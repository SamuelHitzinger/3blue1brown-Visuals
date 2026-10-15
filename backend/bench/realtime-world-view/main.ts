import { LiveWorld } from '../realtime-world/world.js';
import { CanvasRenderer } from '../../../shared/animlib/src/renderer.js';
const canvas=document.querySelector('canvas')!, form=document.querySelector('form')!, button=document.querySelector('button')!;
const status=document.querySelector('#status')!, report=document.querySelector('#report')!;
const now=()=>performance.now()/1000;
let renderer:CanvasRenderer, renderError:Error|undefined, pending:false|{revision:number;resolve:()=>void}=false;
const world=new LiveWorld({prepare:async(scene,assets,signal)=>{signal.throwIfAborted();await renderer.prepare([scene],assets);signal.throwIfAborted();}});
renderer=new CanvasRenderer(canvas,undefined,world.assetGeometry);
renderer.onError=error=>{renderError=error;status.textContent=error.message;};
renderer.onRecovered=()=>{renderError=undefined;};
await renderer.prepare([]);
status.textContent=`Ready · ${renderer.backend} · 10-second target`;button.disabled=false;
let lastFrame:any;
async function frame(){
  try {
    const revision=world.revision;
    lastFrame=await world.sample(now());
    if(revision===world.revision){
      renderer.render(lastFrame,world.rendererOptions);
      if(pending&&pending.revision===revision&&!renderError){const done=pending.resolve;pending=false;done();}
    }
  }catch(error){status.textContent=String(error);}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled)return;
  button.disabled=true;const started=performance.now(),baseRevision=world.revision;
  const instruction=document.querySelector('input')!.value,action=document.querySelector('select')!.value;
  const evidence:any={startedAt:new Date().toISOString(),instruction,action,baseRevision,measurement:'click-to-first-render-submission',
    limitation:'Renderer submission is not a hardware presentation timestamp. Semantic correctness and visual quality are not established by this timing.'};
  status.textContent='Generating… existing animation continues.';
  try {
    const response=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction,action,world:{...world.summary(),elements:lastFrame?.elements.map((e:any)=>({id:e.id,kind:e.geometry.kind,position:e.position,rotation:e.rotation,fill:e.fill}))}})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    evidence.requestId=result.id;evidence.modelCompleteMs=result.metadata.textMetrics.completeOutputMs;evidence.serviceTierActual=result.metadata.serviceTierActual;
    evidence.receivedMs=performance.now()-started;
    if(action==='add')await world.addProgram({id:result.id,source:result.source,baseRevision},now());
    else {const patch=JSON.parse(result.source);await world.apply({...patch,baseRevision},now());}
    evidence.committedMs=performance.now()-started;
    if(renderError)throw renderError;
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{pending=false;reject(new Error('No rendered frame within deadline'));},2000);pending={revision:world.revision,resolve:()=>{clearTimeout(timeout);resolve();}};});
    evidence.firstRenderSubmissionMs=performance.now()-started;evidence.within10s=evidence.firstRenderSubmissionMs<=10_000;
    evidence.status='submitted';evidence.entityIds=world.summary().entityIds;
    status.textContent=`Frame submitted in ${(evidence.firstRenderSubmissionMs/1000).toFixed(2)}s · revision ${world.revision} · quality unreviewed`;
  }catch(error){evidence.status='failed';evidence.error=error instanceof Error?error.message:String(error);status.textContent=evidence.error;}
  finally {evidence.elapsedMs=performance.now()-started;report.textContent=JSON.stringify(evidence,null,2);await fetch('/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evidence)}).catch(()=>{});button.disabled=false;}
});
window.addEventListener('pagehide',()=>{world.dispose();renderer.dispose();});
