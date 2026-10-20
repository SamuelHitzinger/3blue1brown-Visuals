import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export async function mcpClient(dataDir,server=fileURLToPath(new URL('../src/server.mjs',import.meta.url))){
  const child=spawn(process.execPath,[server],{windowsHide:true,env:{...process.env,ANIMLIB_STUDIO_HOME:dataDir},stdio:['pipe','pipe','pipe']});
  const pending=new Map();let id=0,stderr='';
  child.stderr.on('data',data=>{stderr+=data.toString();});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    const message=JSON.parse(line),p=pending.get(message.id);if(!p)return;
    pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);
  });
  child.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(`MCP exited: ${stderr}`));}pending.clear();});
  child.on('error',error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();});
  function request(method,params={}){
    const requestId=++id;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('MCP client timeout'));},45000);
      pending.set(requestId,{resolve,reject,timer});
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})+'\n');
    });
  }
  const initialization=await request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'studio-tests',version:'1'}});
  return {initialization,request,async call(name,args={}){
    const result=await request('tools/call',{name:`animlib_${name}`,arguments:args});
    if(result.isError)throw Error(result.content.map(c=>c.text??'').join('\n'));
    const value=result.structuredContent??JSON.parse(result.content.find(c=>c.type==='text').text);
    const image=result.content.find(c=>c.type==='image');return {...value,...(image?{imageData:image.data}:{})};
  },async close(){
    if(child.exitCode!==null)return;
    const ended=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();await ended;lines.close();
  }};
}
