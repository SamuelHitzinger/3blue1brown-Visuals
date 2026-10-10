import { describe, expect, it } from 'vitest';
import { createCoordinateBuilders } from '../src/diagrams/coordinates.js';
import { buildScene } from '../src/runtime.js';
import type { SceneContext, Vec2 } from '../src/types.js';

function setup() {
  const callbacks = new Map<string, (...v:number[])=>any>();
  let plane!: ReturnType<ReturnType<typeof createCoordinateBuilders>['plane']>;
  const scene = buildScene({}, s => {
    const adapter: SceneContext = { ...s, bind(h, _deps, fn) { callbacks.set(h.id, fn); } };
    plane = createCoordinateBuilders(adapter).plane('p', {xRange:[-2,2], yRange:[-2,2], origin:[1,-1], scale:[2,3]});
    plane.vector('v',[2,1]);
    plane.components('c',[2,1]);
    plane.path('square',[[0,0],[1,0],[1,1],[0,1]],{closed:true});
    plane.label('label','v',[2,1],[0.2,0.3]);
    plane.map([s.time], ([x,y], t) => [x+t*y,y]);
  });
  return {plane,callbacks,scene};
}
describe('shared coordinate world',()=>{
  it('preserves source correspondence, origin, grid parallels and weighted basis at all interior times',()=>{
    const {plane,callbacks,scene}=setup(); const ids=scene.initial.map(e=>e.id);
    for(const t of [0,.25,.5,.75,1,.25,0]) {
      expect(callbacks.get('p/v')!(t).points).toEqual([[1,-1],[1+2*(2+t),2]]);
      const square=callbacks.get('p/square')!(t).points;
      expect(square[0]).toEqual([1,-1]);
      expect(square[2]).toEqual([1+2*(1+t),2]);
      const c1=callbacks.get('p/c/x')!(t).points,c2=callbacks.get('p/c/y')!(t).points;
      expect(c1[1]).toEqual(c2[0]);expect(c2[1]).toEqual(callbacks.get('p/v')!(t).points[1]);
      const grid=plane.grid.slice(0,5).map(h=>callbacks.get(h.id)!(t).points);
      expect(grid.map(p=>[p[1][0]-p[0][0],p[1][1]-p[0][1]])).toEqual(Array(5).fill([8*t,12]));
      expect(callbacks.get('p/label')!(t)).toEqual({position:[1+2*(2+t)+.2,2.3]});
    }
    expect(scene.initial.map(e=>e.id)).toEqual(ids);
  });
  it('accepts singular maps and true rotations without changing source points',()=>{
    buildScene({},s=>{
      const callbacks: ((t:number)=>any)[]=[];
      const p=createCoordinateBuilders({...s,bind(_h,_d,fn){callbacks.push(fn);}}).plane('p',{xRange:[-1,1],yRange:[-1,1],grid:false,axes:false,ticks:false});
      p.vector('v',[3,4]);p.map([s.time],([x,y],t)=>[x*Math.cos(t)-y*Math.sin(t),x*Math.sin(t)+y*Math.cos(t)]);
      for(const t of [0,.25,.5,.75,1]) expect(Math.hypot(...callbacks[0](t).points[1])).toBeCloseTo(5);
    });
    buildScene({},s=>{const p=createCoordinateBuilders({...s,bind(_h,_d,fn){expect(fn(0)).toEqual({points:[[0,0],[0,0]]});}}).plane('q',{xRange:[-1,1],yRange:[-1,1],grid:false,axes:false,ticks:false});p.path('x',[[0,0],[1,1]]);p.map([s.time],()=>[0,0]);});
  });
  it('rejects invalid ranges, excessive grids/samples and nonfinite mapped output',()=>{
    for(const range of [[1,1],[2,1],[0,Infinity]]) expect(()=>buildScene({},s=>createCoordinateBuilders(s).plane('p',{xRange:range as Vec2,yRange:[0,1]}))).toThrow();
    expect(()=>buildScene({},s=>createCoordinateBuilders(s).plane('p',{xRange:[0,1e5],yRange:[0,1],step:.001}))).toThrow(/budget|limit/);
    expect(()=>buildScene({},s=>createCoordinateBuilders(s).plane('p',{xRange:[0,1],yRange:[0,1]}).curve('c',x=>[x,x],[0,1],20001))).toThrow(/sample/);
    expect(()=>buildScene({},s=>{const p=createCoordinateBuilders({...s,bind(_h,_d,fn){fn(0);}}).plane('p',{xRange:[0,1],yRange:[0,1]});p.map([s.time],()=>[NaN,0]);})).toThrow(/finite/);
  });
  it('samples exact curve endpoints, snapshots caller coordinates and maps later members with the same function',()=>{
    const callbacks=new Map<string,(...values:number[])=>any>();
    buildScene({},s=>{
      const p=createCoordinateBuilders({...s,bind(h,_d,fn){callbacks.set(h.id,fn);}}).plane('p',{xRange:[-2,2],yRange:[-2,2],grid:false,axes:false,ticks:false});
      const original:Vec2[]=[[0,0],[1,2]];p.path('captured',original);original[1][0]=99;
      p.map([s.time],([x,y],t)=>[x+t*y,y]);
      p.curve('curve',t=>[t,t*t],[-1,1],3);
      expect(callbacks.get('p/captured')!(1).points).toEqual([[0,0],[3,2]]);
      expect(callbacks.get('p/curve')!(1).points).toEqual([[0,1],[0,0],[2,1]]);
      expect(()=>p.map([s.time],p=>p)).toThrow(/already/);
    });
  });
});
