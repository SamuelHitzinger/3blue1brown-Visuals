/** Re-run a saved original candidate through the production gate, without new authoring/TTS. */
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { compileSource, evaluateScene } from 'animlib/core';
import { agentConfig } from '../src/agents/config.js';
import { PiAgentRunner } from '../src/agents/runtime.js';
import { reviewGeneratedScene } from '../src/agents/visual-gate.js';
import { sourceHash } from '../src/agents/visual-edits.js';
import { validateSceneQuality } from '../src/agents/scene-quality.js';
import { validateScenePlan } from '../src/agents/scene-plan.js';
import type { SceneVerificationInput } from '../src/agents/visual-gate.js';
import { atomicWrite } from '../src/narration/service.js';

const original = resolve(process.argv[2] ?? '');
const index = Number(process.argv[3]);
if (!process.argv[2] || !Number.isInteger(index) || index < 0 || index > 99) throw new Error('Pass saved job directory and scene index.');
const config = agentConfig(), videoId = randomUUID();
const directory = resolve('../data/visual-speed', videoId);
await mkdir(directory, { recursive: true });
const input: SceneVerificationInput = JSON.parse(await readFile(join(original, `scene-${index}.input.json`), 'utf8'));
const source = await readFile(join(original, `scene-${index}.visual/0/candidate.js`), 'utf8');
const author = await readFile(join(original, `scene-${index}.prompt.md`), 'utf8');
const split = author.lastIndexOf('\n\nGenerate this scene using the authoritative narration packet and lesson plan:');
if (split < 0) throw new Error('Saved author prompt boundary missing.');
const signal = new AbortController().signal;
const started = performance.now();
const result = { original, index, videoId, directory, model: config.model, thinking: config.thinking,
  originalSourceSha256: sourceHash(source), finalSourceSha256: '', elapsedMs: 0, status: 'running', error: '' };
console.log(JSON.stringify(result));
try {
  const output = await reviewGeneratedScene({ runner: new PiAgentRunner(config), source, input,
    task: { systemPrompt: author.slice(0, split), prompt: author.slice(split + 2) }, directory, index, videoId, signal,
    validate: async candidate => {
      const compiled = await compileSource(candidate, { previous: input.previousFrame });
      if (compiled.options.audio !== input.audioAssetId || compiled.options.end !== input.endMode
        || Math.abs(compiled.duration - input.scene.durationSec) > 1e-6) throw new Error('Narration identity or duration changed.');
      if (input.planning.current) validateScenePlan(compiled, evaluateScene(compiled, compiled.duration), input.planning.current);
      validateSceneQuality(compiled);
    },
  });
  await atomicWrite(join(directory, `scene-${index}.js`), output);
  result.finalSourceSha256 = sourceHash(output); result.status = 'complete';
} catch (error) {
  result.status = 'failed'; result.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  result.elapsedMs = performance.now() - started;
  await atomicWrite(join(directory, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
