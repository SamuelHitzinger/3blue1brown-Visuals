import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {createBridge} from '../src/bridge.mjs';
import {createTools,TOOLS} from '../src/tools.mjs';
async function fixture(t){
  const dataDir=await mkdtemp(path.resolve('.tmp/studio-test-'));
  const b=await createBridge({dataDir,commandTimeoutMs:80});
  b.setRpc(createTools(b));t.after(()=>b.close());return b;
}
test('RPC requires capability and same origin; tools expose animlib operations',async t=>{
  const b=await fixture(t);
  const call=headers=>fetch(b.baseUrl+'/rpc',{method:'POST',headers,body:JSON.stringify({name:'animlib_sessions'})});
  assert.equal((await call({})).status,401);
  assert.equal((await call({authorization:`Bearer ${b.masterToken}`,origin:'https://example.com'})).status,403);
  assert.equal((await call({authorization:`Bearer ${b.masterToken}`})).status,200);
  assert.ok(TOOLS.some(t=>t.name==='animlib_scene'));assert.ok(TOOLS.some(t=>t.name==='animlib_flow'));
});
test('duplicate renderer and stale checkpoint rejected; timeout remains unknown outcome',async t=>{
  const b=await fixture(t),s=await b.create({title:'Test'});
  const key=new URLSearchParams(new URL(s.viewerUrl).hash.slice(1)).get('token');
  const route=tail=>`${b.baseUrl}/s/${s.sessionId}/${tail}?token=${key}`;
  await assert.rejects(b.command(s.sessionId,'inspect'),/not connected/);
  const controller=new AbortController();t.after(()=>controller.abort());
  const stream=await fetch(route('events'),{signal:controller.signal});
  const first=new TextDecoder().decode((await stream.body.getReader().read()).value);
  const ready=JSON.parse(first.split('data: ')[1].trim());
  assert.equal((await fetch(route('events'))).status,409);
  assert.equal((await fetch(route('checkpoint'),{method:'POST',body:JSON.stringify({lease:'wrong',state:{}})})).status,409);
  assert.equal((await fetch(route('checkpoint'),{method:'POST',body:JSON.stringify({lease:ready.lease,state:{format:'bad'}})})).status,400);
  await assert.rejects(b.command(s.sessionId,'inspect'),/outcome unknown/);
});
test('session IDs and keys cannot be supplied by create caller',async t=>{
  const b=await fixture(t);
  const s=await b.create({id:'../../escape',key:'known',title:'Safe'});
  assert.match(s.sessionId,/^[a-f0-9-]+$/);assert.ok(!s.viewerUrl.includes('known'));
});
test('reopening another server reads newest persisted checkpoint',async t=>{
  const a=await fixture(t),s=await a.create({title:'Shared'});
  const b=await createBridge({dataDir:a.dataDir});t.after(()=>b.close());
  const key=new URLSearchParams(new URL(s.viewerUrl).hash.slice(1)).get('token');
  const route=(bridge,tail)=>`${bridge.baseUrl}/s/${s.sessionId}/${tail}?token=${key}`;
  const abort=new AbortController();t.after(()=>abort.abort());
  const stream=await fetch(route(a,'events'),{signal:abort.signal});
  const ready=JSON.parse(new TextDecoder().decode((await stream.body.getReader().read()).value).split('data: ')[1].trim());
  const state={format:'animlib-studio-1',time:5,records:[],queue:[],sequences:[],endMs:5000};
  assert.equal((await fetch(route(a,'checkpoint'),{method:'POST',body:JSON.stringify({lease:ready.lease,state})})).status,200);
  assert.deepEqual((await (await fetch(route(b,'bootstrap'))).json()).state,state);
});
