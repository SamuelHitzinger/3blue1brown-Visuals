import {expect,it,vi} from 'vitest';
import {meshTriangles} from '../src/mesh-shading.js';
import type {Geometry} from '../src/types.js';

it('normalizes shared authored normals once without per-face fallback work',()=>{
  const mesh:Geometry={kind:'mesh',shading:'smooth',vertices:[[0,0,0],[3.14159,0,0],[0,2.71828,0]],
    triangles:Array.from({length:100},()=>[0,1,2]),normals:[[0,3,4],[0,3,4],[0,3,4]]};
  const hypot=vi.spyOn(Math,'hypot');
  let calls=0;
  try{const result=meshTriangles(mesh);calls=hypot.mock.calls.length;expect(result.normals).toEqual(Array.from({length:300},()=>[0,.6,.8]));}
  finally{hypot.mockRestore();}
  expect(calls).toBe(3);
});

it('preserves per-face fallbacks for zero, missing and nonfinite authored normals',()=>{
  const mesh:Geometry={kind:'mesh',shading:'smooth',vertices:[[0,0,0],[5.123,0,0],[0,7.456,0],[0,0,0]],
    triangles:[[0,1,2],[2,1,0],[0,3,1]],normals:[[0,0,0],[0,0,0],[0,0,0]]};
  const expected=[[0,0,1],[0,0,1],[0,0,1],[0,0,-1],[0,0,-1],[0,0,-1],[0,0,1],[0,0,1],[0,0,1]];
  expect(meshTriangles(mesh).normals).toEqual(expected);
  expect(meshTriangles({...mesh,normals:[]}).normals).toEqual(expected);
  expect(meshTriangles({...mesh,normals:[[Infinity,0,0],[NaN,0,0],[0,0,0]]}).normals).toEqual(expected);
  expect(meshTriangles({...mesh,normals:undefined}).normals).toEqual(expected);
});
