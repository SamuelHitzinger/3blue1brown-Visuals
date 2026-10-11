import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
const directory=resolve('data/animlib-expansion/rna-processing-3b1b-revision4');await mkdir(directory,{recursive:true});
// Versioned reviewed inputs make reproduction independent of ignored historical renders.
const input=async name=>JSON.parse(await readFile(new URL('./inputs/rna-processing-'+name+'.json',import.meta.url),'utf8')).props;
const splice=await input('splice'),thread=await input('thread');
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080d18',WHITE:'#f0f2f8',GREEN:'#47d7c8',YELLOW:'#f4d06f',BLUE:'#7ea8ff',GREY_A:'#b7c3d9',GREY_D:'#152238',GREY_E:'#101928'}};
const shared=`const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 const text=(id,label,pos,fill='WHITE',size=.28)=>s.text(id,{text:label,position:pos,fill,fontSize:size,billboard:true,labelOcclusion:'overlay'});
 const link=(id,a,b,active,fill='GREEN',width=.055)=>{const h=s.line(id,{points:[a(0),b(0)],stroke:fill,strokeWidth:width,strokeProfile:'round'});s.bind(h,[s.time],t=>({points:[a(t),b(t)],opacity:active(t)?1:0}));};`;
const membrane={vertices:[],normals:[],triangles:[]},n=64;
for(const z of [-.5,.5])for(const r of [1.3,0])for(let i=0;i<n;i++){const a=i*2*Math.PI/n,c=Math.cos(a),q=Math.sin(a),radius=r||Math.min(9/Math.max(1e-9,Math.abs(c)),9/Math.max(1e-9,Math.abs(q)));membrane.vertices.push([radius*c,radius*q,z]);membrane.normals.push([0,0,z>0?1:-1]);}
for(let side=0;side<2;side++)for(let i=0;i<n;i++){const a=side*2*n+i,b=side*2*n+(i+1)%n,c=a+n,d=b+n;membrane.triangles.push(...(side?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]]));}
const wall={vertices:[],normals:[],triangles:[]};for(const z of [-.5,.5])for(let i=0;i<n;i++){const a=i*2*Math.PI/n;wall.vertices.push([1.3*Math.cos(a),1.3*Math.sin(a),z]);wall.normals.push([-Math.cos(a),-Math.sin(a),0]);}for(let i=0;i<n;i++){const a=i,b=(i+1)%n,c=a+n,d=b+n;wall.triangles.push([a,c,b],[b,c,d]);}
const sources={splice:`export default scene({mode:'3d',background:'BLACK',lighting:{ambient:3.125,directional:{direction:[0,0,1],space:'camera',intensity:0}},end:'hold'},s=>{${shared}
 const props=${JSON.stringify(splice)};let last=-1,result;const pose=t=>{if(last!==t){last=t;result=s.nucleicSplice(props,Math.min(1,t/11));}return result;};
 for(let i=0;i<props.sites.length;i++){const fill=i>=10&&i<=29?'YELLOW':'GREEN',h=s.sphere('site-'+i,{radius:.065,fill});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone}));link('base-'+i,t=>pose(t).anchors[i].backbone,t=>pose(t).anchors[i].tip,()=>true,fill,.045);}
 const edges=props.sites.slice(1).map((v,i)=>[i,i+1]);edges.push([9,30]);for(const [a,b] of edges)link('bond-'+a+'-'+b,t=>pose(t).anchors[a].backbone,t=>pose(t).anchors[b].backbone,t=>pose(t).bonds.some(e=>e[0]===props.sites[a].id&&e[1]===props.sites[b].id),a>=10&&b<=29?'YELLOW':'GREEN');
 for(const i of [9,30]){const h=s.sphere('cut-end-'+i,{radius:.11,fill:'WHITE'});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone,opacity:pose(t).phase==='closing'?1:0}));}
 for(let e=0;e<2;e++){const points=t=>{const a=pose(t).anchors[e?29:10].backbone,approach=1-smooth(t,.2,1.25);return Array.from({length:31},(_,i)=>{const u=(-.30+i/30*1.6)*Math.PI;return [a[0]+(e?1:-1)*1.8*approach+.42*Math.cos(u),a[1]+.42*Math.sin(u),-.06];});};const h=s.line('boundary-guide-'+e,{points:points(0),stroke:'BLUE',strokeWidth:.045,strokeProfile:'round'});s.bind(h,[s.time],t=>({points:points(t)}));}
 const intron=text('intron','Intron',[-2,0,.3],'YELLOW');s.bind(intron,[s.time],t=>{const a=pose(t).anchors[19].backbone;return {position:[a[0]-.7,a[1]+.6,.3],opacity:1-smooth(t,6,1)};});
 const exon=text('exon','Exons',[2,3,.3],'GREEN');s.bind(exon,[s.time],t=>({position:pose(t).anchors[35].backbone.map((v,k)=>v+(k===0?.8:k===2?.3:0))}));
 const joined=text('joined','Joined mRNA',[1.1,-.8,.3]);s.bind(joined,[s.time],t=>({opacity:smooth(t,8.1,.4)}));
 s.play(s.camera.to3D({height:11.3,distance:27,perspective:0,yaw:0,pitch:0,target:[-.5,0,0]}),{duration:0});s.wait(1.6);s.play(s.camera.animate({height:9.5,target:[-1,.2,0]}),{duration:1.2,ease:'smooth'});s.wait(9.2);
});`,pore:`export default scene({mode:'3d',background:'BLACK',lighting:{ambient:3.125,directional:{direction:[-.5,.65,1],space:'camera',intensity:0}},end:'hold'},s=>{${shared}
 const props=${JSON.stringify(thread)};let last=-1,result;const pose=t=>{if(last!==t){last=t;const clock=t<=4.4?t:t<4.9?4.4:t-.5;result=s.nucleicThread(props,smooth(clock,.6,8));}return result;};
 s.mesh('membrane',{...${JSON.stringify(membrane)},fill:'GREY_E',shading:'smooth'});s.mesh('lumen',{...${JSON.stringify(wall)},fill:'GREY_D',shading:'smooth'});
 for(const z of [-.5,.5])s.line('rim-'+z,{points:Array.from({length:65},(_,i)=>[1.3*Math.cos(i*Math.PI/32),1.3*Math.sin(i*Math.PI/32),z]),stroke:'BLUE',strokeWidth:.055,strokeProfile:'round'});
 for(let i=0;i<props.sites.length;i++){const h=s.sphere('site-'+i,{radius:i===10?.13:.09,fill:i===10?'YELLOW':'GREEN'});s.bind(h,[s.time],t=>({position:pose(t).anchors[i].backbone}));if(i)link('bond-'+i,t=>pose(t).anchors[i-1].backbone,t=>pose(t).anchors[i].backbone,()=>true,'GREEN',.09);}
 text('pore-label','Nuclear pore',[-2.9,-1.9,.9],'BLUE',.27);
 const labelPoint=t=>{const a=pose(t).anchors[10].backbone;return [a[0]+(t<4.65?3.2:-3.2),a[1]+.8,a[2]+.25];};
 const label=text('rna','mRNA',[0,0,0]);s.bind(label,[s.time],t=>({position:labelPoint(t)}));link('rna-leader',t=>{const a=labelPoint(t);return [a[0]+(t<4.65?-.45:.45),a[1],a[2]];},t=>pose(t).anchors[10].backbone,()=>true,'GREY_A',.017);
 s.play(s.camera.to3D({height:10.6,distance:30,perspective:1,yaw:3.05,pitch:.75,target:[0,.3,-2]}),{duration:0});s.wait(4.65);s.play(s.camera.to3D({yaw:.1,pitch:.85,height:10.6,distance:30,perspective:1,target:[1.1,.4,2.3]}),{duration:0});s.wait(5.35);
});`};
for(const [id,source] of Object.entries(sources)){
 const duration=id==='splice'?12:10,times=id==='splice'?[0,2,3.5,5.39,6.15,6.17,7,8.04,9,11.9]:[0,3.5,4.4,4.649,4.65,5.4,6.5,9.9];
 await writeFile(join(directory,id+'.js'),source);await writeFile(join(directory,id+'-manifest.json'),JSON.stringify({palette,scenes:[{id,file:id+'.js',duration}],captions:[]},null,2));
 await writeFile(join(directory,id+'-frames.json'),JSON.stringify({source,palette,times,directory:join(directory,id+'-frames')}));
 const at=performance.now();await withOfflineScene(source,{palette},async sampler=>{const compiledMs=performance.now()-at,saved=sampler.sample(5.4);sampler.sample(duration);if(JSON.stringify(saved)!==JSON.stringify(sampler.sample(5.4)))throw Error('Reverse seek');const begin=performance.now();let maxSerializedFrameBytes=0;for(let i=0;i<=120;i++)maxSerializedFrameBytes=Math.max(maxSerializedFrameBytes,JSON.stringify(sampler.sample(i*duration/120)).length);const report={compiledMs,sample121IncludingSerializationMs:performance.now()-begin,maxSerializedFrameBytes,elements:saved.elements.length,reverseSeek:'exact',externalAssets:0};console.log(id,report);await writeFile(join(directory,id+'-measurements.json'),JSON.stringify(report,null,2));});
}

