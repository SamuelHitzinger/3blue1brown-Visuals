/** Run from any directory. Requires built animlib and a local FFmpeg executable. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const fixture=fileURLToPath(new URL('.',import.meta.url));
const directory=join(root,'data/animlib-expansion/offline-proof');
const ffmpeg=resolve(process.argv[2] ?? join(root,'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'));
mkdirSync(directory,{recursive:true});
const input=join(directory,'input.json');
writeFileSync(input,JSON.stringify({source:readFileSync(join(fixture,'motion.js'),'utf8'),times:[0,1,2],directory:join(directory,'frames')},null,2));
function run(script,args){
 const result=spawnSync(process.execPath,[script,...args],{cwd:root,windowsHide:true,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)throw Error(`${script} exited ${result.status}`);
}
run('shared/animlib/tools/render-frames.mjs',[input]);
run('shared/animlib/tools/render-video.mjs',['--manifest',join(fixture,'manifest.json'),'--output',join(directory,'proof.mp4'),'--ffmpeg',ffmpeg,'--width','640','--height','360','--fps','8','--preset','ultrafast']);
run(join(fixture,'verify.mjs'),[ffmpeg]);
