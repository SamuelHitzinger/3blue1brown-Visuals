import { setTimeout as delay } from 'node:timers/promises';
import { AgentError } from './config.js';
import { validationMessage } from './runtime.js';
import type { AgentRunner, AgentTask } from './runtime.js';
import { atomicWrite } from '../narration/service.js';
import { logEvent } from '../logging.js';

export const MAX_REVIEW_ROUNDS = 50;

export const waitForRecovery = async (ms: number, signal: AbortSignal) => {
  await delay(ms, undefined, { signal });
};

export function recoveryDelay(attempt: number, code?: string): number {
  const base = ['AUTH', 'CONFIG', 'MODEL', 'LIMIT', 'QUOTA', 'PROVIDER_AUTH', 'NOT_CONFIGURED'].includes(code ?? '') ? 60_000 : 5_000;
  return Math.min(300_000, base * 2 ** Math.min(Math.max(0, attempt - 1), 6));
}

/** A fresh bounded model conversation can fail without discarding the host's task.
 * Infrastructure failures bubble to the durable job retry loop. Invalid output is
 * retried here with its actual validation feedback, never a provider's raw error.
 */
export async function runWithValidationRecovery(runner: AgentRunner, task: AgentTask, options: {
  diagnosticsPath?: string;
  maxAttempts?: number;
  wait?: typeof waitForRecovery;
} = {}): Promise<string> {
  const signal = task.signal ?? new AbortController().signal;
  let feedback = '', rejectedOutput = '';
  const diagnostics: { attempt: number; code: string; detail: string }[] = [];
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted();
    let validationFailed = false;
    const validate = async (output: string) => {
      try { await task.validate?.(output); }
      catch (error) {
        signal.throwIfAborted();
        validationFailed = true;
        feedback = validationMessage(error).slice(0, 8000);
        rejectedOutput = output.slice(0, 256000);
        throw error;
      }
    };
    try {
      const output = await runner.run({ ...task, signal, validate: task.validate ? validate : undefined,
        prompt: task.prompt + (attempt > 1 ? `\n\nThe previous attempt did not finish with valid output. Correct the following problem, preserve the task's facts and constraints, and return a complete result.\n${feedback}\n${rejectedOutput ? `Previous rejected output:\n${rejectedOutput}` : 'Keep the output concise enough to finish within one response.'}` : ''),
      });
      signal.throwIfAborted();
      // Also enforce validation for injected runners and alternate completion paths.
      if (task.validate) await validate(output);
      return output;
    } catch (error) {
      signal.throwIfAborted();
      const code = error instanceof AgentError ? error.code : 'VALIDATION';
      if (error instanceof AgentError ? !['VALIDATION', 'OUTPUT', 'TURN_LIMIT'].includes(code) : !validationFailed) throw error;
      if (!validationFailed) { feedback = `The previous response reached ${code}. Produce a concise, complete result.`; rejectedOutput = ''; }
      diagnostics.push({ attempt, code, detail: feedback });
      if (diagnostics.length > 20) diagnostics.shift();
      if (options.diagnosticsPath) await atomicWrite(options.diagnosticsPath, JSON.stringify(diagnostics.slice(-20), null, 2));
      if (attempt >= (options.maxAttempts ?? MAX_REVIEW_ROUNDS)) throw new AgentError(options.maxAttempts ? 'VALIDATION' : 'RECOVERY_EXHAUSTED', feedback);
      logEvent('agent.validation_retrying', { ...task.logContext, attempt, code }, 'warn');
      await (options.wait ?? waitForRecovery)(Math.min(30_000, 1000 * attempt), signal);
    }
  }
}
