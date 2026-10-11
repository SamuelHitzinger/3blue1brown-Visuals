import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');
const cases = [
  ['baseline', 'sine'], ['baseline', 'enzyme'],
  ['baseline', 'saddle'], ['routing', 'enzyme'],
  ['spatial', 'enzyme'], ['routing', 'sine'],
  ['spatial', 'sine'], ['spatial', 'saddle'], ['routing', 'saddle'],
];
const logDirectory = join(repo, 'data/dimensional-prompt-eval/logs');
await mkdir(logDirectory, { recursive: true });
try { await readFile(join(root, 'matrix-state.json')); throw Error('Existing matrix state must be archived explicitly before starting a fresh matrix.'); }
catch (error: any) { if (error.code !== 'ENOENT') throw error; }
const formalExperiment = JSON.parse(await readFile(join(root, 'formal-experiment.json'), 'utf8'));
const state: any = { formalExperimentId: formalExperiment.id, startedAt: new Date().toISOString(), status: 'running', concurrency: 2,
  runs: cases.map(([strategy, caseId]) => ({ strategy, caseId, status: 'queued' })) };
let writeChain = Promise.resolve();
const save = () => {
  const text = JSON.stringify(state, null, 2);
  writeChain = writeChain.then(() => writeFile(join(root, 'matrix-state.json'), text));
  return writeChain;
};
let cursor = 0;
let blocked = false;
await save();
async function worker() {
  while (!blocked && cursor < state.runs.length) {
    const run = state.runs[cursor++];
    const name = `${run.strategy}-${run.caseId}`;
    run.status = 'running'; run.startedAt = new Date().toISOString();
    run.stdout = join(logDirectory, `${name}.stdout.log`);
    run.stderr = join(logDirectory, `${name}.stderr.log`);
    const stdout = createWriteStream(run.stdout), stderr = createWriteStream(run.stderr);
    const child = spawn(process.execPath, [join(root, 'run.ts'), '--strategy', run.strategy, '--case', run.caseId], {
      cwd: join(repo, 'backend'), env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    run.pid = child.pid;
    child.stdout.pipe(stdout); child.stderr.pipe(stderr);
    await save();
    console.log(JSON.stringify({ event: 'matrix.started', ...run }));
    const code = await new Promise<number | null>(resolve => {
      child.once('error', () => resolve(-1)); child.once('close', resolve);
    });
    run.exitCode = code; run.finishedAt = new Date().toISOString();
    try {
      const result = JSON.parse(await readFile(join(root, `${name}.result.json`), 'utf8'));
      // An earlier infrastructure attempt can leave a convenience summary behind;
      // never treat it as the newly launched process's result.
      if (Date.parse(result.createdAt) < Date.parse(run.startedAt) - 1000) throw Error('Stale result');
      run.status = result.status; run.id = result.id; run.directory = result.directory;
      run.elapsedMs = result.elapsedMs; run.effort = result.effort; run.error = result.error; run.failureKind = result.failureKind;
      if (['model-infrastructure', 'render-infrastructure', 'provenance-interference'].includes(result.failureKind)) {
        blocked = true; state.blockedBy = name; state.status = 'blocked';
      }
    } catch {
      run.status = 'infrastructure-failed'; blocked = true; state.blockedBy = name; state.status = 'blocked';
    }
    await save();
    console.log(JSON.stringify({ event: 'matrix.finished', ...run }));
  }
}
await Promise.all([worker(), worker()]);
if (!blocked) state.status = 'complete';
state.finishedAt = new Date().toISOString();
await save();
console.log(JSON.stringify({ event: 'matrix.done', status: state.status, completed: state.runs.filter((run: any) => run.status === 'complete').length }));
if (blocked) process.exitCode = 1;
