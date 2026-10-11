import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
const directory=resolve('data/animlib-expansion/rna-processing-revision2');await mkdir(directory,{recursive:true});
const palette={background:'GREY_D',foreground:'WHITE',colors:{WHITE:'#f3eff7',GREEN:'#65ad61',GREEN_D:'#477b52',BLUE:'#415bbd',ORANGE:'#ce956c',PURPLE_B:'#9990c2',PURPLE_D:'#535060',GREY_D:'#59545f',GREY_C:'#b6b0c8',GREY_A:'#dedce7',GREY_B:'#a79b98',YELLOW:'#eedb66',PINK:'#c669bb',GOLD:'#d2ad63'}};
const sites=Array.from({length:40},(_,i)=>({id:'rna-'+i,base:'AUGC'[i%4],position:[(i-19.5)*.17,(i-19.5)*.25,0]}));
const splice={sites,intron:{start:10,end:29},initialNormal:[-.25,.17,0],baseReach:.26,joinDistance:.30,formation:{start:.18,end:.49,angle:5.2,bendDirection:[-.25,.17,0]},phases:{cut:.56,closeEnd:.73,departEnd:.92},departure:{translation:[-2.1,1.25,.05],axis:[0,0,1],angle:-.28}};
// Normal-monotone helix-like approach, then an upward arc. The center of the slab stays straight.
const path=Array.from({length:241},(_,i)=>{const z=-6+i*.05;if(z<-1){const u=(-z-1)/5,a=u*5.2;return [2.8*Math.sin(a)*u,1.8*(1-Math.cos(a))*u,z];}if(z>1){const u=(z-1)/5;return [4*u*u,1.5*Math.sin(Math.PI*u),z];}return [0,0,z];});
const thread={sites:Array.from({length:26},(_,i)=>({id:'export-'+i,base:'AUGC'[i%4],offset:i*.24})),path,initialNormal:[0,1,0],baseReach:.14,aperture:{center:[0,0,0],normal:[0,0,1],radius:1.05,halfThickness:.75,chainRadius:.22}};
const shared=`const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 const orient=a=>{const x=a.normal,y=a.tangent,z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],ry=Math.asin(Math.max(-1,Math.min(1,-x[2])));return Math.abs(Math.cos(ry))>1e-7?[Math.atan2(y[2],z[2]),ry,Math.atan2(x[1],x[0])]:[Math.atan2(-z[1],y[1]),ry,0];};
 const text=(id,label,pos,fill='WHITE',size=.24)=>s.text(id,{text:label,position:pos,fill,fontSize:size,billboard:true,labelOcclusion:'overlay'});
 const link=(id,a,b,active,radius=.06)=>{const geo=t=>s.molecularBackboneGeometry({segments:[{id:'edge',chainId:'rna',residues:[{id:'a',position:a(t),value:0},{id:'b',position:b(t),value:0}]}],bonds:[['a','b']],representation:'sticks',radius,initialNormal:[0,1,0],radialSegments:8,colors:['GREEN','GREEN'],provenance:{kind:'schematic',source:'Explicit processing edge',units:'arbitrary'}}).meshes[0];const h=s.mesh(id,{...geo(0),shading:'smooth',material:{roughness:.47,specular:.3}});s.bind(h,[s.time],t=>{const g=geo(t);return {vertices:g.vertices,normals:g.normals,opacity:active(t)?1:0};});};
 const enzyme=s.modelInfo('schematic-splice-enzyme-r2');
 const body=(id,pos,scale,fill='PURPLE_D',rot=[0,0,0])=>{const info=id.startsWith('context')?s.modelInfo('schematic-splice-enzyme-context-r2'):enzyme;return s.mesh(id,{asset:{id:info.id,hash:info.hash,part:'body'},position:pos,scale,rotation:rot,fill,shading:'smooth',material:{roughness:.62,specular:.3}});};
 const cellular=()=>{for(let layer=0;layer<3;layer++)for(let i=0;i<9;i++){const x=8*Math.sin(i*7.13+layer*3.7),y=6.5*Math.sin(i*3.23+layer*8.1),z=-4-layer*4;body('context-'+layer+'-'+i,[x,y,z],.4+.14*Math.sin(i*2),'PURPLE_D',[.2*i,.3*layer,i*.71]);}
 for(let k=0;k<4;k++){const points=Array.from({length:31},(_,i)=>[(i-15)*.54,3.8*Math.sin(k*1.4)+(i-15)*(.13-k*.06)+.3*Math.sin(i*.3),-5-k*2]);s.line('background-strand-'+k,{points,stroke:'GREEN_D',strokeWidth:.085,strokeProfile:'round'});for(let i=0;i<points.length;i++){const a=points[i];s.sphere('background-base-'+k+'-'+i,{radius:.095,position:[a[0],a[1]+.22,a[2]],fill:i%3?'PURPLE_B':'GOLD'});}}
 };`;
const sources={splice:`export default scene({mode:'3d',background:'GREY_D',lighting:{ambient:1.65,directional:{direction:[-.5,.65,1],space:'camera',intensity:1.5}},end:'hold'},s=>{${shared}
 cellular();const props=${JSON.stringify(splice)};let last=-1,result;const pose=t=>{if(last!==t){last=t;result=s.nucleicSplice(props,Math.min(1,t/11));}return result;};
 const colors={A:'ORANGE',U:'BLUE',G:'GOLD',C:'PINK'};
 for(let i=0;i<props.sites.length;i++){const a=pose(0).anchors[i],info=s.modelInfo('transcription-r2-'+a.shape+'-context');for(const part of info.parts){const h=s.mesh('site-'+a.id+'-'+part.id,{asset:{id:info.id,hash:info.hash,part:part.id},fill:part.id==='base'?(i>=10&&i<=29?'YELLOW':colors[a.base]):'GREEN',shading:'smooth',material:{roughness:.36,specular:.5}});s.bind(h,[s.time],t=>{const a=pose(t).anchors[i];return {position:a.backbone,rotation:orient(a),scale:.26/.675};});}}
 const edges=props.sites.slice(1).map((v,i)=>[i,i+1]);edges.push([9,30]);for(const [a,b] of edges)link('bond-'+a+'-'+b,t=>pose(t).anchors[a].backbone,t=>pose(t).anchors[b].backbone,t=>pose(t).bonds.some(e=>e[0]===props.sites[a].id&&e[1]===props.sites[b].id));
 for(const i of [9,30]){const h=s.sphere('cut-end-'+i,{radius:.095,fill:'WHITE'});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone,opacity:pose(t).phase==='closing'?1:0}));}
 for(let e=0;e<2;e++){const h=body('enzyme-'+e,[0,0,0],.52,'BLUE');s.bind(h,[s.time],t=>{const a=pose(t).anchors[e?29:10].backbone,approach=1-smooth(t,.2,1.25);return {position:[a[0]+(e?1:-1)*2.3*approach+(e?.08:-.08),a[1],-.28],rotation:[.1,-.15,e?.2:2.7]};});}
 const intron=text('intron','Intron',[-2,0,.5],'YELLOW');s.bind(intron,[s.time],t=>{const a=pose(t).anchors[19].backbone;return {position:[a[0]-.6,a[1]+.7,.5],opacity:1-smooth(t,6,1)};});
 const exon=text('exon','Exons',[2,3,.4],'GREY_A');s.bind(exon,[s.time],t=>({position:pose(t).anchors[35].backbone.map((v,k)=>v+(k===0?.6:k===2?.4:0))}));
 const joined=text('joined','Joined mRNA',[.8,-.8,.4],'GREY_A');s.bind(joined,[s.time],t=>({opacity:smooth(t,8.1,.4)}));
 s.play(s.camera.to3D({height:11.2,distance:27,perspective:1,yaw:.10,pitch:-.04,target:[-.6,0,0],focus:{distance:27,aperture:.65,samples:32}}),{duration:0});s.wait(1.6);s.play(s.camera.animate({height:9.5,target:[-1,.2,0]}),{duration:1.2,ease:'smooth'});s.wait(9.2);
});`,pore:`export default scene({mode:'3d',background:'GREY_C',lighting:{ambient:1.9,directional:{direction:[-.5,.65,1],space:'camera',intensity:1.3}},end:'hold'},s=>{${shared}
 const props=${JSON.stringify(thread)};let last=-1,result;const pose=t=>{if(last!==t){last=t;const clock=t<=4.4?t:t<4.9?4.4:t-.5;result=s.nucleicThread(props,smooth(clock,.6,8));}return result;};
 const membrane=s.modelInfo('schematic-cellular-membrane-r2');for(const part of membrane.parts)s.mesh('membrane-'+part.id,{asset:{id:membrane.id,hash:membrane.hash,part:part.id},fill:'PURPLE_B',shading:'smooth',material:{roughness:.78,specular:.17}});
 for(let cy=-2;cy<=2;cy++)for(let cx=-2;cx<=2;cx++)for(let i=0;i<8;i++){const lobe=s.modelInfo(cx===0&&cy===0?'schematic-pore-lobe-r2':'schematic-pore-lobe-context-r2'),a=i*2*Math.PI/8,r=cx===0&&cy===0?1.8:1.45;s.mesh('pore-lobe-'+cx+'-'+cy+'-'+i,{asset:{id:lobe.id,hash:lobe.hash,part:'body'},rotation:[0,0,a],position:[cx*12+r*Math.cos(a),cy*12+r*Math.sin(a),.04],fill:cx===0&&cy===0?'ORANGE':'GREY_B',shading:'smooth',material:{roughness:.53,specular:.3}});}
 for(let i=0;i<props.sites.length;i++){const h=s.sphere('site-'+i,{radius:.15,fill:i===10?'YELLOW':'GREEN',material:{roughness:.44,specular:.32}});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone}));if(i)link('bond-'+i,t=>pose(t).anchors[i-1].backbone,t=>pose(t).anchors[i].backbone,()=>true,.12);}
 text('pore-label','Nuclear pore',[-2.9,-1.9,.9],'WHITE',.27);
 const label=text('rna','mRNA',[0,0,0],'WHITE',.25);s.bind(label,[s.time],t=>({position:pose(t).anchors[10].backbone.map((v,k)=>v+(k===0?.45:k===1?.5:0))}));
 s.play(s.camera.to3D({height:11.8,distance:30,perspective:1,yaw:3.05,pitch:.75,target:[0,.3,-2],focus:{distance:30,aperture:.25,samples:16}}),{duration:0});s.wait(4.65);s.play(s.camera.to3D({yaw:.1,pitch:.85,height:11.8,distance:30,perspective:1,target:[1.1,.4,2.3],focus:{distance:30,aperture:.25,samples:16}}),{duration:0});s.wait(5.35);
});`};
const modelAssets=['purine-context/transcription-r2-purine-context.json','pyrimidine-context/transcription-r2-pyrimidine-context.json'].map(p=>resolve('shared/animlib/fixtures/biological/transcription-revision2',p));
modelAssets.push(...['enzyme/schematic-splice-enzyme-r2.json','enzyme-context/schematic-splice-enzyme-context-r2.json','membrane/schematic-cellular-membrane-r2.json','pore-lobe/schematic-pore-lobe-r2.json','pore-lobe-context/schematic-pore-lobe-context-r2.json'].map(p=>resolve('shared/animlib/fixtures/biological/rna-processing-revision2',p)));
const registry=await loadAssetRegistry(modelAssets);
for(const [id,source] of Object.entries(sources)){
 if(process.argv[2]&&process.argv[2]!==id)continue;
 const output=id==='pore'?join(directory,'pore-cut'):directory;await mkdir(output,{recursive:true});
 const duration=id==='splice'?12:10,times=id==='splice'?[0,1.5,2,3,4,5.39,5.8,6.15,6.17,7,8.04,8.06,9,11.9]:[0,1.5,2.5,3.5,4.4,4.649,4.65,4.9,5.5,6.5,8,9.9];
 await writeFile(join(output,id+'.js'),source);await writeFile(join(output,id+'-manifest.json'),JSON.stringify({modelAssets,palette,scenes:[{id,file:id+'.js',duration}],captions:[]},null,2));
 await writeFile(join(output,id+'-frames.json'),JSON.stringify({source,modelAssets,palette,times,directory:join(output,id+'-frames')}));
 const at=performance.now();await withOfflineScene(source,{palette},async sampler=>{const compiledMs=performance.now()-at,saved=sampler.sample(3);sampler.sample(duration);if(JSON.stringify(saved)!==JSON.stringify(sampler.sample(3)))throw Error(id+' reverse seek');const begin=performance.now();let bytes=0;for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i*duration/120)).length);const report={sourceCharacters:source.length,compiledMs,sample121IncludingSerializationMs:performance.now()-begin,maxSerializedFrameBytes:bytes,elements:saved.elements.length,reverseSeek:'exact',assetStats:registry.stats()};await writeFile(join(output,id+'-measurements.json'),JSON.stringify(report,null,2));console.log(id,report);},{modelAssets:registry});
}



