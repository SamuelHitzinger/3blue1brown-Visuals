/** Isolated unsafe diagnostic: never import these variants into production. No network. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SceneProgram } from '../../shared/animlib/src/compiler.js';
import { evaluateScene } from '../../shared/animlib/src/timeline.js';
import { meshTriangles } from '../../shared/animlib/src/mesh-shading.js';
import { buildDrawItems } from '../../shared/animlib/src/render-geometry.js';
import { paletteResolver } from '../../shared/animlib/src/palette.js';
import type { CompiledScene, Frame, ReactiveUpdate } from '../../shared/animlib/src/types.js';
import { mergeReactiveUpdates } from '../../shared/animlib/src/reactive.js';

export function frameWithUpdates(scene:CompiledScene,updates:ReactiveUpdate[],time:number):Frame {
  return evaluateScene({...scene,reactiveBindings:mergeReactiveUpdates(scene,updates,[],time),reactiveTime:time},time);
}
function verifyMotion(frame:Frame,time:number,grid:number) {
  if(grid) {
    const points=frame.elements.find(e=>e.id==='surface')!.geometry.vertices!;
    for(const p of points) {assert.ok(p[2]!==undefined);assert.ok(Math.abs(p[2]-Math.sin(p[0]+time)*Math.cos(p[1]))<1e-12,'Frame did not apply active deformation');}
    const p=points[0];assert.ok(p[2]!==undefined);assert.ok(Math.abs(p[2]-Math.sin(p[0])*Math.cos(p[1]))>1e-8,'Frame remained initial');
  } else assert.ok(Math.abs(frame.elements.find(e=>e.id==='box')!.rotation[1]-time*.2)<1e-12,'Control rotation did not advance');
}

const baselineRef = 'c1298f469501abe7e20098dc159cbb559654e8d8';
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const json = (v: unknown) => JSON.stringify(v);
const write = (path: string, value: string | Uint8Array) => writeFile(path, value, { flag: 'wx' });
type Row = { index: number; time: number; arm: string; order: number; elapsedMs: number; registeredCallbacks: number; outputSha256: string; frameSha256: string };
function stats(rows: Row[]) {
  const xs = rows.map(r => r.elapsedMs).sort((a,b) => a-b);
  return { samples: xs.length, medianMs: (xs[9]+xs[10])/2, minMs: xs[0], maxMs: xs.at(-1), meanMs: xs.reduce((a,b)=>a+b,0)/xs.length,
    registeredCallbacks: rows.reduce((n,r)=>n+r.registeredCallbacks,0) };
}
async function main() {
  const candidateMode=process.argv[3]==='candidate', comparison=candidateMode?'candidate':'unsafe', arms=['baseline',comparison];
  const out = resolve(process.argv[2] ?? 'data/realtime-workshop/deform-copy-diagnostic-01');
  await mkdir(out);
  const variants = resolve('.tmp', `deform-copy-${Date.now()}`); await mkdir(variants);
  const originals: Record<string,string> = {};
  for (const name of ['runtime','compiler']) {
    const result = spawnSync('git', ['show', `${baselineRef}:shared/animlib/src/${name}.ts`], { encoding: 'utf8' });
    assert.equal(result.status,0,result.stderr); originals[name] = result.stdout;
    await write(join(out,`original-${name}.ts`),result.stdout);
  }
  assert.equal(originals.runtime.split('properties: clone(properties)').length-1,1);
  const relocate = (source: string) => source.replace(/from (["'])\.\/(.*?)\1/g, (_all, quote, path) => `from ${quote}../../shared/animlib/src/${path}${quote}`);
  const variantHashes: Record<string,string> = {};
  const candidateRuntime=candidateMode?await readFile('shared/animlib/src/runtime.ts','utf8'):undefined;
  if(candidateMode) {assert.equal((await readFile('shared/animlib/src/compiler.ts','utf8')).replace(/\r\n/g,'\n'), originals.compiler.replace(/\r\n/g,'\n'),'Current compiler differs beyond checkout line endings');await write(join(out,'original-candidate-runtime.ts'),candidateRuntime!);}
  for (const arm of arms) {
    const runtime = arm==='candidate'?relocate(candidateRuntime!):relocate(originals.runtime).replace('properties: clone(properties)', arm === 'unsafe' ? 'properties' : 'properties: clone(properties)');
    const compiler = relocate(originals.compiler).replace('"../../shared/animlib/src/runtime.js"',`"./${arm}-runtime.ts"`);
    assert.ok(compiler.includes(`from "./${arm}-runtime.ts"`));
    for (const [name,source] of [['runtime',runtime],['compiler',compiler]]) {
      const filename = `${arm}-${name}.ts`; await write(join(variants,filename),source); await write(join(out,filename),source); variantHashes[filename] = sha(source);
    }
  }
  const create: Record<string,typeof import('../../shared/animlib/src/compiler.js').createSceneProgram> = {};
  for (const arm of arms) create[arm] = (await import(pathToFileURL(join(variants,`${arm}-compiler.ts`)).href)).createSceneProgram;
  const dependencies:Record<string,string>={};
  for(const name of await readdir('shared/animlib/src',{recursive:true}))if(name.endsWith('.ts'))dependencies[name]=sha(await readFile(join('shared/animlib/src',name)));
  await write(join(out,'probe.ts'),await readFile(fileURLToPath(import.meta.url)));
  await write(join(out,'provenance.json'),json({ baselineRef, variants, originalHashes:Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,sha(v)])), variantHashes,
    node:process.version,bun:process.versions.bun,providerRequests:0,unsafe:!candidateMode,dependencies,candidateRuntimeSha256:candidateRuntime?sha(candidateRuntime):undefined,
    difference:candidateMode?'Frozen current guarded candidate runtime versus frozen baseline; compiler identical after CRLF normalization, both arms execute frozen compiler with import relocation only.':'One properties: clone(properties) expression replaced with properties; import relocation only otherwise. Unsafe diagnostic, never eligible for direct promotion.',
    scope:'Real QuickJS SceneProgram.update end-to-end CPU: callback evaluation, inner clone (baseline), outer serialization, host JSON parse, validation/merge. Excludes compile, setup, equality/hashing, frame evaluation, tessellation, GPU and rendering. Callback-free control separately times evaluateScene, because no __animlibUpdate exists.',
    method:'One warmup per arm, then 20 paired active times; alternating arm order; timing includes no instrumentation inside callback. Successful update records count registered callbacks, not per-vertex mapper invocations.' }));
  const fixtures = [10,20,40].map(n=>({id:`surface-${n}`,stage:'QuickJS-update',grid:n,source:`export default scene({mode:'3d',end:'hold',orbit:false},s=>{const m=s.surface('surface',{fn:(x,y)=>Math.sin(x)*Math.cos(y),xRange:[-3,3],yRange:[-3,3],xSegments:${n},ySegments:${n},shading:'smooth',fill:'TEAL'});s.deform(m,[s.time],(p,i,t)=>[p[0],p[1],Math.sin(p[0]+t)*Math.cos(p[1])]);s.wait(60);});`}));
  fixtures.push({id:'reactive-transform',stage:'QuickJS-update',grid:0,source:`export default scene({mode:'3d',end:'hold',orbit:false},s=>{const m=s.box('box');s.bind(m,[s.time],t=>({rotation:[0,t*.2,0]}));s.wait(60);});`},
    {id:'native-transform',stage:'evaluateScene',grid:0,source:`export default scene({mode:'3d',end:'hold',orbit:false},s=>{const m=s.box('box');s.play(m.rotateTo([0,12,0]),{duration:60,ease:'linear'});});`});
  const summaries: unknown[] = [];
  for (const fixture of fixtures) {
    const dir=join(out,fixture.id); await mkdir(dir); await write(join(dir,'source.js'),fixture.source);
    const programs:Record<string,SceneProgram>={},setup:Record<string,number>={},rows:Row[]=[],raw:unknown[]=[];
    try {
      for (const arm of arms) { const start=performance.now(); programs[arm]=await create[arm](fixture.source);setup[arm]=performance.now()-start; }
      assert.deepEqual(programs.baseline.scene,programs[comparison].scene);
      for (const arm of arms) if (fixture.stage==='QuickJS-update') programs[arm].update({},[],.5); else evaluateScene(programs[arm].scene,.5);
      for(let index=0;index<20;index++) {
        const time=1+index*.137,outputs:Record<string,unknown>={},frames:Record<string,unknown>={};
        const order=index%2?[comparison,'baseline']:['baseline',comparison];
        for(const [position,arm] of order.entries()) {
          const start=performance.now();
          const output=fixture.stage==='QuickJS-update'?programs[arm].update({},[],time):evaluateScene(programs[arm].scene,time);
          const elapsedMs=performance.now()-start;
          const frame=fixture.stage==='QuickJS-update'?frameWithUpdates(programs[arm].scene,output as ReactiveUpdate[],time):output as Frame;
          verifyMotion(frame,time,fixture.grid);
          outputs[arm]=output;frames[arm]=frame;
          rows.push({index,time,arm,order:position,elapsedMs,registeredCallbacks:fixture.stage==='QuickJS-update'?(output as unknown[]).length:0,outputSha256:sha(json(output)),frameSha256:sha(json(frame))});
        }
        raw.push({index,time,outputs,frameHashes:Object.fromEntries(Object.entries(frames).map(([a,f])=>[a,sha(json(f))]))});
        assert.deepEqual(outputs.baseline,outputs[comparison]);assert.deepEqual(frames.baseline,frames[comparison]);
      }
      const renderChecks:unknown[]=[];
      // Untimed backward seek and resumed active time: topology, recalculated normals and packed draw data.
      for(const time of [3.603,.25,2]) {
        const results:Record<string,unknown>={};
        for(const arm of arms) {
          const updates=fixture.stage==='QuickJS-update'?programs[arm].update({},[],time):[];
          const frame:Frame=fixture.stage==='QuickJS-update'?frameWithUpdates(programs[arm].scene,updates,time):evaluateScene(programs[arm].scene,time);
          verifyMotion(frame,time,fixture.grid);
          const meshes=frame.elements.filter(e=>e.geometry.kind==='mesh').map(e=>({id:e.id,data:meshTriangles(e.geometry)}));
          const draw=buildDrawItems(frame,frame.camera,1280,720,paletteResolver(programs[arm].scene.options.palette));
          results[arm]={updates,frame,meshes,draw};
        }
        assert.deepEqual(results.baseline,results[comparison]);
        renderChecks.push({time,exact:true,hashes:Object.fromEntries(Object.entries(results).map(([arm,value])=>[arm,sha(json(value))]))});
      }
      const summary={id:fixture.id,stage:fixture.stage,grid:fixture.grid,vertices:fixture.grid?(fixture.grid+1)**2:undefined,triangles:fixture.grid?fixture.grid**2*2:undefined,sourceSha256:sha(fixture.source),setupMs:setup,exactPairs:20,renderChecks,baseline:stats(rows.filter(r=>r.arm==='baseline')),[comparison]:stats(rows.filter(r=>r.arm===comparison))};
      await write(join(dir,'raw.json'),json({rows,raw}));await write(join(dir,'summary.json'),json(summary));summaries.push(summary);console.log(json(summary));
    } catch(error) {await write(join(dir,'failure.json'),json({message:String(error),stack:(error as Error).stack,rows,raw}));throw error;}
    finally {Object.values(programs).forEach(p=>p.dispose());}
  }
  await write(join(out,'summary.json'),json({baselineRef,comparison,unsafeDiagnosticOnly:!candidateMode,exactPairs:100,additionalRenderPairs:15,results:summaries}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error);process.exitCode=1;});
