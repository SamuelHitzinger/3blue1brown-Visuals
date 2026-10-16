/** Past-only synthetic prefix probe. One request per step; never repairs generated output. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {runProbe,type WorldSubmission} from './realtime-tool-probe.js';
import {lectureAuthorSystem} from './realtime-lecture-join.js';
import {LiveWorld} from './realtime-world/world.js';
import {commitLectureSubmission} from './realtime-media/world-submission.js';
import {CommittedContextJournal} from './realtime-media/committed-context.js';
import {buildWorldContext} from './realtime-media/world-context.js';
import type {Frame} from '../../shared/animlib/src/types.js';
import {SpatialFrame} from '../../shared/animlib/src/spatial.js';

const steps=[
 {id:'cube',text:'Consider a cube A. Its dimensions and motion have not yet been specified.'},
 {id:'incomplete',text:'The velocity of A is ... [the speaker has not supplied its value or direction yet].'},
 {id:'velocity',text:'A now moves right at 0.6 display units per second. Right is positive X; these are illustrative display units, not metres.'},
 {id:'reverse',text:'A now changes its velocity to minus 0.4 display units per second along X. This is a new physical event, not a correction of the earlier statement.'},
 {id:'stop',text:'A now stops moving.'},
 {id:'structure',text:'Correction: A should be represented as a sphere, not a cube. Keep A at its current pose and keep its label and other unrelated content. Its stopped state remains valid.'},
 {id:'surface',text:'Introduce a separate 3D surface z = x*x - y*y for x and y in [-1,1]. Show its actual curved geometry using a 20 by 20 cell grid, with local identification. Keep A.'},
 {id:'molecule',text:'Introduce a separate benzene connectivity schematic, not an optimized molecular conformer: six carbon atoms at regular hexagon vertices in the XY plane, each attached to one outward hydrogen, and a six-carbon ring with alternating single and double bonds. Show all 12 atoms and the bonds as spatial ball-and-stick geometry. Use an illustrative scale and place it apart from existing objects. Keep A and the surface.'},
];
const save=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2),{flag:'wx'});
const meaningful=(frame:Awaited<ReturnType<LiveWorld['sample']>>)=>frame.elements.filter(e=>!['text','latex','group'].includes(e.geometry.kind));

/** Narrow sphere/round-stroke scenario checks, not complete connectivity,
 * surface-intersection, camera occlusion, or visual-layout certification. */
export function assertMoleculeAddition(before:Frame,current:Frame,retainedId:string):void{
 const retained=current.elements.find(e=>e.id===retainedId);
 assert(retained?.geometry.kind==='sphere','Molecule addition lost retained sphere A');
 const existing=new Set(before.elements.map(e=>e.id)),added=current.elements.filter(e=>!existing.has(e.id));
 const atoms=added.filter(e=>e.geometry.kind==='sphere');
 assert.equal(atoms.length,12,'Expected twelve distinct sphere atoms');
 const space=new SpatialFrame(current),center=space.world(retainedId),radius=Math.abs(space.radius(retainedId));
 for(const atom of atoms){
  const distance=Math.hypot(...space.world(atom.id).map((value,i)=>value-center[i]));
  assert(distance+1e-9>=radius+Math.abs(space.radius(atom.id)),`${atom.id} overlaps retained sphere ${retainedId}`);
 }
 const bonds=added.filter(e=>e.geometry.kind==='line'||e.geometry.kind==='arrow');
 assert(bonds.length>=15&&bonds.every(e=>e.strokeProfile==='round'),'Expected round spatial bonds for the benzene schematic');
}

export async function runProgressiveModelProbe(directory:string){
 directory=resolve(directory);await mkdir(directory);
 const worker=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{value:undefined,writable:true,configurable:true});
 let clock=100;const world=new LiveWorld({clock:()=>clock}),journal=new CommittedContextJournal();
 const evidence:{id:string;version:number;text:string}[]=[],rows:Record<string,unknown>[]=[];
 let objectId:string|undefined;
 try{
  await save(join(directory,'manifest.json'),{schemaVersion:1,steps,model:'gpt-6-luna',thinking:'off',serviceTier:'priority',timeoutMs:10000,
   measurement:'Synthetic text prefixes and deterministic scene clock. Provider timings exclude ASR, capture and display. Actual generated state feeds every later request. No retries or repair.',
   limitation:'Scenario checks are partial and do not establish full scientific or visual quality, arbitrary-subject parity, or live speech latency.'});
  for(const [index,step] of steps.entries()){
   clock=100+index*5;const folder=join(directory,`${index+1}-${step.id}`);await mkdir(folder);
   const item={id:step.id,version:1,text:step.text};evidence.push(item);
   const before=await world.sample(clock),revision=world.revision;
   const prompt={changes:[item],context:evidence.slice(0,-1),world:buildWorldContext({summary:world.summary(),sampledRevision:revision,
    sampledAt:{worldSeconds:clock},frame:before,requestOverheadBytes:10000,journal}),
    evidenceKind:'synthetic text, not measured speech; all-null speechAnchor required',
    instruction:'Apply only supported new information. Earlier outputs are actual committed state; do not assume missing geometry exists.'};
   await save(join(folder,'prompt.json'),prompt);await writeFile(join(folder,'system.txt'),lectureAuthorSystem,{flag:'wx'});
   const row:Record<string,unknown>={id:step.id,index,baseRevision:revision,status:'failed',provider:null,action:null};
   try{
    const result=await runProbe(['run','--kind=world','--case=external','--model=gpt-6-luna','--thinking=off','--service-tier=priority',
     '--timeout-ms=10000','--max-tokens=4096',`--prompt-file=${join(folder,'prompt.json')}`,`--system-file=${join(folder,'system.txt')}`,`--out=${join(folder,'provider')}`],
     {speechAnchors:true,retainedParameters:true,progressiveWorld:true});
    row.provider=result.report;assert(result.report.status==='complete'&&result.submission,'No complete provider submission');
    const submission=result.submission as WorldSubmission;row.action=submission.action;
    assert.equal(submission.speechAnchor,null,'Synthetic text has no measured speech anchor');
    if(submission.action!=='defer'){
     const started=performance.now(),committed=await commitLectureSubmission(world,submission,revision,`program-${step.id}`,clock);
     row.localCommitMs=performance.now()-started;row.changed=committed.changed;
     if(committed.changed)journal.record({revision:committed.commit.revision,runId:'synthetic-prefix',planId:step.id,committedAtMs:clock*1000,
      evidence:{changes:[{id:step.id,version:1}],context:evidence.slice(0,-1).map(({id,version})=>({id,version}))},operation:committed.operation});
    }
    const current=await world.sample(clock),later=await world.sample(clock+1);
    await save(join(folder,'frames.json'),[{time:clock,frame:current},{time:clock+1,frame:later}]);
    const body=()=>current.elements.find(e=>e.id===objectId),next=()=>later.elements.find(e=>e.id===objectId);
    if(step.id==='cube'){
     assert.equal(submission.action,'add');objectId=meaningful(current)[0]?.id;assert(objectId,'No visible initial object');
     assert.deepEqual(body()?.position,next()?.position,'Unsupported initial translation');assert.deepEqual(body()?.rotation,next()?.rotation,'Unsupported initial rotation');
    }else if(step.id==='incomplete'){
     assert.equal(submission.action,'defer','Incomplete velocity must not invent motion');assert.equal(world.revision,revision);assert(body());
    }else if(['velocity','reverse','stop'].includes(step.id)){
     assert.equal(submission.action,'motion');assert(body()&&next(),'Original object missing');
     const v=step.id==='velocity'?.6:step.id==='reverse'?-.4:0;
     const previous=before.elements.find(e=>e.id===objectId)!;
     assert.deepEqual(body()!.position,previous.position,'Motion start jumped');
     assert(Math.abs(next()!.position[0]-body()!.position[0]-v)<1e-9,'Wrong velocity');
     assert.deepEqual(next()!.position.slice(1),body()!.position.slice(1));
    }else if(step.id==='structure'){
     assert.equal(submission.action,'replace');assert(body(),'Replacement lost original entity identity');
     assert.deepEqual(body()!.position,before.elements.find(e=>e.id===objectId)!.position,'Replacement moved A');
     assert.equal(body()!.geometry.kind,'sphere','Correction did not produce a sphere');
    }else if(step.id==='surface'){
     assert.equal(submission.action,'add');assert(body(),'Surface addition lost A');
     assert(current.elements.some(e=>(e.geometry.vertices?.length??0)>=441),'Missing requested detailed surface');
    }else{
     assert.equal(submission.action,'add');assert(body(),'Molecule addition lost A');
     assertMoleculeAddition(before,current,objectId!);
    }
    row.status='passed';
   }catch(error){row.error=error instanceof Error?error.message:String(error);}
   row.finalRevision=world.revision;row.objectId=objectId;rows.push(row);await save(join(folder,'result.json'),row);
   console.log(JSON.stringify({id:step.id,status:row.status,action:row.action,error:row.error??null}));
  }
  const result={steps:rows.length,passed:rows.filter(r=>r.status==='passed').length,rows};await save(join(directory,'result.json'),result);return result;
 }finally{world.dispose();if(worker)Object.defineProperty(globalThis,'Worker',worker);else delete (globalThis as any).Worker;}
}
if(import.meta.main){
 const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--execute','Use --execute NEW_DIRECTORY to make eight real model requests.');
 const result=await runProgressiveModelProbe(args[1]);if(result.passed!==result.steps)process.exitCode=1;
}
