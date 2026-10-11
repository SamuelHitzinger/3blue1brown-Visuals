import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import { reviewGeneratedScene, sampleReviewTimes } from '../src/agents/visual-gate.js';
import type { AgentTask } from '../src/agents/runtime.js';
import { sourceHash } from '../src/agents/visual-edits.js';
import { createModelGLB, parseModelGLB } from 'animlib/core';
import { loadPrompt } from '../src/agents/prompts.js';
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
const source=`export default scene({audio:'voice',end:'hold'},s=>{s.text('label',{text:'DNA',position:[5,0]});s.wait(4);});`;
const repair=source.replace('[5,0]','[0,0]');
async function fixture(){const directory=await mkdtemp(join(tmpdir(),'visual-gate-'));roots.push(directory);return {
  recoveryWait:async()=>{},source,directory,index:0,videoId:crypto.randomUUID(),signal:new AbortController().signal,
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
  expect(tasks[2].prompt).toContain(repair);
  expect(tasks[0].systemPrompt).toBe(`${input.task.systemPrompt}\n\n${await loadPrompt('scene-verify')}`);
  expect(tasks[1].systemPrompt).toBe(`${input.task.systemPrompt}\n\n${await loadPrompt('scene-repair')}`);
  expect(tasks[2].systemPrompt).toBe(tasks[0].systemPrompt);
  const receipt=JSON.parse(await readFile(join(input.directory,'scene-0.visual-review.json'),'utf8'));
  expect(receipt.approved).toBe(true);expect(receipt.attempt).toBe(1);expect(receipt.sourceSha256).toHaveLength(64);
});
test('visual review keeps repairing beyond the original limit until approval',async()=>{
  const input=await fixture();let renders=0,repairs=0,current=source;
  const result=await reviewGeneratedScene({...input,renderFrames:async args=>{
    renders++;current=args.source;return {backend:'test',frames:[],sheets:[]};
  },runner:{async run(task){
    if(task.logContext?.stage==='repair'){
      repairs++;return JSON.stringify({sourceSha256:sourceHash(current),edits:[{finding:0,before:`[${6-repairs},0]`,after:`[${5-repairs},0]`}]});
    }
    return JSON.stringify(renders>=5?{approved:true,findings:[]}:{approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Unreadable',fix:'Move left'}]});
  }}});
  expect(result).toBe(source.replace('[5,0]','[1,0]'));expect(renders).toBe(5);expect(repairs).toBe(4);
  const receipt=JSON.parse(await readFile(join(input.directory,'scene-0.visual-review.json'),'utf8'));
  expect(receipt.approved).toBe(true);expect(receipt.attempt).toBe(4);
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
test('verification retries invalid findings without invoking repair or approving them',async()=>{
  const input=await fixture();const stages:string[]=[];
  const result=await reviewGeneratedScene({...input,renderFrames:async()=>({backend:'test',frames:[],sheets:[]}),runner:{async run(task){
    stages.push(task.logContext!.stage!);
    if(stages.length===1)return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}],source:repair});
    expect(task.prompt).toContain('verification never edits');
    return JSON.stringify({approved:true,findings:[]});
  }}});
  expect(stages).toEqual(['review','review']);expect(result).toBe(source);
});
test('invalid patches fall back to full regeneration, which must render and pass review',async()=>{
  const input=await fixture();let renders=0,patches=0,rewrites=0;
  const result=await reviewGeneratedScene({...input,renderFrames:async()=>{renders++;return {backend:'test',frames:[],sheets:[]};},runner:{async run(task){
    if(task.logContext?.stage==='repair'){
      if(task.outputMode==='text'){rewrites++;return repair;}
      patches++;return JSON.stringify({sourceSha256:'stale',edits:[]});
    }
    return JSON.stringify(renders===1?{approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}]}:{approved:true,findings:[]});
  }}});
  expect(result).toBe(repair);expect(patches).toBe(3);expect(rewrites).toBe(1);expect(renders).toBe(2);
});
test('compiler failure regenerates source within existing limits before review',async()=>{
  const input=await fixture();let rewrites=0,reviews=0;
  const result=await reviewGeneratedScene({...input,source:'export default scene({},s=>{while(true){};});',
    renderFrames:async()=>({backend:'test',frames:[],sheets:[]}),runner:{async run(task){
      if(task.logContext?.stage==='repair'){rewrites++;return repair;}
      reviews++;return JSON.stringify({approved:true,findings:[]});
    }}});
  expect(result).toBe(repair);expect(rewrites).toBe(1);expect(reviews).toBe(1);
});
test('restart resumes the last rejected candidate at repair without reauthoring',async()=>{
  const input=await fixture();const renderFrames=async()=>({backend:'test',frames:[],sheets:[]});
  await expect(reviewGeneratedScene({...input,renderFrames,runner:{async run(task){
    if(task.logContext?.stage==='repair')throw new Error('Interrupted');
    return JSON.stringify({approved:false,findings:[{timeSec:4,objectIds:['label'],problem:'Clipped',fix:'Move'}]});
  }}})).rejects.toThrow('Interrupted');
  const stages:string[]=[];
  const result=await reviewGeneratedScene({...input,renderFrames,runner:{async run(task){
    stages.push(task.logContext!.stage!);
    return task.logContext?.stage==='repair'
      ?JSON.stringify({sourceSha256:sourceHash(source),edits:[{finding:0,before:'[5,0]',after:'[0,0]'}]})
      :JSON.stringify({approved:true,findings:[]});
  }}});
  expect(result).toBe(repair);expect(stages).toEqual(['repair','review']);
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

test('visual cap survives restart without starting round 51',async()=>{
  const input=await fixture();
  await writeFile(join(input.directory,'scene-0.visual-state.json'),JSON.stringify({contextHash:sourceHash(JSON.stringify(input.input)),source,attempt:50,phase:'review',history:[]}));
  let calls=0;
  await expect(reviewGeneratedScene({...input,runner:{async run(){calls++;return '';}}})).rejects.toMatchObject({code:'RECOVERY_EXHAUSTED'});
  expect(calls).toBe(0);
});
