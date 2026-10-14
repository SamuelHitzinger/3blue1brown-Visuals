/** Start the desktop and a restricted private HTTPS phone receiver. */
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function phoneOptions(args){
  const result={port:8080,capturePort:8081,httpsPort:8443,origin:undefined};
  const keys={'--port':'port','--capture-port':'capturePort','--https-port':'httpsPort','--origin':'origin'};
  for(let i=0;i<args.length;i++){
    const key=keys[args[i]],value=args[++i];
    if(!key||!value)throw new Error('Use --origin https://host, --port, --capture-port, or --https-port.');
    if(key==='origin'){
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Phone origin must be an HTTPS origin without credentials, paths, queries, or fragments.');
      result.origin=url.origin;
    }else{
      const port=Number(value);
      if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Ports must be integers from 1 to 65535.');
      result[key]=port;
    }
  }
  if(result.port===result.capturePort)throw new Error('Desktop and capture ports must differ.');
  return result;
}
export function privateOrigin(state,port){
  const name=state?.Self?.DNSName?.replace(/\.$/,'');
  if(state?.BackendState!=='Running'||!name||!/^[a-z0-9.-]+\.ts\.net$/i.test(name))throw new Error('Start Tailscale and sign in on this computer first.');
  return `https://${name}${port===443?'':':'+port}`;
}
export function matchingServe(config,origin,target){
  const url=new URL(origin),port=url.port||'443';
  const existing=config.TCP?.[port];
  if(!existing)return false;
  const handlers=config.Web?.[url.host]?.Handlers;
  if(existing.HTTPS!==true||Object.keys(handlers??{}).length!==1||handlers?.['/']?.Proxy!==target||config.AllowFunnel?.[url.host])throw new Error('That Tailscale HTTPS port already serves another configuration. Choose a different --https-port; existing settings were not changed.');
  return true;
}
async function freePort(port){
  await new Promise((resolve,reject)=>{
    const server=createServer();server.once('error',()=>reject(new Error(`Port ${port} is busy. Stop the existing app or choose another port.`)));
    server.listen(port,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()));
  });
}
async function main(){
  const options=phoneOptions(process.argv.slice(2));
  const tailscale=process.env.TAILSCALE_BIN??(process.platform==='win32'?'C:\\Program Files\\Tailscale\\tailscale.exe':'tailscale');
  const query=args=>{
    try{return JSON.parse(execFileSync(tailscale,args,{encoding:'utf8',timeout:10_000,windowsHide:true,stdio:['ignore','pipe','pipe']}));}
    catch{throw new Error('Could not read Tailscale. Start it and sign in, or supply --origin for an existing trusted HTTPS proxy.');}
  };
  const origin=options.origin??privateOrigin(query(['status','--json']),options.httpsPort);
  const target=`http://127.0.0.1:${options.capturePort}`;
  const reuse=options.origin?true:matchingServe(query(['serve','status','--json']),origin,target);
  await Promise.all([freePort(options.port),freePort(options.capturePort)]);
  const bun=join(root,'node_modules/bun/bin',process.platform==='win32'?'bun.exe':'bun');
  if(!existsSync(bun))throw new Error('Install repository dependencies with npm install first.');
  const children=[];
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const start=(command,args,settings={})=>{
    const child=spawn(command,args,{stdio:'inherit',windowsHide:true,...settings});children.push(child);
    child.once('error',()=>{console.error('Could not start phone capture service.');process.exitCode=1;stop();});
    child.once('exit',code=>{if(!stopping){process.exitCode=code??1;stop();}});return child;
  };
  const backend=start(bun,['src/index.ts'],{cwd:join(root,'backend'),env:{...process.env,HOST:'127.0.0.1',PORT:String(options.port),
    CAPTURE_PORT:String(options.capturePort),CAPTURE_PUBLIC_ORIGIN:origin,NARRATION_PUBLIC_ORIGIN:`http://127.0.0.1:${options.port}`}});
  const backendExit=new Promise(resolve=>{backend.once('exit',resolve);backend.once('error',resolve);});
  let ready=false;
  for(let tries=0;tries<100&&!stopping;tries++){
    try{const response=await fetch(`${target}/healthz`,{signal:AbortSignal.timeout(1_000)});const status=await response.json();if(response.ok&&status.capture){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready){stop();throw new Error('Capture receiver did not become ready. Check the server configuration above.');}
  if(!options.origin&&!reuse)start(tailscale,['serve',`--https=${options.httpsPort}`,'--yes',target]);
  console.log(`\nDesktop: http://127.0.0.1:${options.port}/lectures\nPhone receiver: ${origin}/capture`);
  console.log(options.origin?'Forward this HTTPS origin only to '+target+'.':'Connect your iPhone to the same Tailscale account. This uses private Serve, not public Funnel.');
  console.log('Open a lecture on the desktop and scan its recording QR. Live notes appear on that same lecture page. Keep this command and the recording device page open. Ctrl+C stops this session.');
  await backendExit;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
