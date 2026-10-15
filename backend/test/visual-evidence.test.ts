import { expect, test } from 'bun:test';
import { compileSource } from 'animlib/core';
import { planReviewEvidence, selectReviewImages } from '../src/agents/visual-evidence.js';
import { hasRepeatedFinding } from '../src/agents/visual-gate.js';

test('named speech boundaries are visible in the bounded review plan', async () => {
  const scene = await compileSource(`export default scene({},s=>s.wait(20));`);
  const plan = planReviewEvidence(scene, [], { reveal: { startSec: 1.234, endSec: 1.678 } });
  expect(plan.samples.map(sample => sample.time)).toContain(1.234);
  expect(plan.samples.map(sample => sample.time)).toContain(1.678);
  expect(plan.samples.find(sample => sample.time === 1.234)?.reasons).toContain('speech-cue-start:reveal');
});

test('dense timelines keep a bounded deterministic plan and disclose omitted risks', async () => {
  const scene = await compileSource(`export default scene({},s=>{
    const a=s.circle('a');for(let i=0;i<40;i++){s.play(a.moveTo([i%2,0]),{duration:.1});s.wait(.4);}
  });`);
  const first = planReviewEvidence(scene), second = planReviewEvidence(scene);
  expect(first).toEqual(second); expect(first.samples.length).toBe(16);
  expect(first.omittedOperationInteriors).toBeGreaterThan(0);
  expect(first.coverage).toBe('partial');
  expect(first.samples[0].time).toBe(0); expect(first.samples.at(-1)?.time).toBe(scene.duration);
});

test('known defects exceed the evidence budget explicitly rather than silently disappear', async () => {
  const scene = await compileSource(`export default scene({},s=>s.wait(20));`);
  const plan = planReviewEvidence(scene, [{ approved: false, findings: Array.from({ length: 20 }, (_, i) => ({
    timeSec: i + .1, objectIds: ['label'], problem: 'Clipped', fix: 'Move',
  })) }]);
  expect(plan.samples.length).toBeLessThanOrEqual(16);
  expect(plan.uncoveredDefectTimes.length).toBeGreaterThan(0);
});

test('a decimal endpoint defect is normalized to the compiled duration within validation tolerance', async () => {
  const scene = await compileSource(`export default scene({},s=>{s.wait(.1);s.wait(.7);});`);
  expect(scene.duration).toBeLessThan(.8);
  const plan = planReviewEvidence(scene, [{ approved: false, findings: [{ timeSec: .8, objectIds: ['label'], problem: 'Clipped', fix: 'Move' }] }]);
  expect(plan.uncoveredDefectTimes).toEqual([]);
  expect(plan.samples.find(sample => sample.time === scene.duration)?.reasons).toContain('prior-defect');
  expect(plan.nativeTimes).toContain(scene.duration);
  expect(plan.samples.every(sample => sample.time >= 0 && sample.time <= scene.duration)).toBe(true);
});

test('a genuinely out-of-range known defect remains explicitly uncovered', async () => {
  const scene = await compileSource(`export default scene({},s=>{s.wait(.1);s.wait(.7);});`);
  const plan = planReviewEvidence(scene, [{ approved: false, findings: [{ timeSec: .81, objectIds: ['label'], problem: 'Clipped', fix: 'Move' }] }]);
  expect(plan.uncoveredDefectTimes).toEqual([.81]);
  expect(plan.samples.every(sample => sample.time >= 0 && sample.time <= scene.duration)).toBe(true);
});

test('native image selection preserves every overview and both viewport sizes', async () => {
  const scene = await compileSource(`export default scene({},s=>s.wait(4));`);
  const evidence = { backend: 'test', frames: [1280, 960].flatMap(width => [0, 4].map(time => ({ width, height: 720, time, path: `${width}-${time}` }))),
    sheets: [1280, 960].map(width => ({ width, height: 720, times: [0, 4], path: `${width}-sheet`, columns: 2 })) };
  const images = selectReviewImages(evidence, planReviewEvidence(scene));
  expect(images.map(image => image.path)).toEqual(['1280-sheet', '960-sheet', '1280-4', '960-4']);
  expect(images.filter(image => image.kind === 'native-frame').map(image => image.width)).toEqual([1280, 960]);
  expect(() => selectReviewImages({ ...evidence, sheets: [{ ...evidence.sheets[0], times: [3] }] }, planReviewEvidence(scene))).toThrow('timestamps');
});

test('stagnation requires the same demonstrated defect across two repairs', () => {
  const review = { approved: false, findings: [{ timeSec: 2, objectIds: ['b', 'a'], problem: 'Clipped label', fix: 'Move' }] };
  expect(hasRepeatedFinding([review, review])).toBe(false);
  expect(hasRepeatedFinding([review, review, { ...review, findings: [{ ...review.findings[0], objectIds: ['a', 'b'], fix: 'Different attempted correction' }] }])).toBe(true);
  expect(hasRepeatedFinding([review, review, { ...review, findings: [{ ...review.findings[0], timeSec: 3 }] }])).toBe(false);
  expect(hasRepeatedFinding([review, review, { ...review, findings: [{ ...review.findings[0], problem: 'Different defect' }] }])).toBe(false);
});
