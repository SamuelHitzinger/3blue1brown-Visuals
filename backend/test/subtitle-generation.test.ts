import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createPiGenerator} from '../src/agents/generator.js';
import type {NarrationService} from '../src/narration/service.js';
import type {AgentTask} from '../src/agents/runtime.js';

test('subtitle resume bypasses unavailable speech and still verifies generated scenes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'subtitle-resume-'));
 try{
  const id=crypto.randomUUID(),directory=join(root,id);await mkdir(directory);
  await writeFile(join(directory,'script.md'),'# Dots\n\n## Beat 1\n\nContent needed: Show one dot.\n\nNarration: One dot.\n\n## Beat 2\n\nContent needed: Show another dot.\n\nNarration: Another dot appears.');
  const narration=new Proxy({available:false},{get(target,key){if(key==='available')return target.available;throw new Error('Speech service must not be called');}}) as unknown as NarrationService;
  let reviews=0;
  const runner={async run(task:AgentTask){
   const packet=JSON.parse(task.prompt.slice(task.prompt.indexOf('\n')+1));
   expect(packet.timingBasis).toBe('subtitle-reading');
   const source=`export default scene({audio:${JSON.stringify(packet.audioAssetId)},end:${JSON.stringify(packet.endMode)}},s=>{s.circle('dot');s.wait(${packet.scene.durationSec});});`;
   await task.validate!(source);return source;
  }};
  const generator=createPiGenerator(runner,narration,root,{visualGate:async options=>{reviews++;await options.validate(options.source);return options.source;}});
  const result=await generator({title:'Dots',topic:'Dots',documents:[],narrationMode:'subtitles'},1,{videoId:id,owner:'shared-user',signal:new AbortController().signal});
  expect(reviews).toBe(1);expect(result?.scene.captions.map(c=>c.text).join(' ')).toBe('Another dot appears.');
  expect(result?.audio.slice(44).every(byte=>byte===0)).toBe(true);
  expect(await generator({title:'Dots',topic:'Dots',documents:[],narrationMode:'subtitles'},2,{videoId:id,owner:'shared-user',signal:new AbortController().signal})).toBeNull();
 }finally{await rm(root,{recursive:true,force:true});}
});
