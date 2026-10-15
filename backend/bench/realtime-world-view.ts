/** Local experimental model-to-persistent-world harness. No production routes. */
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const repo = resolve(import.meta.dir, '../..'), port = 5363;
const nativeSystem = `Return only complete JavaScript, no prose or fences. Author arbitrary requested geometry with this API:
export default scene({mode:"3d",end:"hold",orbit:false},s=>{...});
s.box/circle/rectangle/path/line/arrow/text(id,props). Props: position:[x,y,z],rotation:[x,y,z] radians,width,height,depth,radius,points:[[x,y,z],...],text,fontSize,fill,stroke,strokeWidth. Colors are quoted strings: "BLUE","TEAL","YELLOW","WHITE","RED","none"; no color globals exist. Labels fontSize .25-.4. Use ordinary ASCII text. Handles .animate(props), .moveTo(position), .rotateTo(rotation), .fadeIn(). s.play([actions],{duration:seconds,ease:"linear"}); s.wait(seconds); s.keep(handle). Continuous motion: s.bind(handle,[s.time],t=>({rotation:[0,t,0]})); s.wait(60). s.attach(child,parent,{offset:[x,y,z]}) keeps labels with moving objects; s.connect(arrow,from,to,{endpoints:"center"}) keeps connectors attached. Both references must belong to this new program. Only new IDs may be created; no previous handles. First program chooses camera, later ones share it. Keep geometry within x[-6,6],y[-3,3]. No title cards, panels or decoration. No imports, controls, views, camera animations or external assets. Existing programs keep moving; do not recreate them. Build only requested new objects; choose IDs not already present.`;
const patchSystem = `Return only one JSON object: {"changes":[{"id":"existing-id","props":{"fill":"TEAL"},"duration":0.5}],"remove":[]}. No prose or fences. Modify only requested properties of existing entities. Allowed properties: position/rotation arrays of 3 numbers, scale number, fill color strings, opacity. Colors BLUE,TEAL,YELLOW,WHITE,RED. Numeric properties and fill can interpolate for duration 0..60 seconds. Existing motion continues for untouched properties. Do not write rotation when asked only to change color or position. No new geometry here. IDs must come from current world. Empty changes is allowed only with removals.`;
let busy = false;
const server = await createServer({ configFile: false, root: join(import.meta.dir, 'realtime-world-view'),
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [repo] } },
  optimizeDeps: { exclude: ['quickjs-emscripten','quickjs-emscripten-core','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-wasmfile-release-asyncify'] },
  plugins: [{ name: 'world-native-build', enforce: 'pre', resolveId(source) {
    const prefix = '../../../shared/animlib/src/';
    if (source.startsWith(prefix)) return join(repo, 'shared/animlib/dist', source.slice(prefix.length));
  } }, { name: 'local-world-api', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const route = req.url?.split('?')[0];
      if (route !== '/generate' && route !== '/evidence') return next();
      if (req.method !== 'POST' || req.headers.origin !== `http://127.0.0.1:${port}`) { res.statusCode = 403; res.end(); return; }
      res.setHeader('Content-Type','application/json');
      try {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error('Request too large'); }
        const body = JSON.parse(raw);
        if (route === '/evidence') {
          const folder = join(repo,'data/realtime-workshop/browser'); await mkdir(folder,{recursive:true});
          await writeFile(join(folder,`${randomUUID()}.json`),JSON.stringify(body,null,2),{flag:'wx'});
          res.end('{}'); return;
        }
        if (busy) { res.statusCode=409; res.end(JSON.stringify({error:'Another model request is active'})); return; }
        if (!['add','edit'].includes(body.action) || typeof body.instruction !== 'string' || !body.instruction.trim() || body.instruction.length>4000) throw new Error('Invalid instruction');
        busy=true;
        try {
          const id=randomUUID(), folder=join(repo,'data/realtime-workshop/live-requests',id);
          await mkdir(folder,{recursive:true});
          const prompt=join(folder,'instruction.txt'), system=join(folder,'system.txt'), output=join(folder,'probe');
          await writeFile(prompt,`Current world: ${JSON.stringify(body.world)}\nInstruction: ${body.instruction}`);
          await writeFile(system,body.action==='add'?nativeSystem:patchSystem);
          const args=[join(repo,'backend/bench/realtime-model-probe.ts'),'run','--case=external','--format=native-js','--action=create',
            '--model=gpt-6.1-sol','--thinking=low','--service-tier=priority','--timeout-ms=15000',`--prompt-file=${prompt}`,`--system-file=${system}`,`--out=${output}`];
          await new Promise<void>((done,fail)=>{
            const child=spawn(process.execPath,args,{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,AGENT_PROVIDER:'openai-codex',PI_CODING_AGENT_DIR:process.env.PI_CODING_AGENT_DIR??'C:/Users/samue/.pi/agent'}});
            const timer=setTimeout(()=>child.kill(),20_000);
            child.once('error',error=>{clearTimeout(timer);fail(error);});
            child.once('exit',()=>{clearTimeout(timer);done();});
          });
          const metadata=JSON.parse(await readFile(join(output,'result.json'),'utf8'));
          if(metadata.status!=='complete')throw new Error(`Model failed; retained request ${id}`);
          const source=await readFile(join(output,'output.txt'),'utf8');
          res.end(JSON.stringify({id,source,metadata,action:body.action}));
        } finally { busy=false; }
      } catch(error) { res.statusCode=400;res.end(JSON.stringify({error:error instanceof Error?error.message:'Request failed'})); }
    });
  } }],
});
await server.listen(); console.log(`Persistent-world workshop: http://127.0.0.1:${port}`);

