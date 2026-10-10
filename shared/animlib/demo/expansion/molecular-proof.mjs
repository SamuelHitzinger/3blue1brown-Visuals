/** Original native proof. Run after npm run build --prefix shared/animlib. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createMolecularBackboneBuilders} from '../../dist/molecular-backbone.js';
import {createMoleculeBuilders} from '../../dist/molecules.js';
import {createMolecularEnvelope} from '../../dist/molecular-envelope.js';
import {withOfflineScene} from '../../dist/core.js';
const directory=resolve('data/animlib-expansion/molecular-proof');
const integrated=process.argv.includes('--integrated');
await mkdir(directory,{recursive:true});
const api=createMolecularBackboneBuilders(createMoleculeBuilders());
const count=33;
const spec={lengths:Array(count-1).fill(0.55),from:Array.from({length:count-1},(_,i)=>[i===0?0:0.082,0]),to:Array.from({length:count-1},(_,i)=>[i===0?0:0.73+0.09*Math.sin(i*0.7),0.26+0.05*Math.cos(i*0.4)]),start:1.1,duration:3.6};
function centeredPose(time){const p=api.articulatedChainPose(spec,time),center=[0,1,2].map(j=>(Math.min(...p.map(v=>v[j]))+Math.max(...p.map(v=>v[j])))/2);return p.map(v=>[v[1]-center[1],-v[0]+center[0],v[2]-center[2]]);}
const finalPositions=centeredPose(8);
const colors=['RED','ORANGE','YELLOW','GREEN','BLUE_D','PURE_BLUE'];
const envelope=createMolecularEnvelope({positions:finalPositions.flat(),sigma:0.36,isoLevel:0.52,resolution:19,smoothingIterations:3});
envelope.scalarColors={domain:[0,1],colors,values:envelope.vertices.map(v=>{
  let closest=0,distance=Infinity;for(let i=0;i<finalPositions.length;i++){const d=v.reduce((sum,x,j)=>sum+(x-finalPositions[i][j])**2,0);if(d<distance){distance=d;closest=i;}}return closest/(count-1);
})};
const compact=value=>JSON.stringify(value,(_key,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
const source=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
  const api=${integrated?'{molecularBackbone:props=>s.molecularBackboneGeometry(props),articulatedChainPose:(spec,time)=>s.articulatedChainPose(spec,time)}':`(${createMolecularBackboneBuilders.toString()})((${createMoleculeBuilders.toString()})())`};
  const spec=${compact(spec)},colors=${compact(colors)};
  const provenance={kind:'schematic',source:'Original fixed-link chain; no folding physics',units:'arbitrary'};
  let lastTime=-1,lastPose;
  function pose(time){if(time!==lastTime){const p=api.articulatedChainPose(spec,time),center=[0,1,2].map(j=>(Math.min(...p.map(v=>v[j]))+Math.max(...p.map(v=>v[j])))/2);lastPose=p.map(v=>[v[1]-center[1],-v[0]+center[0],v[2]-center[2]]);lastTime=time;}return lastPose;}
  function geometry(representation,time,radius,beadDetail=1){const positions=pose(time);return api.molecularBackbone({representation,radius,beadDetail,colors,provenance,segments:[{id:'unbroken-A',chainId:'A',residues:positions.map((position,i)=>({id:'A:'+i,position,value:i/(positions.length-1)}))}],bonds:positions.slice(1).map((_,i)=>['A:'+i,'A:'+(i+1)])}).meshes[0];}
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(time,start,duration)=>{const x=clamp((time-start)/duration);return x*x*(3-2*x);};
  const beadOpacity=time=>smooth(time,0.7,0.4)*(1-smooth(time,5.1,0.4));
  const surfaceOpacity=time=>smooth(time,5.8,0.7);
  const stickOpacity=time=>(1-beadOpacity(time))*(1-surfaceOpacity(time));
  s.play(s.camera.to3D({height:10,distance:25,yaw:0.15,pitch:-0.3}),{duration:0});
  const sticks=s.mesh('explicit-bonds',{...geometry('sticks',0,0.075),fill:'WHITE',material:{roughness:0.5,specular:0.35}});
  s.bind(sticks,[s.time],time=>{const mesh=geometry('sticks',time,0.075);return {vertices:mesh.vertices,normals:mesh.normals,opacity:stickOpacity(time)};});
  const joints=s.mesh('stick-joints',{...geometry('beads',0,0.09),fill:'WHITE',material:{roughness:0.5,specular:0.35}});
  s.bind(joints,[s.time],time=>{const mesh=geometry('beads',time,0.09);return {vertices:mesh.vertices,normals:mesh.normals,opacity:stickOpacity(time)};});
  const beads=s.mesh('residue-beads',{...geometry('beads',0,0.23,2),fill:'WHITE',opacity:0,material:{roughness:0.4,specular:0.35}});
  s.bind(beads,[s.time],time=>{const mesh=geometry('beads',time,0.23,2);return {vertices:mesh.vertices,normals:mesh.normals,opacity:beadOpacity(time)};});
  const surface=s.mesh('same-conformer-surface',{...${compact(envelope)},fill:'WHITE',opacity:0,material:{roughness:0.58,specular:0.25}});
  s.bind(surface,[s.time],time=>({opacity:surfaceOpacity(time)}));
  for(const [index,text] of [[0,'1'],[${count-1},'${count}']]){
    const label=s.text('residue-label-'+index,{text,fontSize:0.23,fill:'WHITE',billboard:true,labelOcclusion:'overlay'});
    s.bind(label,[s.time],time=>({position:pose(time)[index].map((x,j)=>x+(j===1?0.44:0)),opacity:1-surfaceOpacity(time)}));
  }
  s.wait(1.1);s.play(s.camera.animate({height:6.6}),{duration:3.6,ease:'smooth'});s.wait(3.3);
});`;
if(source.length>256000)throw new Error('Source exceeds unchanged compiler cap');
await writeFile(join(directory,'molecular-folding.js'),source);
await writeFile(join(directory,'manifest.json'),JSON.stringify({scenes:[{id:'molecular-folding',file:'molecular-folding.js',duration:8}],captions:[]},null,2));
await writeFile(join(directory,'frames-input.json'),JSON.stringify({source,times:[0,0.7,1.1,2,3,4,4.7,5.1,5.5,5.8,6.15,6.5,7.5,8],directory:join(directory,'frames')}));
let maxRelativeError=0;for(let k=0;k<=800;k++){const p=api.articulatedChainPose(spec,k/100);for(let i=0;i<spec.lengths.length;i++)maxRelativeError=Math.max(maxRelativeError,Math.abs(Math.hypot(...p[i+1].map((x,j)=>x-p[i][j]))/spec.lengths[i]-1));}
const measurements={integration:integrated?'public SceneContext methods':'factory installed in scene source; public integration pending',sourceCharacters:source.length,maxRelativeLinkError:maxRelativeError,anchors:count,explicitBonds:count-1,envelopeVertices:envelope.vertices.length,envelopeTriangles:envelope.triangles.length,provenance:{kind:'schematic',source:'Original serial-chain kinematics',units:'arbitrary',surface:'Existing Gaussian envelope, sigma 0.36, isoLevel 0.52, same endpoint residue coordinates'},spec,finalPositions};
await withOfflineScene(source,{},async sampler=>{const initial=sampler.sample(0),middle=sampler.sample(3),end=sampler.sample(8),back=sampler.sample(0);if(JSON.stringify(initial)!==JSON.stringify(back))throw new Error('Backward seek differs');const vertices=frame=>frame.elements.find(e=>e.id==='residue-beads').geometry.vertices;if(JSON.stringify(vertices(initial))===JSON.stringify(vertices(middle)))throw new Error('Retained chain did not bend');measurements.sceneElements=end.elements.length;measurements.duration=sampler.scene.duration;measurements.beadDetail=2;measurements.meshes=end.elements.filter(e=>e.geometry.kind==='mesh').map(e=>({id:e.id,vertices:e.geometry.vertices.length,triangles:e.geometry.triangles.length}));});
await writeFile(join(directory,'provenance-and-invariants.json'),JSON.stringify(measurements,null,2));
console.log(JSON.stringify({directory,...measurements,finalPositions:undefined,spec:undefined},null,2));
