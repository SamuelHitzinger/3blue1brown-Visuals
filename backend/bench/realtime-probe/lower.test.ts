import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from 'animlib/core';
import { lowerOperations } from './lower.js';

const scene = { op: 'scene', mode: '2d', end: 'hold' };
const commit = { op: 'commit' };
const add = { op: 'add', kind: 'circle', id: 'dot', props: { radius: .2, position: [0, 0], fill: 'BLUE' } };
const batch = (...records: unknown[]) => records.map(record => JSON.stringify(record)).join('\n');

test('lowers generic primitives and simultaneous animation into native compiled state', async () => {
  const source = lowerOperations(batch(scene, add,
    { op: 'add', kind: 'path', id: 'curve', props: { points: [[0, 0], [1, 1], [2, 4]], stroke: 'TEAL', fill: 'none', strokeEnd: 0 } },
    { op: 'animate', duration: 1, changes: [
      { id: 'dot', props: { position: [2, 4], fill: 'YELLOW' } },
      { id: 'curve', props: { strokeEnd: 1 } },
    ] }, { op: 'wait', duration: .5 }, { op: 'keep', ids: ['dot', 'curve'] }, commit));
  const compiled = await compileSource(source);
  expect(compiled.duration).toBe(1.5);
  expect(compiled.tracks.map(track => track.start)).toEqual([0, 0]);
  const end = evaluateScene(compiled, compiled.duration);
  expect(end.elements.find(element => element.id === 'dot')?.position).toEqual([2, 4, 0]);
  expect(end.elements.find(element => element.id === 'curve')?.strokeEnd).toBe(1);
  expect(end.elements.every(element => element.persistent)).toBe(true);
});

test('edits existing IDs without recreating them and preserves untouched persistent state', async () => {
  const initial = await compileSource(`export default scene({mode:'3d',orbit:false},s=>{
    const cube=s.box('cube',{width:1.5,height:1.5,depth:1.5,rotation:[0,.8,0],fill:'BLUE'});
    const label=s.text('label',{text:'Shape',position:[0,2,0]});
    s.circle('temporary');s.keep(cube);s.keep(label);s.wait(1);
  });`);
  const previous = evaluateScene(initial, 1), before = JSON.stringify(previous);
  const source = lowerOperations(batch({ ...scene, mode: '3d' },
    { op: 'animate', duration: .5, changes: [{ id: 'cube', props: { position: [1, 0, 0], fill: 'TEAL' } }] },
    { op: 'add', kind: 'text', id: 'new-label', props: { text: 'Moved', position: [1, -1, 0], fontSize: .3 } },
    { op: 'keep', ids: ['new-label'] }, { op: 'wait', duration: .5 }, commit), previous);
  expect(source).toContain('s.previous.get("cube")');
  expect(source).not.toContain('s.box(');
  const compiled = await compileSource(source, { previous });
  const end = evaluateScene(compiled, compiled.duration);
  expect(end.elements.map(element => element.id).sort()).toEqual(['cube', 'label', 'new-label']);
  const cube = end.elements.find(element => element.id === 'cube')!;
  expect(cube.position).toEqual([1, 0, 0]);
  expect(cube.rotation).toEqual([0, .8, 0]);
  expect(cube.geometry).toEqual(previous.elements.find(element => element.id === 'cube')!.geometry);
  expect(end.elements.find(element => element.id === 'label')).toEqual(previous.elements.find(element => element.id === 'label'));
  expect(end.elements.every(element => element.persistent)).toBe(true);
  expect(JSON.stringify(previous)).toBe(before);
  expect(() => lowerOperations(batch(scene, add, commit), { ...previous, elements: [...previous.elements, previous.elements[0]] })).toThrow();
  expect(() => lowerOperations(batch(scene, { ...add, id: 'cube' }, commit), previous)).toThrow();
  expect(() => lowerOperations(batch(scene, { op: 'keep', ids: ['temporary'] }, commit), previous)).toThrow();
});

test('text remains data even when it contains JavaScript delimiters', async () => {
  const label = '");throw new Error("executed");//\n` ${globalThis.secret} \u2028';
  const compiled = await compileSource(lowerOperations(batch(scene,
    { op: 'add', kind: 'text', id: 'label', props: { text: label } }, { op: 'wait', duration: 1 }, commit)));
  expect(evaluateScene(compiled, 0).elements[0].geometry.text).toBe(label);
});

test('all seven protocol primitives compile through native constructors', async () => {
  const specs = [
    ['box', { width: 1, height: 2, depth: 3 }], ['circle', { radius: .2 }],
    ['rectangle', { width: 2, height: 1 }], ['path', { points: [[0, 0], [1, 1], [2, 0]], strokeEnd: 0 }],
    ['line', { points: [[0, 0, 0], [1, 1, 1]] }], ['arrow', { points: [[0, 0], [1, 1]] }],
    ['text', { text: 'Label', fontSize: .3, rotation: .2 }],
  ] as const;
  const compiled = await compileSource(lowerOperations(batch({ ...scene, mode: '3d' },
    ...specs.map(([kind, props], index) => ({ op: 'add', kind, id: `element-${index}`, props })),
    { op: 'wait', duration: 1 }, commit)));
  expect(evaluateScene(compiled, 1).elements).toHaveLength(7);
  expect(compiled.options.orbit).toBe(false);
});

test('committed reveal preserves the entire native render state, including camera and paint', async () => {
  const source = lowerOperations(batch(scene,
    { op: 'add', kind: 'arrow', id: 'axis', props: { points: [[-2, 0], [2, 0]], stroke: 'WHITE' } },
    { op: 'add', kind: 'path', id: 'curve', props: { points: [[-1, 1], [0, 0], [1, 1]], stroke: 'BLUE', strokeEnd: 0 } },
    { op: 'add', kind: 'circle', id: 'marker', props: { radius: .1, position: [1, 1], fill: 'YELLOW' } },
    { op: 'add', kind: 'text', id: 'label', props: { text: 'Curve', position: [-1, 2], fontSize: .28, fill: 'WHITE' } },
    { op: 'animate', duration: 1, changes: [{ id: 'curve', props: { strokeEnd: 1 } }] },
    { op: 'wait', duration: 1 }, { op: 'keep', ids: ['axis', 'curve', 'marker', 'label'] }, commit));
  const lowered = await compileSource(source);
  const native = await compileSource(`export default scene({mode:'2d',end:'hold',orbit:false},s=>{
    const axis=s.arrow('axis',{points:[[-2,0],[2,0]],stroke:'WHITE'});
    const curve=s.path('curve',{points:[[-1,1],[0,0],[1,1]],stroke:'BLUE',strokeEnd:1});
    const marker=s.circle('marker',{radius:.1,position:[1,1],fill:'YELLOW'});
    const label=s.text('label',{text:'Curve',position:[-1,2],fontSize:.28,fill:'WHITE'});
    s.wait(2);s.keep(axis);s.keep(curve);s.keep(marker);s.keep(label);
  });`);
  // Entire Frames include camera, paint, opacity, transforms, stroke widths/range,
  // viewport state and geometry. Geometry-only comparisons miss visibility errors.
  expect(evaluateScene(lowered, 2)).toEqual(evaluateScene(native, 2));
  for (const time of [0, .5, 1, 1.5, 2]) {
    const frame = evaluateScene(lowered, time);
    expect(frame.camera).toEqual(evaluateScene(native, time).camera);
    expect(frame.elements.filter(element => element.id !== 'curve').map(element => ({
      id: element.id, fill: element.fill, stroke: element.stroke, opacity: element.opacity,
      position: element.position, scale: element.scale, strokeWidth: element.strokeWidth,
    }))).toEqual(evaluateScene(native, time).elements.filter(element => element.id !== 'curve').map(element => ({
      id: element.id, fill: element.fill, stroke: element.stroke, opacity: element.opacity,
      position: element.position, scale: element.scale, strokeWidth: element.strokeWidth,
    })));
  }
});

test('rejects malformed, incomplete or non-atomic protocols', () => {
  for (const text of ['', '{}', batch(scene, add), batch(add, scene, commit),
    batch(scene, scene, commit), batch(scene, commit, add), batch(scene, commit, commit),
    batch({ ...scene, extra: true }, commit), batch({ ...scene, mode: '4d' }, commit),
    batch({ ...scene, end: 'advance' }, commit), batch(scene, { op: 'remove', id: 'dot' }, commit),
    batch(scene, { ...add, kind: 'template' }, commit), batch(scene, { op: 'commit', ignored: true }),
    `${batch(scene)}\n{\n${batch(commit)}`, `\u0060\u0060\u0060json\n${batch(scene, commit)}\n\u0060\u0060\u0060`,
  ]) expect(() => lowerOperations(text)).toThrow();
});

test('rejects duplicate, missing and invalid IDs including simultaneous duplicate writes', () => {
  for (const records of [[add, add], [{ op: 'keep', ids: ['missing'] }],
    [{ op: 'animate', duration: 1, changes: [{ id: 'missing', props: { opacity: 1 } }] }],
    [add, { op: 'animate', duration: 1, changes: [{ id: 'dot', props: { opacity: 0 } }, { id: 'dot', props: { fill: 'BLUE' } }] }],
    [add, { op: 'keep', ids: ['dot', 'dot'] }],
    ...['', '@internal', '__proto__', 'constructor', 'prototype', 'x'.repeat(257)].map(id => [{ ...add, id }]),
  ]) expect(() => lowerOperations(batch(scene, ...records, commit))).toThrow();
});

test('rejects unsafe keys, unsupported props, invalid values and oversized structures', () => {
  const props = [
    { position: [0] }, { position: [0, 1, 2, 3] }, { position: ['0', 1] }, { radius: -1 },
    { radius: 0 }, { position: [1e20, 0] }, { fill: { color: 'BLUE' } }, { fill: 'url(secret)' },
    { strokeEnd: 1.1 }, { opacity: -1 }, { unexpected: 1 }, { points: [[0, 0], [1, 1]] },
  ];
  for (const prop of props) expect(() => lowerOperations(batch(scene, { ...add, props: prop }, commit))).toThrow();
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    expect(() => lowerOperations(`${batch(scene)}\n{"op":"add","kind":"circle","id":"x","props":{"${key}":{}}}\n${batch(commit)}`)).toThrow();
  }
  for (const duration of [-1, '1', 1e20]) expect(() => lowerOperations(batch(scene, { op: 'wait', duration }, commit))).toThrow();
  expect(() => lowerOperations(`${batch(scene)}\n{"op":"wait","duration":1e999}\n${batch(commit)}`)).toThrow();
  expect(() => lowerOperations(batch(scene, { op: 'animate', duration: 1, changes: [] }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, { op: 'wait', duration: 200 }, { op: 'wait', duration: 200 }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, add, { op: 'animate', duration: 1, changes: [{ id: 'dot', props: {} }] }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, add, { op: 'animate', duration: 1, changes: [{ id: 'dot', props: { radius: 2 } }] }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, { op: 'add', kind: 'path', id: 'p', props: { points: [[0, 0]] } }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, { op: 'add', kind: 'path', id: 'p', props: { points: Array.from({ length: 10000 }, () => [0, 0]) } }, commit))).toThrow();
  expect(() => lowerOperations(batch(scene, ...Array.from({ length: 10000 }, () => ({ op: 'wait', duration: 1 })), commit))).toThrow();
  expect(() => lowerOperations(' '.repeat(300000))).toThrow();
});
