import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
const directory=resolve('data/animlib-expansion/rna-processing-revision3');await mkdir(directory,{recursive:true});
const previous=resolve('data/animlib-expansion/rna-processing-revision2/pore-cut'),manifest=JSON.parse(await readFile(join(previous,'pore-manifest.json')));
let source=await readFile(join(previous,'pore.js'),'utf8');
source=source.replace("background:'GREY_C',lighting:{ambient:1.9,directional:{direction:[-.5,.65,1],space:'camera',intensity:1.3}}","background:'BLACK',lighting:{ambient:1.1,directional:{direction:[-.5,.65,1],space:'camera',intensity:1.7}}");
const start=source.indexOf(" const membrane=s.modelInfo("),end=source.indexOf(" for(let i=0;i<props.sites.length;i++)",start);
source=source.slice(0,start)+`
 const membrane=s.modelInfo('rna-r3-cellular-membrane');for(const part of membrane.parts)s.mesh('membrane-'+part.id,{asset:{id:membrane.id,hash:membrane.hash,part:part.id},...(part.imageTexture?{imageTexture:part.imageTexture}:{}),fill:part.id.startsWith('lumen')?'BLACK':'WHITE',shading:'smooth',material:{roughness:.84,specular:.12}});
 const lobe=s.modelInfo('rna-r3-pore-lobes');for(let cy=-1;cy<=1;cy++)for(let cx=-1;cx<=1;cx++)for(let i=0;i<8;i++){const main=cx===0&&cy===0,a=i*2*Math.PI/8,r=main?1.95:1.13,scale=main?1:.58,part=lobe.parts.find(p=>p.id===(main?'body':'context'));s.mesh('pore-lobe-'+cx+'-'+cy+'-'+i,{asset:{id:lobe.id,hash:lobe.hash,part:part.id},imageTexture:part.imageTexture,fill:'WHITE',rotation:[0,0,a],scale,position:[cx*14+r*Math.cos(a),cy*14+r*Math.sin(a),main?0:.28],shading:'smooth',material:{roughness:.68,specular:.20}});}
`+source.slice(end);
const labelStart=source.indexOf(" const label=text('rna'"),labelEnd=source.indexOf(" s.play(s.camera",labelStart);
source=source.slice(0,labelStart)+`
 const labelPoint=t=>{const a=pose(t).anchors[10].backbone;return [a[0]+(t<4.65?2.7:-2.7),a[1]+.55,a[2]+.25];};
 const label=text('rna','mRNA',[0,0,0],'WHITE',.27);s.bind(label,[s.time],t=>({position:labelPoint(t)}));
 const leader=s.line('rna-leader',{points:[labelPoint(0),pose(0).anchors[10].backbone],stroke:'GREY_A',strokeWidth:.018});s.bind(leader,[s.time],t=>{const a=labelPoint(t),b=pose(t).anchors[10].backbone;return {points:[[a[0]+(t<4.65?-.45:.45),a[1],a[2]],b]};});
`+source.slice(labelEnd);
source=source.replaceAll('height:11.8','height:10.6').replaceAll('aperture:.25,samples:16','aperture:.65,samples:32');
manifest.palette.colors.BLACK='#24202f';manifest.palette.colors.GREEN='#8db96a';manifest.palette.colors.WHITE='#f7f2ec';
const root=resolve('shared/animlib/fixtures/biological/rna-processing-revision3');
const modelAssets=['membrane/rna-r3-membrane-illumination.json','membrane/rna-r3-cellular-membrane.json','pore/rna-r3-pore-contact-colors.json','pore/rna-r3-pore-lobes.json'].map(p=>join(root,p));
// Frozen context enzyme descriptors are referenced only by the unchanged shared
// function declarations; the pore scene does not instantiate those functions.
modelAssets.push(resolve('shared/animlib/fixtures/biological/rna-processing-revision2/enzyme/schematic-splice-enzyme-r2.json'));
manifest.modelAssets=modelAssets;manifest.colorPolicy='source';
await writeFile(join(directory,'pore.js'),source);await writeFile(join(directory,'pore-manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(directory,'pore-frames.json'),JSON.stringify({source,modelAssets,colorPolicy:'source',palette:manifest.palette,times:[0,4.4,4.649,4.65,5.4,6.5,9.9],directory:join(directory,'pore-frames')}));
const registry=await loadAssetRegistry(modelAssets,{colorPolicy:'source'});const begin=performance.now();await withOfflineScene(source,{palette:manifest.palette},sampler=>{const compiledMs=performance.now()-begin,held=[4.4,4.649,4.65,4.9].map(t=>sampler.sample(t).elements.filter(e=>e.id.startsWith('site-')).map(e=>e.position));if(!held.every(p=>JSON.stringify(p)===JSON.stringify(held[0])))throw Error('Held chain state changed');const saved=sampler.sample(5.4);sampler.sample(10);if(JSON.stringify(saved)!==JSON.stringify(sampler.sample(5.4)))throw Error('Reverse seek differs');let maxSerializedFrameBytes=0;const at=performance.now();for(let i=0;i<=120;i++)maxSerializedFrameBytes=Math.max(maxSerializedFrameBytes,JSON.stringify(sampler.sample(i/12)).length);const report={compiledMs,sample121IncludingSerializationMs:performance.now()-at,maxSerializedFrameBytes,elements:saved.elements.length,assetStats:registry.stats(),heldChainState:'exact',reverseSeek:'exact'};console.log(report);return writeFile(join(directory,'measurements.json'),JSON.stringify(report,null,2));},{modelAssets:registry});


