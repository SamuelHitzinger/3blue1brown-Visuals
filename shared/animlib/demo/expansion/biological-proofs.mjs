import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene,createNucleicBuilders,createMolecularBackboneBuilders} from '../../dist/core.js';
import {createMoleculeBuilders} from '../../dist/molecules.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
const directory=resolve('data/animlib-expansion/biological-proof');await mkdir(directory,{recursive:true});
const assetRoot=resolve('shared/animlib/fixtures/biological');
const props={axis:Array.from({length:16},(_,i)=>[(i-7.5)*.62,.35*Math.sin(i/5),.18*Math.cos(i/5)]),template:'ACGTACGTACGTACGT'.split('').map((base,i)=>({id:`template-${i}`,base})),coding:'TGCATGCATGCATGCA'.split('').map((base,i)=>({id:`coding-${i}`,base})),pairs:Array.from({length:16},(_,i)=>[`template-${i}`,`coding-${i}`]),templateDirection:'3to5',codingDirection:'5to3',initialNormal:[0,1,0],radius:.85,backboneRadius:.085,twistPerBase:.58,window:{start:2,end:13,separation:1.5},radialSegments:8,samplesPerLink:3};
const tx={id:'rna',bases:'UGCAUG'.split('').map((base,i)=>({id:`rna-${i}`,base,templateId:`template-${i+4}`})),start:2,secondsPerBase:.65,approachFraction:.72,radius:.075,incomingOffset:[.3,2.1,1.1]};
const mechanism=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const props=${JSON.stringify(props)},tx=${JSON.stringify(tx)};
 const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 const open=s.nucleicDuplex(props,1);tx.duplex=open;
 let dt=-1,dr,rt=-1,rr;
 const dna=t=>{if(dt!==t){dt=t;dr=s.nucleicDuplex(props,smooth(t,.35,1.4));}return dr;};
 const rna=t=>{if(rt!==t){rt=t;rr=s.nucleicTranscript(tx,t);}return rr;};
 s.play(s.camera.to3D({height:8.6,distance:24,yaw:.1,pitch:-.22}),{duration:0});
 for(let i=0;i<4;i++){const g=dna(0).parts[i].geometry,h=s.mesh('dna-'+i,{...g,fill:'WHITE',material:{roughness:.6,specular:.22}});s.bind(h,[s.time],t=>{const g=dna(t).parts[i].geometry;return {vertices:g.vertices,...(g.normals?{normals:g.normals}:{})};});}
 for(let i=0;i<rna(0).parts.length;i++){const p=rna(0).parts[i],h=s.mesh('rna-'+i,{...p.geometry,fill:'WHITE',opacity:p.opacity,material:{roughness:.45,specular:.3}});s.bind(h,[s.time],t=>{const p=rna(t).parts[i];return {vertices:p.geometry.vertices,...(p.geometry.normals?{normals:p.geometry.normals}:{}),opacity:p.opacity};});}
 const shell=s.model('polymerase',{asset:'illustrative-polymerase-channel',fill:'PURPLE',opacity:.28,scale:1,material:{roughness:.65,specular:.24}});
 const label=(id,text,fill,size)=>s.text(id,{text,fill,fontSize:size,billboard:true,labelOcclusion:'overlay'});
 const template=label('template-label','DNA template 3′ → 5′','BLUE',.23);s.bind(template,[s.time],t=>({position:dna(t).anchors[2].backbone.map((x,j)=>x+(j===1?-.8:0))}));
 const machinery=label('machinery-label','Illustrative polymerase channel','GREY_B',.21);s.bind(machinery,[s.time],()=>({position:[0,-3.5,0]}));
 const five=label('rna-five','RNA 5′','ORANGE',.23),three=label('rna-three','3′','ORANGE',.24);
 s.bind(five,[s.time],t=>({position:rna(t).anchors[0].backbone.map((x,j)=>x+(j===1?.12:j===0?-.7:.2)),opacity:rna(t).incorporated?1:0}));
 s.bind(three,[s.time],t=>{const r=rna(t);return {position:r.anchors[Math.max(0,r.incorporated-1)].backbone.map((x,j)=>x+(j===1?.5:j===0?.35:0)),opacity:r.incorporated>1?1:0};});
 const incoming=label('incoming-label','Incoming nucleotide','GREY_A',.2);s.bind(incoming,[s.time],t=>{const r=rna(t),a=r.anchors.find(a=>a.id===r.incomingId);return {position:a?a.backbone.map((x,j)=>x+(j===1?.5:0)):[0,0,0],opacity:a?1:0};});
 s.wait(8);
});`;
const crnSource=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const colors=['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'];
 const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 const bead=t=>smooth(t,1,.5)*(1-smooth(t,2.5,.5)),surface=t=>smooth(t,4,.7);
 s.play(s.camera.to3D({height:8,distance:24,yaw:.25,pitch:-.2}),{duration:0});
 for(const name of ['sticks','beads','surface']){const descriptor=s.modelInfo('1crn-'+name);for(const part of descriptor.parts){const index=Number(part.id.split('-')[1]);const h=s.mesh(name+'-'+part.id,{asset:{id:descriptor.id,hash:descriptor.hash,part:part.id},fill:colors[Math.min(6,Math.floor(index/46*7))],scale:.22,shading:'smooth',material:{roughness:.55,specular:.3}});s.bind(h,[s.time],t=>({opacity:name==='beads'?bead(t):name==='surface'?surface(t):(1-bead(t))*(1-surface(t))}));}}
 s.text('title',{text:'1CRN · one deposited conformer',position:[0,3.15,0],fontSize:.27,fill:'WHITE',billboard:true,labelOcclusion:'overlay'});
 s.text('caption',{text:'Atomic bonds → residue anchors → same-conformer surface',position:[0,-3.15,0],fontSize:.22,fill:'GREY_A',billboard:true,labelOcclusion:'overlay'});
 s.wait(6);
});`;
const mechanisms=[join(assetRoot,'polymerase-channel/illustrative-polymerase-channel.json')],scientific=['sticks','beads','surface'].map(n=>join(assetRoot,`1crn/1crn-${n}/1crn-${n}.json`));
const summaries=[];
for(const [id,source,duration,modelAssets,times] of [['transcription',mechanism,8,mechanisms,[0,.7,1.4,1.8,2.2,2.6,3.2,3.9,4.5,5.2,5.9,7.5]],['structure',crnSource,6,scientific,[0,1.25,1.8,2.75,3.5,4.25,4.7,5.8]]]){
 await writeFile(join(directory,`${id}.js`),source);await writeFile(join(directory,`${id}-manifest.json`),JSON.stringify({modelAssets,scenes:[{id,file:`${id}.js`,duration}],captions:[]},null,2));
 await writeFile(join(directory,`${id}-frames.json`),JSON.stringify({source,modelAssets,times,directory:join(directory,id+'-frames')}));
 const registry=await loadAssetRegistry(modelAssets),started=performance.now();
 await withOfflineScene(source,{},sampler=>{const compiledMs=performance.now()-started,first=sampler.sample(0),middle=sampler.sample(duration/2),end=sampler.sample(duration);if(JSON.stringify(sampler.sample(0))!==JSON.stringify(first)||JSON.stringify(sampler.sample(duration/2))!==JSON.stringify(middle))throw Error('Reverse seek mismatch');const start=performance.now();for(let i=0;i<121;i++)sampler.sample(i/120*duration);summaries.push({id,sourceCharacters:source.length,duration,elements:end.elements.length,compileMs:compiledMs,sample121Ms:performance.now()-start,assetStats:registry.stats(),reverseSeek:'exact'});},{modelAssets:registry});
}
const api=createNucleicBuilders(createMolecularBackboneBuilders(createMoleculeBuilders())),rest=api.nucleicDuplex(props,0);let maxRelativeError=0;
for(let i=0;i<=400;i++){const r=api.nucleicDuplex(props,i/400);for(const strand of ['template','coding']){const a=r.anchors.filter(a=>a.strand===strand);for(let j=1;j<a.length;j++)maxRelativeError=Math.max(maxRelativeError,Math.abs(Math.hypot(...a[j].backbone.map((v,k)=>v-a[j-1].backbone[k]))/rest.linkLengths[strand][j-1]-1));}}
await writeFile(join(directory,'measurements.json'),JSON.stringify({summaries,maxRelativeError,dnaSites:32,rnaSites:6,sourceEvidence:'See biological-reference-inspection.md',scientificPreparation:JSON.parse(await readFile(join(assetRoot,'1crn/preparation-report.json'),'utf8'))},null,2));console.log(JSON.stringify({directory,summaries,maxRelativeError},null,2));
