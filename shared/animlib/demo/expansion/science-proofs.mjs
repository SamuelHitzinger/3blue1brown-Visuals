/** Repeatable native science proofs. Run from repository root. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {inflateSync} from 'node:zlib';
const root=resolve('data/animlib-expansion/science-proofs');
const ffmpeg=resolve(process.env.FFMPEG??'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const args=new Set(process.argv.slice(2)),video=!args.has('--frames-only');
const run=(command,argv)=>{const result=spawnSync(command,argv,{stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error(`${command} exited ${result.status}`);};
await mkdir(root,{recursive:true});
const reports=[];
for(const name of['artem-state','logistic-residual']){
 const manifestPath=resolve(`shared/animlib/demo/expansion/${name}-manifest.json`),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const source=await readFile(`shared/animlib/demo/expansion/${name}.js`,'utf8');
 const times=[0,.8,1.6,2.6,3.8,4.4,5.2,6.3,7,3.8];
 const input=resolve(root,`${name}-input.json`),directory=resolve(root,`${name}-frames`);
 await writeFile(input,JSON.stringify({source,palette:manifest.palette,times,directory}));
 run(process.execPath,['shared/animlib/tools/render-frames.mjs',input]);
 // PNG output uses unfiltered RGBA rows. Assert actual native background and seek equality.
 for(const width of[1280,960]){
  const png=await readFile(resolve(directory,`${width}x720-0.png`));let offset=8,parts=[];
  while(offset<png.length){const n=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')parts.push(png.subarray(offset+8,offset+8+n));offset+=12+n;}
  const rgba=inflateSync(Buffer.concat(parts)),expected=manifest.palette.colors.BLACK.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16));
  if(expected.some((v,i)=>Math.abs(v-rgba[1+i])>1))throw Error(`Native palette mismatch ${name}/${width}: ${rgba.subarray(1,4)}`);
  const a=await readFile(resolve(directory,`${width}x720-4.png`)),b=await readFile(resolve(directory,`${width}x720-9.png`));
  if(!a.equals(b))throw Error(`Native reverse-seek mismatch ${name}/${width}`);
 }
 if(video){
  const output=resolve(root,`${name}.mp4`),motion=resolve(root,`${name}-motion`);
  run(process.execPath,['shared/animlib/tools/render-video.mjs','--manifest',manifestPath,'--output',output,'--ffmpeg',ffmpeg,'--width','1280','--height','720','--fps','30']);
  await mkdir(motion,{recursive:true});
  const sampled=spawnSync(ffmpeg,['-hide_banner','-y','-i',output,'-vf','fps=6,scale=426:240,tile=3x3','-frames:v','5',resolve(motion,'sheet-%02d.png')],{encoding:'utf8',windowsHide:true});
  if(sampled.status!==0)throw Error(sampled.stderr);
  if(/Audio:/.test(sampled.stderr)||!/1280x720.*30 fps/.test(sampled.stderr))throw Error('Incorrect encoded stream metadata');
  await writeFile(resolve(motion,'ffmpeg-inspection.txt'),sampled.stderr);
  const decoded=spawnSync(ffmpeg,['-v','error','-i',output,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,maxBuffer:4*1280*720});
  const expected=manifest.palette.colors.BLACK.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16));
  if(decoded.status!==0||expected.some((v,i)=>Math.abs(v-decoded.stdout[i])>4))throw Error(`Video palette mismatch ${name}`);
  await writeFile(resolve(motion,'sample-times.json'),JSON.stringify({fps:6,columns:3,rows:3,times:Array.from({length:Math.ceil(manifest.scenes[0].duration*6)},(_,i)=>i/6),note:'FFmpeg fps filter chooses nearest decoded source frames; 30fps source, not every-frame review.'},null,2));
 }
 reports.push({name,times,nativePalette:true,nativeReverseSeek:true,video});
}
await writeFile(resolve(root,'checks.json'),JSON.stringify(reports,null,2));
