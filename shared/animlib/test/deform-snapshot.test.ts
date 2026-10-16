import { afterEach, expect, it, vi } from 'vitest';
import { buildScene } from '../src/runtime.js';
import { createSceneProgram } from '../src/compiler.js';
import type { ReactiveUpdate } from '../src/types.js';

afterEach(() => vi.restoreAllMocks());

it('does not serialize privately owned numeric deformation snapshots twice', () => {
  let update!: (values: Record<string, number>, changed: string[], time?: number) => ReactiveUpdate[];
  buildScene({}, s => {
    const mesh = s.surface('m', { fn: () => 0, xSegments: 10, ySegments: 10 });
    s.deform(mesh, [s.time], ([x, y], _i, t) => [x, y, t]); s.wait(3);
  }, {}, fn => { update = fn; });
  const parse = vi.spyOn(JSON, 'parse');
  const result = update({}, [], 2);
  expect(parse).not.toHaveBeenCalled();
  expect(result[0].properties.vertices).toHaveLength(121);
  expect(result[0].properties.vertices!.every(p => p[2] === 2)).toBe(true);
});

it('keeps input, reused callback outputs, later callbacks and returned updates isolated', async () => {
  const program = await createSceneProgram(`export default scene({},s=>{
    const m=s.surface('m',{fn:()=>0,xSegments:1,ySegments:1});
    const scratch=[0,0,0];
    s.deform(m,[s.time],(p,i,t)=>{scratch[0]=p[0];scratch[1]=p[1];scratch[2]=t;p[0]=99;return scratch;});
    const c=s.circle('c');s.bind(c,[s.time],t=>{scratch[0]=88;scratch[2]=77;return {radius:1+t};});s.wait(3);
  });`);
  try {
    const first = program.update({}, [], 1);
    const expected = structuredClone(first[0].properties.vertices!);
    expect(new Set(expected.map(p => p[0] + ',' + p[1])).size).toBe(4);
    expect(expected.every(p => p[2] === 1 && p[0] !== 99 && p[0] !== 88)).toBe(true);
    first[0].properties.vertices![0][0] = 123;
    program.update({}, [], 2);
    expect(program.update({}, [], 1)[0].properties.vertices).toEqual(expected);
  } finally { program.dispose(); }
});

it('preserves immediate snapshots for ordinary bindings sharing mutable arrays', async () => {
  const program = await createSceneProgram(`export default scene({},s=>{
    const shared=[[0,0,0],[1,0,0],[0,1,0]],triangles=[[0,1,2]];
    const a=s.mesh('a',{vertices:shared,triangles}),b=s.mesh('b',{vertices:shared,triangles});
    s.bind(a,[s.time],t=>{shared[0][2]=t;return {vertices:shared};});
    s.bind(b,[s.time],t=>{shared[0][2]=t+1;return {vertices:shared};});s.wait(3);
  });`);
  try {
    expect(program.update({}, [], 2).map(u => u.properties.vertices![0])).toEqual([[0,0,2],[0,0,3]]);
  } finally { program.dispose(); }
});

it('keeps JSON normalization for signed zero and custom numeric serialization', async () => {
  const program = await createSceneProgram(`export default scene({},s=>{
    const m=s.surface('m',{fn:()=>0,xSegments:1,ySegments:1});
    s.deform(m,[s.time],(p,i,t)=>[-0,p[1],{toJSON(){return t;}}]);s.wait(3);
  });`);
  try {
    const vertices = program.update({}, [], 2)[0].properties.vertices!;
    expect(vertices.every(p => Object.is(p[0], 0) && p[2] === 2)).toBe(true);
  } finally { program.dispose(); }
});

it('normalizes primitive signed zero for direct retained runtime callers', () => {
  let update!: (values: Record<string, number>, changed: string[], time?: number) => ReactiveUpdate[];
  buildScene({}, s => {
    const m = s.surface('m', { fn: () => 0, xSegments: 1, ySegments: 1 });
    s.deform(m, [s.time], (p, _i, t) => [-0, p[1], t]); s.wait(3);
  }, {}, fn => { update = fn; });
  expect(update({}, [], 2)[0].properties.vertices!.every(p => Object.is(p[0], 0))).toBe(true);
});

it('preserves inherited array JSON hooks and rejects invalid values without poisoning later updates', async () => {
  const program = await createSceneProgram(`export default scene({},s=>{
    const m=s.surface('m',{fn:()=>0,xSegments:1,ySegments:1});
    s.deform(m,[s.time],(p,i,t)=>{
      if(t>0)Array.prototype.toJSON=function(){return this.length===3&&typeof this[0]==='number'&&typeof this[2]==='number'?[this[0],this[1],this[2]+1]:this;};
      return [p[0],p[1],t===1?Infinity:t];
    });s.wait(3);
  });`);
  try {
    expect(() => program.update({}, [], 1)).toThrow();
    // One per-binding JSON snapshot and one outer transport stringify.
    expect(program.update({}, [], 2)[0].properties.vertices!.every(p => p[2] === 4)).toBe(true);
  } finally { program.dispose(); }
});
