/** Isolated main-app fixture. Animation uses the real provider; no mocked submissions. */
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {LectureService} from '../src/lectures.js';
import {createHandler} from '../src/server.js';

export async function main(args=process.argv.slice(2)){
  if(args.length!==1)throw Error('Use NEW_EVIDENCE_DIRECTORY; start the model explicitly in the browser.');
  const directory=resolve(args[0]);await mkdir(directory);
  const lectures=new LectureService(join(directory,'lectures.sqlite'));
  const origin='http://127.0.0.1:5368';
  const created=await lectures.handle(new Request(`${origin}/api/lectures`,{method:'POST',
    headers:{'Content-Type':'application/json',Origin:origin,'Idempotency-Key':'progressive-app-proof'},
    body:JSON.stringify({title:'Live animation · arriving lecture input'})}));
  if(!created.ok)throw Error(`Fixture creation failed: ${await created.text()}`);
  const session=await created.json() as {id:string};
  lectures.appendSource('local',session.id,'cube','Consider a cube A. Its motion has not yet been specified. Use an illustrative scale; do not assert it is physically at rest.');
  const handler=createHandler(undefined,undefined,undefined,undefined,lectures);
  const server=Bun.serve({hostname:'127.0.0.1',port:5368,idleTimeout:30,fetch:handler});
  const manifest={url:`${origin}/lectures/${session.id}`,lectureId:session.id,directory,
    purpose:'Main app live screen with synthetic arriving source text and real model generation.',
    notes:'Notes synthesis and capture are not configured in this isolated fixture. No user lecture data is modified.',
    inputEndpoint:`${origin}/api/lectures/${session.id}/sources`};
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  console.log(JSON.stringify(manifest));
  let stopped=false;
  const close=async()=>{if(stopped)return;stopped=true;server.stop(true);await lectures.close();process.exit(0);};
  process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
  return {server,lectures};
}
if(import.meta.main)await main();
