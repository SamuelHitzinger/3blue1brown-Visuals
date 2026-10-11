/** Independent numerical audit. Reads original source; instruments an in-memory copy
 * only to expose authored variables, then checks untouched source in native QuickJS. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createPeptideBuilders,withOfflineScene,Color} from 'animlib/core';

const sourcePath=resolve(process.argv[2]??'data/animlib-expansion/pipeline-demo/872ef266-3328-4b6b-a520-c911f0952d69/scene-inspection/0-a4120134-f28e-4bcd-9100-fc795c3af875/1-inspect.js');
const output=resolve(process.argv[3]??'data/animlib-expansion/pipeline-demo/geometry-review.json');
const source=await readFile(sourcePath,'utf8'),hash=createHash('sha256').update(source).digest('hex');
const api=createPeptideBuilders(),calls=[];
let captured;
const handle=id=>new Proxy({id},{get:(o,k)=>k in o?o[k]:(...args)=>({id,method:k,args})});
const context=new Proxy({peptidePose:(spec,phi,psi)=>{calls.push({phi:[...phi],psi:[...psi]});return api.peptidePose(spec,phi,psi);},camera:handle('camera'),time:{}},{get:(o,k)=>k in o?o[k]:(id)=>handle(id)});
assert(source.includes('until(__narration.durationSec);'),'Expected final duration anchor');
const inspectionCopy=source.replace('export default scene(','return scene(').replace('until(__narration.durationSec);','capture({spec,poseAt,initial,final,ni,ci,qi,bi,index,moving,world,progress,pose,arcPoints,t0,t1,scale});until(__narration.durationSec);');
new Function('scene','Color','capture',inspectionCopy)((options,callback)=>callback(context),Color,x=>captured=x);
const g=captured,sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a),dist=(a,b)=>norm(sub(a,b)),unit=a=>mul(a,1/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angle=(a,b,c,d)=>{const u=unit(sub(c,b)),p=sub(a,b),q=sub(d,c),v=sub(p,mul(u,dot(p,u))),w=sub(q,mul(u,dot(q,u)));return Math.atan2(dot(cross(u,v),w),dot(v,w));};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const maxima={bondLengthError:0,upstreamDrift:0,axisDrift:0,phiError:0,psiError:0,omegaError:0,worldBondLengthError:0,compiledAtomError:0,surfaceConnectorError:0,ghostConnectorError:0,arcRadiusError:0,arcPlaneError:0,arcEndpointError:0,ghostDrift:0};
const update=(key,value)=>{maxima[key]=Math.max(maxima[key],value);assert(value<1e-9,`${key}: ${value}`);};
assert.equal(g.spec.residues.length,6);assert.equal(g.ni,10);assert.equal(g.ci,11);assert.equal(g.qi,16);
const initial=g.initial,atomIds=initial.atoms.map(a=>a.id),bondIds=JSON.stringify(initial.bonds);
assert.equal(atomIds.length,30);assert.equal(initial.bonds.length,29);assert.equal(new Set(atomIds).size,30);
const rawAxis=unit(sub(initial.atoms[g.ci].position,initial.atoms[g.ni].position));
const fixed=initial.atoms.map((_,i)=>i).filter(i=>i<=11),moving=initial.atoms.map((_,i)=>i).filter(i=>i>=12);
const lengths=initial.bonds.map(([a,b])=>dist(initial.atoms[g.index[a]].position,initial.atoms[g.index[b]].position));
let maxDownstreamDisplacement=0,minDownstreamEndDisplacement=Infinity;
for(let j=0;j<=100;j++){
  const frac=j/100,p=g.poseAt(frac),pts=p.atoms.map(a=>a.position);
  assert.deepEqual(p.atoms.map(a=>a.id),atomIds);assert.equal(JSON.stringify(p.bonds),bondIds);
  p.bonds.forEach(([a,b],k)=>update('bondLengthError',Math.abs(dist(pts[g.index[a]],pts[g.index[b]])-lengths[k])));
  fixed.forEach(i=>update(i===g.ni||i===g.ci?'axisDrift':'upstreamDrift',dist(pts[i],initial.atoms[i].position)));
  moving.forEach(i=>{const d=dist(pts[i],initial.atoms[i].position);maxDownstreamDisplacement=Math.max(maxDownstreamDisplacement,d);if(j===100)minDownstreamEndDisplacement=Math.min(minDownstreamEndDisplacement,d);});
  for(let i=1;i<6;i++)update('phiError',Math.abs(wrap(angle(pts[(i-1)*5+2],pts[i*5],pts[i*5+1],pts[i*5+2])-(-120+(i===2?60*frac:0))*Math.PI/180)));
  for(let i=0;i<5;i++){
    update('psiError',Math.abs(wrap(angle(pts[i*5],pts[i*5+1],pts[i*5+2],pts[(i+1)*5])-140*Math.PI/180)));
    update('omegaError',Math.abs(wrap(angle(pts[i*5+1],pts[i*5+2],pts[(i+1)*5],pts[(i+1)*5+1])-Math.PI)));
  }
}
assert(minDownstreamEndDisplacement>0.1);assert(g.moving.every((v,i)=>v===(i>=12)));
assert(calls.every(c=>c.phi.length===6&&c.psi.length===6&&c.phi.every((v,i)=>i===2||v===-120*Math.PI/180)&&c.psi.every(v=>v===140*Math.PI/180)));
const startWorld=initial.atoms.map(a=>g.world(a.position)),axis=unit(sub(startWorld[g.ci],startWorld[g.ni]));
const q=startWorld[g.qi],center=add(startWorld[g.ni],mul(axis,dot(sub(q,startWorld[g.ni]),axis))),radius=dist(q,center);
const times=[0,2,4,6,g.t0,...Array.from({length:101},(_,i)=>g.t0+(g.t1-g.t0)*i/100),14,16,18,20.167];
let sceneSummary,reverseSeeks=0,arcSamples=0;
await withOfflineScene(source,{},sampler=>{
  const {palette,...options}=sampler.scene.options;
  sceneSummary={duration:sampler.scene.duration,options,reactiveBindings:sampler.scene.reactiveBindings?.length};
  const camera=JSON.stringify(sampler.sample(0).camera),checks=new Map();
  for(const t of times){
    const frame=sampler.sample(t),elements=new Map(frame.elements.map(e=>[e.id,e]));
    assert.equal(JSON.stringify(frame.camera),camera,'Camera changed');
    const pose=g.poseAt(g.progress(t)),expected=pose.atoms.map(a=>g.world(a.position));
    assert.equal(frame.elements.filter(e=>/^peptide-atom-\d+$/.test(e.id)).length,30);
    assert.equal(frame.elements.filter(e=>/^peptide-bond-\d+$/.test(e.id)).length,29);
    atomIds.forEach((_,i)=>update('compiledAtomError',dist(elements.get('peptide-atom-'+i).position,expected[i])));
    initial.bonds.forEach(([a,b],k)=>{
      const i=g.index[a],j=g.index[b],ea=elements.get('peptide-atom-'+i),eb=elements.get('peptide-atom-'+j),u=unit(sub(eb.position,ea.position));
      update('worldBondLengthError',Math.abs(dist(ea.position,eb.position)-lengths[k]*g.scale));
      const ends=elements.get('peptide-bond-'+k).geometry.points;
      update('surfaceConnectorError',dist(ends[0],add(ea.position,mul(u,ea.geometry.radius))));
      update('surfaceConnectorError',dist(ends[1],sub(eb.position,mul(u,eb.geometry.radius))));
    });
    for(const i of moving){const ghost=elements.get('initial-atom-'+i);if(ghost)update('ghostDrift',dist(ghost.position,startWorld[i]));}
    const ghostBonds=frame.elements.filter(e=>/^initial-bond-\d+$/.test(e.id));
    for(const edge of ghostBonds){
      const k=Number(edge.id.slice('initial-bond-'.length)),[a,b]=initial.bonds[k],i=g.index[a],j=g.index[b];
      assert(i>=12||j>=12,'Ghost includes upstream-only bond');
      const ea=elements.get('initial-atom-'+i)??elements.get('initial-anchor-'+i),eb=elements.get('initial-atom-'+j)??elements.get('initial-anchor-'+j),u=unit(sub(eb.position,ea.position));
      update('ghostConnectorError',dist(edge.geometry.points[0],add(ea.position,mul(u,ea.geometry.radius))));
      update('ghostConnectorError',dist(edge.geometry.points[1],sub(eb.position,mul(u,eb.geometry.radius))));
    }
    for(let i=0;i<30;i++)assert.equal(elements.get('peptide-atom-'+i).fill,i===g.ni||i===g.ci?'TEAL':i>=12?'ORANGE':'BLUE_D','Atom role color changed');
    const arc=elements.get('tracked-arc');
    if(arc){
      const pts=arc.geometry.points;assert.equal(pts.length,65);
      for(const p of pts){update('arcRadiusError',Math.abs(dist(p,center)-radius));update('arcPlaneError',Math.abs(dot(sub(p,center),axis)));arcSamples++;}
      update('arcEndpointError',dist(pts[0],startWorld[g.qi]));update('arcEndpointError',dist(pts.at(-1),elements.get('peptide-atom-'+g.qi).position));
    }
    checks.set(t,JSON.stringify(frame));
  }
  for(const t of [...times].reverse()){assert.equal(JSON.stringify(sampler.sample(t)),checks.get(t),`Reverse seek ${t}`);reverseSeeks++;}
  for(const t of [9,12.2,0,18,10.42,g.t0,20.167]){const a=JSON.stringify(sampler.sample(t));sampler.sample((t+7)%20);assert.equal(JSON.stringify(sampler.sample(t)),a);reverseSeeks++;}
});
const report={verdict:'pass',sourcePath,sha256:hash,checkedAt:new Date().toISOString(),method:'Independent signed dihedral measurement and geometric invariants; closure values extracted from instrumented in-memory copy; untouched source compiled/sampled with native QuickJS with no limits override.',productionDefaults:{executionLimitMs:200,memoryMiB:32,sourceMaximumBytes:256000,sourceBytes:Buffer.byteLength(source),overrides:false},scene:sceneSummary,geometry:{residues:6,atoms:30,bonds:29,changedPhiIndex:2,phiStartDegrees:-120,phiEndDegrees:-60,fixedAtoms:12,movingAtoms:18,trackedAtom:atomIds[g.qi],axis:atomIds.slice(g.ni,g.ci+1),motionStart:g.t0,motionEnd:g.t1,resultHoldSeconds:sceneSummary.duration-g.t1,bondLengths:[...new Set(lengths.map(x=>Number(x.toFixed(12))))],worldScale:g.scale,arcRadiusWorld:radius,maxDownstreamDisplacement,minDownstreamEndDisplacement},samples:{rawPoses:101,nativeFrames:times.length,reverseSeeks,arcPoints:arcSamples},maximumErrors:maxima,limitations:['Surface connectors deliberately shorten visible bond segments by the endpoint sphere radii; atom-center bond distances are invariant.','Fixed orthographic projection can change apparent 2D bond lengths while preserving true 3D lengths.','This is an original schematic template and prescribed torsion; no energetic or folding simulation claim is supported.','Rendered readability and style are delegated to the independent visual reviewer; this audit checks actual compiled geometry, not raster legibility.']};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
await writeFile(output.replace(/\.json$/,'.md'),`# Generated peptide geometry audit\n\nVerdict: **pass**. Source SHA-256: \`${hash}\`.\n\nUntouched generated source compiled and sampled with production defaults (200 ms execution, 32 MiB VM, no overrides). Six residues, 30 atoms and 29 explicit bonds preserve identity. Only phi[2] changes, from -120° to -60°; 12 atoms including the N–CA axis remain stationary and all 18 downstream atoms move. Independently measured phi, psi and trans omega agree with the prescribed values.\n\n101 raw poses and ${times.length} native compiled frames preserve every atom-center bond length within ${maxima.bondLengthError.toExponential(3)} model units. Compiled spheres and surface-trimmed bond endpoints correspond to those atoms; maximum sphere discrepancy is ${maxima.compiledAtomError.toExponential(3)} world units. The trace follows ${atomIds[g.qi]} on its true circle about the fixed axis, with maximum radius error ${maxima.arcRadiusError.toExponential(3)} and endpoint error ${maxima.arcEndpointError.toExponential(3)}. The initial ghost stays fixed and the camera/common transform stay constant. ${reverseSeeks} reverse/nonmonotonic seeks reproduced identical complete frames.\n\nMotion: ${g.t0.toFixed(3)}–${g.t1.toFixed(3)} s; endpoint holds ${(sceneSummary.duration-g.t1).toFixed(3)} s. The length mark refers to a true unchanged 1.40-model-unit CA–C bond. Screen-projected lengths can vary under the oblique view; the bond-center distances in 3D do not. Raster readability/style remain the separate visual review’s responsibility.\n`);
console.log(JSON.stringify(report,null,2));
