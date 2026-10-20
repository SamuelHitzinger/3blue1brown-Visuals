// Reuse renderers across MCP processes without creating duplicate viewer tabs.
// Credentials remain in local runtime files. Only literal loopback RPC is allowed.
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
export function createConnections(bridge){
 const directory=path.join(bridge.dataDir,'connections');let cache=null,expires=0;
 async function runtime(file){if(!path.isAbsolute(file))throw Error('runtimePath must be absolute.');const bytes=await readFile(file);if(bytes.length>16384)throw Error('Runtime file too large.');const r=JSON.parse(bytes.toString());const u=new URL(r.baseUrl);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Only literal HTTP loopback runtime URLs are permitted.');if(!/^[a-f0-9]{64}$/.test(r.token))throw Error('Invalid runtime capability.');return {...r,file};}
 async function rpc(r,name,args,timeout=1500){let response;try{response=await fetch(r.baseUrl+'/rpc',{method:'POST',headers:{authorization:`Bearer ${r.token}`,'content-type':'application/json'},body:JSON.stringify({name,arguments:args}),redirect:'error',signal:AbortSignal.timeout(timeout)});}catch(e){throw Error(`Runtime request failed${name==='animlib_runtime'&&args.operation==='command'?'; command outcome may be unknown':''}: ${e.message}`);}const data=await response.json();if(!response.ok)throw Error(data.error||'Runtime request failed');return data;}
 async function status(r){try{return await rpc(r,'animlib_runtime',{operation:'status'},600);}catch(e){if(!/Unknown tool/.test(e.message))throw e;return {protocol:0,...await rpc(r,'animlib_sessions',{},600)};}}
 async function peers(force=false){if(cache&&Date.now()<expires&&!force)return cache;await mkdir(directory,{recursive:true});const files=new Set();for(const f of await readdir(bridge.dataDir)){if(/^runtime-\d+\.json$/.test(f))files.add(path.join(bridge.dataDir,f));}for(const f of await readdir(directory)){try{files.add(JSON.parse(await readFile(path.join(directory,f),'utf8')).runtimePath);}catch{}}
  const results=await Promise.all([...files].slice(-64).map(async file=>{try{const r=await runtime(file);if(r.baseUrl===bridge.baseUrl)return null;return {runtime:r,info:await status(r)};}catch{return null;}}));cache=results.filter(Boolean);expires=Date.now()+1000;return cache;
 }
 async function list(){const all=[...bridge.list()];for(const p of await peers())for(const s of p.info.sessions||[])all.push({...s,shared:true});const groups=new Map();for(const s of all){const old=groups.get(s.sessionId);if(!old||s.connected&&!old.connected)groups.set(s.sessionId,s);}return [...groups.values()];}
 async function command(sessionId,kind,params){const local=bridge.list().find(s=>s.sessionId===sessionId);
  let candidates=(await peers()).filter(p=>p.info.sessions?.some(s=>s.sessionId===sessionId));
  if(!local&&!candidates.length)candidates=(await peers(true)).filter(p=>p.info.sessions?.some(s=>s.sessionId===sessionId));
  const connected=candidates.filter(p=>p.info.sessions.find(s=>s.sessionId===sessionId).connected);
  if(connected.length+(local?.connected?1:0)>1)throw Error('Multiple active renderers for session; close duplicate before editing.');
  if(local?.connected||local&&!connected.length)return bridge.command(sessionId,kind,params);
  const peer=connected[0]||candidates[0];if(!peer)throw Error('Unknown session. Use sessions or connect with its local runtimePath.');
  if(peer.info.protocol>=1)return rpc(peer.runtime,'animlib_runtime',{operation:'command',sessionId,kind,params},31000);
  throw Error('Incompatible Animlib Studio runtime; restart its server.');
 }
 async function connect(file){const r=await runtime(file);const info=await status(r);await mkdir(directory,{recursive:true});const target=path.join(directory,createHash('sha256').update(path.resolve(file)).digest('hex')+'.json'),tmp=target+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify({runtimePath:path.resolve(file)}));await rename(tmp,target);cache=null;return {connected:true,baseUrl:r.baseUrl,sessions:info.sessions,protocol:info.protocol};}
 return {list,command,connect};
}
