/** Reproducible local gates. Live generation is a separate, explicit experiment. */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runAuthoringEfficiencyBenchmark } from './authoring-efficiency.js';
import { runResourceEfficiencyBenchmark } from './resource-efficiency.js';
import { runReviewEfficiencyBenchmark } from './review-efficiency.js';
import { runPromptEfficiencyBenchmark } from './prompt-efficiency.js';

export async function runAnimationEfficiencyBenchmark(directory: string, native = false) {
  const root = resolve(directory);
  const resultPath = join(root, 'result.json');
  try { await access(resultPath); throw new Error('Benchmark result exists; choose a new output directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(root, { recursive: true });
  const started = performance.now();
  // Sequential timing avoids competing benchmark workloads on the same host.
  const authoring = await runAuthoringEfficiencyBenchmark();
  await writeFile(join(root, 'authoring.json'), JSON.stringify(authoring, null, 2));
  const resources = await runResourceEfficiencyBenchmark();
  await writeFile(join(root, 'resources.json'), JSON.stringify(resources, null, 2));
  const review = await runReviewEfficiencyBenchmark({ directory: join(root, 'review'), native });
  const prompts = await runPromptEfficiencyBenchmark();
  await writeFile(join(root, 'prompts.json'), JSON.stringify(prompts, null, 2));
  const cases = Object.fromEntries(review.gateCases.map(result => [result.name, result]));
  const gates = {
    authoring: authoring.allEquivalent && authoring.meetsBoilerplateTarget,
    resources: resources.retrieval.falselyCompatible === 0 && resources.retrieval.top3 === resources.retrieval.supportedCases,
    evidence: review.sampling.every(result => result.candidate.interiorCovered),
    reviewBudget: cases.clean.status === 'approved' && cases.clean.reviews === 1 && cases.clean.repairs === 0
      && cases['one-repair'].status === 'approved' && cases['one-repair'].reviews === 2 && cases['one-repair'].repairs === 1
      && cases.rejected.status === 'rejected' && cases.rejected.reviews === 2 && cases.rejected.repairs === 1
      && cases['malformed-protocol'].status === 'rejected' && cases['malformed-protocol'].reviews === 2 && cases['malformed-protocol'].repairs === 0,
    prompts: prompts.targetPassed,
  };
  const report = { schemaVersion: 1, evidenceKind: 'deterministic-host-gates',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
    completedAt: new Date().toISOString(), elapsedMs: performance.now() - started, nativeRendered: native,
    gates, passed: Object.values(gates).every(Boolean),
    summary: {
      authoring: authoring.results.map(({ id, boilerplateReduction, sourceBytes, equivalent }) => ({ id, boilerplateReduction, sourceBytes, equivalent })),
      retrieval: { top1: resources.retrieval.top1, top3: resources.retrieval.top3, supported: resources.retrieval.supportedCases, falselyCompatible: resources.retrieval.falselyCompatible },
      preparation: resources.preparation, prompts: prompts.cases,
      review: { sampling: review.sampling.map(({ id, baseline, candidate }) => ({ id, baselineInterior: baseline.interiorCovered, candidateInterior: candidate.interiorCovered, samples: candidate.samples.length })), gateCases: review.gateCases },
    },
    limitation: 'These gates do not establish generation speed, acoustic alignment, real-model defect detection or visual quality. Run matched live generations and inspect native renders separately.',
  };
  await writeFile(resultPath, JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.main) {
  const directory = process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length);
  if (!directory) throw new Error('Supply --output=PATH. Optional --native renders review evidence.');
  const report = await runAnimationEfficiencyBenchmark(directory, process.argv.includes('--native'));
  console.log(JSON.stringify({ passed: report.passed, gates: report.gates, elapsedMs: report.elapsedMs, directory }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
