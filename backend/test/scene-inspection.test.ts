import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from 'animlib/core';
import { inspectScene, sampleScene, sceneSampleTimes } from '../src/agents/scene-inspection.js';
import { inspectInWorker, sampleInWorker } from '../src/agents/scene-inspection-client.js';
import { createModelGLB, parseModelGLB } from 'animlib/core';

test('worker inspection retains model inventories when resampling time callbacks',async()=>{
  const {metadata}=await parseModelGLB(await createModelGLB({parts:[{name:'Panel',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]}]}));
  const models={panel:metadata};
  const source=`export default scene({},s=>{s.model('panel',{asset:'panel'});const m=s.mesh('live',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});s.deform(m,[s.time],([x,y,z],i,t)=>[x+t,y,z]);s.wait(2);});`;
  const compiled=await compileSource(source,{models});
  const samples=await sampleInWorker({source,compiled,models},{times:[0,1]});
  expect(samples).toHaveLength(2);
  expect(samples[1].frame.elements.some(e=>e.geometry.model?.asset==='panel')).toBe(true);
  const report=await inspectInWorker({source,compiled,models},{times:[1],objectIds:['panel']});
  expect(report.bounds[0].bounds).not.toBeNull();
});

async function candidate(body: string) {
  const source = `export default scene({}, s => { ${body} });`;
  return { source, compiled: await compileSource(source, {}, { sampleTime: 'end' }) };
}

test('inspection identifies glyph collisions, offscreen paint, tiny labels and explicit missing bounds', async () => {
  const scene = await candidate(`
    s.text('a', {text:'HELLO',fontSize:0.5}); s.text('b', {text:'HELLO',fontSize:0.5});
    s.circle('offscreen', {position:[30,0],fill:Color.BLUE});
    s.text('tiny', {text:'small',fontSize:0.04,position:[0,2]}); s.wait(2);
  `);
  const report = await inspectInWorker(scene, { times: [1], objectIds: ['a', 'missing'] });
  expect(report.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'text-overlap', elements: ['a', 'b'], time: 1 }),
    expect.objectContaining({ kind: 'outside-view', elements: ['offscreen'] }),
    expect.objectContaining({ kind: 'possibly-small-text', elements: ['tiny'] }),
  ]));
  expect(report.bounds[0].bounds!.right).toBeGreaterThan(report.bounds[0].bounds!.left);
  expect(report.bounds[1]).toEqual({ time: 1, id: 'missing', bounds: null });
});

test('settled overlap checks skip moving text unless explicitly requested', async () => {
  const scene = await candidate(`s.text('a',{text:'A'}); const b=s.text('b',{text:'A',position:[-1,0]});
    s.play(b.moveTo([1,0]),{duration:2}); s.wait(1);`);
  expect((await inspectScene(scene, { times: [1] })).warnings.filter(w => w.kind === 'text-overlap')).toEqual([]);
  expect((await inspectScene(scene, { times: [1], includeAnimating: true })).warnings.some(w => w.kind === 'text-overlap')).toBe(true);
});

test('sampling limits and local timestamps are validated before doing geometry work', async () => {
  const scene = await candidate('s.wait(2);');
  for (const times of [[], [-1], [3], [NaN], Array(7).fill(0)]) {
    await expect(sampleScene(scene, { times })).rejects.toThrow('timestamps');
  }
  expect(sceneSampleTimes(scene.compiled, [2, 0, 2], 6)).toEqual([0, 2]);
  await expect(inspectScene(scene, { objectIds: Array(21).fill('a') })).rejects.toThrow('20 object IDs');
});

test('sampled frames include inherited state and evaluate retained time callbacks at each timestamp', async () => {
  const preceding = await candidate("const a=s.circle('kept',{position:[2,0]});s.keep(a);s.wait(1);");
  const previous = evaluateScene(preceding.compiled, 1);
  const source = `export default scene({},s=>{
    s.keep(s.previous.get('kept'));
    const live=s.mesh('live',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],fill:Color.BLUE});
    s.deform(live,[s.time],([x,y,z],i,t)=>[x+t,y,z]);s.wait(2);
  });`;
  const scene = { source, previous, compiled: await compileSource(source, { previous }, { sampleTime: 'end' }) };
  const frames = await sampleInWorker(scene, { times: [0, 1, 2] });
  expect(frames.map(f => f.frame.elements.find(e => e.id === 'live')!.geometry.vertices![0][0])).toEqual([0, 1, 2]);
  expect(frames.every(f => f.frame.elements.some(e => e.id === 'kept'))).toBe(true);
  const report = await inspectInWorker(scene, { times: [0, 2], objectIds: ['live'] });
  expect(report.bounds[1].bounds!.left).toBeGreaterThan(report.bounds[0].bounds!.left);
});

test('crops reject absent objects and cancelled inspections terminate without a result', async () => {
  const scene = await candidate("s.circle('dot');s.wait(1);");
  await expect(sampleScene(scene, { times: [0], focusObjectId: 'missing' })).rejects.toThrow('no visible bounds');
  const controller = new AbortController();
  const pending = inspectInWorker(scene, {}, controller.signal);
  controller.abort(new Error('Cancelled by test'));
  await expect(pending).rejects.toThrow('Cancelled by test');
});
