/** Scripted native runtime proof. No model requests, ASR, or uploaded media. */
import {createServer} from 'vite';
import {join,resolve} from 'node:path';

export async function main(args=process.argv.slice(2)){
  if(args.length>1||args.some(arg=>!/^--port=\d+$/.test(arg)))throw Error('Use [--port=5370]');
  const port=args.length?Number(args[0].slice('--port='.length)):5370;
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port must be between 1 and 65535');
  const server=await createServer({configFile:false,root:join(import.meta.dir,'progressive-view'),
    server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[resolve(import.meta.dir,'../..')]}},
    optimizeDeps:{exclude:['quickjs-emscripten','quickjs-emscripten-core','@jitl/quickjs-wasmfile-debug-sync',
      '@jitl/quickjs-wasmfile-debug-asyncify','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-wasmfile-release-asyncify']}});
  await server.listen();console.log(`http://127.0.0.1:${port}/`);return server;
}
if(import.meta.main)main().catch(error=>{console.error(error);process.exitCode=1;});
