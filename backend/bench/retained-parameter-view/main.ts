import {LiveWorld} from '../realtime-world/world.js';
import {CanvasRenderer} from '../../../shared/animlib/src/renderer.js';

interface ComparisonCase {id:string;subject:string;detail:string;source:string;baselineSource:string;values:Record<string,number>;comparisonTimeSeconds:number}
const manifest=await fetch('/cases.json').then(response=>response.json()) as {cases:ComparisonCase[]};
const select=document.querySelector<HTMLSelectElement>('#case')!,play=document.querySelector<HTMLButtonElement>('#play')!,
  restart=document.querySelector<HTMLButtonElement>('#restart')!,seek=document.querySelector<HTMLInputElement>('#seek')!,
  status=document.querySelector('#status')!,metrics=document.querySelector('#metrics')!,time=document.querySelector('#time')!;
type Arm={world:LiveWorld;renderer:CanvasRenderer;error?:Error};
let arms:Arm[]=[],generation=0,playing=false,position=0,lastTick=0,drawing=false,disposed=false,drawRequest=0;
let selected:ComparisonCase;
function stop(){playing=false;play.textContent='Play';}
function close(){for(const arm of arms){arm.world.dispose();arm.renderer.dispose();}arms=[];}
function fail(error:unknown){stop();status.textContent=`Failed: ${error instanceof Error?error.message:String(error)}`;play.disabled=true;}
async function draw(){
  drawRequest++;
  if(drawing||arms.length!==2)return;
  drawing=true;const token=generation,current=arms;
  try{
    while(!disposed&&token===generation){
      const request=drawRequest,sampledPosition=position,at=selected.comparisonTimeSeconds+sampledPosition;
      const frames=await Promise.all(current.map(arm=>arm.world.sample(at)));
      if(token!==generation)return;
      // A seek arriving during sampling replaces that draw. Both frames and label
      // must describe the same requested position, including when playback is paused.
      if(request!==drawRequest)continue;
      for(let i=0;i<2;i++){
        if(current[i].error)throw current[i].error;
        if(!current[i].renderer.render(frames[i],current[i].world.rendererOptions))throw Error('Native renderer did not submit frame');
      }
      time.textContent=`${sampledPosition.toFixed(2)} s`;seek.value=String(sampledPosition);break;
    }
  }finally{drawing=false;}
}
async function load(index:number){
  const token=++generation;stop();play.disabled=restart.disabled=seek.disabled=true;
  // Never dispose a compiler while an earlier draw still holds its result.
  while(drawing)await new Promise(resolve=>setTimeout(resolve,10));
  if(token!==generation)return;close();selected=manifest.cases[index];position=0;
  status.textContent='Preparing both native worlds…';
  try{
    for(const name of ['baseline','candidate']){
      let renderer:CanvasRenderer;
      const world=new LiveWorld({clock:()=>0,prepare:async(scene,assets)=>{await renderer.prepare([scene],assets);}});
      renderer=new CanvasRenderer(document.querySelector<HTMLCanvasElement>(`#${name}`)!,undefined,world.assetGeometry);
      const arm:Arm={world,renderer};renderer.onError=error=>{arm.error=error;};arms.push(arm);
    }
    await Promise.all(arms.map((arm,index)=>arm.world.addProgram({id:'construction',baseRevision:0,
      source:index===0?selected.baselineSource:selected.source},0)));
    if(token!==generation)return;
    await arms[1].world.setParameters({baseRevision:1,programId:'construction',values:selected.values},selected.comparisonTimeSeconds);
    if(token!==generation)return;
    await draw();if(token!==generation)return;play.disabled=restart.disabled=seek.disabled=false;
    const encode=new TextEncoder();
    metrics.textContent=`${selected.subject} · ${selected.detail} detail. Update: ${JSON.stringify(selected.values)}. Source ${encode.encode(selected.source).length} bytes; parameter patch ${encode.encode(JSON.stringify({baseRevision:1,programId:'construction',values:selected.values})).length} bytes. Byte reduction is not measured model latency.`;
    status.textContent=`Ready · ${arms.map(arm=>arm.renderer.backend).join(' / ')} · synchronized native playback after parameter change.`;
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
