import {CanvasRenderer} from '../../../shared/animlib/src/renderer.js';
import {StudioSession} from '../src/session.js';

const canvas=document.querySelector('canvas')!,status=document.querySelector('#status')!,title=document.querySelector('#title')!;
const revision=document.querySelector('#revision')!,pause=document.querySelector<HTMLButtonElement>('#pause')!;
const url=new URL(location.href),sessionId=url.searchParams.get('session'),token=new URLSearchParams(url.hash.slice(1)).get('token');
const route=(name:string)=>`/s/${sessionId}/${name}?token=${encodeURIComponent(token??'')}`;
let lease:string|null=null,renderer:CanvasRenderer,session:StudioSession,events:EventSource;
let serial:Promise<unknown>=Promise.resolve(),closing=false,lastSave=0,renderError:string|null=null;
const enqueue=<T>(work:()=>Promise<T>):Promise<T>=>{
  const next=serial.catch(()=>{}).then(work);serial=next;return next;
};
async function post(name:string,data:any){
  const response=await fetch(route(name),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...data,lease})});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error??`HTTP ${response.status}`),{status:response.status});return result;
}
async function save(){
  try{await post('checkpoint',{state:session.checkpoint()});lastSave=performance.now();return {saved:true};}
  catch(error){return {saved:false,error:String(error)};}
}
async function draw(){
  const frame=await session.sample();
  if(!renderer.render(frame,session.world.rendererOptions)||renderError)throw Error(renderError??'Renderer did not submit frame');
  return {status:'submitted',backend:renderer.backend,revision:session.world.revision};
}
async function command(message:any){
  if(message.deadline<Date.now())throw Error('Command expired before execution; no mutation applied');
  const started=performance.now(),{verify,preview,...params}=message.params??{};
  // Validate optional evidence requests BEFORE applying a mutation.
  if(preview!==undefined&&typeof preview!=='boolean')throw Error('preview must be boolean');
  if(verify!==undefined){
    if(!verify||!Array.isArray(verify.checks))throw Error('verify.checks required');
    // Session verify validates property names, IDs and tolerances without mutation.
    await session.execute('verify',verify);
  }
  const result=await session.execute(message.kind,params);
  // Execute immediately due cues before returning the first render submission.
  await session.tick();
  const appliedMs=performance.now()-started;
  let rendering:any,verification:any,imageData:string|undefined,evidenceError:string|undefined;
  try{
    rendering=await draw();
    if(verify)verification=(await session.execute('verify',verify)).verification;
    if(preview)imageData=canvas.toDataURL('image/png').split(',')[1];
  }catch(error){evidenceError=String(error);rendering={status:'failed',error:evidenceError};}
  const persistence=await save();
  const state=await session.execute('inspect');
  revision.textContent=`Revision ${state.revision} · ${state.objectCount} objects`;
  pause.textContent=state.paused?'Resume':'Pause';
  status.textContent=evidenceError??(!persistence.saved?'Applied; checkpoint failed':`${renderer.backend} · ${state.paused?'Paused':'Live'}`);
  return {...result,...state,...(verification?{verification}:{}),rendering,persistence,...(imageData?{imageData}:{}),
    timings:{applyMs:appliedMs,totalMs:performance.now()-started,scope:'viewer execution, rendering submission and checkpoint; excludes model and transport'}};
}
async function start(){
  if(!sessionId||!token)throw Error('Open the viewerUrl returned by animlib_create.');
  const response=await fetch(route('bootstrap'));if(!response.ok)throw Error('Invalid session capability');
  const data=await response.json();title.textContent=data.title;
  session=new StudioSession({prepare:async(scene,assets,signal)=>{
    signal.throwIfAborted();await renderer.prepare([scene],assets);signal.throwIfAborted();
  }});
  renderer=new CanvasRenderer(canvas,undefined,session.world.assetGeometry);
  renderer.onError=error=>{renderError=error.message;status.textContent=error.message;};
  renderer.onRecovered=()=>{renderError=null;};
  await renderer.prepare([],session.world.assetGeometry);
  events=new EventSource(route('events'));
  events.addEventListener('ready',event=>{void enqueue(async()=>{
    const ready=JSON.parse((event as MessageEvent).data);
    // A reconnect rebuilds from the server checkpoint; reload to discard an
    // uncertain old world rather than replaying mutations twice.
    if(lease){events.close();location.reload();return;}
    lease=ready.lease;
    if(ready.state)await session.restore(ready.state);
    await draw();pause.disabled=false;
    const info=await session.execute('inspect');pause.textContent=info.paused?'Resume':'Pause';
    status.textContent=`${renderer.backend} · ${info.paused?'Restored paused':'Ready'}`;
    void loop();
  }).catch(fail);});
  events.addEventListener('command',event=>{
    const message=JSON.parse((event as MessageEvent).data);
    void enqueue(async()=>{
      let reply;
      try{reply={id:message.id,result:await command(message)};}
      catch(error){reply={id:message.id,error:String(error instanceof Error?error.message:error)};}
      try{await post('result',reply);}
      catch(error){
        // A timed-out caller can still inspect this healthy renderer. Reporting
        // an expired result must not turn into another reply or close the SSE.
        if((error as any).status!==409||!String(error).includes('Request expired or unknown'))throw error;
        status.textContent='Previous reply expired; inspect current state before retrying';
      }
    }).catch(fail);
  });
  events.onerror=()=>{status.textContent='Viewer disconnected; reconnecting…';pause.disabled=true;};
}
async function loop(){
  if(closing)return;
  try{await enqueue(async()=>{
    await session.tick();await draw();
    if(performance.now()-lastSave>2000){const saved=await save();if(!saved.saved)status.textContent='Checkpoint failed; changes remain in this viewer';}
  });}catch(error){status.textContent=String(error);}
  requestAnimationFrame(()=>void loop());
}
pause.onclick=()=>{void enqueue(async()=>{
  const state=await session.execute('inspect');await command({kind:state.paused?'resume':'pause',params:{},deadline:Date.now()+30000});
}).catch(fail);};
function fail(error:unknown){status.textContent=String(error);pause.disabled=true;events?.close();}
window.addEventListener('pagehide',()=>{closing=true;events?.close();session?.dispose();renderer?.dispose();});
void start().catch(fail);
