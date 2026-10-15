import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { compileSource, evaluateScene } from 'animlib/core';
import type { Frame, Vec3 } from 'animlib/core';
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
    s.mesh('turn-indicator/ribbon',{vertices:[[0,0],[1,0],[1,1],[0,1]],triangles:[[0,1,2],[0,2,3]]});s.wait(1);
  });`);
  const frame = evaluateScene(scene, 0);
  expect(isNondegenerateHoldoutRibbon(frame)).toBe(true);
  for (const vertices of [
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
    [[0, 0, 0], [Infinity, 0, 0], [1, 1, 0], [0, 1, 0]],
  ] as Vec3[][]) {
    const invalid = structuredClone(frame); invalid.elements[0].geometry.vertices = vertices;
    expect(isNondegenerateHoldoutRibbon(invalid)).toBe(false);
  }
  const invalid = structuredClone(frame); invalid.elements[0].geometry.triangles = [[0, 1, 99]];
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
