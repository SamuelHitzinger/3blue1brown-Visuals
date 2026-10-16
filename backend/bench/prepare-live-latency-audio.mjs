import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';

const directory=resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Supply the synthetic speech directory.');
const speech=JSON.parse((await readFile(join(directory,'speech.json'),'utf8')).replace(/^\uFEFF/,''));
const rate=16000, track=Buffer.alloc(speech.durationMs*rate/1000*2), cues=[];
function pcm(wav){
  if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Expected WAV.');
  let format,data;
  for(let offset=12;offset+8<=wav.length;){
    const name=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);
    if(name==='fmt ')format=wav.subarray(offset+8,offset+8+size);
    if(name==='data')data=wav.subarray(offset+8,offset+8+size);
    offset+=8+size+(size%2);
  }
  if(!format||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==rate||format.readUInt16LE(14)!==16||!data)throw Error('Expected 16 kHz mono PCM16.');
  return data;
}
function wav(data){
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
  header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
  header.write('data',36);header.writeUInt32LE(data.length,40);return Buffer.concat([header,data]);
}
for(const cue of speech.cues){
  const data=pcm(await readFile(join(directory,basename(cue.file.replaceAll('\\','/')))));
  const offset=cue.startMs*rate/1000*2;if(offset+data.length>track.length)throw Error('Speech exceeds track.');data.copy(track,offset);
  let first=-1,last=-1;for(let i=0;i<data.length/2;i++)if(Math.abs(data.readInt16LE(i*2))>100){if(first<0)first=i;last=i;}
  if(first<0)throw Error('Silent phrase.');
  cues.push({id:cue.id,startMs:cue.startMs,speechStartMs:cue.startMs+first/rate*1000,speechEndMs:cue.startMs+(last+1)/rate*1000,text:cue.text});
}
await writeFile(join(directory,'track.wav'),wav(track),{flag:'wx'});
const clips=[];
for(let start=0;start+2000<=speech.durationMs;start+=1000){
  const id=`window-${String(start/1000).padStart(2,'0')}`,file=`${id}.wav`,data=wav(track.subarray(start*rate/1000*2,(start+2000)*rate/1000*2));
  await writeFile(join(directory,file),data,{flag:'wx'});clips.push({id,file,durationMs:2000,sourceStartMs:start,releaseAtMs:start+2000,sha256:createHash('sha256').update(data).digest('hex')});
}
const manifest={durationMs:speech.durationMs,voice:speech.voice,sampleRate:rate,speechBoundary:'First/last PCM sample with absolute amplitude >100; phrase end conservatively marks complete evidence, not individual-word alignment.',cues,clips};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
console.log(JSON.stringify({cues,windows:clips.length,durationMs:speech.durationMs},null,2));
