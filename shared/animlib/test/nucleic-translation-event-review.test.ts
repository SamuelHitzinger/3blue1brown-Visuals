import {expect,it} from 'vitest';
import {getQuickJS} from 'quickjs-emscripten';
import {createNucleicTranslationBuilders} from '../src/nucleic-translation.js';
import type {NucleicTranslationProps} from '../src/nucleic-translation-types.js';

// Reviewer regression: discrete state follows explicitly computed absolute events.
const props=(start=3,cycleDuration=4.4):NucleicTranslationProps=>({
 sites:Array.from('AUGGGUGCUUAA',(base,i)=>({id:'r'+i,base:base as 'A'})),
 direction:'5to3',anticodonDirection:'3to5',
 carriers:['Met','Gly','Ala'].map((aminoAcid,i)=>({id:'t'+i,residueId:'p'+i,aminoAcid,anticodon:['UAC','CCA','CGA'][i]})),
 origin:[0,0,0],axis:[1,0,0],normal:[0,1,0],pitch:.6,carrierHeight:2.2,peptideSpacing:.46,
 arrivalOffset:[-4,1,2.2],exitOffset:[-2.5,-1.1,2],subunitSeparation:1.75,
 assembly:{start:.2,duration:2},start,cycleDuration,releaseDuration:2,disassemblyDuration:2,
});
const evaluate=createNucleicTranslationBuilders().nucleicTranslationCycle;
function adjacent(t:number,up:boolean){const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,t);v.setBigUint64(0,v.getBigUint64(0)+(up?1n:-1n));return v.getFloat64(0);}
const schedules=[[3,4.4],[3,.7],[80000,.1]];
const around=(t:number)=>[adjacent(t,false),t,adjacent(t,true)];

it('incorporates initial Met at its exact absolute quarter-cycle event',()=>{
 const p=props(),t=p.start+.25*p.cycleDuration;
 expect(t).toBe(4.1);
 expect(evaluate(p,adjacent(t,false)).product.residues[0].incorporated).toBe(false);
 expect(evaluate(p,t).product.residues[0].incorporated).toBe(true);
 expect(evaluate(p,t).product.attachedCarrierId).toBe('t0');
});

it('uses absolute arrival and exit events for carrier/residue visibility and loaded state',()=>{
 for(const [start,duration]of schedules){const p=props(start,duration),release=start+3*duration+.25*duration;
  for(let i=0;i<3;i++){
   const arrival=start+i*duration,spent=i===2?release:start+(i+1+.5)*duration;
   const exit=i===2?release+.6*p.releaseDuration:start+(i+1+.95)*duration;
   for(const event of [arrival,spent,exit])for(const t of around(event)){
    const r=evaluate(p,t),label=`start=${start}, duration=${duration}, carrier=${i}, time=${t}`;
    expect(r.carriers[i].visible,label).toBe(t>=arrival&&t<exit);
    expect(r.product.residues[i].visible,label).toBe(t>=arrival);
    expect(r.carriers[i].loaded,label).toBe(t>=arrival&&t<spent);
   }
  }
 }
});

it('uses absolute incorporation and transfer boundaries for product flags, bonds and attachment',()=>{
 for(const [start,duration]of schedules){const p=props(start,duration);
  for(let i=0;i<3;i++)for(const event of [start+(i+(i===0?.25:.3))*duration,start+(i+(i===0?.25:.5))*duration])for(const t of around(event)){
   const r=evaluate(p,t),count=p.carriers.filter((_,j)=>t>=start+(j+(j===0?.25:.5))*duration).length;
   expect(r.product.residues.filter(x=>x.incorporated).length,`count at ${t}`).toBe(count);
   expect(r.product.bonds.length,`bonds at ${t}`).toBe(Math.max(0,count-1));
   if(i>0){const transferring=t>start+(i+.3)*duration&&t<start+(i+.5)*duration;
    expect(r.product.transfer!==undefined,`transfer at ${t}`).toBe(transferring);
    if(transferring)expect(r.product.attachedCarrierId).toBeUndefined();
    if(t>=start+(i+.5)*duration)expect(r.product.attachedCarrierId).toBe('t'+i);
   }
  }
 }
});

it('finishes translocation and carrier exit at their exact absolute boundaries',()=>{
 for(const [start,duration]of schedules){const p=props(start,duration);
  for(let i=1;i<3;i++){
   const end=start+(i+.7)*duration,exit=start+(i+.95)*duration;
   expect(evaluate(p,end).rna.register,`register at ${end}`).toBe(i);
   expect(evaluate(p,end).carriers[i].phase,`phase at ${end}`).toBe('docked');
   expect(evaluate(p,exit).carriers[i-1].phase,`spent at ${exit}`).toBe('spent');
   expect(evaluate(p,adjacent(exit,false)).carriers[i-1].phase).toBe('exiting');
  }
 }
});

it('recognizes stop, releases and completes at absolute times with adjacent samples',()=>{
 for(const [start,duration]of schedules){const p=props(start,duration),stop=start+3*duration,release=stop+.25*duration,end=release+p.releaseDuration+p.disassemblyDuration;
  for(const event of [stop+.2*duration,release,end])for(const t of around(event)){
   const r=evaluate(p,t);expect(r.stopRecognized).toBe(t>=stop+.2*duration);expect(r.product.released).toBe(t>=release);expect(r.complete).toBe(t>=end);
  }
 }
});

it('keeps nonbinary exact-event poses continuous with host/VM and reverse parity',async()=>{
 const vm=(await getQuickJS()).newContext();
 const run=(s:string)=>{const r=vm.evalCode(s);if(r.error){const e=vm.dump(r.error);r.error.dispose();throw Error(JSON.stringify(e));}const v=vm.dump(r.value);r.value.dispose();return v;};
 const compare=(a:any,b:any):void=>{if(typeof a==='number'){expect(Math.abs(a-b)).toBeLessThanOrEqual(1e-11);return;}if(a&&typeof a==='object'){expect(Object.keys(a)).toEqual(Object.keys(b));for(const k of Object.keys(a))compare(a[k],b[k]);return;}expect(a).toEqual(b);};
 const positions=(r:ReturnType<typeof evaluate>)=>[...r.rna.anchors.flatMap(a=>[a.backbone,a.tip]),...r.carriers.flatMap(c=>[c.position,c.payloadPosition]),...r.product.residues.map(x=>x.position),...r.subunits.map(x=>x.position)];
 const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
 try{run('globalThis.api=('+createNucleicTranslationBuilders.toString()+')();');
  for(const [start,duration]of schedules){const p=props(start,duration);Object.assign(p,{origin:[17,-31,8],axis:[1,2,3],normal:[-2,4,1],productCoil:{radius:.2,twist:1.3}});
   const stop=start+3*duration,release=stop+.25*duration,end=release+4;
   const events=[p.assembly.start,p.assembly.start+p.assembly.duration,stop,stop+.2*duration,release,release+1.2,release+2,end];
   for(let i=0;i<3;i++)for(const f of [0,.25,.3,.5,.7,.95,1])events.push(start+(i+f)*duration);
   const times=[...new Set(events.flatMap(around))];run('globalThis.p='+JSON.stringify(p));
   const saved=times.map(t=>{const host=evaluate(p,t),text=run('JSON.stringify(api.nucleicTranslationCycle(p,'+t+'))');compare(host,JSON.parse(text));for(const [a,b]of host.product.bonds)expect(distance(host.product.residues.find(x=>x.id===a)!.position,host.product.residues.find(x=>x.id===b)!.position)).toBeCloseTo(p.peptideSpacing,10);return {host:JSON.stringify(host),text};});
   for(let i=times.length-1;i>=0;i--){expect(JSON.stringify(evaluate(p,times[i]))).toBe(saved[i].host);expect(run('JSON.stringify(api.nucleicTranslationCycle(p,'+times[i]+'))')).toBe(saved[i].text);}
   for(const t of events){const a=positions(evaluate(p,adjacent(t,false))),b=positions(evaluate(p,adjacent(t,true)));a.forEach((v,i)=>expect(distance(v,b[i])).toBeLessThan(1e-8));}
  }
 }finally{vm.dispose();}
});
