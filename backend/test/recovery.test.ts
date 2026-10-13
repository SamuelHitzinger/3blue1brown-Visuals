import { expect, test } from 'bun:test';
import { AgentError } from '../src/agents/config.js';
import { runWithValidationRecovery } from '../src/agents/recovery.js';

test('turn-limit recovery retains the validated candidate and refreshes published asset context', async () => {
  let calls = 0;
  const prompts: string[] = [];
  const output = await runWithValidationRecovery({ async run(task) {
    prompts.push(task.prompt);
    if (++calls === 1) {
      await task.validate!('complete scene using newly published model');
      throw new AgentError('TURN_LIMIT', 'Agent exceeded its turn limit.');
    }
    return 'finished scene';
  } }, { prompt: 'original context', systemPrompt: 'Generate scene', validate: async () => {} }, {
    prompt: () => calls ? 'context with newly published model' : 'original context',
    maxAttempts: 2, wait: async () => {},
  });
  expect(output).toBe('finished scene');
  expect(prompts[1]).toContain('context with newly published model');
  expect(prompts[1]).toContain('complete scene using newly published model');
  expect(prompts[1]).toContain('TURN_LIMIT');
  expect(prompts[1]).not.toContain('Previous rejected output');
});

test('invalid revision remains paired with its feedback across a later empty turn-limit attempt', async () => {
  let calls = 0;
  const prompts: string[] = [];
  await runWithValidationRecovery({ async run(task) {
    prompts.push(task.prompt);
    if (++calls === 1) {
      await task.validate!('valid draft');
      try { await task.validate!('broken revision'); } catch {}
      throw new AgentError('TURN_LIMIT', 'Agent exceeded its turn limit.');
    }
    if (calls === 2) throw new AgentError('TURN_LIMIT', 'Agent exceeded its turn limit.');
    return 'repaired scene';
  } }, { prompt: 'Generate', systemPrompt: 'Scene', validate: async output => {
    if (output === 'broken revision') throw new Error('Label overlaps DNA at 8 seconds');
  } }, { maxAttempts: 3, wait: async () => {} });
  for (const prompt of prompts.slice(1)) {
    expect(prompt).toContain('broken revision');
    expect(prompt).toContain('Label overlaps DNA at 8 seconds');
    expect(prompt).not.toContain('valid draft');
  }
});
