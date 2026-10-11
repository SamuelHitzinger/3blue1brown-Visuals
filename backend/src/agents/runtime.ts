import { createAgentUsageObserver } from '../token-usage.js';
import { createAgentSession, DefaultResourceLoader, defineTool, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { ModelRuntime, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage, ImageContent } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { createModelRuntime } from "./auth.js";
import { agentConfig, AgentError, agentFailure } from "./config.js";
import type { AgentConfig } from "./config.js";
import { SceneCompileError } from 'animlib/core';
import { setTimeout as delay } from 'node:timers/promises';
import { logEvent } from '../logging.js';
import type { LogFields } from '../logging.js';
import { fileURLToPath } from 'node:url';
import type { InspectionOptions, InspectionReport, PreviewOptions } from './scene-inspection.js';
import type { PreviewFrame } from './scene-preview.js';

const webAccessExtension = fileURLToPath(import.meta.resolve('pi-web-access/dist/index.js'));

export function validationMessage(error: unknown): string {
  if (error instanceof SceneCompileError) {
    const d = error.diagnostic;
    return `${d.code}${d.line !== undefined ? ` at line ${d.line}${d.column !== undefined ? `:${d.column}` : ''}` : ''}: ${d.message}${d.hint ? `\nHint: ${d.hint}` : ''}`;
  }
  return error instanceof Error ? error.message : 'Invalid output.';
}

export interface AgentTurnMetrics {
  index: number;
  elapsedMs: number;
  providerMs: number;
  stopReason: AssistantMessage['stopReason'];
  inputTokens: number;
  outputTokens: number;
  /** A subset of outputTokens; undefined when the provider does not report it. */
  reasoningTokens?: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  textChars: number;
  toolArgumentChars: number;
}
export interface AgentValidationMetrics { kind: 'tool' | 'final'; elapsedMs: number; valid: boolean }
export interface AgentRunMetrics {
  elapsedMs: number;
  /** Logical provider stream calls, not transport retries or HTTP requests. */
  providerCalls: number;
  turns: AgentTurnMetrics[];
  validations: AgentValidationMetrics[];
}
export interface AgentTask {
  /** Host-owned asset publication, scoped to this generation job. */
  publishModel?: (input: { url?: string; generated?: string; license?: string; attribution?: string }, signal: AbortSignal) => Promise<unknown>;
  systemPrompt: string;
  prompt: string;
  validate?: (output: string) => Promise<void>;
  signal?: AbortSignal;
  images?: ImageContent[];
  logContext?: Pick<LogFields, 'videoId' | 'stage' | 'sceneIndex'>;
  outputMode?: 'text' | 'validated-reference' | 'submit' | 'submit-only';
  /** Scene-only, nonterminal tools. Sources still pass the authoritative validator. */
  sceneTools?: {
    inspect(output: string, options: InspectionOptions, signal: AbortSignal): Promise<InspectionReport>;
    preview?: (output: string, options: PreviewOptions, signal: AbortSignal) => Promise<PreviewFrame[]>;
  };
  /** Called once on success or failure; carries no prompt, source, credentials, or error text. */
  onMetrics?: (metrics: AgentRunMetrics) => void;
}
export const AGENT_COMPLETION_INSTRUCTIONS: Record<NonNullable<AgentTask['outputMode']>, string> = {
  text: '',
  'validated-reference': '\n\nOutput completion protocol: validate_output stores each valid complete output and returns its candidateId. You may review and revise it further. When finished, return only {"candidateId":"the chosen validated candidate ID"}. Do not repeat the source in your final response. This replaces earlier final-output formatting instructions only.',
  submit: '\n\nOutput completion protocol: validate_output is an optional nonterminal check. When your complete output is ready as your final answer, call submit_output with it, as the only tool call in that turn. A successful submission ends the task; errors are returned for repair. Do not submit a draft or repeat the source afterward. This replaces earlier final-output formatting and mandatory validate_output instructions only; all content and quality requirements still apply.',
  'submit-only': '\n\nOutput completion protocol: submit_output is the only output validation tool. Web research tools are available for gathering evidence before submission. submit_output validates your complete final output and finishes the task on success. If validation fails, it returns errors so you can repair and resubmit. When satisfied with correctness and explanatory quality, call submit_output with the complete final output as the only tool call in that turn. Do not submit a draft or repeat the source afterward. This replaces earlier final-output formatting and mandatory validate_output instructions only; all content and quality requirements still apply.',
};
export interface AgentRunner { run(task: AgentTask): Promise<string> }

/** One credential runtime, a fresh conversation for every script or scene. */
export class PiAgentRunner implements AgentRunner {
  private runtime?: Promise<ModelRuntime>;
  constructor(readonly config: AgentConfig = agentConfig(), private runtimeFactory = () => createModelRuntime(config),
    private wait: (ms: number, signal?: AbortSignal) => Promise<void> = async (ms, signal) => { await delay(ms, undefined, { signal }); }) {}

  async run(task: AgentTask): Promise<string> {
    const started = performance.now();
    const metrics: AgentRunMetrics = { elapsedMs: 0, providerCalls: 0, turns: [], validations: [] };
    const sceneBudget = { inspections: 0, previews: 0 };
    try {
      const agentRunId = crypto.randomUUID();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await this.runAttempt(task, metrics, sceneBudget);
          if (attempt > 1) logEvent('agent.recovered', { ...task.logContext, agentRunId, providerAttempt: attempt });
          return result;
        } catch (error) {
          const failure = agentFailure(error);
          const retry = failure.diagnostics.retryable === true && attempt < 3 && !task.signal?.aborted;
          const retryDelayMs = retry ? 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250) : undefined;
          logEvent(retry ? 'agent.retrying' : 'agent.failed', { ...task.logContext, agentRunId, providerAttempt: attempt,
            code: failure.code, ...failure.diagnostics, retryDelayMs }, retry ? 'warn' : 'error');
          if (!retry) throw failure;
          try { await this.wait(retryDelayMs!, task.signal); }
          catch (error) {
            if (task.signal?.aborted) throw task.signal.reason instanceof AgentError ? task.signal.reason : new AgentError('ABORTED', 'Agent generation was cancelled.');
            throw agentFailure(error);
          }
        }
      }
      throw new AgentError('PROVIDER', 'Agent retry attempts exhausted.');
    } finally {
      metrics.elapsedMs = performance.now() - started;
      try { task.onMetrics?.(metrics); } catch { /* Metrics sinks cannot alter generation outcomes. */ }
    }
  }

  /** Recreate the conversation so failed partial output never enters a retry. */
  private async runAttempt(task: AgentTask, metrics: AgentRunMetrics, sceneBudget: { inspections: number; previews: number }): Promise<string> {
    const mode = task.outputMode ?? 'text';
    const isSubmission = mode === 'submit' || mode === 'submit-only';
    const controller = new AbortController();
    const signal = task.signal ? AbortSignal.any([task.signal, controller.signal]) : controller.signal;
    let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
    const usage = createAgentUsageObserver();
    const abort = () => { void session?.abort(); };
    signal.addEventListener("abort", abort, { once: true });
    const validate = async (output: string, kind: AgentValidationMetrics['kind']) => {
      if (!task.validate) return;
      const validationStarted = performance.now();
      let valid = false;
      try { await task.validate(output); valid = true; }
      finally { metrics.validations.push({ kind, elapsedMs: performance.now() - validationStarted, valid }); }
    };
    try {
      signal.throwIfAborted();
      if (mode !== 'text' && !task.validate) throw new AgentError('CONFIG', 'Validated completion modes require a host validator.');
      const runtime = await (this.runtime ??= this.runtimeFactory().catch(error => { this.runtime = undefined; throw error; }));
      const auth = await runtime.getAuth(this.config.provider, { signal });
      if (!auth) throw new AgentError("AUTH", "Agent login is missing. Run agents:login.");
      const model = runtime.getModel(this.config.provider, this.config.model);
      if (!model) throw new AgentError("MODEL", "AGENT_MODEL is not in the pinned Pi model catalog.");
      const completion = AGENT_COMPLETION_INSTRUCTIONS[mode] + (task.sceneTools && mode === 'validated-reference'
        ? '\nYou may also select a candidateId returned by inspect_scene or preview_scene; both run the same host validation before inspection. No extra validate_output call is needed for that candidate.' : '');
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0 } } });
      const resourceLoader = new DefaultResourceLoader({ cwd: this.config.agentDir, agentDir: this.config.agentDir, settingsManager,
        additionalExtensionPaths: [webAccessExtension],
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        systemPrompt: task.systemPrompt + completion, appendSystemPromptOverride: () => [] });
      await resourceLoader.reload();
      const webExtensions = resourceLoader.getExtensions();
      if (webExtensions.errors.length) throw new AgentError('CONFIG', 'Could not load pi-web-access. Check the installed package and web-search.json configuration.');
      const webTools = webExtensions.extensions.flatMap(extension => [...extension.tools.keys()]);
      const candidates = new Map<string, string>();
      const remember = (output: string) => {
        for (const [id, source] of candidates) if (source === output) return id;
        if (candidates.size >= 12) throw new Error('Candidate limit reached. Select or inspect an existing candidate.');
        const id = `candidate-${candidates.size + 1}`;
        candidates.set(id, output);
        return id;
      };
      const submissions = new Map<string, string>();
      let currentAssistant: AssistantMessage | undefined;
      const validationTool = defineTool({ name: "validate_output", label: "Validate output",
        description: mode === 'text' ? "Validate your complete proposed output. Fix any reported errors before returning it as your final answer."
          : 'Validate your complete proposed output. This check does not finish the task; you may revise the output afterward.',
        parameters: Type.Object({ output: Type.String({ maxLength: 256000 }) }),
        async execute(_id, { output }) {
          try {
            if (mode !== 'text' && !output.trim()) throw new Error('Output must not be empty.');
            await validate(output, 'tool');
            if (mode === 'validated-reference' || task.sceneTools) {
              signal.throwIfAborted();
              const candidateId = remember(output);
              return { content: [{ type: 'text', text: JSON.stringify({ valid: true, candidateId }) }], details: {} };
            }
            return { content: [{ type: "text", text: "Valid." }], details: {} };
          }
          catch (error) { return { content: [{ type: "text", text: validationMessage(error) }], details: {}, ...(mode === 'text' ? {} : { isError: true }) }; }
        },
      });
      const submissionTool = defineTool({ name: 'submit_output', label: 'Submit final output',
        description: 'Submit your complete final output. On successful host validation this ends the task. Use only when satisfied with its correctness and explanatory quality. Call alone, with no other tool calls in the turn. Failed validation returns diagnostics so you can repair and resubmit.',
        parameters: Type.Object({ output: Type.String({ maxLength: 256000 }) }),
        async execute(id, { output }) {
          try {
            signal.throwIfAborted();
            if (currentAssistant?.content.filter(block => block.type === 'toolCall').length !== 1) throw new Error('Call submit_output alone to select one unambiguous final output.');
            if (!output.trim()) throw new Error('Output must not be empty.');
            await validate(output, 'tool');
            signal.throwIfAborted();
            submissions.set(id, output);
            return { content: [{ type: 'text', text: 'Final output accepted.' }], details: {}, terminate: true };
          } catch (error) { return { content: [{ type: 'text', text: validationMessage(error) }], details: {}, isError: true }; }
        },
      });
      const modelTools = task.publishModel ? [defineTool({
        name: 'publish_model', label: 'Publish 3D model',
        description: 'Publish a self-contained static GLB from a public HTTPS URL, or generate a GLB from JSON geometry. Provide exactly one of url or generated. Generated JSON: {parts:[{name,vertices:[[x,y,z]],triangles:[[a,b,c]],uv?:[[u,v]],position?:[x,y,z],baseColor?:[r,g,b,a],metalness?:number,roughness?:number,unlit?:boolean,texture?:{base64:string,mime:"image/png"|"image/jpeg"}}]}. Returns a stable asset ID, bounds, named part IDs and material inventory. Use that ID with s.model; never put binary data in scene source. Preserve source attribution/license for downloaded assets.',
        parameters: Type.Object({ url: Type.Optional(Type.String({maxLength:4096})), generated: Type.Optional(Type.String({maxLength:1000000})), license: Type.Optional(Type.String({maxLength:2000})), attribution: Type.Optional(Type.String({maxLength:2000})) }),
        async execute(_id, input) {
          try {const result=await task.publishModel!(input,signal);return {content:[{type:'text' as const,text:JSON.stringify(result)}],details:{}};}
          catch(error){return {content:[{type:'text' as const,text:validationMessage(error)}],details:{},isError:true};}
        },
      })] : [];
      const customTools: ToolDefinition[] =
        [...modelTools, ...(task.validate ? [...(mode === 'submit-only' ? [] : [validationTool]), ...(isSubmission ? [submissionTool] : [])] : [])];
      if (task.sceneTools) {
        if (!task.validate) throw new AgentError('CONFIG', 'Scene inspection requires a host validator.');
        const select = async ({ output, candidateId }: { output?: string; candidateId?: string }) => {
          signal.throwIfAborted();
          if ((output === undefined) === (candidateId === undefined)) throw new Error('Provide exactly one of output or candidateId.');
          if (candidateId !== undefined) {
            const source = candidates.get(candidateId);
            if (source === undefined) throw new Error('Unknown candidateId. Use the ID returned by validate_output or inspect_scene.');
            return { output: source, candidateId };
          }
          if (!output?.trim()) throw new Error('Output must not be empty.');
          await validate(output, 'tool');
          return { output, candidateId: remember(output) };
        };
        const selector = {
          candidateId: Type.Optional(Type.String({ maxLength: 64 })),
          output: Type.Optional(Type.String({ maxLength: 256000 })),
        };
        customTools.push(defineTool({ name: 'inspect_scene', label: 'Inspect scene layout',
          description: 'Inspect a complete scene before final submission. Pass output once or reuse a candidateId. Returns sampled advisory text collisions, framing, small-text warnings, and optional object bounds at 960×540. At most four inspections per run, including retries; does not finish the task.',
          parameters: Type.Object({ ...selector,
            times: Type.Optional(Type.Array(Type.Number({ minimum: 0 }), { minItems: 1, maxItems: 24 })),
            objectIds: Type.Optional(Type.Array(Type.String({ maxLength: 256 }), { maxItems: 20 })),
            includeAnimating: Type.Optional(Type.Boolean()),
          }),
          async execute(_id, args) {
            try {
              if (sceneBudget.inspections++ >= 4) throw new Error('Scene inspection budget exhausted (four calls). Finish using the available feedback.');
              const candidate = await select(args);
              const report = await task.sceneTools!.inspect(candidate.output, args, signal);
              return { content: [{ type: 'text', text: JSON.stringify({ candidateId: candidate.candidateId, ...report }) }], details: {} };
            } catch (error) { return { content: [{ type: 'text', text: validationMessage(error) }], details: {}, isError: true }; }
          },
        }));
        if (task.sceneTools.preview) customTools.push(defineTool({ name: 'preview_scene', label: 'Preview scene frames',
          description: 'Render 1–6 scene frames with the production WebGL2 renderer on CPU, before final submission. Reuse candidateId or provide complete output. Optional local times and focusObjectId for a crop. At most two batches per run, including retries; use the second to verify a repair. Still frames cannot verify continuous motion or audio sync.',
          parameters: Type.Object({ ...selector,
            times: Type.Optional(Type.Array(Type.Number({ minimum: 0 }), { minItems: 1, maxItems: 6 })),
            focusObjectId: Type.Optional(Type.String({ maxLength: 256 })),
          }),
          async execute(_id, args) {
            try {
              if (sceneBudget.previews++ >= 2) throw new Error('Scene preview budget exhausted (two batches). Finish using the available feedback.');
              const candidate = await select(args);
              const frames = await task.sceneTools!.preview!(candidate.output, args, signal);
              return { content: [
                { type: 'text' as const, text: JSON.stringify({ candidateId: candidate.candidateId, viewport: { width: 960, height: 540 },
                  times: frames.map(f => f.time), focusObjectId: args.focusObjectId, remainingPreviews: 2 - sceneBudget.previews }) },
                ...frames.flatMap(frame => [{ type: 'text' as const, text: `Local time: ${frame.time}s` }, frame.image]),
              ], details: {} };
            } catch (error) { return { content: [{ type: 'text', text: validationMessage(error) }], details: {}, isError: true }; }
          },
        }));
      }
      ({ session } = await createAgentSession({ modelRuntime: runtime, model, thinkingLevel: this.config.thinking,
        cwd: this.config.agentDir, agentDir: this.config.agentDir, settingsManager, resourceLoader,
        sessionManager: SessionManager.inMemory(), tools: [...customTools.map(tool => tool.name), ...webTools], customTools }));
      await session.bindExtensions({ mode: 'print' });
      signal.throwIfAborted();
      session.subscribe(usage);
      let turns = 0, turnStarted = 0, providerMs = 0;
      let providerStarted: number | undefined;
      const stream = session.agent.streamFunction;
      session.agent.streamFunction = async (...args) => {
        metrics.providerCalls++;
        providerStarted = performance.now();
        usage.startRequest(args[0].maxTokens, signal);
        try { return await stream(...args); }
        catch (error) { usage.stopRequest(); throw error; }
      };
      session.subscribe(event => {
        if (event.type === 'turn_start') {
          turnStarted = performance.now(); providerStarted = undefined; providerMs = 0;
          if (++turns > 12) controller.abort(new AgentError('TURN_LIMIT', 'Agent exceeded its turn limit.'));
        }
        if (event.type === 'message_end' && event.message.role === 'assistant') {
          currentAssistant = event.message;
          providerMs = providerStarted === undefined ? 0 : performance.now() - providerStarted;
        }
        if (event.type === 'turn_end' && event.message.role === 'assistant') {
          const { usage, content, stopReason } = event.message;
          metrics.turns.push({ index: metrics.turns.length + 1, elapsedMs: performance.now() - turnStarted, providerMs, stopReason,
            inputTokens: usage.input, outputTokens: usage.output, reasoningTokens: usage.reasoning,
            cacheReadTokens: usage.cacheRead, cacheWriteTokens: usage.cacheWrite,
            textChars: content.reduce((total, block) => total + (block.type === 'text' ? block.text.length : 0), 0),
            toolArgumentChars: content.reduce((total, block) => total + (block.type === 'toolCall' ? JSON.stringify(block.arguments).length : 0), 0) });
        }
      });
      let prompt = task.prompt;
      for (let attempt = 0; attempt < 3; attempt++) {
        await session.prompt(prompt, attempt === 0 ? { images: task.images } : undefined);
        signal.throwIfAborted();
        const last = [...session.messages].reverse().find(message => message.role === "assistant");
        if (last?.stopReason === 'aborted') throw new AgentError('ABORTED', 'Agent generation was cancelled.');
        if (last?.stopReason === 'length') throw new AgentError('OUTPUT', 'The agent response exceeded the model output limit.');
        if (!last || (last.stopReason !== 'stop' && !(isSubmission && last.stopReason === 'toolUse'))) throw agentFailure(new Error(last?.errorMessage ?? "Incomplete model response"));
        const text = session.getLastAssistantText()?.trim();
        if (mode === 'text' && (!text || text.length > 256000)) throw new AgentError('OUTPUT', 'The agent returned an empty or oversized result.');
        try {
          let output = text!;
          if (mode === 'validated-reference') {
            let reference: unknown;
            try { reference = JSON.parse(text ?? ''); } catch { throw new Error('Return only JSON with candidateId from successful validate_output.'); }
            const id = reference && typeof reference === 'object' && Object.keys(reference).length === 1 && 'candidateId' in reference ? reference.candidateId : undefined;
            if (typeof id !== 'string' || !candidates.has(id)) throw new Error('Select a candidateId returned by successful validate_output.');
            output = candidates.get(id)!;
          } else if (isSubmission) {
            const calls = last.content.filter(block => block.type === 'toolCall');
            const call = calls.length === 1 ? calls[0] : undefined;
            if (!call || call.name !== 'submit_output' || !submissions.has(call.id)) throw new Error('Finish by calling submit_output alone with your complete final output.');
            output = submissions.get(call.id)!;
          }
          await validate(output, 'final');
          if (mode !== 'text') signal.throwIfAborted();
          return output;
        } catch (error) {
          signal.throwIfAborted();
          if (attempt === 2) throw new AgentError('VALIDATION', 'The agent could not produce valid output after three attempts.');
          const finish = mode === 'text' ? 'Return the complete corrected output.' : mode === 'validated-reference'
            ? 'Validate the complete corrected output, then return only JSON with its candidateId.'
            : 'Call submit_output alone with the complete corrected final output.';
          prompt = `Correct only the reported problems in the previous output. Validation failed: ${validationMessage(error)}. Preserve the task's facts, IDs, inherited state, and timing. ${finish}`;
        }
      }
      throw new AgentError("OUTPUT", "The agent did not complete.");
    } catch (error) {
      if (signal.aborted) throw signal.reason instanceof AgentError ? signal.reason : new AgentError("ABORTED", "Agent generation was cancelled.");
      throw agentFailure(error);
    } finally {
      usage.dispose();
      signal.removeEventListener("abort", abort);
      try { await session?.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }); }
      finally { session?.dispose(); }
    }
  }
}
