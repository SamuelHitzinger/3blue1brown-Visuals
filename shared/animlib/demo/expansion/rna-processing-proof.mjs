import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
const directory=resolve('data/animlib-expansion/rna-processing-proof');await mkdir(directory,{recursive:true});
const sites=[];for(let i=0;i<8;i++)sites.push({id:'rna-'+i,base:'AUGC'[i%4],position:[-3+i*.3,-3+i*.3,0]});
for(let i=0;i<10;i++){const t=i/9;sites.push({id:'rna-'+(i+8),base:'AUGC'[(i+8)%4],position:[-.65+1.3*t-1.5*Math.sin(Math.PI*t),-.65+1.3*t,0]});}
for(let i=0;i<8;i++)sites.push({id:'rna-'+(i+18),base:'AUGC'[(i+18)%4],position:[.9+i*.3,.9+i*.3,0]});
const splice={sites,intron:{start:8,end:17},initialNormal:[1,0,0],baseReach:.32,joinDistance:.42,departure:{translation:[-2.0,1.2,.15],axis:[0,0,1],angle:-.45}};
const thread={sites:Array.from({length:20},(_,i)=>({id:'export-'+i,base:'AUGC'[i%4],offset:i*.26})),path:Array.from({length:161},(_,i)=>{const z=(i-80)*.0875;return [.055*Math.sign(z)*Math.max(0,Math.abs(z)-.8)**2,.018*Math.max(0,Math.abs(z)-.8)**2,z];}),initialNormal:[0,1,0],baseReach:.14,aperture:{center:[0,0,0],normal:[0,0,1],radius:1.15,halfThickness:.55,chainRadius:.23}};
const shared=`const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 const orient=a=>{const x=a.normal,y=a.tangent,z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],ry=Math.asin(Math.max(-1,Math.min(1,-x[2])));return Math.abs(Math.cos(ry))>1e-7?[Math.atan2(y[2],z[2]),ry,Math.atan2(x[1],x[0])]:[Math.atan2(-z[1],y[1]),ry,0];};
 const text=(id,label,pos,fill='WHITE',size=.22)=>s.text(id,{text:label,position:pos,fill,fontSize:size,billboard:true,labelOcclusion:'overlay'});
 const link=(id,a,b,active)=>{const geo=t=>s.molecularBackboneGeometry({segments:[{id:'edge',chainId:'rna',residues:[{id:'a',position:a(t),value:0},{id:'b',position:b(t),value:0}]}],bonds:[['a','b']],representation:'sticks',radius:.065,initialNormal:[0,1,0],radialSegments:8,colors:['GREEN','GREEN'],provenance:{kind:'schematic',source:'Explicit processing edge',units:'arbitrary'}}).meshes[0];const h=s.mesh(id,{...geo(0),shading:'smooth',material:{roughness:.4,specular:.45}});s.bind(h,[s.time],t=>{const g=geo(t);return {vertices:g.vertices,normals:g.normals,opacity:active(t)?1:0};});};`;
const sources={splice:`export default scene({mode:'3d',background:'GREY_D',lighting:{ambient:1.7,directional:{intensity:1.2}},end:'hold'},s=>{${shared}
 const props=${JSON.stringify(splice)};let last=-1,result;const pose=t=>{if(last!==t){last=t;result=s.nucleicSplice(props,Math.min(1,t/7));}return result;};
 const colors={A:'ORANGE',U:'BLUE',G:'GOLD',C:'PURPLE_A'};
 for(let i=0;i<props.sites.length;i++){const a=pose(0).anchors[i],info=s.modelInfo('schematic-nucleotide-'+a.shape+'-context');for(const part of info.parts){const h=s.mesh('site-'+a.id+'-'+part.id,{asset:{id:info.id,hash:info.hash,part:part.id},fill:part.id==='base'?(i>=8&&i<=17?'YELLOW':colors[a.base]):'GREEN',shading:'smooth',material:{roughness:.36,specular:.5}});s.bind(h,[s.time],t=>{const a=pose(t).anchors[i];return {position:a.backbone,rotation:orient(a),scale:.32/.675};});}}
 const edges=props.sites.slice(1).map((v,i)=>[i,i+1]);edges.push([7,18]);for(const [a,b] of edges)link('bond-'+a+'-'+b,t=>pose(t).anchors[a].backbone,t=>pose(t).anchors[b].backbone,t=>pose(t).bonds.some(e=>e[0]===props.sites[a].id&&e[1]===props.sites[b].id));
 for(const i of [7,18]){const h=s.sphere('cut-end-'+i,{radius:.11,fill:'WHITE'});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone,opacity:pose(t).phase==='closing'?1:0}));}
 const enzyme=s.modelInfo('schematic-organic-machinery');for(let e=0;e<2;e++)for(const part of enzyme.parts){const h=s.mesh('enzyme-'+e+'-'+part.id,{asset:{id:enzyme.id,hash:enzyme.hash,part:part.id},fill:'BLUE',scale:.19,shading:'smooth',material:{roughness:.38,specular:.5}});s.bind(h,[s.time],t=>{const a=pose(t).anchors[e?18:7].backbone,approach=1-smooth(t,0,1.2),depart=smooth(t,4.9,1.5);return {position:[a[0]+(e?1:-1)*1.6*approach-1.7*depart,a[1]+.4*depart,-.45],rotation:[0,0,e?.4:-.4]};});}
 const intron=text('intron','Intron',[-2.7,.2,.7],'YELLOW');s.bind(intron,[s.time],t=>({position:pose(t).anchors[12].backbone.map((v,k)=>v+(k===0?-.7:k===1?.35:.55))}));
 text('scope','RNA splicing · schematic',[-2.2,3.6,0],'GREY_A',.19);
 const exons=text('exons','Exons',[3.15,1.7,.3],'GREEN');
 const joined=text('joined','Joined',[.8,-.5,.3],'WHITE');s.bind(joined,[s.time],t=>({opacity:pose(t).phase==='joined'?1:0}));
 s.play(s.camera.to3D({height:8.9,distance:24,yaw:.13,pitch:-.08,target:[-.4,.1,0]}),{duration:0});s.wait(8);
});`,pore:`export default scene({mode:'3d',background:'GREY_C',lighting:{ambient:2,directional:{intensity:1.4}},end:'hold'},s=>{${shared}
 const props=${JSON.stringify(thread)};let last=-1,result;const pose=t=>{if(last!==t){last=t;result=s.nucleicThread(props,smooth(t,.5,6.5));}return result;};
 const membrane=s.modelInfo('schematic-pore-membrane');s.mesh('membrane',{asset:{id:membrane.id,hash:membrane.hash,part:'annulus'},fill:'PURPLE_B',shading:'smooth',material:{roughness:.68,specular:.2}});
 for(let i=0;i<8;i++){const a=i*2*Math.PI/8;s.sphere('pore-lobe-'+i,{radius:.6,position:[1.4*Math.cos(a),1.4*Math.sin(a),0],fill:'ORANGE',material:{roughness:.45,specular:.38}});}
 for(let i=0;i<props.sites.length;i++){const h=s.sphere('site-'+i,{radius:.14,fill:i===8?'YELLOW':'GREEN',material:{roughness:.4,specular:.4}});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone}));if(i)link('bond-'+i,t=>pose(t).anchors[i-1].backbone,t=>pose(t).anchors[i].backbone,()=>true);}
 text('scope','Nuclear export · schematic',[-2.7,3.5,0],'GREY_A',.21);text('pore-label','Nuclear pore',[1.8,-1.9,.7],'WHITE',.24);
 const label=text('rna','mRNA',[0,0,0],'GREEN',.24);s.bind(label,[s.time],t=>({position:pose(t).anchors[8].backbone.map((v,k)=>v+(k===0?.5:k===1?.5:0))}));
 s.play(s.camera.to3D({height:11.5,distance:34,yaw:2.2,pitch:-.25,target:[0,0,0]}),{duration:0});s.wait(2.2);s.play(s.camera.animate({yaw:.95,pitch:-.15,height:11.5}),{duration:3.8,ease:'smooth'});s.wait(2);
});`};
const modelAssets=['purine-context/schematic-nucleotide-purine-context.json','pyrimidine-context/schematic-nucleotide-pyrimidine-context.json','machinery/schematic-organic-machinery.json'].map(p=>resolve('shared/animlib/fixtures/biological/nucleotide-anatomy',p));modelAssets.push(resolve('shared/animlib/fixtures/biological/rna-processing/schematic-pore-membrane.json'));
const registry=await loadAssetRegistry(modelAssets);
for(const [id,source] of Object.entries(sources)){
 await writeFile(join(directory,id+'.js'),source);await writeFile(join(directory,id+'-manifest.json'),JSON.stringify({modelAssets,scenes:[{id,file:id+'.js',duration:8}],captions:[]},null,2));
 await writeFile(join(directory,id+'-frames.json'),JSON.stringify({source,modelAssets,times:[0,.8,1.39,1.41,2,3,4,4.89,4.91,6,7,7.9,3],directory:join(directory,id+'-frames')}));
 const start=performance.now();await withOfflineScene(source,{},async sampler=>{const compiledMs=performance.now()-start,saved=sampler.sample(3);sampler.sample(8);if(JSON.stringify(saved)!==JSON.stringify(sampler.sample(3)))throw Error(id+' reverse seek');let bytes=0;const at=performance.now();for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i/15)).length);const report={sourceCharacters:source.length,compiledMs,sample121IncludingSerializationMs:performance.now()-at,maxSerializedFrameBytes:bytes,elements:saved.elements.length,reverseSeek:'exact',assetStats:registry.stats()};await writeFile(join(directory,id+'-measurements.json'),JSON.stringify(report,null,2));console.log(id,report);},{modelAssets:registry});
}
