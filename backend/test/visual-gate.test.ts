import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import { reviewGeneratedScene, sampleReviewTimes } from '../src/agents/visual-gate.js';
import type { AgentTask } from '../src/agents/runtime.js';
import { sourceHash } from '../src/agents/visual-edits.js';
import { createModelGLB, parseModelGLB } from 'animlib/core';
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
const source=`export default scene({audio:'voice',end:'hold'},s=>{s.text('label',{text:'DNA',position:[5,0]});s.wait(4);});`;
const repair=source.replace('[5,0]','[0,0]');
async function fixture(){const directory=await mkdtemp(join(tmpdir(),'visual-gate-'));roots.push(directory);return {
  source,directory,index:0,videoId:crypto.randomUUID(),signal:new AbortController().signal,
  task:{systemPrompt:'Same style and complete API.',prompt:'Authoritative narration and request.'},
  input:{audioAssetId:'voice',endMode:'hold' as const,scene:{id:'beat-1',durationSec:4},planning:{}},
  validate:async(value:string)=>{await compileSource(value);},
};}
test('visual verification compiles model references and forwards assets to its renderer',async()=>{
  const input=await fixture();
  const bytes=await createModelGLB({parts:[{name:'Panel',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]}]});
  const {metadata}=await parseModelGLB(bytes);
  const models={assets:{panel:{kind:'model' as const,url:'/fixture.glb',metadata}},files:{'/fixture.glb':Buffer.from(bytes).toString('base64')}};
  const source=`export default scene({},s=>{s.model('panel',{asset:'panel'});s.wait(4);});`;
  let rendered=false;
  const result=await reviewGeneratedScene({...input,source,models,
    validate:async source=>{await compileSource(source,{models:{panel:metadata}});},
    runner:{async run(){return JSON.stringify({approved:true,findings:[]});}},
    renderFrames:async args=>{expect(args.models).toEqual(models);rendered=true;const path=join(input.directory,'fixture.png');await writeFile(path,'PNG proof fixture');return {backend:'test',frames:[{path,time:1,width:960,height:540}],sheets:[{path,width:960,height:540,times:[1],columns:1}]};},
  });
  expect(result).toBe(source);expect(rendered).toBe(true);
});
test('image rejection produces an automatically repaired candidate that must be rendered and approved again',async()=>{
  const input=await fixture(),rendered:string[]=[],tasks:AgentTask[]=[];
  const renderFrames=async({source,directory}: {source:string;directory:string})=>{
    rendered.push(source);const path=join(input.directory,`image-${rendered.length}.png`);await writeFile(path,'PNG proof fixture');
    return {backend:'test',frames:[{path,time:4,width:1280,height:720}],sheets:[{path,width:1280,height:720,times:[4],columns:2}]};
  };
  const runner={async run(task:AgentTask){tasks.push(task);expect(task.outputMode).toBe('submit-only');
    const output=task.logContext?.stage==='repair'
      ? JSON.stringify({sourceSha256:sourceHash(source),edits:[{finding:0,before:'[5,0]',after:'[0,0]'}]})
      : tasks.length===1?JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped label',fix:'Move inside frame'}]}):JSON.stringify({approved:true,findings:[]});
    await task.validate!(output);return output;
  }};
  const result=await reviewGeneratedScene({...input,runner,renderFrames});
  expect(result).toBe(repair);expect(rendered).toEqual([source,repair]);
  expect(tasks.map(task=>task.logContext?.stage)).toEqual(['review','repair','review']);
  expect(tasks[0].images).toHaveLength(2);expect(tasks[2].images).toHaveLength(2);
  expect(tasks[2].prompt).toContain(repair);expect(tasks[0].systemPrompt).toContain('Current animation quality policy');
  const receipt=JSON.parse(await readFile(join(input.directory,'scene-0.visual-review.json'),'utf8'));
  expect(receipt.approved).toBe(true);expect(receipt.attempt).toBe(1);expect(receipt.sourceSha256).toHaveLength(64);
});
test('rejection after the repair fails closed without another rewrite',async()=>{
  const input=await fixture();let renders=0,repairs=0;
  const renderFrames=async()=>{renders++;const path=join(input.directory,'frame.png');await writeFile(path,'test');return {backend:'test',frames:[{path,time:4,width:960,height:720}],sheets:[{path,width:960,height:720,times:[4],columns:2}]};};
  await expect(reviewGeneratedScene({...input,renderFrames,runner:{async run(task){
    if(task.logContext?.stage==='repair'){repairs++;return JSON.stringify({sourceSha256:sourceHash(source),edits:[{finding:0,before:'[5,0]',after:'[0,0]'}]});}
    return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Unreadable',fix:'Reframe'}]});
  }}})).rejects.toThrow('visual review');
  expect(renders).toBe(2);expect(repairs).toBe(1);
  await expect(readFile(join(input.directory,'scene-0.visual-review.json'))).rejects.toThrow();
});
test('initial approval preserves exact source and never calls repair',async()=>{
  const input=await fixture();let calls=0;
  const path=join(input.directory,'frame.png');await writeFile(path,'test');
  const result=await reviewGeneratedScene({...input,renderFrames:async()=>({backend:'test',frames:[{path,time:4,width:960,height:720}],sheets:[{path,width:960,height:720,times:[4],columns:2}]}),runner:{async run(task){
    calls++;expect(task.logContext?.stage).toBe('review');return '{"approved":true,"findings":[]}';
  }}});
  expect(result).toBe(source);expect(calls).toBe(1);
});
test('render failures and cancellation never invoke approving reviewer',async()=>{
  const input=await fixture();let calls=0;const runner={async run(){calls++;return JSON.stringify({approved:true,findings:[]});}};
  await expect(reviewGeneratedScene({...input,runner,renderFrames:async()=>{throw new Error('GPU unavailable');}})).rejects.toThrow('GPU unavailable');
  const controller=new AbortController();controller.abort(new Error('cancelled'));
  await expect(reviewGeneratedScene({...input,runner,signal:controller.signal})).rejects.toThrow('cancelled');expect(calls).toBe(0);
});
test('verification cannot return replacement source or start repair before valid findings',async()=>{
  const input=await fixture();const stages:string[]=[];
  await expect(reviewGeneratedScene({...input,renderFrames:async()=>({backend:'test',frames:[],sheets:[]}),runner:{async run(task){
    stages.push(task.logContext!.stage!);
    return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}],source:repair});
  }}})).rejects.toThrow('verification never edits');
  expect(stages).toEqual(['review']);
  await expect(readFile(join(input.directory,'scene-0.visual-review.json'))).rejects.toThrow();
});
test('invalid repair cannot render or publish, even if runner skips validation',async()=>{
  const input=await fixture();let renders=0;
  await expect(reviewGeneratedScene({...input,renderFrames:async()=>{renders++;return {backend:'test',frames:[],sheets:[]};},runner:{async run(task){
    if(task.logContext?.stage==='repair')return JSON.stringify({sourceSha256:'stale',edits:[]});
    return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}]});
  }}})).rejects.toThrow('exact candidate hash');
  expect(renders).toBe(1);
  await expect(readFile(join(input.directory,'scene-0.visual-review.json'))).rejects.toThrow();
});
test('cancellation during repair prevents re-render and approval',async()=>{
  const input=await fixture(),controller=new AbortController();let renders=0;
  await expect(reviewGeneratedScene({...input,signal:controller.signal,renderFrames:async()=>{renders++;return {backend:'test',frames:[],sheets:[]};},runner:{async run(task){
    if(task.logContext?.stage==='repair'){
      controller.abort(new Error('cancelled during repair'));
      return JSON.stringify({sourceSha256:sourceHash(source),edits:[{finding:0,before:'[5,0]',after:'[0,0]'}]});
    }
    return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}]});
  }}})).rejects.toThrow('cancelled during repair');
  expect(renders).toBe(1);
  await expect(readFile(join(input.directory,'scene-0.visual-review.json'))).rejects.toThrow();
});
test('sampling includes camera transition interior, end points and a nonzero opening frame',async()=>{
  const compiled=await compileSource(`export default scene({mode:'3d'},s=>{s.wait(1);s.play(s.camera.to2D(),{duration:2});s.wait(5);});`);
  const times=sampleReviewTimes(compiled);expect(times).toContain(0);expect(times).toContain(8);expect(times).toContain(2);expect(times.some(t=>t>0&&t<1)).toBe(true);expect(times.length).toBeLessThanOrEqual(12);
});
