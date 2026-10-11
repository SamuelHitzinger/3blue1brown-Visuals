import {describe,it,expect} from 'vitest';
import {createPeptideBuilders} from '../src/peptide-motion.js';
import type {PeptideSpec} from '../src/peptide-types.js';
import type {Vec3} from '../src/types.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import {readFileSync} from 'node:fs';
const api=createPeptideBuilders(),rad=(v:number)=>v*Math.PI/180;
// Pinned CCD ALA ideal heavy atoms, excluding the leaving terminal oxygen.
const spec=(n=72):PeptideSpec=>({residues:Array.from({length:n},(_,i)=>({id:`res-${i}`,component:'ALA'})),components:{ALA:{atoms:[{name:'N',position:[-.966,.493,1.5]},{name:'CA',position:[.257,.418,.692]},{name:'C',position:[-.094,.017,-.716]},{name:'O',position:[-1.056,-.682,-.923]},{name:'CB',position:[1.204,-.620,1.296]}],bonds:[['N','CA'],['CA','C'],['C','O'],['CA','CB']]}},peptideLength:1.33,angleCA_C_N:rad(116),angleC_N_CA:rad(121)});
const dist=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const spread=(a:Vec3[])=>{const mean=a[0].map((_,j)=>a.reduce((s,p)=>s+p[j],0)/a.length) as Vec3;return Math.sqrt(a.reduce((s,p)=>s+dist(p,mean)**2,0)/a.length);};
// Independent projection/atan2 measurement, not the construction's internal-coordinate basis.
const dihedral=(a:Vec3,b:Vec3,c:Vec3,d:Vec3)=>{
  const p=a.map((x,i)=>x-b[i]),axis=c.map((x,i)=>x-b[i]),q=d.map((x,i)=>x-c[i]),length=Math.hypot(...axis),u=axis.map(x=>x/length);
  const dot=(x:number[],y:number[])=>x.reduce((s,v,i)=>s+v*y[i],0),v=p.map((x,i)=>x-dot(p,u)*u[i]),w=q.map((x,i)=>x-dot(q,u)*u[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  return Math.atan2(dot(cross,w),dot(v,w));
};
describe('illustrative peptide internal coordinates',()=>{
  it('preserves every explicit displayed bond and side-chain identity through interior torsion poses',()=>{
    const s=spec(),rest=api.peptidePose(s,Array(72).fill(-Math.PI),Array(72).fill(Math.PI)),map=new Map(rest.atoms.map(a=>[a.id,a]));
    const lengths=rest.bonds.map(([a,b])=>dist(map.get(a)!.position,map.get(b)!.position));
    expect(rest.atoms).toHaveLength(360);expect(rest.bonds).toHaveLength(359);expect(rest.anchors).toHaveLength(72);
    for(let j=0;j<=100;j++){
      const r=api.peptidePose(s,Array(72).fill(rad(-180+120*j/100)),Array(72).fill(rad(180-225*j/100))),m=new Map(r.atoms.map(a=>[a.id,a]));
      expect(r.atoms.map(a=>a.id)).toEqual(rest.atoms.map(a=>a.id));expect(r.bonds).toEqual(rest.bonds);
      r.bonds.forEach(([a,b],i)=>expect(Math.abs(dist(m.get(a)!.position,m.get(b)!.position)-lengths[i])).toBeLessThan(1e-10));
      expect(r.atoms.every(a=>a.position.every(Number.isFinite))).toBe(true);
    }
    expect(api.peptidePose(s,Array(72).fill(-Math.PI),Array(72).fill(Math.PI))).toEqual(rest);
  });
  it('produces a sustained local helix with a smaller span than an extended chain, with exact trans-peptide planarity',()=>{
    const s=spec(24),r=api.peptidePose(s,Array(24).fill(rad(-60)),Array(24).fill(rad(-45))),extended=api.peptidePose(s,Array(24).fill(-Math.PI),Array(24).fill(Math.PI));
    expect(spread(r.anchors.map(a=>a.position))).toBeLessThan(spread(extended.anchors.map(a=>a.position))*.65);
    const repeat=r.anchors.slice(0,-4).map((a,i)=>dist(a.position,r.anchors[i+4].position));
    expect(Math.max(...repeat)-Math.min(...repeat)).toBeLessThan(1e-10);
    const m=new Map(r.atoms.map(a=>[a.id,a.position]));
    for(let i=0;i<23;i++){
      const c=m.get(`res-${i}/C`)!,o=m.get(`res-${i}/O`)!,n=m.get(`res-${i+1}/N`)!,ca=m.get(`res-${i+1}/CA`)!;
      const a=o.map((x,k)=>x-c[k]),b=n.map((x,k)=>x-c[k]),v=ca.map((x,k)=>x-c[k]);
      expect(Math.abs((a[1]*b[2]-a[2]*b[1])*v[0]+(a[2]*b[0]-a[0]*b[2])*v[1]+(a[0]*b[1]-a[1]*b[0])*v[2])).toBeLessThan(1e-10);
    }
  });
  it('rejects sparse, degenerate, disconnected, duplicate, and excessive inputs',()=>{
    expect(()=>api.peptidePose(spec(97),[],[])).toThrow(/budget/i);
    expect(()=>api.peptidePose(spec(2),Array(2),[0,0])).toThrow(/torsion/i);
    const dup=spec(2);dup.residues[1].id=dup.residues[0].id;expect(()=>api.peptidePose(dup,[0,0],[0,0])).toThrow(/identity/i);
    const bad=spec(2);bad.components.ALA.atoms[2].position=[...bad.components.ALA.atoms[1].position];expect(()=>api.peptidePose(bad,[0,0],[0,0])).toThrow(/degenerate/i);
    const broken=spec(2);broken.components.ALA.bonds.pop();expect(()=>api.peptidePose(broken,[0,0],[0,0])).toThrow(/connected/i);
  });
  it('matches requested signed phi/psi dihedrals and trans omega using independent measurements',()=>{
    const s=spec(12),phi=Array.from({length:12},(_,i)=>-2.4+i*.37),psi=Array.from({length:12},(_,i)=>2.6-i*.43),r=api.peptidePose(s,phi,psi),m=new Map(r.atoms.map(a=>[a.id,a.position]));
    const atom=(i:number,name:string)=>m.get(`res-${i}/${name}`)!,error=(actual:number,target:number)=>Math.abs(Math.atan2(Math.sin(actual-target),Math.cos(actual-target)));
    for(let i=0;i<11;i++){
      expect(error(dihedral(atom(i,'CA'),atom(i,'C'),atom(i+1,'N'),atom(i+1,'CA')),Math.PI)).toBeLessThan(1e-12);
      expect(error(dihedral(atom(i,'N'),atom(i,'CA'),atom(i,'C'),atom(i+1,'N')),psi[i])).toBeLessThan(1e-12);
      expect(error(dihedral(atom(i,'C'),atom(i+1,'N'),atom(i+1,'CA'),atom(i+1,'C')),phi[i+1])).toBeLessThan(1e-12);
    }
  });
  it('is standalone after erasure and leaves input templates untouched',()=>{
    const s=spec(3),before=JSON.stringify(s),phi=[-.5,-1,-1.2],psi=[.4,-.8,-1];
    const isolated=new Function(`return (${createPeptideBuilders.toString()})()`)() as typeof api;
    expect(isolated.peptidePose(s,phi,psi)).toEqual(api.peptidePose(s,phi,psi));expect(JSON.stringify(s)).toBe(before);
  });
  it('runs public peptide poses in retained QuickJS callbacks with reversible interior motion',async()=>{
    const s=spec(12),source=`export default scene({},s=>{const spec=${JSON.stringify(s)};const pose=t=>s.peptidePose(spec,Array(12).fill(-3+t),Array(12).fill(3-t));const mesh=s.mesh('peptide',s.molecularBackboneGeometry({segments:pose(0).anchors.map(a=>({id:a.id,chainId:'A',residues:[a]})),bonds:[],representation:'beads',radius:.3,provenance:{kind:'schematic',source:'original',units:'arbitrary'}}).meshes[0]);s.bind(mesh,[s.time],t=>({vertices:s.molecularBackboneGeometry({segments:pose(t).anchors.map(a=>({id:a.id,chainId:'A',residues:[a]})),bonds:[],representation:'beads',radius:.3,provenance:{kind:'schematic',source:'original',units:'arbitrary'}}).meshes[0].vertices}));s.wait(2);});`;
    await withOfflineScene(source,{},sampler=>{const a=sampler.sample(.4),b=sampler.sample(1.4);expect(a.elements[0].geometry.vertices).not.toEqual(b.elements[0].geometry.vertices);expect(sampler.sample(.4)).toEqual(a);});
  });
  it('reconstructs the authored mixed-component endpoint and preserves its bonds during coil compaction',()=>{
    const root=new URL('../fixtures/biological/illustrative-peptide/',import.meta.url),rig=JSON.parse(readFileSync(new URL('rig.json',root),'utf8')),endpoint=JSON.parse(readFileSync(new URL('endpoint.json',root),'utf8'));
    const end=api.peptidePose(rig.spec,rig.compact.phi,rig.compact.psi);expect(end).toEqual(endpoint);expect(end.atoms).toHaveLength(414);
    const finalMap=new Map(end.atoms.map(a=>[a.id,a.position])),lengths=end.bonds.map(([a,b])=>dist(finalMap.get(a)!,finalMap.get(b)!));
    for(let i=0;i<=100;i++){
      const angles=(key:'phi'|'psi')=>rig.coil[key].map((a:number,j:number)=>a+(rig.compact[key][j]-a)*i/100),p=api.peptidePose(rig.spec,angles('phi'),angles('psi')),m=new Map(p.atoms.map(a=>[a.id,a.position]));
      p.bonds.forEach(([a,b],j)=>expect(Math.abs(dist(m.get(a)!,m.get(b)!)-lengths[j])).toBeLessThan(1e-10));
    }
    const model=JSON.parse(readFileSync(new URL('illustrative-peptide-surface.json',root),'utf8'));expect(model.provenance.converter.options.origin).toEqual(end.center);
  });
});
