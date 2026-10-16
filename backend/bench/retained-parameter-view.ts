/** Local paired runtime viewer. No provider calls or media uploads. */
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

export async function main(args=process.argv.slice(2)){
  if(args.length!==1)throw Error('Use MANIFEST_JSON');
  const payload=await readFile(resolve(args[0]),'utf8'),manifest=JSON.parse(payload);
  if(!Array.isArray(manifest.cases)||!manifest.cases.length)throw Error('Missing comparison cases');
  const repo=resolve(import.meta.dir,'../..');
  const server=await createServer({configFile:false,root:join(import.meta.dir,'retained-parameter-view'),
    server:{host:'127.0.0.1',port:5367,strictPort:true,fs:{allow:[repo]}},
    optimizeDeps:{exclude:['quickjs-emscripten','quickjs-emscripten-core','@jitl/quickjs-wasmfile-debug-sync',
      '@jitl/quickjs-wasmfile-debug-asyncify','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-wasmfile-release-asyncify']},
    plugins:[{name:'local-retained-parameters',configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/cases.json')return next();
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(payload);
    });}}]});
  await server.listen();console.log('http://127.0.0.1:5367/');return server;
}
if(import.meta.main)main().catch(error=>{console.error(error);process.exitCode=1;});
