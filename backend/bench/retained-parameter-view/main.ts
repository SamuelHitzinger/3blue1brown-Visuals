import {LiveWorld} from '../realtime-world/world.js';
import {CanvasRenderer} from '../../../shared/animlib/src/renderer.js';

interface ComparisonCase {id:string;subject:string;detail:string;source?:string|null;baselineSource?:string|null;values:Record<string,number>;comparisonTimeSeconds:number;metrics?:string;baselineError?:string;candidateError?:string}
const manifest=await fetch('/cases.json').then(response=>response.json()) as {title?:string;description?:string;cases:ComparisonCase[]};
if(manifest.title){document.title=manifest.title;document.querySelector('h1')!.textContent=manifest.title;}
if(manifest.description)document.querySelector('#description')!.textContent=manifest.description;
const select=document.querySelector<HTMLSelectElement>('#case')!,play=document.querySelector<HTMLButtonElement>('#play')!,
  restart=document.querySelector<HTMLButtonElement>('#restart')!,seek=document.querySelector<HTMLInputElement>('#seek')!,
  status=document.querySelector('#status')!,metrics=document.querySelector('#metrics')!,time=document.querySelector('#time')!;
type Arm={name:'baseline'|'candidate';world?:LiveWorld;renderer?:CanvasRenderer;error?:Error};
let arms:Arm[]=[],generation=0,playing=false,position=0,lastTick=0,drawing=false,disposed=false,drawRequest=0;
let selected:ComparisonCase;
function stop(){playing=false;play.textContent='Play';}
function close(){for(const arm of arms){arm.world?.dispose();arm.renderer?.dispose();}arms=[];}
function fail(error:unknown){stop();status.textContent=`Failed: ${error instanceof Error?error.message:String(error)}`;play.disabled=true;}
function armFailure(arm:Arm,error:unknown){
  arm.error=error instanceof Error?error:new Error(String(error));
  document.querySelector<HTMLCanvasElement>(`#${arm.name}`)!.style.visibility='hidden';
  const message=document.querySelector<HTMLElement>(`#${arm.name}-error`)!;
  message.textContent=`${arm.name==='baseline'?'Baseline':'Candidate'} failed: ${arm.error.message}`;message.hidden=false;
}
function updateStatus(){
  const available=arms.some(arm=>!arm.error&&arm.world&&arm.renderer);
  play.disabled=restart.disabled=seek.disabled=!available;
  if(!available)stop();
  status.textContent=arms.map(arm=>`${arm.name==='baseline'?'Baseline':'Candidate'}: ${arm.error?`failed (${arm.error.message})`:`ready · ${arm.renderer?.backend}`}`).join(' / ')
    +(available?' · synchronized native playback after parameter change.':' · Both arms failed.');
}
async function draw(){
  drawRequest++;
  if(drawing||arms.length!==2)return;
  drawing=true;const token=generation,current=arms;
  try{
    while(!disposed&&token===generation){
      const request=drawRequest,sampledPosition=position,at=selected.comparisonTimeSeconds+sampledPosition;
      const frames=await Promise.allSettled(current.map(arm=>arm.error||!arm.world?Promise.resolve(null):arm.world.sample(at)));
      if(token!==generation)return;
      // A seek arriving during sampling replaces that draw. Both frames and label
      // must describe the same requested position, including when playback is paused.
      if(request!==drawRequest)continue;
      for(let i=0;i<2;i++){
        const arm=current[i],frame=frames[i];
        if(arm.error)continue;
        try{
          if(frame.status==='rejected')throw frame.reason;
          if(!frame.value||!arm.renderer||!arm.world)throw Error('No native frame available');
          if(!arm.renderer.render(frame.value,arm.world.rendererOptions))throw Error('Native renderer did not submit frame');
        }catch(error){armFailure(arm,error);}
      }
      time.textContent=`${sampledPosition.toFixed(2)} s`;seek.value=String(sampledPosition);updateStatus();break;
    }
  }finally{drawing=false;}
}
async function load(index:number){
  const token=++generation;stop();play.disabled=restart.disabled=seek.disabled=true;
  // Never dispose a compiler while an earlier draw still holds its result.
  while(drawing)await new Promise(resolve=>setTimeout(resolve,10));
  if(token!==generation)return;close();selected=manifest.cases[index];position=0;
  time.textContent='0.00 s';seek.value='0';
  status.textContent='Preparing both native worlds…';
  const encode=new TextEncoder();
  metrics.textContent=selected.metrics??`${selected.subject} · ${selected.detail} detail. Update: ${JSON.stringify(selected.values)}. Source ${encode.encode(selected.source??'').length} bytes; parameter patch ${encode.encode(JSON.stringify({baseRevision:1,programId:'construction',values:selected.values})).length} bytes. Byte reduction is not measured model latency.`;
  try{
    for(const name of ['baseline','candidate'] as const){
      document.querySelector<HTMLElement>(`#${name}-error`)!.hidden=true;
      document.querySelector<HTMLCanvasElement>(`#${name}`)!.style.visibility='hidden';
      arms.push({name});
    }
    const current=arms,item=selected;
    await Promise.all(current.map(async arm=>{
      try{
        const source=arm.name==='baseline'?item.baselineSource:item.source;
        const recordedError=arm.name==='baseline'?item.baselineError:item.candidateError;
        if(recordedError)throw Error(recordedError);
        if(!source?.trim())throw Error('No source was produced for this arm');
        let renderer:CanvasRenderer;
        const world=new LiveWorld({clock:()=>0,prepare:async(scene,assets)=>{await renderer.prepare([scene],assets);}});
        arm.world=world;
        renderer=new CanvasRenderer(document.querySelector<HTMLCanvasElement>(`#${arm.name}`)!,undefined,world.assetGeometry);
        arm.renderer=renderer;
        renderer.onError=error=>{if(token===generation){armFailure(arm,error);updateStatus();}};
        await world.addProgram({id:'construction',baseRevision:0,source},0);
        if(token!==generation)return;
        if(arm.name==='candidate')await world.setParameters({baseRevision:1,programId:'construction',values:item.values},item.comparisonTimeSeconds);
        if(token===generation&&!arm.error)document.querySelector<HTMLCanvasElement>(`#${arm.name}`)!.style.visibility='visible';
      }catch(error){if(token===generation)armFailure(arm,error);}
    }));
    if(token!==generation)return;
    await draw();if(token!==generation)return;updateStatus();
  }catch(error){if(token===generation){fail(error);close();}}
}
for(const [index,item] of manifest.cases.entries()){
  const option=document.createElement('option');option.value=String(index);option.textContent=`${item.subject} · ${item.detail} · ${item.id}`;select.append(option);
}
select.addEventListener('change',()=>void load(Number(select.value)));
play.addEventListener('click',()=>{playing=!playing;play.textContent=playing?'Pause':'Play';lastTick=performance.now();});
restart.addEventListener('click',()=>{stop();position=0;void draw().catch(fail);});
seek.addEventListener('input',()=>{stop();position=Number(seek.value);void draw().catch(fail);});
document.querySelector('#aspect')!.addEventListener('change',event=>{
  document.querySelector('.pair')!.classList.toggle('narrow',(event.target as HTMLSelectElement).value==='narrow');void draw().catch(fail);
});
async function tick(now:number){
  if(disposed)return;
  if(playing&&!drawing){position=Math.min(4,position+(now-lastTick)/1000);lastTick=now;if(position===4)stop();await draw().catch(fail);}
  requestAnimationFrame(tick);
}
window.addEventListener('pagehide',()=>{disposed=true;generation++;stop();close();});
await load(0);requestAnimationFrame(tick);
