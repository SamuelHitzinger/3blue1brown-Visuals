/** Local overhead only. No model calls, media ingestion or production edits.
 * Run: node_modules/.bin/bun.cmd backend/bench/realtime-runtime-probe.ts [--render]
 * SourceCompiler's real QuickJS fallback is selected explicitly: Bun's worker
 * is not a browser worker. Process-cold runs each use a fresh subprocess.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SourceCompiler } from '../../shared/animlib/src/compiler-client.js';
import { SceneSequence } from '../../shared/animlib/src/sequence.js';
import { evaluateScene } from '../../shared/animlib/src/timeline.js';
import { mergeReactiveUpdates } from '../../shared/animlib/src/reactive.js';
import { fixtures, target, verifyChanged, verifyFixture } from './realtime-runtime/fixtures.js';
import type { Fixture } from './realtime-runtime/fixtures.js';

Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined });
const samples = 12, updateSamples = 30;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const summarize = (values: number[]) => {
  const sorted = [...values].sort((a,b) => a-b);
  return { n: values.length, minMs: sorted[0], medianMs: sorted[Math.floor(sorted.length/2)],
    p95Ms: sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*.95)-1)], maxMs: sorted.at(-1),
    meanMs: values.reduce((sum,value)=>sum+value,0)/values.length, samplesMs: values };
};
async function timed<T>(work: () => Promise<T>) {
  const start = performance.now(), result = await work();
  return { ms: performance.now()-start, result };
}

async function measureFixture(fixture: Fixture) {
  const compiler = new SourceCompiler(), sequence = new SceneSequence();
  try {
    const first = await timed(() => compiler.compile(fixture.source));
    verifyFixture(fixture, evaluateScene(first.result, 0));
    const warm: number[] = [];
    let compiled = first.result;
    for (let i=0;i<samples;i++) {
      const run = await timed(() => compiler.compile(fixture.source));
      warm.push(run.ms); compiled = run.result; compiler.retain([compiled]);
    }
    const before = evaluateScene(compiled, 0), directUpdate: number[] = [];
    for (let i=0;i<updateSamples;i++) {
      const run = await timed(() => compiler.update(compiled, { gain: i%2 ? .75 : 1.5 }, ['gain']));
      directUpdate.push(run.ms);
      const snapshot = { ...compiled, reactiveBindings: mergeReactiveUpdates(compiled,run.result,['gain']) };
      verifyChanged(fixture,before,evaluateScene(snapshot,0));
    }
    const frames: number[] = [];
    for (let i=0;i<300;i++) {
      const start = performance.now(); const frame = evaluateScene(compiled,(i%240)/60);
      frames.push(performance.now()-start); assert(frame.elements.length>0);
    }
    const motionId = fixture.id === 'cube' ? 'body' : 'marker';
    assert.notDeepEqual(target(evaluateScene(compiled,0),motionId).position,
      target(evaluateScene(compiled,2),motionId).position,'Timeline must actually animate geometry');
    const load = await timed(() => sequence.submit({type:'load',scenes:[{id:'root',source:fixture.source}]}));
    assert(load.result.ok,JSON.stringify(load.result));
    const sequenceUpdate: number[] = [];
    for (let i=0;i<updateSamples;i++) {
      const prev = sequence.frame(0,0);
      const run = await timed(() => sequence.setControl('root','gain',i%2 ? .75 : 1.5));
      sequenceUpdate.push(run.ms); verifyChanged(fixture,prev,sequence.frame(0,0));
    }
    const appended: number[] = [];
    for (let i=0;i<7;i++) {
      const prefix = sequence.compiled.slice();
      const run = await timed(() => sequence.submit({type:'insert',after:sequence.sources.at(-1)!.id,
        scenes:[{id:`append-${i}`,source:fixture.source,handoffFrom:null}]}));
      assert(run.result.ok,JSON.stringify(run.result)); appended.push(run.ms);
      assert(prefix.every((scene,index)=>sequence.compiled[index]===scene),'Append must retain compiled prefix');
      verifyFixture(fixture,sequence.frame(i+1,0));
    }
    const retained = sequence.compiled.slice();
    const replacement = await timed(() => sequence.submit({type:'replace',scene:'root',source:fixture.source}));
    assert(replacement.result.ok,JSON.stringify(replacement.result));
    const rebuiltSceneCount = retained.filter((scene,index)=>scene!==sequence.compiled[index]).length;
    assert.equal(rebuiltSceneCount,8,'Replacement currently reconstructs all history');
    const revision = sequence.revision, saved = sequence.compiled.slice(), frame = sequence.frame(0,1.5);
    const bad = await timed(() => sequence.submit({type:'replace',scene:'root',source:'export default scene({},s=>{throw new Error("probe-invalid");});'}));
    assert.equal(bad.result.ok,false); assert.equal(sequence.revision,revision);
    assert(saved.every((scene,index)=>sequence.compiled[index]===scene)); assert.deepEqual(sequence.frame(0,1.5),frame);
    return { id:fixture.id, sourceSha256:hash(fixture.source), sourceBytes:Buffer.byteLength(fixture.source),
      geometryElements:before.elements.length, firstCompileInParentMs:first.ms,
      warmCompile:summarize(warm), directReactiveUpdate:summarize(directUpdate), frameEvaluation:summarize(frames),
      sequenceLoadMs:load.ms, singleSceneControlUpdate:summarize(sequenceUpdate), appendIndependentScene:summarize(appended),
      replaceEightSceneHistory:{elapsedMs:replacement.ms,rebuiltSceneCount},
      invalidReplacement:{elapsedMs:bad.ms,rollbackVerified:true,diagnostics:bad.result.diagnostics},
      assertions:['real geometry exists','control changes real geometry','timeline changes position','append preserves prefix','invalid replacement rolls back'] };
  } finally {compiler.dispose();sequence.dispose();}
}

async function measureHandoff() {
  const source = fixtures[0].source, compiler = new SourceCompiler(), sequence = new SceneSequence();
  const nextSource = `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
    const body=s.previous.get('body');s.keep(body);s.play(body.moveTo([4,0,0]),{duration:2.5,ease:'linear'});
  });`;
  try {
    const base = await compiler.compile(source), playhead = 1.5;
    const current = evaluateScene(base,playhead), end = evaluateScene(base,base.duration);
    const run = await timed(() => compiler.compile(nextSource,{previous:current}));
    assert.deepEqual(target(evaluateScene(run.result,0),'body').position,target(current,'body').position);
    assert.deepEqual(target(evaluateScene(run.result,.5),'body').position,target(evaluateScene(base,2),'body').position);
    assert((await sequence.submit({type:'load',scenes:[{id:'base',source}]})).ok);
    const prefix = sequence.compiled[0];
    const append = await timed(() => sequence.submit({type:'insert',after:'base',scenes:[{id:'next',source:nextSource}]}));
    assert(append.result.ok,JSON.stringify(append.result));assert.equal(sequence.compiled[0],prefix);
    const appendedStart = target(sequence.frame(1,0),'body').position;
    assert.deepEqual(appendedStart,target(end,'body').position);
    assert.notDeepEqual(appendedStart,target(current,'body').position);
    return {playheadSec:playhead,currentPosition:target(current,'body').position,endPosition:target(end,'body').position,
      directCompileFromCurrentFrameMs:run.ms,currentFrameInherited:true,explicitlyAuthoredContinuationMatchesAfterHalfSecond:true,
      sequenceAppendMs:append.ms,sequenceAppendStartsFromEndPosition:appendedStart,
      limitation:'This tests a frozen current-frame input and an explicitly authored continuation. It does not implement asynchronous moving-frame rebase, generic preserved callbacks, cancellation, presentation, or live scene mutation.'};
  } finally {compiler.dispose();sequence.dispose();}
}

const childId = process.argv[process.argv.indexOf('--cold-child')+1];
if (process.argv.includes('--cold-child')) {
  const fixture = fixtures.find(f=>f.id===childId); assert(fixture,'Unknown fixture');
  const compiler = new SourceCompiler();
  try {
    const run = await timed(()=>compiler.compile(fixture.source));verifyFixture(fixture,evaluateScene(run.result,0));
    console.log(JSON.stringify({fixture:fixture.id,compileMs:run.ms,geometryVerified:true}));
  } finally {compiler.dispose();}
} else {
  const runId = `${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
  const directory = resolve('data/realtime-workshop/runtime',runId);
  await mkdir(directory,{recursive:true});
  const startedAt = new Date().toISOString();
  try {
  const cold = [];
  for (const fixture of fixtures) {
    const runs = [];
    for (let i=0;i<3;i++) {
      const start = performance.now();
      const result = spawnSync(process.execPath,[import.meta.filename,'--cold-child',fixture.id],{encoding:'utf8',windowsHide:true,timeout:60000});
      assert.equal(result.status,0,`${result.error ?? ''}\n${result.stderr}\n${result.stdout}`);
      runs.push({...JSON.parse(result.stdout.trim()),subprocessMs:performance.now()-start});
    }
    cold.push({id:fixture.id,compile:summarize(runs.map(run=>run.compileMs)),runs});
  }
  const results = [];for (const fixture of fixtures) results.push(await measureFixture(fixture));
  const handoff = await measureHandoff();
  const rendered = [];
  if (process.argv.includes('--render')) for (const fixture of fixtures) {
    const inputPath = resolve(directory,`${fixture.id}-render-input.json`);
    const outputDirectory = resolve(directory,`${fixture.id}-frames`);
    await writeFile(inputPath,JSON.stringify({source:fixture.source,times:[0,1.5,3.5],directory:outputDirectory},null,2)+'\n',{flag:'wx'});
    const start = performance.now();
    const result = spawnSync('node',['shared/animlib/tools/render-frames.mjs',inputPath],{encoding:'utf8',windowsHide:true,timeout:60000});
    const elapsedMs = performance.now()-start;
    await writeFile(resolve(directory,`${fixture.id}-render-process.json`),JSON.stringify({status:result.status,error:String(result.error??''),stdout:result.stdout,stderr:result.stderr,elapsedMs},null,2)+'\n',{flag:'wx'});
    assert.equal(result.status,0,`${result.error??''}\n${result.stderr}`);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.backend,'native-webgpu');assert.equal(manifest.frames.length,6);
    rendered.push({id:fixture.id,backend:manifest.backend,totalSubprocessMs:elapsedMs,manifest:resolve(outputDirectory,'frames.json'),
      limitation:'Total process time includes startup, compile, two GPU devices/resolutions, six renders/readbacks, PNG encoding, contact sheets and disk writes. It is not first-frame latency.'});
  }
  const paths = ['backend/bench/realtime-runtime-probe.ts','backend/bench/realtime-runtime/fixtures.ts',
    'shared/animlib/src/compiler-client.ts','shared/animlib/src/compiler.ts','shared/animlib/src/sequence.ts',
    'shared/animlib/src/player.ts','shared/animlib/src/timeline.ts','shared/animlib/src/runtime.ts',
    ...(rendered.length?['shared/animlib/tools/render-frames.mjs','shared/animlib/dist/renderer.js','shared/animlib/dist/compiler.js','shared/animlib/dist/runtime.js']:[])];
  const sources = Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path,'utf8'))])));
  const report = {schemaVersion:1,runId,startedAt,finishedAt:new Date().toISOString(),
    runtime:{bun:Bun.version,platform:process.platform,arch:process.arch,mode:'SourceCompiler real headless in-process QuickJS fallback',
      coldDefinition:'Fresh subprocess for each cold compile; timer starts immediately before compile, excludes process/module startup. subprocessMs includes startup.',
      warmDefinition:'Repeated compile within one compiler instance and process; release superseded retained callback programs.'},
    scope:'Generic hand-authored synthetic geometry. No model, input capture, network, browser worker, DOM or frame-present measurement. Optional separate native GPU renders are recorded without a presentation latency claim.',
    cold,results,handoff,rendered,
    playerReplacement:{evidence:'shared/animlib/src/player.ts:264-306',
      observedInSource:'replace at/before active scene marks affected; stopClock; reset behaviors; this.time = affected ? 0 : min(...); resume playback',
      runtimeTested:false,meaning:'Sequence replacement timings cannot be described as continuous live updates. Player continuity is not solved by this probe.'},sources};
  await writeFile(resolve(directory,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  for (const fixture of fixtures) await writeFile(resolve(directory,`${fixture.id}.js`),fixture.source+'\n',{flag:'wx'});
  console.log(JSON.stringify({directory,report:resolve(directory,'result.json'),cold:cold.map(item=>({id:item.id,medianMs:item.compile.medianMs})),
    results:results.map(item=>({id:item.id,warmCompileMedianMs:item.warmCompile.medianMs,reactiveMedianMs:item.singleSceneControlUpdate.medianMs,
      evaluateMedianMs:item.frameEvaluation.medianMs,appendMedianMs:item.appendIndependentScene.medianMs,replaceEightMs:item.replaceEightSceneHistory.elapsedMs})),handoff,rendered},null,2));
  } catch (error) {
    await writeFile(resolve(directory,'failure.json'),JSON.stringify({runId,startedAt,failedAt:new Date().toISOString(),error:error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error)},null,2)+'\n',{flag:'wx'});
    throw error;
  }
}
