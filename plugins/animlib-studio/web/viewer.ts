import {CanvasRenderer} from '../../../shared/animlib/src/renderer.js';
import {StudioSession} from '../src/session.js';
import {WORLD_LIMITS} from '../../../shared/animlib/src/live-world.js';

let canvas=document.querySelector('canvas')!;
const status=document.querySelector('#status')!,title=document.querySelector('#title')!;
const revision=document.querySelector('#revision')!,pause=document.querySelector<HTMLButtonElement>('#pause')!;
const controls=document.querySelector<HTMLElement>('#controls')!,resetView=document.querySelector<HTMLButtonElement>('#reset-view')!;
const navigation=document.querySelector<HTMLElement>('#navigation')!;
const url=new URL(location.href),sessionId=url.searchParams.get('session'),token=new URLSearchParams(url.hash.slice(1)).get('token');
const route=(name:string)=>`/s/${sessionId}/${name}?token=${encodeURIComponent(token??'')}`;
let lease:string|null=null,renderer:CanvasRenderer,session:StudioSession,events:EventSource;
let serial:Promise<unknown>=Promise.resolve(),closing=false,lastSave=0,renderError:string|null=null;
let zoom=1,controlTask=false,controlIndex=0,orbitAvailable=false;
type Parameter={id:string;label:string;value:number;min:number;max:number;step?:number};
const sliders=new Map<string,{input:HTMLInputElement;output:HTMLOutputElement;root:HTMLElement}>();
const pending=new Map<string,{programId:string;id:string;value:number}>(),editing=new Set<string>();
const format=(value:number)=>Number(value.toFixed(3)).toString();
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
  orbitAvailable=frame.camera.perspective>0;
  renderer.setOrbitEnabled(orbitAvailable);
  frame.camera={...frame.camera,height:frame.camera.height*zoom,distance:frame.camera.distance*zoom};
  navigation.textContent=orbitAvailable?'Drag to rotate · Shift-drag to pan · Scroll to zoom':'Shift-drag to pan · Scroll to zoom';
  if(!renderer.render(frame,{...session.world.rendererOptions,orbit:orbitAvailable})||renderError)throw Error(renderError??'Renderer did not submit frame');
  return {status:'submitted',backend:renderer.backend,revision:session.world.revision};
}
function syncControls(state:any){
  const found=new Set<string>();
  for(const program of state.programs??[])for(const parameter of program.parameters as Parameter[]){
    const key=JSON.stringify([program.id,parameter.id]);found.add(key);
    let slider=sliders.get(key);
    if(!slider){
      const root=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input'),output=document.createElement('output');
      root.className='parameter';input.type='range';input.id=`parameter-${++controlIndex}`;
      input.dataset.programId=program.id;input.dataset.parameterId=parameter.id;
      label.htmlFor=input.id;output.htmlFor=input.id;
      root.append(label,output,input);controls.append(root);slider={root,input,output};sliders.set(key,slider);
      input.addEventListener('input',()=>{
        output.value=format(input.valueAsNumber);
        pending.set(key,{programId:program.id,id:parameter.id,value:input.valueAsNumber});scheduleControls();
      });
    }
    slider.root.querySelector('label')!.textContent=parameter.label||parameter.id;
    slider.input.min=String(parameter.min);slider.input.max=String(parameter.max);
    slider.input.step=parameter.step===undefined?'any':String(parameter.step);
    slider.input.disabled=!lease||closing;
    if(!pending.has(key)&&!editing.has(key)){slider.input.value=String(parameter.value);slider.output.value=format(parameter.value);}
  }
  for(const [key,slider] of sliders)if(!found.has(key)){slider.root.remove();sliders.delete(key);pending.delete(key);}
}
function scheduleControls(){
  if(controlTask||closing)return;controlTask=true;
  // At most one queued edit; newer pointer positions replace older values.
  void enqueue(async()=>{
    const first=pending.values().next().value;if(!first)return;
    const values:Record<string,number>={};
    for(const [key,edit] of pending)if(edit.programId===first.programId){
      pending.delete(key);editing.add(key);values[edit.id]=edit.value;
      if(Object.keys(values).length===WORLD_LIMITS.parameterChanges)break;
    }
    const started=performance.now();
    try{
      await command({kind:'parameters',params:{programId:first.programId,values},deadline:Date.now()+30000});
      status.textContent=`${renderer.backend} · Live edit ${Math.round(performance.now()-started)} ms`;
    }catch(error){status.textContent=`Edit failed: ${String(error)}`;}
    finally{editing.clear();syncControls(await session.execute('inspect'));}
  }).finally(()=>{controlTask=false;if(pending.size)scheduleControls();}).catch(fail);
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
  syncControls(state);
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
  renderer.onCanvasChange=next=>{canvas=next;bindNavigation(next);};
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
    await draw();pause.disabled=false;resetView.disabled=false;
    const info=await session.execute('inspect');pause.textContent=info.paused?'Resume':'Pause';
    syncControls(info);revision.textContent=`Revision ${info.revision} · ${info.objectCount} objects`;
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
  events.onerror=()=>{status.textContent='Viewer disconnected; reconnecting…';pause.disabled=true;for(const {input} of sliders.values())input.disabled=true;};
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
resetView.onclick=()=>{zoom=1;renderer.resetInteraction();};
function bindNavigation(surface:HTMLCanvasElement){
surface.addEventListener('wheel',event=>{
  if(!lease)return;event.preventDefault();
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
  zoom=Math.max(.25,Math.min(4,zoom*Math.exp(Math.max(-200,Math.min(200,delta))*.001)));
},{passive:false});
surface.addEventListener('keydown',event=>{
  if(!lease)return;
  const orbit=renderer.orbit;
  if(event.key==='0'){zoom=1;renderer.resetInteraction();}
  else if(event.key==='+'||event.key==='=')zoom=Math.max(.25,zoom/1.1);
  else if(event.key==='-')zoom=Math.min(4,zoom*1.1);
  else if(orbitAvailable&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    const pitch=renderer.interactionSnapshot()?.frame.camera.pitch??0;
    orbit.yaw+=event.key==='ArrowLeft'?.1:event.key==='ArrowRight'?-.1:0;
    orbit.pitch=Math.max(-Math.PI/2+.02-pitch,Math.min(Math.PI/2-.02-pitch,orbit.pitch+(event.key==='ArrowUp'?.1:event.key==='ArrowDown'?-.1:0)));
    renderer.setOrbit(orbit);
  }else return;
  event.preventDefault();
});
}
bindNavigation(canvas);
function fail(error:unknown){status.textContent=String(error);pause.disabled=true;events?.close();}
window.addEventListener('pagehide',()=>{closing=true;events?.close();session?.dispose();renderer?.dispose();});
void start().catch(fail);
