/** Geometry-led transcription: source motion techniques, approved mathematical art. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene,createNucleicTranscriptionCycleBuilders} from '../../dist/core.js';
const directory=resolve('data/animlib-expansion/transcription-cycle-revision3');
await mkdir(directory,{recursive:true});
// The reviewed revision 2 schedule is versioned so generation needs no old exports.
const props=JSON.parse(await readFile(new URL('./inputs/transcription-cycle.json',import.meta.url),'utf8'));
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080d18',WHITE:'#f0f2f8',BLUE:'#7ea8ff',TEAL:'#47d7c8',GOLD:'#ffac66',GREY:'#8c96a9',GREY_D:'#354156',PURPLE:'#c7a0ff'}};
const api=createNucleicTranscriptionCycleBuilders(),smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
const targets=Array.from({length:81},(_,i)=>{const r=api.nucleicTranscriptionCycle(props,i/10),f=smooth(i/10,5.9,1.2),a=smooth(i/10,.25,.8);return [0,1,2].map(k=>r.activeSite.position[k]*a*(1-f)+r.rna.anchors.slice(0,3).reduce((n,p)=>n+p.tip[k],0)/3*f+(k===1?.5*f:0));});
const source=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const props=${JSON.stringify(props)},smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);},focus=t=>smooth(t,5.9,1.2);
 let previous=-1,cached;const sample=t=>{if(previous!==t){previous=t;cached=s.nucleicTranscriptionCycle(props,t);}return cached;};
 const first=sample(0),point=(a,d)=>a.backbone.map((v,k)=>v+a.normal[k]*d),lift=p=>p.map((v,k)=>v+(k===2?.025:0));
 for(let strand=0;strand<2;strand++){
  const h=s.line('dna-backbone-'+strand,{points:first.dna.anchors.slice(strand*24,strand*24+24).map(a=>a.backbone),stroke:strand===0?'BLUE':'GREY',strokeWidth:strand===0?.035:.024});
  s.bind(h,[s.time],t=>({points:sample(t).dna.anchors.slice(strand*24,strand*24+24).map(a=>a.backbone),opacity:strand===0?.82-.6*focus(t):.28-.16*focus(t)}));
 }
 for(let i=1;i<8;i++){
  const h=s.line('rna-link-'+i,{points:first.rna.anchors.slice(i-1,i+1).map(a=>a.backbone),stroke:'TEAL',strokeWidth:.042});
  s.bind(h,[s.time],t=>{const r=sample(t);return {points:r.rna.anchors.slice(i-1,i+1).map(a=>a.backbone),opacity:r.rna.incorporated>i?1:0};});
 }
 for(const kind of ['dna','rna'])for(let i=0;i<first[kind].anchors.length;i++){
  const a=first[kind].anchors[i],color=kind==='rna'?'TEAL':i<24?'BLUE':'GREY';
  const alpha=t=>{const r=sample(t);return kind==='rna'?(r.rna.visibleIds.includes(a.id)?1:0):i<24?.85-.72*focus(t):.26-.2*focus(t);};
  const stem=s.line(kind+'-stem-'+i,{points:[a.backbone,point(a,.28)],stroke:color,strokeWidth:.027});
  const tip=s.line(kind+'-tip-'+i,{points:[point(a,.59),a.tip],stroke:color,strokeWidth:.027});
  const label=s.text(kind+'-base-'+i,{text:a.base,fill:color,fontSize:.205,billboard:true,labelOcclusion:'overlay'});
  const node=s.sphere(kind+'-node-'+i,{radius:kind==='rna'?.053:.042,fill:color});
  s.bind(stem,[s.time],t=>{const p=sample(t)[kind].anchors[i];return {points:[p.backbone,point(p,.28)],opacity:alpha(t)};});
  s.bind(tip,[s.time],t=>{const p=sample(t)[kind].anchors[i];return {points:[point(p,.59),p.tip],opacity:alpha(t)};});
  s.bind(label,[s.time],t=>{const r=sample(t),p=point(r[kind].anchors[i],.43);let clearance=1;if(kind==='dna')for(const b of r.rna.anchors){if(!r.rna.visibleIds.includes(b.id))continue;const q=point(b,.43),d=Math.hypot(p[0]-q[0],p[1]-q[1]);clearance=Math.min(clearance,smooth(d,.22,.18));}return {position:lift(p),opacity:alpha(t)*clearance};});
  s.bind(node,[s.time],t=>({position:sample(t)[kind].anchors[i].backbone,opacity:alpha(t)}));
 }
 // Paired tips coincide at docking. Two short transverse marks name that contact
 // geometrically and disappear as the already formed RNA leaves the template.
 for(let i=0;i<8;i++)for(let j=0;j<2;j++){
  const h=s.line('paired-contact-'+i+'-'+j,{points:[[0,0,0],[.1,0,0]],stroke:'GOLD',strokeWidth:.022});
  s.bind(h,[s.time],t=>{const r=sample(t),a=r.rna.anchors[i],b=r.dna.anchors[i+6],d=Math.hypot(...a.tip.map((v,k)=>v-b.tip[k])),p=a.tip.map((v,k)=>(v+b.tip[k])/2+(k===1?(j-.5)*.055:0));return {points:[p.map((v,k)=>v+(k===0?-.085:0)),p.map((v,k)=>v+(k===0?.085:0))],opacity:r.rna.incorporated>i?Math.max(0,1-d/.2)*(1-focus(t)):0};});
 }
 // A quiet outline bounds the working region without a solid occluding body.
 const outline=s.line('polymerase-working-region',{points:Array.from({length:49},(_,i)=>[i/48,0,0]),stroke:'GREY_D',strokeWidth:.016});
 s.bind(outline,[s.time],t=>{const a=sample(t).activeSite;return {points:Array.from({length:49},(_,i)=>{const q=-.35+Math.PI*1.75*i/48;return [a.templatePosition[0]+3.15*Math.cos(q),a.templatePosition[1]+1.3+2.22*Math.sin(q),-.4];}),opacity:.65*(1-focus(t))};});
 const enzymeLabel=s.text('enzyme-label',{text:'RNA polymerase',fill:'GREY',fontSize:.23,billboard:true});
 s.bind(enzymeLabel,[s.time],t=>{const a=sample(t).activeSite;return {position:[a.position[0]+1.9,a.templatePosition[1]-.89,0],opacity:(1-focus(t))*.65};});
 const dnaLabel=s.text('template-label',{text:'template DNA',fill:'BLUE',fontSize:.22,billboard:true});
 s.bind(dnaLabel,[s.time],t=>{const a=sample(t).activeSite;return {position:[a.position[0]-1.9,a.templatePosition[1]-.85,0],opacity:.72*(1-focus(t))};});
 const rnaLabel=s.text('rna-label',{text:'RNA',fill:'TEAL',fontSize:.24,billboard:true});
 s.bind(rnaLabel,[s.time],t=>{const r=sample(t),a=r.rna.anchors[Math.max(0,r.rna.incorporated-3)];return {position:a.backbone.map((v,k)=>v+(k===1?.48:0)),opacity:smooth(t,1.4,.35)*(1-focus(t))};});
 const bracket=s.line('triplet-bracket',{points:[[0,0,0],[0,1,0],[1,1,0],[2,1,0],[2,0,0]],stroke:'WHITE',strokeWidth:.012});
 s.bind(bracket,[s.time],t=>{const a=sample(t).rna.anchors.slice(0,3).map(p=>p.backbone.map((v,k)=>v+(k===1?.48:0)));return {points:[a[0].map((v,k)=>v-(k===1?.11:0)),a[0],a[1],a[2],a[2].map((v,k)=>v-(k===1?.11:0))],opacity:focus(t)};});
 const codon=s.text('triplet-label',{text:'codon',fill:'WHITE',fontSize:.22,billboard:true});
 s.bind(codon,[s.time],t=>{const a=sample(t).rna.anchors.slice(0,3);return {position:[0,1,2].map(k=>a.reduce((n,p)=>n+p.backbone[k],0)/3+(k===1?.72:0)),opacity:focus(t)};});
 const targets=${JSON.stringify(targets)};
 s.play(s.camera.to3D({height:13.5,distance:32,yaw:0,pitch:-.04}),{duration:0});
 for(let i=1;i<=80;i++){const f=smooth(i/10,5.9,1.2),a=smooth(i/10,.25,.8);s.play(s.camera.animate({height:13.5-8.1*a-2*f,target:targets[i],yaw:0,pitch:-.04}),{duration:.1,ease:'linear'});}
});`;
await writeFile(join(directory,'cycle-inputs.json'),JSON.stringify(props,null,2));
await writeFile(join(directory,'cycle.js'),source);
await writeFile(join(directory,'cycle-manifest.json'),JSON.stringify({palette,scenes:[{id:'cycle',file:'cycle.js',duration:8}],captions:[]},null,2));
await writeFile(join(directory,'cycle-frames.json'),JSON.stringify({source,palette,times:[0,.8,1.1,1.29,1.55,2.2,3.5,4.8,5.45,5.9,6.5,7.5],directory:join(directory,'frames')}));
await writeFile(join(directory,'representative-frames.json'),JSON.stringify({source,palette,times:[2.2,3.5,7.5],directory:join(directory,'schematic-representative')}));
const start=performance.now();await withOfflineScene(source,{palette},sampler=>{
 const compileMs=performance.now()-start,first=sampler.sample(1.55),middle=sampler.sample(4.25);sampler.sample(8);
 if(JSON.stringify(sampler.sample(1.55))!==JSON.stringify(first)||JSON.stringify(sampler.sample(4.25))!==JSON.stringify(middle))throw Error('Cycle reverse seek mismatch');
 const at=performance.now();let bytes=0;for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i/15)).length);
 const report={sourceCharacters:source.length,compileMs,sample121IncludingSerializationMs:performance.now()-at,maxSerializedFrameBytes:bytes,elements:middle.elements.length,reverseSeeks:'exact',assets:'none',helperSchedule:'frozen revision 2'};
 console.log(JSON.stringify(report));return writeFile(join(directory,'measurements.json'),JSON.stringify(report,null,2));
});


