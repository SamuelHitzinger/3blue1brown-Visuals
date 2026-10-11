import {expect,it} from 'vitest';
import {createNucleicProcessingBuilders} from '../src/nucleic-processing.js';
import type {NucleicSpliceProps,NucleicThreadProps} from '../src/nucleic-processing-types.js';
import type {Vec3} from '../src/types.js';
const api=createNucleicProcessingBuilders();
// Frozen proof inputs, kept hermetic so this review suite also runs without local media.
const splice=():NucleicSpliceProps=>({sites:Array.from({length:40},(_,i)=>({id:'rna-'+i,base:'AUGC'[i%4] as 'A',position:[(i-19.5)*.17,(i-19.5)*.25,0]})),intron:{start:10,end:29},initialNormal:[-.25,.17,0],baseReach:.26,joinDistance:.3,formation:{start:.18,end:.49,angle:5.2,bendDirection:[-.25,.17,0]},phases:{cut:.56,closeEnd:.73,departEnd:.92},departure:{translation:[-2.1,1.25,.05],axis:[0,0,1],angle:-.28}});
const thread=():NucleicThreadProps=>({sites:Array.from({length:26},(_,i)=>({id:'export-'+i,base:'AUGC'[i%4] as 'A',offset:i*.24})),path:Array.from({length:241},(_,i)=>{const z=-6+i*.05;if(z<-1){const u=(-z-1)/5,a=u*5.2;return [2.8*Math.sin(a)*u,1.8*(1-Math.cos(a))*u,z];}if(z>1){const u=(z-1)/5;return [4*u*u,1.5*Math.sin(Math.PI*u),z];}return [0,0,z];}),initialNormal:[0,1,0],baseReach:.14,aperture:{center:[0,0,0],normal:[0,0,1],radius:1.05,halfThickness:.75,chainRadius:.22}});
const close=(a:number[],b:number[])=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],9));
it('independent formation audit is rigid-coordinate equivariant, including tiny bends',()=>{
 const p=splice();
 const rotate=(v:Vec3):Vec3=>[v[2],v[0],v[1]],translate=(v:Vec3):Vec3=>{const r=rotate(v);return [r[0]+17,r[1]-29,r[2]+11];};
 for(const angle of [1e-14,1e-8,Math.PI,p.formation!.angle]){
  const q=structuredClone(p);q.formation!.angle=angle;
  const r=structuredClone(q);r.sites.forEach(s=>s.position=translate(s.position));r.initialNormal=rotate(r.initialNormal);r.formation!.bendDirection=rotate(r.formation!.bendDirection);r.departure.axis=rotate(r.departure.axis);r.departure.translation=rotate(r.departure.translation);
  for(const t of [0,.19,.31,.45,.52,.67,.9,1]){
   const a=api.nucleicSplice(q,t),b=api.nucleicSplice(r,t);expect(b.bonds).toEqual(a.bonds);
   a.anchors.forEach((v,i)=>{close(b.anchors[i].backbone,translate(v.backbone));close(b.anchors[i].normal,rotate(v.normal));close(b.anchors[i].tangent,rotate(v.tangent));});
  }
 }
});
it('independent full encoded pore schedule holds state across the cut and clears all rendered chords',()=>{
 const p=thread();
 const smooth=(t:number,a:number,duration:number)=>{const u=Math.max(0,Math.min(1,(t-a)/duration));return u*u*(3-2*u);};
 const pose=(t:number)=>api.nucleicThread(p,smooth(t<=4.4?t:t<4.9?4.4:t-.5,.6,8));
 for(const t of [4.4,4.649,4.65,4.899999,4.9])expect(pose(t)).toEqual(pose(4.4));
 let minimum=Infinity;
 for(let frame=0;frame<300;frame++){
  const r=pose(frame/30),a=p.aperture;
  for(let j=1;j<r.anchors.length;j++){
   const x=r.anchors[j-1].backbone,y=r.anchors[j].backbone;
   // Independent dense interior samples, in addition to the author's convex endpoint proof.
   for(let k=0;k<=40;k++){
    const v=x.map((z,i)=>z+(y[i]-z)*k/40-a.center[i]);
    const axial=v.reduce((sum,z,i)=>sum+z*a.normal[i],0);
    if(Math.abs(axial)>a.halfThickness+a.chainRadius)continue;
    const radial=Math.hypot(...v.map((z,i)=>z-axial*a.normal[i]));
    minimum=Math.min(minimum,a.radius-a.chainRadius-radial);
   }
  }
 }
 expect(minimum).toBeGreaterThan(.79);
});
