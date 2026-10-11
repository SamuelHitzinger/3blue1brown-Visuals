import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ff='data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe',dir='data/animlib-expansion/peptide-3b1b-revision5',report=[];
for(const aspect of ['16x9','4x3']){
 const path=dir+'/peptide-'+aspect+'.mp4',decoded=spawnSync(ff,['-hide_banner','-i',path,'-f','null','-'],{encoding:'utf8'});
 writeFileSync(dir+'/decode-'+aspect+'.log',decoded.stderr);if(decoded.status!==0)throw Error(decoded.stderr);
 const r=spawnSync(ff,['-hide_banner','-loglevel','error','-y','-i',path,'-vf','fps=8,scale=320:-2,tile=4x4','-q:v','2',dir+'/peptide-'+aspect+'-ordered-%02d.jpg'],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 report.push({aspect,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),fullDecode:'pass',samples:80,orderedSheets:5});
}
writeFileSync(dir+'/film-hashes.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
