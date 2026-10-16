import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

if(process.argv.length!==4)throw Error('Use EXCERPT_DIRECTORY ORIGINAL_OFFSET_SECONDS. Directory must contain excerpt.mp4, track.wav and source.jpg.');
const directory=resolve(process.argv[2]),sourceOffsetSec=Number(process.argv[3]);
if(!Number.isFinite(sourceOffsetSec)||sourceOffsetSec<0)throw Error('Invalid source offset.');
const input=await readFile(join(directory,'track.wav'));
let format,pcm;
if(input.toString('ascii',0,4)!=='RIFF'||input.toString('ascii',8,12)!=='WAVE')throw Error('Expected WAV.');
for(let offset=12;offset+8<=input.length;){
  const size=input.readUInt32LE(offset+4),name=input.toString('ascii',offset,offset+4);
  if(name==='fmt ')format=input.subarray(offset+8,offset+8+size);
  if(name==='data')pcm=input.subarray(offset+8,offset+8+size);
  offset+=8+size+(size%2);
}
if(!format||!pcm||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==16000||format.readUInt16LE(14)!==16)throw Error('Expected mono 16 kHz PCM16.');
const durationMs=Math.floor(pcm.length/32),clips=[];
for(let start=0;start+2000<=durationMs;start+=1000){
  const data=pcm.subarray(start*32,(start+2000)*32),header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
  const bytes=Buffer.concat([header,data]),id=`window-${String(start/1000).padStart(3,'0')}`,file=`${id}.wav`;
  await writeFile(join(directory,file),bytes,{flag:'wx'});clips.push({id,file,durationMs:2000,sourceStartMs:start,releaseAtMs:start+2000,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const stamp=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const manifest={title:`Live lecture · ${stamp(sourceOffsetSec)}–${stamp(sourceOffsetSec+durationMs/1000)}`,videoFile:'excerpt.mp4',photoFile:'source.jpg',sourceOffsetSec,durationMs,cues:[],clips,
  purpose:'Original lecture replay at normal speed; only released audio windows and initial frame are sent to actual providers.'};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
console.log(JSON.stringify({durationMs,windows:clips.length,sourceOffsetSec}));
