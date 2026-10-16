/** Bounded headless LiveWorld sampling comparison. No renderer, network or provider. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LiveWorld, type WorldOptions } from './realtime-world/world.js';
import { SourceCompiler } from '../../shared/animlib/src/compiler-client.js';
import { ModelStore } from '../../shared/animlib/src/model-store.js';
import type { Frame } from '../../shared/animlib/src/types.js';

export function worldCompatibleSource(source: string) {
  let removedCameraCommands = 0;
  const adapted = source.replace(/^\s*s\.play\(s\.camera\.to3D\(\{[^\r\n]*\}\),\{duration:0\}\);\r?\n/gm, () => { removedCameraCommands++; return ''; });
  if (adapted.includes('s.camera')) throw Error('Unsupported camera adaptation');
  return { source: adapted, removedCameraCommands };
}
export function scalingSource(index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 15) throw Error('Scaling index must be 0..15');
  return `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
    const mesh=s.surface('held-surface-${index}',{fn:(x,y)=>Math.sin(x)*Math.cos(y),xRange:[-3,3],yRange:[-3,3],xSegments:40,ySegments:40,shading:'smooth',fill:'TEAL'});
    s.deform(mesh,[s.time],(p,i,t)=>[p[0],p[1],Math.sin(p[0]+t)*Math.cos(p[1])]);s.wait(8);
  });`;
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const frameHash = (value: Frame) => hash(JSON.stringify(value));
type World = Pick<LiveWorld, 'addProgram' | 'sample' | 'apply' | 'dispose' | 'revision' | 'summary'>;
type WorldConstructor = new (options?: WorldOptions) => World;
type Row = { phase: string; time: number; arm: string; order: number; sampleMs: number; dispatches: number; registeredCallbackExecutions: number; heldCallbacks: number; sentinelCallbacks: number; frameSha256?: string };
const sentinel = `export default scene({mode:'3d',end:'hold',orbit:false},s=>{const dot=s.box('probe-active-sentinel',{position:[10,0,0]});s.bind(dot,[s.time],t=>({rotation:[0,t*.01,0]}));s.wait(120);});`;
function stats(rows: Row[]) { const xs = rows.map(row => row.sampleMs).sort((a,b) => a-b); return { samples: xs.length, medianMs: (xs[(xs.length-1)>>1]+xs[xs.length>>1])/2,
  minMs: xs[0], maxMs: xs.at(-1), meanMs: xs.reduce((a,b) => a+b,0)/xs.length,
  dispatches: rows.reduce((n,r) => n+r.dispatches,0), registeredCallbackExecutions: rows.reduce((n,r) => n+r.registeredCallbackExecutions,0),
  heldCallbacks: rows.reduce((n,r) => n+r.heldCallbacks,0), sentinelCallbacks: rows.reduce((n,r) => n+r.sentinelCallbacks,0) }; }

async function main() {
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined });
  const out = resolve(process.argv[2] ?? 'data/realtime-workshop/terminal-sampling-01'); await mkdir(out);
  const baselineOriginal = await readFile('.tmp/terminal-cache-baseline-original.ts'), baselineRelocated = await readFile('.tmp/terminal-cache-baseline.ts');
  const identity = JSON.parse(await readFile('.tmp/terminal-cache-baseline-identity.json', 'utf8'));
  assert.equal(hash(baselineOriginal), identity.originalSha256); assert.equal(hash(baselineRelocated), identity.relocatedSha256);
  const BaselineWorld = (await import(pathToFileURL(resolve('.tmp/terminal-cache-baseline.ts')).href)).LiveWorld as WorldConstructor;
  const sources = ['backend/bench/realtime-world/world.ts', 'shared/animlib/src/compiler-client.ts', 'shared/animlib/src/compiler.ts', 'shared/animlib/src/runtime.ts', 'shared/animlib/src/timeline.ts'];
  const provenance = Object.fromEntries(await Promise.all(sources.map(async name => [name, hash(await readFile(name))])));
  await writeFile(join(out, 'probe.ts'), await readFile(fileURLToPath(import.meta.url)), { flag: 'wx' });
  await writeFile(join(out, 'baseline-world.ts'), baselineOriginal, { flag: 'wx' });
  await writeFile(join(out, 'candidate-world.ts'), await readFile(sources[0]), { flag: 'wx' });
  await writeFile(join(out, 'started.json'), JSON.stringify({ baseline: identity, provenance, providerRequests: 0,
    scope: 'Headless Bun LiveWorld.sample only. Sample timers include delegating callback instrumentation, exclude hash/equality checks, compile/add, model preparation and all GPU work.',
    callbackMeaning: 'Completed ReactiveUpdate records count successful registered runtime binding callback invocations; nested per-vertex deformation functions and construction callbacks are not counted.' }, null, 2), { flag: 'wx' });
  const large = JSON.parse(await readFile('data/realtime-workshop/lecture-assets-local-04/render-input.json', 'utf8'));
  let modelReads = 0;
  const models = new ModelStore(large.models.assets, { read: async asset => {
    modelReads++; const bytes = Buffer.from(large.models.files[asset.url], 'base64'); assert.equal(hash(bytes), asset.sha256); return bytes;
  } });
  const fixtures: { id: string; duration: number; sources: string[]; sourcePath?: string; adaptation?: unknown; heldCount: number; usesModel?: boolean; synthetic?: boolean }[] = [];
  for (const [id, sourcePath] of [['graph', 'data/realtime-workshop/stroke-preflight-02/graph/source.js'],
    ['surface', 'data/realtime-workshop/quality-revision-01/surface/revised.js'], ['full-molecule', 'data/realtime-workshop/quality-revision-01/molecule/revised.js']]) {
    const original = await readFile(sourcePath, 'utf8'), adapted = worldCompatibleSource(original);
    fixtures.push({ id, duration: 8, sources: [adapted.source], sourcePath, adaptation: { originalSha256: hash(original), adaptedSha256: hash(adapted.source), removedCameraCommands: adapted.removedCameraCommands }, heldCount: 1 });
  }
  fixtures.push({ id: 'large-glb', duration: 30, sources: [large.source], sourcePath: 'data/realtime-workshop/lecture-assets-local-04/render-input.json', heldCount: 1, usesModel: true });
  for (const heldCount of [1, 4, 16]) fixtures.push({ id: `synthetic-surfaces-${heldCount}`, duration: 8, sources: Array.from({ length: heldCount }, (_, i) => scalingSource(i)), heldCount, synthetic: true });
  const originalUpdate = SourceCompiler.prototype.update; let currentRow: Row | undefined;
  SourceCompiler.prototype.update = async function(...args: Parameters<typeof originalUpdate>) {
    const row = currentRow; if (row) row.dispatches++;
    const updates = await originalUpdate.apply(this, args);
    if (row) { row.registeredCallbackExecutions += updates.length; for (const update of updates) if (update.target === 'probe-active-sentinel') row.sentinelCallbacks++; else row.heldCallbacks++; }
    return updates;
  };
  const completed: unknown[] = [];
  try {
    for (const fixture of fixtures) {
      const directory = join(out, fixture.id); await mkdir(directory); await writeFile(join(directory, 'fixture.json'), JSON.stringify(fixture, null, 2), { flag: 'wx' });
      const worlds: Record<string, World> = {}, rows: Row[] = [], setup: Record<string, unknown> = {}, checks: unknown[] = [], snapshots: unknown[] = [];
      const pair = async (phase: string, time: number, index: number, snapshot = false) => {
        const frames: Record<string, Frame> = {}, order = index % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
        for (const [position, arm] of order.entries()) {
          const row: Row = { phase, time, arm, order: position, sampleMs: 0, dispatches: 0, registeredCallbackExecutions: 0, heldCallbacks: 0, sentinelCallbacks: 0 };
          currentRow = row; const begin = performance.now();
          try { frames[arm] = await worlds[arm].sample(time); } finally { row.sampleMs = performance.now()-begin; currentRow = undefined; rows.push(row); }
          row.frameSha256 = frameHash(frames[arm]);
          const active = frames[arm].elements.find(e => e.id === 'probe-active-sentinel'); assert.ok(active); assert.equal(active.rotation[1], time*.01);
        }
        assert.deepEqual(frames.candidate, frames.baseline); assert.equal(frameHash(frames.candidate), frameHash(frames.baseline));
        if (snapshot) snapshots.push({ phase, time, frame: frames.baseline });
        checks.push({ phase, time, exactFramesEqual: true, sentinelMotionExact: true });
        return frames;
      };
      try {
        for (const [arm, Constructor] of [['baseline', BaselineWorld], ['candidate', LiveWorld]] as const) {
          const world = worlds[arm] = new Constructor({ clock: () => 0, models: models.metadata, prepare: async scene => { if (fixture.usesModel) await models.prepare([scene]); } });
          const begin = performance.now();
          for (const [index, source] of [...fixture.sources, sentinel].entries()) await world.addProgram({ id: `program-${index}`, source, baseRevision: world.revision }, 0);
          setup[arm] = { addMs: performance.now()-begin, summary: world.summary() };
        }
        for (let i=0;i<12;i++) await pair('active', fixture.duration*(.2+i*.05), i, i===0);
        const terminal = await pair('first-terminal', fixture.duration, 12, true);
        if (fixture.usesModel) {
          const modelIds = new Set(terminal.baseline.elements.filter(e => e.geometry.model).map(e => e.id));
          const resolved = models.resolve(terminal.baseline), triangles = resolved.elements.filter(e => modelIds.has(e.id)).reduce((n,e) => n+(e.geometry.triangles?.length??0),0);
          const expected = Object.values(large.models.assets).reduce((n: number, asset: any) => n+asset.metadata.triangles,0);
          assert.equal(triangles, expected); checks.push({ modelReads, resolvedModelTriangles: triangles, sha256Verified: true });
        }
        for (let i=0;i<60;i++) await pair('held', fixture.duration+1+i/60, i);
        await pair('rewind-active', fixture.duration*.5, 0);
        const final = await pair('return-terminal', fixture.duration+3, 1);
        const target = final.baseline.elements.find(e => e.id !== 'probe-active-sentinel')!.id;
        for (const world of Object.values(worlds)) await world.apply({ baseRevision: world.revision, changes: [{ id: target, props: { fill: 'RED' } }] }, fixture.duration+3);
        const patched = await pair('host-override', fixture.duration+4, 0);
        assert.equal(patched.candidate.elements.find(e => e.id === target)!.fill, 'RED');
        const aggregate = Object.fromEntries(['active','first-terminal','held','rewind-active','return-terminal','host-override'].map(phase => [phase,
          Object.fromEntries(['baseline','candidate'].map(arm => [arm, stats(rows.filter(row => row.phase===phase && row.arm===arm))]))]));
        const result = { id: fixture.id, status: 'complete', setup, aggregate, rows, checks };
        await writeFile(join(directory, 'snapshots.json'), JSON.stringify(snapshots), { flag: 'wx' });
        await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
        completed.push({ id: fixture.id, aggregate }); console.log(JSON.stringify({ id: fixture.id, aggregate: aggregate.held }));
      } catch (error) { await writeFile(join(directory, 'failure.json'), JSON.stringify({ error: String(error), rows, checks, setup }, null, 2), { flag: 'wx' }); throw error; }
      finally { for (const world of Object.values(worlds)) world.dispose(); }
    }
    await writeFile(join(out, 'result.json'), JSON.stringify({ status: 'complete', providerRequests: 0, completed,
      limitation: 'Headless fixed fixtures, one local run, no GPU, live latency or visual review claim. Graph and molecule are callback-free negative controls.' }, null, 2), { flag: 'wx' });
  } finally { SourceCompiler.prototype.update = originalUpdate; models.dispose(); }
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode=1; });
