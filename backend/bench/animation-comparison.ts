import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { AgentRunMetrics } from '../src/agents/runtime.js';

interface Run {
  variant: string; topic: string; status: string; revision: string; elapsedMs: number;
  model: string; thinking: string; fixtureHash: string; packageHash: string; planSha256: string;
  audioHashes: Record<string, string>; error?: unknown; sourceHashes: Record<string, string>;
  metrics: { stage: string; promptBytes: number; metrics?: AgentRunMetrics }[];
  scenes: { id: string; source: string; sourceSha256: string; approvedAttempt: number }[];
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
function summary(run: Run) {
  const metrics = run.metrics.flatMap(task => task.metrics ? [task.metrics] : []);
  const turns = metrics.flatMap(value => value.turns);
  return {
    status: run.status, revision: run.revision, elapsedMs: run.elapsedMs, error: run.error,
    modelTasks: run.metrics.length, providerCalls: sum(metrics.map(value => value.providerCalls)),
    outputTokens: sum(turns.map(turn => turn.outputTokens ?? 0)),
    reasoningTokens: sum(turns.map(turn => turn.reasoningTokens ?? 0)),
    uncachedInputTokens: sum(turns.map(turn => turn.inputTokens ?? 0)),
    cacheReadTokens: sum(turns.map(turn => turn.cacheReadTokens ?? 0)),
    invalidSubmissions: sum(metrics.map(value => value.validations.filter(validation => !validation.valid).length)),
    authorPromptBytes: run.metrics.filter(task => task.stage === 'scene').map(task => task.promptBytes),
    firstReviewApprovals: run.scenes.filter(scene => scene.approvedAttempt === 0).length,
    approvedScenes: run.scenes.length,
    scenes: run.scenes.map(scene => {
      const prelude = scene.source.startsWith('const __narration=');
      const authored = prelude ? scene.source.slice(scene.source.indexOf('\n') + 1) : scene.source;
      return { id: scene.id, sourceSha256: scene.sourceSha256, approvedAttempt: scene.approvedAttempt,
        savedBytes: Buffer.byteLength(scene.source), authoredBytes: Buffer.byteLength(authored),
        usesSchedule: /\bs\.schedule\s*\(/.test(authored), usesCompose: /\bs\.compose\s*\(/.test(authored) };
    }),
  };
}

/** Preserve failures and compare only runs whose semantic input and model settings match. */
export async function compareAnimationGenerations(trial: string, topics = ['binary', 'derivative', 'rna']) {
  if (!/^[a-z0-9-]+$/.test(trial) || topics.some(topic => !['binary', 'derivative', 'rna'].includes(topic))) throw new Error('Invalid benchmark trial/topic.');
  const root = resolve(import.meta.dir, '../../data/animation-efficiency/live', trial);
  const pairs = [];
  for (const topic of topics) {
    const read = async (variant: string): Promise<Run> => JSON.parse(await readFile(join(root, topic, variant, 'result.json'), 'utf8'));
    const [baseline, candidate] = await Promise.all([read('baseline'), read('candidate')]);
    if (baseline.variant !== 'baseline' || candidate.variant !== 'candidate' || baseline.topic !== topic || candidate.topic !== topic) throw new Error(`Mislabeled runs: ${topic}`);
    for (const key of ['model', 'thinking', 'fixtureHash', 'packageHash', 'planSha256'] as const) {
      if (baseline[key] !== candidate[key]) throw new Error(`Unmatched ${key}: ${topic}`);
    }
    if (JSON.stringify(baseline.audioHashes) !== JSON.stringify(candidate.audioHashes)) throw new Error(`Unmatched audio: ${topic}`);
    const a = summary(baseline), b = summary(candidate);
    const completed = a.status === 'complete' && b.status === 'complete';
    pairs.push({ topic, matchingInputs: true, baseline: a, candidate: b,
      reduction: completed ? {
        wallTime: 1 - b.elapsedMs / a.elapsedMs,
        outputTokens: a.outputTokens ? 1 - b.outputTokens / a.outputTokens : null,
        authoredBytes: 1 - sum(b.scenes.map(scene => scene.authoredBytes)) / sum(a.scenes.map(scene => scene.authoredBytes)),
      } : null,
      sourceHashes: { baseline: baseline.sourceHashes, candidate: candidate.sourceHashes },
    });
  }
  return { evidenceKind: 'matched-production-generations', trial, pairs,
    limitation: 'One pair per domain is exploratory, with model/provider variance and shared prompt-cache effects. Source bytes exclude the host prelude. Approval is a pipeline outcome, not independent visual-quality proof. Failures are retained, never converted into speedups.' };
}

if (import.meta.main) {
  const report = await compareAnimationGenerations(process.argv[2], process.argv[3]?.split(','));
  const directory = resolve(import.meta.dir, '../../docs/validation/animation-authoring-benchmark');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `live-${report.trial}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.pairs.map(({ topic, baseline, candidate, reduction }) => ({ topic,
    status: [baseline.status, candidate.status], seconds: [baseline.elapsedMs / 1000, candidate.elapsedMs / 1000],
    outputTokens: [baseline.outputTokens, candidate.outputTokens], reduction })), null, 2));
}
