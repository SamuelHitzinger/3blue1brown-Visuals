import { test, expect } from 'bun:test';
import { createSceneProgram } from '../../shared/animlib/src/compiler.js';
import { frameWithUpdates } from './realtime-deform-copy-probe.js';

test('probe applies returned deformation updates without mutating initial scene', async () => {
  const program=await createSceneProgram(`export default scene({mode:'3d'},s=>{const m=s.surface('surface',{fn:(x,y)=>Math.sin(x)*Math.cos(y),xRange:[-3,3],yRange:[-3,3],xSegments:2,ySegments:2});s.deform(m,[s.time],(p,i,t)=>[p[0],p[1],Math.sin(p[0]+t)*Math.cos(p[1])]);s.wait(10);});`);
  try {
    const before=JSON.stringify(program.scene),time=1.25,updates=program.update({},[],time);
    const frame=frameWithUpdates(program.scene,updates,time),p=frame.elements.find(e=>e.id==='surface')!.geometry.vertices![0];
    expect(p[2]).toBeCloseTo(Math.sin(p[0]+time)*Math.cos(p[1]),14);
    expect(p[2]).not.toBeCloseTo(Math.sin(p[0])*Math.cos(p[1]),8);
    expect(JSON.stringify(program.scene)).toBe(before);
  } finally {program.dispose();}
});
