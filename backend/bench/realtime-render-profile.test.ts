import {test,expect} from 'bun:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('native profiler samples mixed parameter/time bindings with authored defaults',async()=>{
 const tempRoot=resolve(tmpdir()),directory=await mkdtemp(join(tempRoot,'aha-render-profile-'));
 try{
 const run=async(id:string,body:string)=>{
  const input=join(directory,id+'-input.json'),result=join(directory,id+'-result.json');
  const source=`export default scene({mode:'3d',orbit:false,end:'hold'},s=>{${body}s.wait(2);});`;
  await writeFile(input,JSON.stringify({id,source,samples:3,result}));
  const child=spawnSync('node',[fileURLToPath(new URL('./realtime-render-profile/worker.mjs',import.meta.url)),input],{windowsHide:true,encoding:'utf8',timeout:30000});
  const metrics=JSON.parse(await readFile(result,'utf8'));
  expect({status:metrics.status,error:metrics.error,exit:child.status}).toEqual({status:'complete',error:undefined,exit:0});
  expect(metrics.renderRows).toHaveLength(3);
  expect(metrics.renderRows.every((row:{submitCalls:number})=>row.submitCalls===1)).toBe(true);
  expect(metrics.pixelHashes[0].sha256).not.toBe(metrics.pixelHashes[1].sha256);
  return metrics;
 };
 const mixed=await run('mixed',"const p=s.slider('p',{reactive:true,default:1.25,min:-2,max:2});const box=s.box('box',{fill:'BLUE'});s.bind(box,[p,s.time],(p,t)=>({rotation:[0,p+t,0]}));");
 const plain=await run('plain',"const box=s.box('box',{fill:'BLUE'});s.bind(box,[s.time],t=>({rotation:[0,1.25+t,0]}));");
 expect(mixed.geometrySha256).toBe(plain.geometrySha256);
 }finally{
  if(dirname(resolve(directory))!==tempRoot||!basename(directory).startsWith('aha-render-profile-'))throw Error('Unexpected test temporary directory');
  await rm(directory,{recursive:true,force:true});
 }
},60000);
