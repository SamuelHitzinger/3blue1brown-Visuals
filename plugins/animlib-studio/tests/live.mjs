/** Actual bundled renderer + HTTP RPC. No model/API-key/network service calls. */
import {createBridge} from '../src/bridge.mjs';
import {createTools} from '../src/tools.mjs';
import puppeteer from 'puppeteer-core';
import {mkdir,mkdtemp,writeFile,readdir} from 'node:fs/promises';
import {PNG} from 'pngjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {mcpClient} from './mcp-client.mjs';
const output=path.resolve(process.env.STUDIO_EVIDENCE??'docs/validation/animlib-studio');
await mkdir(output,{recursive:true});await mkdir('.tmp',{recursive:true});
const dataDir=await mkdtemp(path.resolve('.tmp/studio-live-'));
let executablePath=process.env.STUDIO_CHROMIUM;
if(!executablePath){
  const root=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  const folder=(await readdir(root)).find(p=>p.startsWith('chromium-'));
  executablePath=path.join(root,folder,'chrome-win64/chrome.exe');
}
const bridge=await createBridge({dataDir});bridge.setRpc(createTools(bridge));
const runtimePath=path.join(dataDir,'live-runtime.json');
await writeFile(runtimePath,JSON.stringify({baseUrl:bridge.baseUrl,token:bridge.masterToken}));
const client=await mcpClient(await mkdtemp(path.resolve('.tmp/studio-mcp-')));
await client.call('connect',{runtimePath});
const started=performance.now(),browser=await puppeteer.launch({executablePath,headless:true,
  args:['--enable-unsafe-webgpu','--disable-gpu-sandbox','--no-sandbox'],defaultViewport:{width:1100,height:760}});
const errors=[],results=[];
async function rpc(name,args={}){
  const t=performance.now();
  const result=await client.call(name,args);
  return {result,ms:performance.now()-t};
}
async function open(title){
  const session=await bridge.create({title}),page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(session.viewerUrl);
  await page.waitForFunction(()=>!document.querySelector('#pause').disabled,{timeout:30000});
  return {sessionId:session.sessionId,page};
}
function visible(data){
  const image=PNG.sync.read(Buffer.from(data,'base64'));let colored=0;
  for(let i=0;i<image.data.length;i+=4){
    const [r,g,b]=image.data.subarray(i,i+3);if(Math.max(r,g,b)-Math.min(r,g,b)>30&&Math.max(r,g,b)>80)colored++;
  }
  assert.ok(colored>100,`Expected colored geometry pixels, got ${colored}`);return {width:image.width,height:image.height,coloredPixels:colored};
}
const compact=({imageData,...rest})=>rest;
try{
  const a=await open('Retained geometry · 2D');
  results.push({name:'cold-browser-and-viewer',ms:performance.now()-started});
  const scene={mode:'2d',objects:[{id:'ball',type:'circle',props:{radius:.55,fill:'BLUE',position:[-2,0,0]}},
    {id:'destination',type:'circle',props:{radius:.2,fill:'YELLOW',position:[2,0,0]}}]};
  const created=await rpc('scene',{sessionId:a.sessionId,scene,programId:'base',preview:true,
    verify:{checks:[{id:'ball',property:'radius',expected:.55}]}});
  assert.equal(created.result.verification.passed,true);assert.equal(created.result.persistence.saved,true);
  results.push({name:'create-2d',ms:created.ms,...compact(created.result),pixels:visible(created.result.imageData)});
  await writeFile(path.join(output,'2d.png'),Buffer.from(created.result.imageData,'base64'));
  const patched=await rpc('patch',{sessionId:a.sessionId,changes:[{id:'ball',props:{position:[2,0,0]},duration:0}],
    verify:{checks:[{id:'ball',property:'position',expected:[2,0,0]}]},preview:true});
  assert.equal(patched.result.verification.passed,true);visible(patched.result.imageData);
  assert.notEqual(patched.result.imageData,created.result.imageData);results.push({name:'patch-verified',ms:patched.ms,...compact(patched.result)});
  const rejected=await rpc('patch',{sessionId:a.sessionId,changes:[{id:'ball',props:{radius:.6}}],verify:{checks:[{id:'ball',property:'radius',expected:99}]}});
  assert.equal(rejected.result.verification.passed,false);assert.equal(rejected.result.persistence.saved,true);
  results.push({name:'failed-check-keeps-applied-and-saved',ms:rejected.ms});
  await rpc('flow',{sessionId:a.sessionId,source:'test',sequence:1,cues:[{id:'left',durationMs:500,changes:[{id:'ball',props:{position:[-2,0,0]}}]}]});
  await new Promise(r=>setTimeout(r,180));
  const interrupted=await rpc('flow',{sessionId:a.sessionId,source:'test',sequence:2,cues:[{id:'center',durationMs:250,changes:[{id:'ball',props:{position:[0,0,0]}}]}]});
  assert.equal(interrupted.result.revision,interrupted.result.rendering.revision);
  assert.equal(interrupted.result.flow.queued,0);
  await new Promise(r=>setTimeout(r,400));
  const checked=await rpc('verify',{sessionId:a.sessionId,checks:[{id:'ball',property:'position',expected:[0,0,0]}],preview:true});
  assert.equal(checked.result.verification.passed,true);results.push({name:'flow-interrupt',ackMs:interrupted.ms,...compact(checked.result)});
  const patchTimes=[],replaceTimes=[],patchBytes=[],replaceBytes=[];
  const comparison=await open('Replacement benchmark');
  await rpc('program',{sessionId:comparison.sessionId,id:'base',
    source:`export default scene({mode:'2d',end:'hold'},s=>{s.circle('ball',{radius:.6,fill:'BLUE'});s.circle('destination',{radius:.2,fill:'YELLOW',position:[2,0,0]});s.wait(3600);});`});
  // Alternating arms removes ordering bias; same final geometry, no motion.
  const source=x=>`export default scene({mode:'2d',end:'hold'},s=>{s.circle('ball',{radius:.6,fill:'BLUE',position:[${x},0,0]});s.circle('destination',{radius:.2,fill:'YELLOW',position:[2,0,0]});s.wait(3600);});`;
  for(let i=0;i<12;i++){
    const patch={sessionId:a.sessionId,changes:[{id:'ball',props:{position:[i%2,0,0]}}]};
    const replacement={sessionId:comparison.sessionId,id:'base',source:source(i%2)};
    const arms=i%2?[['replace',replacement],['patch',patch]]:[['patch',patch],['replace',replacement]];
    for(const [kind,args] of arms){const result=await rpc(kind,args);assert.equal(result.result.persistence.saved,true);
      (kind==='patch'?patchTimes:replaceTimes).push(result.ms);(kind==='patch'?patchBytes:replaceBytes).push(Buffer.byteLength(JSON.stringify(args)));}
  }
  for(const sessionId of [a.sessionId,comparison.sessionId]){
    const equivalent=await rpc('verify',{sessionId,checks:[{id:'ball',property:'position',expected:[1,0,0]},{id:'ball',property:'radius',expected:.6}]});
    assert.equal(equivalent.result.verification.passed,true);
  }
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {n:values.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],raw:values};};
  results.push({name:'paired-warm-edit',patchMs:stats(patchTimes),replaceMs:stats(replaceTimes),patchPayloadBytes:patchBytes[0],replacePayloadBytes:replaceBytes[0],
    scope:'Complete stdio MCP call through registered local HTTP runtime including native render submission and checkpoint. Alternating arms use separate warm worlds with equal geometry, verified after both arms. Excludes model generation.'});
  await rpc('control',{sessionId:a.sessionId,operation:'pause'});
  await a.page.bringToFront();await a.page.reload();
  try{await a.page.waitForFunction(()=>!document.querySelector('#pause').disabled,{timeout:10000});}
  catch(error){throw Error(`Reconnect failed: ${await a.page.$eval('#status',e=>e.textContent)}; ${error.message}`);}
  const restored=await rpc('inspect',{sessionId:a.sessionId});assert.equal(restored.result.paused,true);
  assert.equal(restored.result.programs.length,1);results.push({name:'reconnect-paused',...compact(restored.result)});
  const b=await open('Native animlib · molecular geometry');
  const molecule=await rpc('scene',{sessionId:b.sessionId,recipe:'molecule',preview:true});
  visible(molecule.result.imageData);await writeFile(path.join(output,'3d.png'),Buffer.from(molecule.result.imageData,'base64'));
  results.push({name:'native-3d',ms:molecule.ms,...compact(molecule.result),pixels:visible(molecule.result.imageData)});
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'results.json'),JSON.stringify({date:new Date().toISOString(),results,errors},null,2));
  console.log(JSON.stringify({output,checks:results.length,benchmark:results.find(r=>r.name==='paired-warm-edit')},null,2));
}finally{await browser.close();await client.close();await bridge.close();}
