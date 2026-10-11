import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {createPeptideBuilders} from '../src/peptide-motion.js';
import {rotate} from '../src/geometry.js';
import type {Vec3} from '../src/types.js';
const modulePath='../demo/expansion/peptide-staged-pose.mjs';
const {createStagedPeptideSampler}=await import(modulePath);
const fixture='../fixtures/biological/';
const read=async(path:string)=>JSON.parse(await readFile(new URL(fixture+path,import.meta.url),'utf8'));
const [rig,stage,endpoint]=await Promise.all([read('illustrative-peptide/rig.json'),read('peptide-staged/staging.json'),read('illustrative-peptide/endpoint.json')]);
const api=createPeptideBuilders();
const variables:[string,number][]=[];for(let block=1;block<4;block++){const start=block*20;variables.push(['psi',start-9]);for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);}
const keyframes=stage.samples.map((s:{progress:number;angles:Record<string,number[]>})=>({progress:s.progress,values:variables.map(([key,index])=>s.angles[key][index])}));
const sample=createStagedPeptideSampler(api,rig,keyframes) as (time:number)=>{pose:ReturnType<typeof api.peptidePose>;basis:Vec3[]};
const distance=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,i)=>v-b[i]));

it('keeps actual peptide atoms and all bonds through staged formation and packing',()=>{
  const first=sample(0).pose,ids=first.atoms.map(a=>a.id),map=new Map(first.atoms.map(a=>[a.id,a.position]));
  const lengths=first.bonds.map(([a,b])=>distance(map.get(a)!,map.get(b)!));let maximum=0;
  for(let j=0;j<=200;j++){
    const p=sample(j/20).pose,m=new Map(p.atoms.map(a=>[a.id,a.position]));
    expect(p.atoms.map(a=>a.id)).toEqual(ids);expect(p.bonds).toEqual(first.bonds);
    p.bonds.forEach(([a,b],i)=>maximum=Math.max(maximum,Math.abs(distance(m.get(a)!,m.get(b)!)-lengths[i])));
  }
  expect(maximum).toBeLessThan(1e-10);
});

it('keeps the four helical blocks side-visible and separated throughout formation',()=>{
  for(let j=0;j<=120;j++){
    const p=sample(j*4.2/120).pose;
    for(let block=0;block<4;block++){
      const a=p.anchors[block*20+1].position,b=p.anchors[block*20+10].position,d=distance(a,b);
      expect(Math.abs(b[2]-a[2])/d).toBeLessThan(.025);
      expect(Math.abs(b[0]-a[0])/d).toBeGreaterThan(.98);
      const rowCenter=(b:number)=>p.anchors.slice(b*20,b*20+12).reduce((sum,a)=>sum+a.position[1]/12,0);
      if(block)expect(rowCenter(block)-rowCenter(block-1)).toBeCloseTo(10,1);
    }
  }
});

it('preserves the original compact endpoint with the same rigid transform as its surface',()=>{
  const {pose,basis}=sample(10),rotation:Vec3=[Math.atan2(basis[2][1],basis[2][2]),Math.asin(-basis[2][0]),Math.atan2(basis[1][0],basis[0][0])];
  endpoint.atoms.forEach((atom:{id:string;position:Vec3},i:number)=>{
    const local=atom.position.map((v,k)=>v-endpoint.center[k]) as Vec3;
    expect(pose.atoms[i].id).toBe(atom.id);expect(distance(pose.atoms[i].position,rotate(local,rotation))).toBeLessThan(1e-9);
  });
  const a=sample(1.337);sample(10);sample(0);expect(sample(1.337)).toEqual(a);
});
