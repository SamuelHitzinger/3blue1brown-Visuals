import {describe,it,expect} from 'vitest';
import {createNucleicTranscriptionCycleBuilders} from '../src/nucleic-transcription-cycle.js';
import type {NucleicTranscriptionCycleProps} from '../src/nucleic-transcription-cycle-types.js';
const api=createNucleicTranscriptionCycleBuilders(),distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const props=():NucleicTranscriptionCycleProps=>({template:Array.from({length:24},(_,i)=>({id:'t'+i,base:'ACGT'[i%4] as 'A'})),coding:Array.from({length:24},(_,i)=>({id:'c'+i,base:'TGCA'[i%4] as 'T'})),pairs:Array.from({length:24},(_,i)=>['t'+i,'c'+i]),transcript:Array.from({length:8},(_,i)=>({id:'r'+i,base:'CAUG'[i%4] as 'C',templateId:'t'+(i+6)})),templateDirection:'3to5',codingDirection:'5to3',axis:{origin:[1,-2,3],direction:[1,.2,.1],normal:[0,1,.2]},radius:.75,pitch:.8,twistPerBase:.58,baseReach:.675,window:{halfWidth:4,separation:1.1},start:1,cycleDuration:.7,dockFraction:.6,opening:{start:0,duration:.8},exitDirection:[-.6,.2,1],rnaLinkLength:.65,incomingAngle:2.1});
const adjacentTime=(value:number,up:boolean)=>{
 const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,value);
 data.setBigUint64(0,data.getBigUint64(0)+(up?1n:-1n));return data.getFloat64(0);
};

describe('absolute-time moving transcription cycle',()=>{
 it('incorporates at each exact absolute docking event, never at the preceding representable time',()=>{
  for(const schedule of [{start:.9,cycleDuration:.65},{start:1,cycleDuration:.7},{start:80000,cycleDuration:.01}]){
   const p={...props(),...schedule};
   for(let i=0;i<p.transcript.length;i++){
    const event=p.start+(i+p.dockFraction)*p.cycleDuration;
    for(const [time,formed]of [[adjacentTime(event,false),i],[event,i+1],[adjacentTime(event,true),i+1]]){
     const r=api.nucleicTranscriptionCycle(p,time);
     expect(r.rna.incorporated,`docking ${i} at ${time}`).toBe(formed);
     expect(r.rna.bonds).toHaveLength(Math.max(0,formed-1));
     expect(r.complete).toBe(formed===p.transcript.length);
     expect(r.rna.incomingId).toBe(formed===i?'r'+i:undefined);
    }
   }
  }
 });
 it('makes each RNA site visible at its exact arrival and preserves the final completed state',()=>{
  for(const schedule of [{start:.9,cycleDuration:.65},{start:1,cycleDuration:.7},{start:80000,cycleDuration:.01}]){
   const p={...props(),...schedule};
   for(let i=0;i<p.transcript.length;i++){
    const event=p.start+i*p.cycleDuration;
    expect(api.nucleicTranscriptionCycle(p,adjacentTime(event,false)).rna.visibleIds).not.toContain('r'+i);
    for(const time of [event,adjacentTime(event,true)]){
     const r=api.nucleicTranscriptionCycle(p,time);
     expect(r.rna.visibleIds).toHaveLength(i+1);expect(r.rna.incomingId).toBe('r'+i);expect(r.rna.incorporated).toBe(i);
     expect(r.activeSite.register).toBeCloseTo(6+i,9);
    }
   }
   const end=p.start+p.transcript.length*p.cycleDuration;
   for(const time of [adjacentTime(end,false),end,adjacentTime(end,true),Number.MAX_VALUE]){
    const r=api.nucleicTranscriptionCycle(p,time);expect(r.complete).toBe(true);expect(r.rna.incorporated).toBe(8);expect(r.rna.bonds).toHaveLength(7);expect(r.rna.incomingId).toBeUndefined();
   }
  }
 });
 it('preserves both DNA strands and every formed RNA link throughout moving opening and extrusion',()=>{
  const p=props(),before=JSON.stringify(p),first=api.nucleicTranscriptionCycle(p,0);let max=0;
  for(let j=0;j<=280;j++){const r=api.nucleicTranscriptionCycle(p,j/40),all=[...r.dna.anchors,...r.rna.anchors],map=new Map(all.map(a=>[a.id,a]));expect(all.map(a=>a.id)).toEqual([...first.dna.anchors,...first.rna.anchors].map(a=>a.id));for(const [a,b]of r.dna.bonds)max=Math.max(max,Math.abs(distance(map.get(a)!.backbone,map.get(b)!.backbone)-r.dna.linkLength));for(const [a,b]of r.rna.bonds)max=Math.max(max,Math.abs(distance(map.get(a)!.backbone,map.get(b)!.backbone)-p.rnaLinkLength));for(const a of all){expect(Math.hypot(...a.normal)).toBeCloseTo(1,12);expect(Math.hypot(...a.tangent)).toBeCloseTo(1,12);expect(a.normal.reduce((s,v,k)=>s+v*a.tangent[k],0)).toBeCloseTo(0,12);}}
  expect(max).toBeLessThan(1e-12);expect(JSON.stringify(p)).toBe(before);
 });
 it('moves the actual opening and closes paired radius behind it, with bounded completion',()=>{
  const p=props(),a=api.nucleicTranscriptionCycle(p,p.start),b=api.nucleicTranscriptionCycle(p,9);
  expect(a.dna.pairs[6].opening).toBe(1);expect(b.dna.pairs[6].opening).toBe(0);expect(b.dna.pairs[13].opening).toBe(1);expect(distance(b.dna.anchors[6].backbone,b.dna.anchors[30].backbone)).toBeCloseTo(2*p.radius,12);expect(distance(a.dna.anchors[6].backbone,a.dna.anchors[30].backbone)).toBeCloseTo(2*(p.radius+p.window.separation),12);
  for(let i=1;i<8;i++)expect(b.dna.anchors[i].normal.reduce((s,v,k)=>s+v*b.dna.anchors[i-1].normal[k],0)).toBeCloseTo(Math.cos(p.twistPerBase),12);
  expect(b.activeSite.register).toBe(13);expect(b.progress).toBe(7);expect(b.rna.incorporated).toBe(8);expect(b.complete).toBe(true);expect(api.nucleicTranscriptionCycle(p,80000)).toEqual(b);expect(api.nucleicTranscriptionCycle(p,1e100)).toEqual(b);
 });
 it('has continuous positions and frames at all docking, translocation and cycle boundaries',()=>{
  const p=props(),times=[0,.8,p.start];for(let i=0;i<8;i++)times.push(p.start+i*p.cycleDuration,p.start+(i+p.dockFraction)*p.cycleDuration,p.start+(i+1)*p.cycleDuration);
  for(const t of times){const a=api.nucleicTranscriptionCycle(p,t-1e-7),b=api.nucleicTranscriptionCycle(p,t+1e-7);for(const [i,x]of [...a.dna.anchors,...a.rna.anchors].entries()){const y=[...b.dna.anchors,...b.rna.anchors][i];for(const k of ['backbone','tip','normal','tangent'] as const)expect(distance(x[k],y[k])).toBeLessThan(1e-4);}}
 });
 it('docks the mapped incoming nucleotide at the active anchor before adding its exact edge',()=>{
  const p=props();for(let i=0;i<8;i++){const t=p.start+(i+p.dockFraction)*p.cycleDuration,pre=api.nucleicTranscriptionCycle(p,t-1e-7),post=api.nucleicTranscriptionCycle(p,t+1e-7);expect(pre.rna.incomingId).toBe('r'+i);expect(pre.rna.incorporated).toBe(i);expect(post.rna.incorporated).toBe(i+1);expect(distance(post.rna.anchors[i].backbone,post.activeSite.position)).toBeLessThan(1e-10);expect(distance(post.rna.anchors[i].normal,post.activeSite.normal.map(v=>-v))).toBeLessThan(1e-10);if(i)expect(post.rna.bonds.at(-1)).toEqual(['r'+(i-1),'r'+i]);}
 });
 it('rejects sparse data, noncontiguous/wrong complement mappings and unsupported whole schedules before motion',()=>{
  const bad=[()=>{const p=props();delete p.template[3];return p;},()=>{const p=props();p.transcript[1].templateId='t9';return p;},()=>{const p=props();p.transcript[0].base='A';return p;},()=>{const p=props();p.window.separation=20;return p;},()=>{const p=props();p.cycleDuration=12000;return p;},()=>{const p=props();p.exitDirection=[0,1,0];return p;},()=>{const p=props();p.axis.normal=[1,.2,.1];return p;},()=>{const p=props();p.opening!.duration=2;return p;}];for(const make of bad)expect(()=>api.nucleicTranscriptionCycle(make(),-1)).toThrow(/Transcription cycle/);
 });
 it('is self-contained and seek-order independent',()=>{const factory=(0,eval)('('+createNucleicTranscriptionCycleBuilders.toString()+')'),other=factory(),p=props(),a=other.nucleicTranscriptionCycle(p,2.345);other.nucleicTranscriptionCycle(p,9);other.nucleicTranscriptionCycle(p,0);expect(other.nucleicTranscriptionCycle(p,2.345)).toEqual(a);expect(a).toEqual(api.nucleicTranscriptionCycle(p,2.345));});
});
