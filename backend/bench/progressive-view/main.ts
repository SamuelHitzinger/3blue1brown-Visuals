import {LiveWorld} from '../realtime-world/world.js';
import {CanvasRenderer} from '../../../shared/animlib/src/renderer.js';
import {markerSource,objectSource,surfaceSource} from './fixtures.js';

const canvas=document.querySelector<HTMLCanvasElement>('#world')!,step=document.querySelector<HTMLButtonElement>('#step')!,
  reset=document.querySelector<HTMLButtonElement>('#reset')!,status=document.querySelector('#status')!,
  evidence=document.querySelector('#evidence')!,telemetry=document.querySelector('#telemetry')!,events=document.querySelector('#events')!;
const labels=['1 · “Consider a cube…”','2 · “Moves right at 0.6…”','3 · “Now left at 0.4…”','4 · “Stop.”','5 · “Use a sphere instead.”','6 · “Add this surface…”'];
const facts=[
  'Known: cube exists. Velocity unknown; stationary preview does not assert zero velocity.',
  'Known: velocity = [+0.6, 0, 0] display units/s. Attach motion from the current pose.',
  'Known: velocity = [−0.4, 0, 0] display units/s. Change velocity without restarting position.',
  'Known: velocity = [0, 0, 0]. Hold the current pose.',
  'Known: geometry changes to a sphere. Keep object identity, local label, and current pose.',
  'Known: add z = 0.45 sin(2u) cos(2v). Native custom geometry joins the existing world.',
];
let world:LiveWorld|undefined,renderer:CanvasRenderer|undefined,generation=0,disposed=false,busy=false,drawing=false,faulted=false,next=0,origin=0,objectEpoch=0;
const now=()=>performance.now()/1000;
function controls(){step.disabled=faulted||busy||next>=labels.length||!world||(next===1&&now()-objectEpoch<2);reset.disabled=busy;step.textContent=labels[next]??'Sequence complete';}
function failed(error:unknown){faulted=true;status.textContent=`Failed: ${error instanceof Error?error.message:String(error)}`;status.classList.add('error');step.disabled=true;}
async function rebuild(){
  if(busy)return;busy=true;controls();const token=++generation;
  while(drawing)await new Promise(resolve=>setTimeout(resolve,10));
  world?.dispose();renderer?.dispose();world=undefined;renderer=undefined;next=0;faulted=false;events.replaceChildren();telemetry.textContent='';
  evidence.textContent='No object evidence yet.';status.classList.remove('error');status.textContent='Preparing native world…';
  try{
    origin=now();let candidateRenderer:CanvasRenderer;
    const candidate=new LiveWorld({clock:now,prepare:async(scene,assets)=>{await candidateRenderer.prepare([scene],assets);}});
    world=candidate;candidateRenderer=new CanvasRenderer(canvas,undefined,candidate.assetGeometry);renderer=candidateRenderer;
    candidateRenderer.onError=error=>{if(token===generation)failed(error);};
    await candidate.addProgram({id:'reference',source:markerSource,baseRevision:0},now());
    status.textContent=`Ready · ${candidateRenderer.backend} · click the next evidence input.`;
  }catch(error){failed(error);}finally{busy=false;controls();}
}
async function advance(){
  if(busy||step.disabled||!world)return;busy=true;controls();const current=world,at=now(),index=next;
  try{
    let commit;
    if(index===0){commit=await current.addProgram({id:'object-program',source:objectSource('cube'),baseRevision:current.revision},at);objectEpoch=commit.committedAt;}
    else if(index<=3){const velocity=([.6,-.4,0] as const)[index-1];commit=await current.setMotion({baseRevision:current.revision,changes:[{id:'object',velocity:[velocity,0,0]}]},at);}
    else if(index===4)commit=await current.replaceProgram({id:'object-program',source:objectSource('sphere'),baseRevision:current.revision},at);
    else commit=await current.addProgram({id:'surface-program',source:surfaceSource,baseRevision:current.revision},at);
    evidence.textContent=facts[index];const entry=document.createElement('li');
    entry.textContent=`Input ${index+1} → revision ${commit.revision} at ${(commit.committedAt-origin).toFixed(2)} s. ${index===4?'Replaced only the object program.':index===5?'Added custom surface.':index===0?'Created object; velocity pending.':'Motion updated on the existing object.'}`;
    events.append(entry);next++;status.textContent=`Ready · ${renderer?.backend} · native world retained.`;
  }catch(error){failed(error);}finally{busy=false;controls();}
}
async function tick(){
  if(disposed)return;
  if(world&&renderer&&!busy&&!drawing&&!faulted){
    drawing=true;const token=generation,current=world,at=now();
    try{
      const frame=await current.sample(at);
      if(token===generation&&!disposed){
        if(!renderer.render(frame,current.rendererOptions))throw Error('Native renderer did not submit frame');
        const object=frame.elements.find(item=>item.id==='object'),summary=current.summary(),motion=summary.motions.find(item=>item.id==='object');
        telemetry.textContent=`World ${(at-origin).toFixed(1)} s · revision ${current.revision} · ${summary.programs.length} programs · ${frame.elements.length} elements`
          +(object?` · object x = ${object.position[0].toFixed(3)} · ${motion?`velocity x = ${motion.velocity[0]}`:'velocity pending'} · object age ${(at-objectEpoch).toFixed(1)} s`:'');
      }
    }catch(error){if(token===generation)failed(error);}finally{drawing=false;controls();}
  }
  requestAnimationFrame(tick);
}
step.addEventListener('click',()=>void advance());reset.addEventListener('click',()=>void rebuild());
window.addEventListener('pagehide',()=>{disposed=true;generation++;world?.dispose();renderer?.dispose();});
await rebuild();requestAnimationFrame(tick);
