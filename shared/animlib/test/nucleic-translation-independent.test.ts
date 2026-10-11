import {expect,it} from 'vitest';
import {getQuickJS} from 'quickjs-emscripten';
import {createNucleicTranslationBuilders} from '../src/nucleic-translation.js';
import type {NucleicTranslationProps} from '../src/nucleic-translation-types.js';

// Independently grouped assignments, cross-checked against NCBI table 1.
const groups:Record<string,string>={Phe:'UUU UUC',Leu:'UUA UUG CUU CUC CUA CUG',Ile:'AUU AUC AUA',Met:'AUG',Val:'GUU GUC GUA GUG',Ser:'UCU UCC UCA UCG AGU AGC',Pro:'CCU CCC CCA CCG',Thr:'ACU ACC ACA ACG',Ala:'GCU GCC GCA GCG',Tyr:'UAU UAC',His:'CAU CAC',Gln:'CAA CAG',Asn:'AAU AAC',Lys:'AAA AAG',Asp:'GAU GAC',Glu:'GAA GAG',Cys:'UGU UGC',Trp:'UGG',Arg:'CGU CGC CGA CGG AGA AGG',Gly:'GGU GGC GGA GGG'};
const complement:Record<string,string>={A:'U',U:'A',G:'C',C:'G'};
const fixture=(codons=['AUG','GGU','GCU'],names=['Met','Gly','Ala'],stop='UAA'):NucleicTranslationProps=>({
 sites:Array.from(codons.join('')+stop,(base,i)=>({id:'r'+i,base:base as 'A'})),carriers:codons.map((c,i)=>({id:'t'+i,residueId:'p'+i,aminoAcid:names[i],anticodon:Array.from(c,b=>complement[b]).join('')})),
 direction:'5to3',anticodonDirection:'3to5',origin:[0,0,0],axis:[1,0,0],normal:[0,1,0],pitch:.6,carrierHeight:2,peptideSpacing:.5,arrivalOffset:[-4,1,2],exitOffset:[-3,-1,2],subunitSeparation:2,assembly:{start:0,duration:2},start:3,cycleDuration:4,releaseDuration:2,disassemblyDuration:2,
});
const evaluate=createNucleicTranslationBuilders().nucleicTranslationCycle;
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
it('independently checks all 61 sense codons, their anticodons, wrong cargo, and three stops',()=>{
 let count=0;
 for(const [name,list]of Object.entries(groups))for(const codon of list.split(' ')){
  const p=fixture(['AUG',codon],['Met',name]);
  expect(evaluate(p,100).codons.map(c=>c.aminoAcid)).toEqual(['Met',name,null]);
  p.carriers[1].aminoAcid=name==='Met'?'Gly':'Met';expect(()=>evaluate(p,-1)).toThrow(/cargo/);count++;
 }
 expect(count).toBe(61);
 for(const stop of ['UAA','UAG','UGA']){
  const r=evaluate(fixture(['AUG'],['Met'],stop),100);
  expect(r.product.residues.map(x=>x.aminoAcid)).toEqual(['Met']);expect(r.product.bonds).toEqual([]);expect(r.product.released).toBe(true);
 }
});
it('matches complete QuickJS state within 1e-11 at exact boundaries and reverses exactly per engine',async()=>{
 const q=await getQuickJS(),vm=q.newContext(),p=fixture();p.productCoil={radius:.2,twist:1.3};
 const times=[-1e100,0,2,3,15,15.8,16,17.2,18,20,1e100];
 for(let i=0;i<3;i++)for(const f of [0,.25,.3,.5,.7,.95,1])for(const delta of [-1e-8,0,1e-8])times.push(3+4*(i+f)+delta);
 const run=(source:string)=>{const out=vm.evalCode(source);if(out.error){const error=vm.dump(out.error);out.error.dispose();throw Error(JSON.stringify(error));}const value=vm.dump(out.value);out.value.dispose();return value;};
 try{
  run('globalThis.api=('+createNucleicTranslationBuilders.toString()+')();globalThis.p='+JSON.stringify(p));
  const compare=(a:any,b:any):void=>{
   if(typeof a==='number'&&typeof b==='number'){expect(Math.abs(a-b)).toBeLessThanOrEqual(1e-11);return;}
   if(a&&b&&typeof a==='object'&&typeof b==='object'){expect(Object.keys(a)).toEqual(Object.keys(b));for(const key of Object.keys(a))compare(a[key],b[key]);return;}
   expect(a).toEqual(b);
  };
  const saved=times.map(t=>{const host=JSON.stringify(evaluate(p,t)),vmText=run('JSON.stringify(api.nucleicTranslationCycle(p,'+t+'))');compare(JSON.parse(vmText),JSON.parse(host));return {host,vmText};});
  for(let i=times.length-1;i>=0;i--){expect(run('JSON.stringify(api.nucleicTranslationCycle(p,'+times[i]+'))')).toBe(saved[i].vmText);expect(JSON.stringify(evaluate(p,times[i]))).toBe(saved[i].host);}
 }finally{vm.dispose();}
});
it('retains exact edges and attachment at dense poses in a rotated translated frame',()=>{
 const p=fixture();p.origin=[17,-31,8];p.axis=[1,2,3];p.normal=[-2,4,1];p.productCoil={radius:.2,twist:1.3};
 for(let i=0;i<=800;i++){
  const r=evaluate(p,i/40),res=r.product.residues;
  for(const [a,b]of r.product.bonds)expect(distance(res.find(x=>x.id===a)!.position,res.find(x=>x.id===b)!.position)).toBeCloseTo(.5,10);
  for(const c of r.carriers){expect(Math.hypot(...c.normal)).toBeCloseTo(1,12);expect(Math.hypot(...c.tangent)).toBeCloseTo(1,12);expect(c.normal.reduce((s,v,k)=>s+v*c.tangent[k],0)).toBeCloseTo(0,12);}
  if(r.product.attachedCarrierId){const c=r.carriers.find(c=>c.id===r.product.attachedCarrierId)!;const last=res.filter(x=>x.incorporated).at(-1)!;expect(distance(c.payloadPosition,last.position)).toBeLessThan(1e-10);}
 }
});
it('bounds the longest permitted high-pitch schedule at initial, final, and interior poses',()=>{
 const p=fixture(Array(63).fill('AUG'),Array(63).fill('Met'));Object.assign(p,{pitch:10,carrierHeight:20,peptideSpacing:5,origin:[1000,-1000,1000],axis:[1,1,1],normal:[1,-1,0],arrivalOffset:[1000,-1000,1000],exitOffset:[-1000,1000,-1000],subunitSeparation:20});
 for(const t of [-1e100,0,126,258,1e100]){
  const r=evaluate(p,t),positions=[...r.rna.anchors.flatMap(a=>[a.backbone,a.tip,a.tangent,a.normal]),...r.carriers.flatMap(c=>[c.position,c.payloadPosition,c.tangent,c.normal]),...r.product.residues.map(a=>a.position),...r.subunits.map(s=>s.position)];
  expect(r.rna.anchors).toHaveLength(192);expect(r.product.residues).toHaveLength(63);
  for(const v of positions)for(const x of v){expect(Number.isFinite(x)).toBe(true);expect(Math.abs(x)).toBeLessThan(250000);}
 }
});
it('rejects malformed arrays, vectors, orientations, numeric fields, and schedules before start',()=>{
 const mutations:Array<(p:any)=>void>=[p=>delete p.carriers[1],p=>p.carriers.push(p.carriers[0]),p=>p.sites.push({id:'extra',base:'A'}),p=>p.sites[1].id='t0',p=>p.sites[0].base='',p=>p.direction='3to5',p=>p.anticodonDirection='5to3',p=>p.axis=[0,0,0],p=>p.normal=[2,0,0],p=>p.origin=[0,,0],p=>p.arrivalOffset=[0,0,1001],p=>p.exitOffset=[0,NaN,0],p=>p.assembly=null,p=>p.assembly.duration=4,p=>p.start=86399,p=>p.productCoil={radius:5,twist:Math.PI}];
 for(const field of ['pitch','carrierHeight','peptideSpacing','subunitSeparation','start','cycleDuration','releaseDuration','disassemblyDuration'])for(const v of [NaN,Infinity,-1])mutations.push(p=>p[field]=v);
 for(const mutate of mutations){const p=fixture();mutate(p);expect(()=>evaluate(p,-100)).toThrow();}
 for(const time of [NaN,Infinity,-Infinity])expect(()=>evaluate(fixture(),time)).toThrow(/time/);
});
