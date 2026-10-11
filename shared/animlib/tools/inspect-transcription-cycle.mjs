import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ff='data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
for(const name of ['transcription-cycle-proof','transcription-cycle-focus-proof']){const dir='data/animlib-expansion/'+name,report=[];for(const aspect of ['16x9','4x3']){const path=dir+'/cycle-'+aspect+'.mp4',r=spawnSync(ff,['-hide_banner','-loglevel','error','-y','-i',path,'-vf','fps=8,scale=320:-2,tile=4x4','-q:v','2',dir+'/cycle-'+aspect+'-ordered-%02d.jpg'],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);report.push({aspect,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),fullDecode:'pass',samples:64,orderedSheets:4});}writeFileSync(dir+'/film-hashes.json',JSON.stringify(report,null,2));console.log(name,report);}
