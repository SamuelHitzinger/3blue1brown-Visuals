import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');
const args = process.argv.slice(2);
const option = (name: string) => { const i=args.indexOf(name); if(i<0 || !args[i+1])throw Error('Required '+name); return resolve(args[i+1]); };
const manifestPath=option('--manifest'), casesPath=option('--cases');
const formalExperiment=JSON.parse(await readFile(manifestPath,'utf8'));
if(formalExperiment.status!=='frozen' || formalExperiment.phase!=='construction-enzyme')throw Error('Expected reviewed frozen phase manifest.');
if(resolve(formalExperiment.checkoutPath)!==repo || formalExperiment.maximumConcurrency!==2)throw Error('Phase checkout/concurrency mismatch.');
const priorMatrix=JSON.parse(await readFile(join(root,'matrix-state.json'),'utf8'));
if(priorMatrix.formalExperimentId!==formalExperiment.priorExperimentId || priorMatrix.status!=='complete' || priorMatrix.runs.length!==9 || priorMatrix.runs.some((run:any)=>['running','queued'].includes(run.status)))throw Error('Phase 1 must finish before phase 2 inference.');
const phaseDirectory=join(root,'phases',formalExperiment.id);
const logDirectory=join(repo,'data/dimensional-prompt-eval/phases',formalExperiment.id,'logs');
await mkdir(logDirectory,{recursive:true}); await mkdir(phaseDirectory,{recursive:true});
const statePath=join(phaseDirectory,'matrix-state.json');
await writeFile(statePath,JSON.stringify({status:'reserved'}),{flag:'wx'});
const state:any={formalExperimentId:formalExperiment.id,startedAt:new Date().toISOString(),status:'running',concurrency:2,
  runs:formalExperiment.arms.map((arm:any)=>({...arm,status:'queued'}))};
let writeChain = Promise.resolve();
const save = () => {
  const text = JSON.stringify(state, null, 2);
  writeChain = writeChain.then(() => writeFile(statePath, text));
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
    const child = spawn(process.execPath, [join(root, 'phase-run.ts'), '--manifest', manifestPath, '--cases', casesPath, '--strategy', run.strategy, '--case', run.caseId, '--construction-mode', run.constructionMode], {
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
      const result = JSON.parse(await readFile(join(phaseDirectory, `${name}.result.json`), 'utf8'));
      // An earlier infrastructure attempt can leave a convenience summary behind;
      // never treat it as the newly launched process's result.
      if (result.formalExperimentId !== formalExperiment.id || Date.parse(result.createdAt) < Date.parse(run.startedAt) - 1000) throw Error('Stale result');
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
