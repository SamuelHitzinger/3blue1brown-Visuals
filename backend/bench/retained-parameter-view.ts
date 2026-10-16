/** Local paired runtime viewer. No provider calls or media uploads. */
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

export async function main(args=process.argv.slice(2)){
  const files=args.filter(arg=>!arg.startsWith('--')),options=args.filter(arg=>arg.startsWith('--'));
  if(files.length!==1||options.length>1||options.some(arg=>!/^--port=\d+$/.test(arg)))throw Error('Use MANIFEST_JSON [--port=5369]');
  const port=options.length?Number(options[0].slice('--port='.length)):5367;
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port must be between 1 and 65535');
  const payload=await readFile(resolve(files[0]),'utf8'),manifest=JSON.parse(payload);
  if(!Array.isArray(manifest.cases)||!manifest.cases.length)throw Error('Missing comparison cases');
  const repo=resolve(import.meta.dir,'../..');
  const server=await createServer({configFile:false,root:join(import.meta.dir,'retained-parameter-view'),
    server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[repo]}},
    optimizeDeps:{exclude:['quickjs-emscripten','quickjs-emscripten-core','@jitl/quickjs-wasmfile-debug-sync',
      '@jitl/quickjs-wasmfile-debug-asyncify','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-wasmfile-release-asyncify']},
    plugins:[{name:'local-retained-parameters',configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/cases.json')return next();
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(payload);
    });}}]});
  await server.listen();console.log(`http://127.0.0.1:${port}/`);return server;
}
if(import.meta.main)main().catch(error=>{console.error(error);process.exitCode=1;});
