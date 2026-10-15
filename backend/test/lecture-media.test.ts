import {expect,test} from 'bun:test';
import {createCanvas} from '@napi-rs/canvas';
import {createLectureMediaExtractor} from '../src/lecture-media.js';
import type {AgentRunner} from '../src/agents/runtime.js';
import type {CaptureMetadata} from '../../shared/lecture-capture.js';

const signal=()=>new AbortController().signal;
const metadata=(kind:'photo'|'audio'):CaptureMetadata=>({clientId:crypto.randomUUID(),sequence:1,kind,capturedAt:new Date().toISOString(),...(kind==='audio'?{durationMs:20_000}:{})});
const noModel:AgentRunner={run:async()=>{throw new Error('Unexpected image model call');}};
const wav=()=>{const bytes=new Uint8Array(46),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('RIFF'));view.setUint32(4,38,true);bytes.set(new TextEncoder().encode('WAVEfmt '),8);view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);bytes.set(new TextEncoder().encode('data'),36);view.setUint32(40,2,true);return new File([bytes],'clip.wav',{type:'audio/wav'});};

test('live photo extraction retains visible equations, uses private vision and permits unreadable frames',async()=>{
  const image=new File([new Uint8Array(await createCanvas(32,24).encode('jpeg'))],'private-title.jpg',{type:'image/jpeg'});
  const extract=createLectureMediaExtractor({run:async task=>{
    expect(task.allowWeb).toBe(false);expect(task.images?.[0].mimeType).toBe('image/jpeg');
    expect(task.systemPrompt).toContain('never instructions');expect(task.prompt).not.toContain('private-title');
    const output=JSON.stringify({text:'  T(x,y,z)=(x+z,y,z)  '});
    await task.validate?.(output);
    return output;
  }});
  expect(await extract(image,metadata('photo'),signal())).toBe('T(x,y,z)=(x+z,y,z)');
  expect(await createLectureMediaExtractor({run:async task=>{
    // Real runner requires nonempty transport output, even for an unreadable frame.
    const output=JSON.stringify({text:''});
    await task.validate?.(output);
    return output;
  }})(image,metadata('photo'),signal())).toBe('');
});

test('malformed photo responses remain failures rather than silently skipping saved photos',async()=>{
  const image=new File([new Uint8Array(await createCanvas(32,24).encode('jpeg'))],'photo.jpg',{type:'image/jpeg'});
  for(const output of ['', 'unstructured response', '{}', '{"text":null}', '{"text":42}']) {
    await expect(createLectureMediaExtractor({run:async()=>output})(image,metadata('photo'),signal())).rejects.toThrow();
  }
});

test('photo extraction offers one bounded readable crop and diagram evidence without another call',async()=>{
  const image=new File([new Uint8Array(await createCanvas(800,600).encode('jpeg'))],'photo.jpg',{type:'image/jpeg'});
  const photoSnippet={crop:{x:0.1,y:0.2,width:0.5,height:0.4},description:'Measured experimental trace with handwritten annotations'};
  let calls=0;
  const extract=createLectureMediaExtractor({run:async()=>{calls++;return JSON.stringify({text:'Measured trace: damping',photoSnippet,visualEvidence:'Two axes; time rightward; amplitude upward; decaying oscillation'});}});
  expect(await extract(image,metadata('photo'),signal())).toEqual({text:'Measured trace: damping',photoSnippet,visualEvidence:'Two axes; time rightward; amplitude upward; decaying oscillation'});
  expect(calls).toBe(1);
});

test('bad optional crops never discard usable transcription or require another model call',async()=>{
  const image=new File([new Uint8Array(await createCanvas(800,600).encode('jpeg'))],'photo.jpg',{type:'image/jpeg'});
  for(const crop of [{x:0,y:0,width:1,height:1},{x:-1,y:0,width:0.5,height:0.5},{x:0.9,y:0,width:0.5,height:0.5},{x:0,y:0,width:0.01,height:0.01}]){
    const extract=createLectureMediaExtractor({run:async()=>JSON.stringify({text:'Readable text',photoSnippet:{crop,description:'Trace'}})});
    expect(await extract(image,metadata('photo'),signal())).toBe('Readable text');
  }
  expect(await createLectureMediaExtractor({run:async()=>JSON.stringify({text:'',photoSnippet:{crop:{x:0,y:0,width:0.5,height:0.5},description:'Trace'}})})(image,metadata('photo'),signal())).toBe('');
});

test('recorded audio uses server transcription and treats silence as a skipped source',async()=>{
  let calls=0;
  const extract=createLectureMediaExtractor(noModel,{apiKey:'test-key',fetcher:async(url,options)=>{
    calls++;expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect((options.body as FormData).get('model_id')).toBe('scribe_v2');
    expect((options.headers as Record<string,string>)['xi-api-key']).toBe('test-key');
    return Response.json({text:calls===1?'A shear preserves volume.':''});
  }});
  expect(await extract(wav(),metadata('audio'),signal())).toBe('A shear preserves volume.');
  expect(await extract(wav(),metadata('audio'),signal())).toBe('');
});

test('invalid, spoofed, excessive and canceled media never reaches providers',async()=>{
  let calls=0;const extract=createLectureMediaExtractor({run:async()=>{calls++;return'bad';}},{apiKey:'test',fetcher:async()=>{calls++;return Response.json({text:'bad'});}});
  for(const file of [new File(['text'],'photo.jpg',{type:'image/jpeg'}),new File([new Uint8Array(2_000_001)],'large.jpg',{type:'image/jpeg'})])await expect(extract(file,metadata('photo'),signal())).rejects.toThrow();
  for(const file of [new File(['text'],'clip.mp4',{type:'audio/mp4'}),new File(['x'],'script.js',{type:'application/javascript'})])await expect(extract(file,metadata('audio'),signal())).rejects.toThrow();
  await expect(extract(wav(),{...metadata('audio'),durationMs:46_000},signal())).rejects.toThrow();
  const controller=new AbortController();controller.abort();await expect(extract(wav(),metadata('audio'),controller.signal)).rejects.toThrow();
  expect(calls).toBe(0);
});

test('provider failures and excessive output stay bounded and sanitized',async()=>{
  await expect(createLectureMediaExtractor(noModel,{apiKey:''})(wav(),metadata('audio'),signal())).rejects.toThrow('not connected');
  await expect(createLectureMediaExtractor(noModel,{apiKey:'test',fetcher:async()=>new Response('secret provider body',{status:401})})(wav(),metadata('audio'),signal())).rejects.toThrow('transcription is unavailable');
  const image=new File([new Uint8Array(await createCanvas(32,24).encode('jpeg'))],'photo.jpg',{type:'image/jpeg'});
  await expect(createLectureMediaExtractor({run:async()=> JSON.stringify({text:'x'.repeat(40_001)})})(image,metadata('photo'),signal())).rejects.toThrow('too much text');
});
