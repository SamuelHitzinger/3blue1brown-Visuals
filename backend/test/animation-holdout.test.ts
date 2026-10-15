import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileSource, createModelGLB, evaluateScene, parseModelGLB } from 'animlib/core';
import type { Frame, ModelAsset, Vec3 } from 'animlib/core';
import * as holdout from '../bench/animation-holdout.js';
import { verifyHoldoutContinuationInputs } from '../bench/animation-holdout-assess.js';
import { buildHoldoutFixture, checkHoldoutMotion, holdoutLandmarks, isNondegenerateHoldoutRibbon } from '../bench/animation-holdout.js';
import type { HoldoutLandmark } from '../bench/animation-holdout.js';

const landmarks: [HoldoutLandmark, HoldoutLandmark] = [
  { atomId: 'a', residueId: 'a', part: 'a', label: 'A', localPosition: [-1, 0, 0] },
  { atomId: 'b', residueId: 'b', part: 'b', label: 'B', localPosition: [1, 0, 0] },
];
const motion = { startSec: 1, endSec: 2 };

async function motionFrames(scale: number, kind: 'turn' | 'slide', options: {
  fraction?: number; degrees?: number; detached?: 'protein' | 'marker-a' | 'all'; counterRotate?: boolean; rescale?: boolean;
} = {}): Promise<Map<number, Frame>> {
  const children = ['protein', 'marker-a', 'marker-b'].filter(id => options.detached !== 'all' && id !== options.detached);
  const action = kind === 'turn' ? `assembly.rotateTo([0,${(options.degrees ?? 90) * Math.PI / 180},0])`
    : `assembly.moveTo([${2 * scale * (options.fraction ?? .05)},0,0])`;
  const scene = await compileSource(`export default scene({mode:'3d'},s=>{
    const protein=s.group('protein',[s.sphere('bead')]);
    const a=s.sphere('marker-a',{position:[-1,0,0]}),b=s.sphere('marker-b',{position:[1,0,0]});
    const handles={'protein':protein,'marker-a':a,'marker-b':b};
    const assembly=s.group('assembly',${JSON.stringify(children)}.map(id=>handles[id]),{scale:${scale}});
    s.play(s.camera.animate({height:${8 * scale}}),{duration:0});s.wait(1);
    s.play([${action}${options.counterRotate ? ',protein.rotateTo([0,-Math.PI/2,0])' : ''}
      ${options.rescale ? `,assembly.scaleTo(${scale * 1.1})` : ''}],{duration:1,ease:'linear'});s.wait(1);
  });`);
  return new Map([0, 1, 1.5, 2, 3].map(time => [time, evaluateScene(scene, time)]));
}

test('holdout rotation and translation acceptance are independent of display scale', async () => {
  for (const scale of [.01, 1, 3]) {
    const turn = checkHoldoutMotion(await motionFrames(scale, 'turn'), motion, 'turn', landmarks);
    expect(turn.rotationDegrees).toBeCloseTo(90, 8);
    const slide = checkHoldoutMotion(await motionFrames(scale, 'slide'), motion, 'slide', landmarks);
    expect(slide.translationFraction).toBeCloseTo(.05, 8);
    expect(slide.markedSiteDisplaySeparation).toBeCloseTo(2 * scale, 8);
  }
});

test('holdout rejects translations below the declared relative threshold', async () => {
  const frames = await motionFrames(.01, 'slide', { fraction: .049 });
  expect(() => checkHoldoutMotion(frames, motion, 'slide', landmarks)).toThrow('5%');
});

test('holdout checks the declared angular threshold after normalizing the basis', async () => {
  const boundary = await motionFrames(.01, 'turn', { degrees: 10 });
  expect(checkHoldoutMotion(boundary, motion, 'turn', landmarks).rotationDegrees).toBeCloseTo(10, 8);
  const below = await motionFrames(.01, 'turn', { degrees: 9.9 });
  expect(() => checkHoldoutMotion(below, motion, 'turn', landmarks)).toThrow('10 degrees');
});

test('holdout rejects a moving dummy pivot or detached marker', async () => {
  for (const detached of ['protein', 'marker-a', 'all'] as const) {
    const frames = await motionFrames(.01, 'turn', { detached });
    expect(() => checkHoldoutMotion(frames, motion, 'turn', landmarks)).toThrow(`${detached === 'all' ? 'protein' : detached} must descend from assembly`);
  }
});

test('holdout rejects compensating protein motion and display rescaling', async () => {
  const counter = await motionFrames(.01, 'turn', { counterRotate: true });
  expect(() => checkHoldoutMotion(counter, motion, 'turn', landmarks)).toThrow('protein pose relative to assembly');
  const resized = await motionFrames(.01, 'turn', { rescale: true });
  expect(() => checkHoldoutMotion(resized, motion, 'turn', landmarks)).toThrow('display scale');
});

test('holdout accepts a coarse valid ribbon and rejects degenerate or malformed triangles', async () => {
  const scene = await compileSource(`export default scene({},s=>{
    s.compose('turn-indicator',{ribbon:(v,id)=>v.mesh(id,{vertices:[[0,0],[1,0],[1,1],[0,1]],triangles:[[0,1,2],[0,2,3]]})});s.wait(1);
  });`);
  const frame = evaluateScene(scene, 0);
  expect(isNondegenerateHoldoutRibbon(frame)).toBe(true);
  for (const vertices of [
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
    [[0, 0, 0], [Infinity, 0, 0], [1, 1, 0], [0, 1, 0]],
  ] as Vec3[][]) {
    const invalid = structuredClone(frame); invalid.elements.find(e => e.id === 'turn-indicator/ribbon')!.geometry.vertices = vertices;
    expect(isNondegenerateHoldoutRibbon(invalid)).toBe(false);
  }
  const invalid = structuredClone(frame); invalid.elements.find(e => e.id === 'turn-indicator/ribbon')!.geometry.triangles = [[0, 1, 99]];
  expect(isNondegenerateHoldoutRibbon(invalid)).toBe(false);
});

test('frozen holdout fixture declares the same acceptance thresholds before generation', async () => {
  const structure = JSON.parse(await readFile(new URL('../../shared/animlib/fixtures/biological/1crn/structure.json', import.meta.url), 'utf8'));
  const fixture = buildHoldoutFixture('model-test', holdoutLandmarks(structure));
  expect(fixture.acceptanceThresholds).toEqual({ minimumTurnDegrees: 10, minimumTranslationFraction: .05 });
  expect(fixture.lesson.plan.scenes[0].visualDescription).toContain('at least 10 degrees');
  expect(fixture.lesson.plan.scenes[1].visualDescription).toContain('at least 5%');
  for (const [index, scene] of fixture.pkg.scenes.entries()) {
    expect(Math.max(...Object.values(fixture.cues[index]).map(cue => cue.endSec))).toBeLessThanOrEqual(scene.pauses[0].startSec);
  }
});

async function modelFixture() {
  const part = { name: 'sector', vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] as Vec3[], triangles: [[0, 1, 2]] as [number, number, number][] };
  const assets: Record<string, ModelAsset> = {}, files: Record<string, string> = {};
  for (const [id, parts] of [['pinned', [part, { ...part, name: 'second' }]], ['annotation', [part]]] as const) {
    const bytes = await createModelGLB({ parts: [...parts] }), data = await parseModelGLB(bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex'), url = `/api/models/${sha256}.glb`;
    assets[id] = { kind: 'model', url, sha256, metadata: data.metadata }; files[url] = Buffer.from(bytes).toString('base64');
  }
  const source = `export default scene({},s=>{
    const protein=s.model('protein',{asset:'pinned'});
    const a=s.sphere('marker-a',{position:[-1,0,0]}),b=s.sphere('marker-b',{position:[1,0,0]});
    const assembly=s.group('assembly',[protein,a,b]);
    const turn=s.compose('turn-indicator',{ribbon:(v,id)=>v.model(id,{asset:'annotation'})});
    s.wait(1);s.play(assembly.rotateTo([0,Math.PI/2,0]),{duration:1});s.wait(1);s.remove(turn.group);s.wait(1);s.keep(assembly);
  });`;
  const compiled = await compileSource(source, { models: Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, a.metadata])) });
  const frames = new Map([0, 1, 1.5, 2, 3, 3.5, 4].map(time => [time, evaluateScene(compiled, time)]));
  return { assets, files, source, frames, initial: frames.get(0)!, final: frames.get(4)! };
}

test('published annotation is valid ribbon geometry without becoming a second protein', async () => {
  const fixture = await modelFixture();
  const geometry = await holdout.loadHoldoutModelGeometry(fixture);
  expect(isNondegenerateHoldoutRibbon(fixture.initial, geometry)).toBe(true);
  const before = holdout.pinnedHoldoutModels(fixture.initial, 'pinned', fixture.assets.pinned.metadata);
  const after = holdout.pinnedHoldoutModels(fixture.final, 'pinned', fixture.assets.pinned.metadata);
  expect(before.map(element => element.geometry.model!.primitive).sort()).toEqual([0, 1]);
  expect(after.map(element => element.id)).toEqual(before.map(element => element.id));
  expect(isNondegenerateHoldoutRibbon(fixture.final, geometry)).toBe(false);
  expect(holdout.hasScopedHoldoutRibbonCallback(fixture.source)).toBe(true);
  const checks = holdout.checkHoldoutFrames({ ...fixture, modelId: 'pinned', metadata: fixture.assets.pinned.metadata,
    modelGeometry: geometry, landmarks, scene: { durationSec: 4, pauses: [{ startSec: 3, endSec: 4 }] }, motion, kind: 'turn' });
  expect(checks.modelPrimitiveCount).toBe(2);
  expect(checks.maxInternalPoseError).toBeLessThan(1e-10);
});

test('pinned completeness rejects missing, substituted, duplicate, and detached primitives', async () => {
  const fixture = await modelFixture();
  const pinned = fixture.initial.elements.filter(element => element.geometry.model?.asset === 'pinned');
  for (const mutate of [
    (frame: Frame) => { frame.elements = frame.elements.filter(e => e.id !== pinned[0].id); },
    (frame: Frame) => { frame.elements.find(e => e.id === pinned[0].id)!.geometry.model!.asset = 'annotation'; },
    (frame: Frame) => { frame.elements.find(e => e.id === pinned[0].id)!.geometry.model!.primitive = pinned[1].geometry.model!.primitive; },
    (frame: Frame) => { frame.elements.push({ ...structuredClone(pinned[0]), id: 'duplicate-protein' }); },
    (frame: Frame) => { for (const e of frame.elements) if (e.geometry.children) e.geometry.children = e.geometry.children.filter(id => id !== pinned[0].id); },
  ]) {
    const frame = structuredClone(fixture.initial); mutate(frame);
    expect(() => holdout.pinnedHoldoutModels(frame, 'pinned', fixture.assets.pinned.metadata)).toThrow('Holdout acceptance');
  }
});

test('asset-backed ribbon requires actual matching registered bytes and valid primitive geometry', async () => {
  const fixture = await modelFixture();
  const badHash = structuredClone(fixture); badHash.assets.annotation.sha256 = '0'.repeat(64);
  await expect(holdout.loadHoldoutModelGeometry(badHash)).rejects.toThrow('hash');
  const noBytes = structuredClone(fixture); delete noBytes.files[fixture.assets.annotation.url];
  await expect(holdout.loadHoldoutModelGeometry(noBytes)).rejects.toThrow('bytes');
  const badMetadata = structuredClone(fixture); badMetadata.assets.annotation.metadata.triangles++;
  await expect(holdout.loadHoldoutModelGeometry(badMetadata)).rejects.toThrow('metadata');
  const geometry = await holdout.loadHoldoutModelGeometry(fixture);
  const invalid = structuredClone(fixture.initial);
  invalid.elements.find(e => e.geometry.model?.asset === 'annotation')!.geometry.model!.primitive = 99;
  expect(isNondegenerateHoldoutRibbon(invalid, geometry)).toBe(false);
  const degenerate = structuredClone(geometry);
  degenerate.get('annotation')![0].vertices = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
  expect(isNondegenerateHoldoutRibbon(fixture.initial, degenerate)).toBe(false);
  expect(isNondegenerateHoldoutRibbon(fixture.initial, new Map())).toBe(false);
});

test('ribbon requires a custom scoped constructor callback, not only a matching ID or comment', () => {
  const valid = `export default scene({},s=>s.compose('turn-indicator',{ribbon:(v,id)=>v.mesh(id,{})}));`;
  expect(holdout.hasScopedHoldoutRibbonCallback(valid)).toBe(true);
  expect(holdout.hasScopedHoldoutRibbonCallback(valid.replace('(v,id)=>v.mesh(id,{})', "{kind:'mesh',props:{}}"))).toBe(false);
  expect(holdout.hasScopedHoldoutRibbonCallback(`// ${valid}\nexport default scene({},s=>s.mesh('turn-indicator/ribbon',{}));`)).toBe(false);
  expect(holdout.hasScopedHoldoutRibbonCallback(`export default scene({},s=>{
    const ribbon=(view,id)=>view.model(id,{asset:'annotation'});
    s.compose('turn-indicator',{ribbon});
  });`)).toBe(true);
});

test('a custom callback may return a local handle without prescribed return-expression syntax', async () => {
  const fixture = await modelFixture();
  const source = fixture.source.replace("(v,id)=>v.model(id,{asset:'annotation'})", "(v,id)=>{const mesh=v.model(id,{asset:'annotation'});return mesh;}");
  const compiled = await compileSource(source, { models: Object.fromEntries(Object.entries(fixture.assets).map(([id, asset]) => [id, asset.metadata])) });
  expect(isNondegenerateHoldoutRibbon(evaluateScene(compiled, 0), await holdout.loadHoldoutModelGeometry(fixture))).toBe(true);
  expect(holdout.hasScopedHoldoutRibbonCallback(source)).toBe(true);
  const wrongId = source.replace('v.model(id,', "v.model('outside-scope',");
  await expect(compileSource(wrongId, { models: Object.fromEntries(Object.entries(fixture.assets).map(([id, asset]) => [id, asset.metadata])) }))
    .rejects.toThrow('turn-indicator/ribbon');
});

test('an unused callback cannot replace the actual compiled composition hierarchy', async () => {
  const source = `export default scene({},s=>{
    function unused(){s.compose('turn-indicator',{ribbon:(v,id)=>v.mesh(id,{vertices:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]]})});}
    s.mesh('turn-indicator/ribbon',{vertices:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]]});s.wait(1);
  });`;
  const compiled = await compileSource(source);
  expect(holdout.hasScopedHoldoutRibbonCallback(source)).toBe(true);
  expect(isNondegenerateHoldoutRibbon(evaluateScene(compiled, 0))).toBe(false);
});

test('continuation refuses source, registry, fixture, or boundary drift from its assessment', () => {
  const inputs = { source: 'approved source', assets: 'registered assets', fixture: 'frozen fixture', boundaryFrame: 'approved boundary' };
  const hashes = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, createHash('sha256').update(value).digest('hex')])) as Record<keyof typeof inputs, string>;
  expect(() => verifyHoldoutContinuationInputs(hashes, inputs)).not.toThrow();
  for (const key of Object.keys(inputs) as (keyof typeof inputs)[]) {
    expect(() => verifyHoldoutContinuationInputs(hashes, { ...inputs, [key]: `${inputs[key]} changed` })).toThrow(`${key} drift`);
  }
});
