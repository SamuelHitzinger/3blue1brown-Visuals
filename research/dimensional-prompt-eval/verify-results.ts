import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const expectedFragments: Record<string, string[]> = {
  draft: ['guidance.md', 'viewing-mode.md', 'planning-contract.txt', 'animation-quality.md'],
  review: ['story-review.md', 'guidance.md', 'viewing-mode.md', 'planning-contract.txt', 'animation-quality.md'],
  scene: ['viewing-mode.md', 'scene-craft.md', 'animation-quality.md'],
  'visual-review': ['viewing-mode.md', 'scene-craft.md', 'animation-quality.md', 'scene-verify.md'],
  'visual-repair': ['viewing-mode.md', 'scene-craft.md', 'animation-quality.md', 'scene-repair.md'],
};
const results = [];
for (const strategy of ['baseline', 'routing', 'spatial']) for (const caseId of ['sine', 'saddle', 'enzyme']) {
  let summary: any;
  try { summary = JSON.parse(await readFile(join(root, `${strategy}-${caseId}.result.json`), 'utf8')); }
  catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
  const result = JSON.parse(await readFile(join(summary.directory, 'result.json'), 'utf8'));
  const failures: string[] = [];
  const taskChecks = [];
  for (const task of result.tasks) {
    const prefix = join(result.directory, `task-${task.number}-${task.stage}`);
    const metadata = JSON.parse(await readFile(`${prefix}.effective.json`, 'utf8'));
    const system = await readFile(`${prefix}.system.txt`, 'utf8');
    const user = await readFile(`${prefix}.user.txt`, 'utf8');
    const completion = await readFile(`${prefix}.completion.txt`, 'utf8');
    const missing = (expectedFragments[task.stage] ?? []).filter(name => !metadata.matchedFragments[name]);
    if (missing.length) failures.push(`Task ${task.number}: missing ${missing.join(', ')}`);
    if (hash(system) !== metadata.effectiveSystemSha256 || hash(user) !== metadata.userSha256
      || hash(system + completion) !== metadata.effectiveSystemWithCompletionSha256) failures.push(`Task ${task.number}: effective prompt hash mismatch`);
    taskChecks.push({ number: task.number, stage: task.stage, completeCoverage: !missing.length,
      matchedChangedFragments: Object.keys(metadata.matchedFragments).filter(name => result.changedFragments.includes(name)) });
  }
  const sourceChecks = [];
  for (const scene of result.scenes) {
    const source = await readFile(join(result.directory, `scene-${scene.index}.subtitles.js`), 'utf8');
    const review = JSON.parse(await readFile(join(result.directory, `scene-${scene.index}.visual-review.json`), 'utf8'));
    const matches = hash(source) === scene.sourceSha256 && hash(source) === review.sourceSha256;
    if (!matches || !review.approved) failures.push(`Scene ${scene.index}: final source/approval mismatch`);
    sourceChecks.push({ index: scene.index, sourceSha256: hash(source), approvedSourceMatches: matches && review.approved });
  }
  const entry = { strategy, caseId, id: result.id, status: result.status, directory: result.directory,
    auditComplete: result.status !== 'running', auditPassed: result.status === 'running' ? null : failures.length === 0, failures, taskChecks, sourceChecks,
    boundary: 'Prompt coverage and byte provenance, not scientific or visual quality.' };
  results.push(entry);
}
await writeFile(join(root, 'provenance-audit.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.auditPassed === false)) process.exitCode = 1;
