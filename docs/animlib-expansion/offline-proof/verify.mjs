/** Verify actual native PNGs and decoded video, after the commands in infrastructure-report.md. */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve('data/animlib-expansion/offline-proof');
function centroid(rgba,width,height){
 let sum=0,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  if(rgba[i]>180&&rgba[i+1]>180&&rgba[i+2]<90){sum+=x;count++;}
 }
 assert(count>100,'Visible yellow probe missing');
 return sum/count;
}
const frames=[];
for(const width of [1280,960])for(const [index,time] of [0,1,2].entries()){
 const png=readFileSync(join(directory,'frames',`${width}x720-${index}.png`));
 const blocks=[];let w,h;
 for(let i=8;i<png.length;){const n=png.readUInt32BE(i),type=png.toString('ascii',i+4,i+8);if(type==='IHDR'){w=png.readUInt32BE(i+8);h=png.readUInt32BE(i+12);}if(type==='IDAT')blocks.push(png.subarray(i+8,i+8+n));i+=12+n;}
 assert.equal(w,width);assert.equal(h,720);
 const rows=inflateSync(Buffer.concat(blocks)),rgba=Buffer.alloc(width*720*4);
 for(let y=0;y<720;y++){assert.equal(rows[y*(width*4+1)],0);rows.copy(rgba,y*width*4,y*(width*4+1)+1,(y+1)*(width*4+1));}
 const x=centroid(rgba,width,720),expected=width/2+(-2+2*time)*90-0.5;
 assert(Math.abs(x-expected)<1,`PNG ${width} t=${time}: ${x}, expected ${expected}`);frames.push({width,time,centroidX:x,expected});
}
const ffmpeg=resolve(process.argv[2] ?? 'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const decoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-i',join(directory,'proof.mp4'),'-map','0:v:0','-f','rawvideo','-pix_fmt','rgba','pipe:1'],{windowsHide:true,maxBuffer:64*1024*1024});
assert.equal(decoded.status,0,decoded.stderr.toString());
const stride=640*360*4;assert.equal(decoded.stdout.length,stride*24);
const video=[];
for(const [index,expected] of [[0,229.5],[8,319.5],[15,398.25],[16,409.5],[23,409.5]]){
 const x=centroid(decoded.stdout.subarray(index*stride,(index+1)*stride),640,360);
 assert(Math.abs(x-expected)<1,`Video frame ${index}: ${x}, expected ${expected}`);video.push({index,centroidX:x,expected});
}
const metadata=spawnSync(ffmpeg,['-hide_banner','-i',join(directory,'proof.mp4')],{windowsHide:true,encoding:'utf8'}).stderr;
assert.match(metadata,/Video: h264/);assert.match(metadata,/Subtitle: mov_text/);assert(!metadata.includes('Audio:'),'Silent export has an audio stream');
assert.match(readFileSync(join(directory,'proof.srt'),'utf8'),/00:00:02,000 --> 00:00:03,000\nEndpoint handoff/);
assert.match(readFileSync(join(directory,'proof.vtt'),'utf8'),/^WEBVTT\n/);
const result={backend:'native-webgpu',frames,video,framesDecoded:24,silent:true,embeddedSubtitles:true};
writeFileSync(join(directory,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

