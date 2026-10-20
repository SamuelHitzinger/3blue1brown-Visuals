import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {mcpClient} from '../../tests/mcp-client.mjs';
const folder=path.resolve('data/animlib-studio-demo'),runtimePath=path.join(folder,'runtime-standalone.json');
const runtime=JSON.parse(await readFile(runtimePath,'utf8'));
const server=process.env.ANIMLIB_STUDIO_SERVER??path.join(process.env.CODEX_HOME??path.join(os.homedir(),'.codex'),'plugins/cache/animlib-local/animlib-studio/0.1.0/src/server.mjs');
await mkdir(path.join(folder,'client'),{recursive:true});
const client=await mcpClient(path.join(folder,'client'),server);
await client.call('connect',{runtimePath});
const operation=process.argv[2]??'status';
try{
  if(operation==='create'){
    // Create on the persistent standalone server, not the short-lived MCP client.
    const response=await fetch(runtime.baseUrl+'/rpc',{method:'POST',headers:{authorization:`Bearer ${runtime.token}`,'content-type':'application/json'},
      body:JSON.stringify({name:'animlib_create',arguments:{title:'Wave interference · native animlib'}})});
    const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));
    await writeFile(path.join(folder,'demo-session.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }else{
    const {sessionId}=JSON.parse(await readFile(path.join(folder,'demo-session.json'),'utf8'));
    let name='inspect',args={sessionId};
    if(operation==='build'){name='program';args={sessionId,id:'interference',source:await readFile(new URL('./scene.js',import.meta.url),'utf8'),preview:true};}
    else if(operation==='phase'){name='parameters';args={sessionId,programId:'interference',values:{phase:Number(process.argv[3])},preview:true};}
    else if(operation==='amplitude'){name='parameters';args={sessionId,programId:'interference',values:{amplitude:Number(process.argv[3])},preview:true};}
    else if(operation==='wavelength'){name='parameters';args={sessionId,programId:'interference',values:{wavelength:Number(process.argv[3])},preview:true};}
    else if(operation==='preview'){name='verify';args={sessionId,checks:[],preview:true};}
    else if(['pause','resume'].includes(operation)){name='control';args={sessionId,operation};}
    else if(operation==='emphasis'){name='patch';args={sessionId,changes:[{id:'source-b',props:{radius:.27},duration:.45},{id:'phase-zero',props:{opacity:0},duration:.3},{id:'phase-pi',props:{opacity:1},duration:.3}]};}
    else if(operation==='clarity'){name='patch';args={sessionId,changes:[
      {id:'wave-field',props:{opacity:.32},duration:.5},
      {id:'source-a',props:{position:[-2,2,0]},duration:.5},
      {id:'source-b',props:{position:[2,2,0]},duration:.5},
      {id:'source-a-label',props:{position:[-2,2.45,0]},duration:.5},
      {id:'source-b-label',props:{position:[2,2.45,0]},duration:.5},
      {id:'source-a-stem',props:{points:[[-2,-.9,0],[-2,2,0]]},duration:.5},
      {id:'source-b-stem',props:{points:[[2,-.9,0],[2,2,0]]},duration:.5},
      {id:'phase-zero',props:{position:[3.1,3,0]},duration:.5},
      {id:'phase-pi',props:{position:[3.1,3,0]},duration:.5}
    ]};}
    else if(operation==='proof'){
      const records=[];
      for(let i=0;i<6;i++){
        const t=performance.now(),r=await client.call('verify',{sessionId,
          checks:[{id:'probe',property:'position',expected:[0,.07,2.15],tolerance:.00001}],preview:true});
        if(!r.verification.passed)throw Error('Cancellation invariant failed');
        await writeFile(path.join(folder,`proof-${i}.png`),Buffer.from(r.imageData,'base64'));
        records.push({sample:i,ms:performance.now()-t,playheadMs:r.playheadMs,verification:r.verification,rendering:r.rendering});
        if(i<5)await new Promise(r=>setTimeout(r,1000));
      }
      await writeFile(path.join(folder,'proof.json'),JSON.stringify(records,null,2));
      console.log(JSON.stringify({frames:6,durationMs:records[5].playheadMs-records[0].playheadMs,checksPassed:true}));
      process.exitCode=0;
      await client.close();process.exit(0);
    }
    const started=performance.now(),result=await client.call(name,args),ms=performance.now()-started;
    const {imageData,...summary}=result;
    if(imageData)await writeFile(path.join(folder,`${operation}-${process.argv[3]??'frame'}.png`),Buffer.from(imageData,'base64'));
    await writeFile(path.join(folder,`${operation}-${process.argv[3]??'result'}.json`),JSON.stringify({operation,ms,...summary},null,2));
    console.log(JSON.stringify({operation,ms,revision:summary.revision,objectCount:summary.objectCount,
      rendering:summary.rendering,persistence:summary.persistence,timings:summary.timings,
      parameters:summary.programs?.flatMap(p=>p.parameters.map(v=>({id:v.id,value:v.value}))),
      preview:summary.preview},null,2));
  }
}finally{await client.close();}
