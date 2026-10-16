/** Local-only viewing shell. The iframe is the production lecture page. */
type WatchSource={text: string;capture?:{kind?:string;capturedAt?:string;durationMs?:number;sequence?:number}};
/** Explicit benchmark mode: receipt metadata only; the author receives original pixels. */
export function directVideoFrameReceipt(enabled:unknown,kind:string,capturedAt:string){
  if(enabled!==true||kind!=='photo')return undefined;
  return {text:`Lecture video frame received at ${capturedAt}.`,visualEvidence:'Original captured frame is available as direct image evidence.'};
}
/** Display-only exact overlap removal. Original capture sources remain untouched. */
export function watchTranscript(sources:WatchSource[]) {
  const audio=sources.filter(s=>s.capture?.kind==='audio').sort((a,b)=>Date.parse(a.capture!.capturedAt||'')-Date.parse(b.capture!.capturedAt||'')||(a.capture!.sequence||0)-(b.capture!.sequence||0));
  const normalize=(word:string)=>word.normalize('NFKC').toLocaleLowerCase('de').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
  const lines:string[]=[];
  let previous:WatchSource|undefined;
  for(const source of audio){
    const words=source.text.trim().split(/\s+/),before=previous?.text.trim().split(/\s+/)||[];
    const start=Date.parse(source.capture!.capturedAt||''),previousStart=Date.parse(previous?.capture?.capturedAt||'');
    let overlap=0;
    if(previous&&start>previousStart&&start-previousStart<=5000&&previousStart+(previous.capture?.durationMs||0)>start){
      for(let count=Math.min(before.length,words.length,512);count>=2;count--){
        if(before.slice(-count).every((word,index)=>normalize(word)!==''&&normalize(word)===normalize(words[index]))){overlap=count;break;}
      }
    }
    const remaining=words.slice(overlap).join(' ');if(remaining)lines.push(remaining);previous=source;
  }
  return lines.join('\n').slice(-20000);
}

export function watchDecision(event:{epochMs:number;status:number;reply?:{detail?:unknown;submission?:{action?:unknown;reason?:unknown}}}){
  const short=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').slice(0,240):'';
  return new Date(event.epochMs).toISOString().slice(11,19)+' · '+(event.status!==200?`Error ${event.status}: ${short(event.reply?.detail)||'request failed'}`:short(event.reply?.submission?.action)||'No action')+(event.status===200&&event.reply?.submission?.reason?' · '+short(event.reply.submission.reason):'');
}

export function liveLectureWatch(lectureId:string,title:string,clipIds:string[],sourceOffsetSec=0,directVideoFrames=false) {
  const config=JSON.stringify({lectureId,title,clipIds,sourceOffsetSec,directVideoFrames}).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live lecture test</title><style>
*{box-sizing:border-box}body{margin:0;padding:20px;background:#10151f;color:#edf1f7;font:15px system-ui}h1{font-size:23px;margin:0 0 8px}p{color:#abb8cc;margin:8px 0}button{padding:10px 18px;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer}button:disabled{opacity:.4;cursor:default}.controls{display:flex;gap:12px;align-items:center;margin:16px 0}.panels{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel{background:#080d18;border:1px solid #2b384b;border-radius:10px;overflow:hidden}.label{padding:10px 14px;font-weight:600}video{display:block;width:100%;aspect-ratio:16/9;background:#000}iframe{display:block;width:100%;height:480px;border:0;background:white}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.log{height:175px;overflow:auto;padding:12px;background:#182131;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.5}.clock{font-variant-numeric:tabular-nums}@media(max-width:850px){.panels,.evidence{grid-template-columns:1fr}}
</style></head><body><h1 id="title"></h1><p>Original lecture at 1× speed. Audio and video frames arrive as playback advances; frames are sampled every 5 seconds. Right side is the actual live lecture animation screen.</p><div class="controls"><button id="start">Start live test</button><button id="stop" disabled>Stop test</button><span id="status">Ready. No lecture audio sent yet.</span><span class="clock" id="clock">00:00</span></div><div class="panels"><div class="panel"><div class="label">Lecture video · source <span id="offset"></span></div><video id="video" preload="auto" src="/__latency/video" playsinline></video></div><div class="panel"><iframe id="animation" title="Live lecture animation"></iframe></div></div><div class="evidence"><section><h3>Live transcript · overlap trimmed</h3><div class="log" id="transcript">Waiting for audio…</div></section><section><h3 id="visual-label">Arrived frame descriptions</h3><div class="log" id="visuals">Waiting for video frames…</div></section><section><h3>Actual model decisions</h3><div class="log" id="decisions">Waiting for content…</div></section></div><script>
const config=${config},video=document.getElementById('video'),frame=document.getElementById('animation'),start=document.getElementById('start'),stop=document.getElementById('stop'),status=document.getElementById('status');
document.getElementById('title').textContent=config.title;if(config.directVideoFrames)document.getElementById('visual-label').textContent='Video frames received · direct image input';document.getElementById('offset').textContent=Math.floor(config.sourceOffsetSec/60)+':'+String(config.sourceOffsetSec%60).padStart(2,'0');frame.src='/lectures/'+config.lectureId+'?liveTiming=1&liveDemo=1';
let began=false,ended=false,starting=false;
const post=(path,body)=>fetch('/__latency/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function halt(message){if(ended||!began)return;ended=true;video.pause();stop.disabled=true;status.textContent=message;await post('stop',{});const button=[...frame.contentDocument.querySelectorAll('button')].find(b=>b.textContent.trim()==='Stop updates');button?.click();}
start.onclick=async()=>{if(began||starting)return;starting=true;start.disabled=true;try{const button=[...frame.contentDocument.querySelectorAll('button')].find(b=>b.textContent.trim()==='Start live animation');if(!button)throw Error('Live animation screen is still loading.');button.click();video.playbackRate=1;await video.play();const response=await post('start',{clipIds:config.clipIds});if(!response.ok)throw Error(await response.text());began=true;stop.disabled=false;status.textContent='Live · lecture audio arriving at 1×';}catch(error){video.pause();status.textContent=error.message;start.disabled=false;}finally{starting=false;}};
stop.onclick=()=>halt('Stopped. Future audio will not be sent.');video.onpause=()=>{if(began&&!ended&&!video.ended)void halt('Playback paused. Future audio stopped.');};video.onwaiting=()=>{if(began&&!ended)void halt('Video buffering. Future audio stopped to preserve timing.');};video.onended=()=>{status.textContent='Lecture excerpt ended. Waiting for remaining model responses…';};
video.ontimeupdate=()=>{document.getElementById('clock').textContent=Math.floor(video.currentTime/60)+':'+String(Math.floor(video.currentTime%60)).padStart(2,'0');};
window.addEventListener('pagehide',()=>{if(began&&!ended)navigator.sendBeacon('/__latency/stop',new Blob(['{}'],{type:'application/json'}));});
setInterval(async()=>{try{const result=await fetch('/__latency/events').then(r=>r.json());document.getElementById('transcript').textContent=result.transcript||'Waiting for audio…';document.getElementById('visuals').textContent=result.visualCaptions||'Waiting for video frames…';document.getElementById('decisions').textContent=result.decisions||'Waiting for content…';for(const id of ['transcript','visuals','decisions']){const el=document.getElementById(id);el.scrollTop=el.scrollHeight;}}catch{}},750);
</script></body></html>`;
}

export const liveDemoInjection=`<style>body>*{visibility:hidden}.live-lecture-panel,.live-lecture-panel *{visibility:visible}.live-lecture-panel{position:fixed!important;inset:0!important;z-index:9999;margin:0!important;border:0!important;border-radius:0!important;overflow:auto;background:#fff!important}.live-lecture-stage{max-height:calc(100vh - 115px)}</style><script>const originalInfo=console.info;console.info=function(...args){originalInfo.apply(console,args);for(const arg of args)if(typeof arg==='string'&&arg.startsWith('LIVE_ANIMATION_TIMING ')){try{fetch('/__latency/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify((r=>({...r,event:r.kind,browserEpochMs:r.epochMs}))(JSON.parse(arg.slice(22))))}).catch(()=>{});}catch{}}};</script>`;
