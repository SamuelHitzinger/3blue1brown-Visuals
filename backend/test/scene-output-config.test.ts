import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentConfig } from '../src/agents/config.js';
import { createPiGenerator } from '../src/agents/generator.js';
import type { AgentTask } from '../src/agents/runtime.js';
import type { PlannedLesson } from '../src/agents/planning.js';
import type { NarrationService } from '../src/narration/service.js';
import type { NarrationScenePackage } from '../src/narration/types.js';
import { parseModelGLB } from 'animlib/core';

test('scene output config preserves text by default and accepts explicit supported modes', () => {
  expect(agentConfig({}).sceneOutputMode).toBe('text');
  expect(agentConfig({ AGENT_SCENE_OUTPUT_MODE: 'text' }).sceneOutputMode).toBe('text');
  expect(agentConfig({ AGENT_SCENE_OUTPUT_MODE: 'validated-reference' }).sceneOutputMode).toBe('validated-reference');
});

test('scene output config rejects unsupported or misspelled completion protocols', () => {
  for (const value of ['', 'submit', 'submit-only', 'validated_reference', 'TEXT']) {
    expect(() => agentConfig({ AGENT_SCENE_OUTPUT_MODE: value })).toThrow('AGENT_SCENE_OUTPUT_MODE');
  }
});

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

const lesson: PlannedLesson = {
  schemaVersion: 1,
  markdown: '# Counting\n\n## Beat 1\n\nContent needed: Show one dot.\n\nNarration: One dot.',
  plan: {
    audience: 'Newcomer', prerequisites: [], learningGoal: 'Recognize one', centralQuestion: 'How many dots?',
    keyInsight: 'One dot is one object', runningExample: 'One dot', misconceptions: [], entities: [],
    scenes: [{ id: 'beat-1', purpose: 'Count one dot', whyNow: 'Complete one-object example', keyPoints: ['One dot'],
      visualDescription: 'Show one dot', endsWith: 'One dot remains', carry: [], cleanup: [], sourceRefs: [], interactions: [] }],
  },
};
const packet: NarrationScenePackage = {
  id: 'saved-narration', scriptHash: 'test-script-hash', totalScenes: 1,
  scenes: [{ id: 'beat-1', title: 'Counting', context: 'Show one dot.', startSec: 0, durationSec: 1,
    audio: { id: 'saved-narration.beat-1', url: '/unused.wav', sha256: 'test-audio-hash', sampleCount: 24000 },
    utterances: [{ id: 'beat-1.u1', role: 'narration', text: 'One dot.', spokenText: 'One dot.',
      source: { start: 0, end: 8, line: 7 }, startSec: 0, endSec: 1,
      words: [{ id: 'beat-1.u1.w1', utteranceId: 'beat-1.u1', text: 'One', startSec: 0, endSec: 0.4, characterRange: [0, 3] },
        { id: 'beat-1.u1.w2', utteranceId: 'beat-1.u1', text: 'dot.', startSec: 0.5, endSec: 1, characterRange: [4, 8] }],
      sentences: [{ id: 'beat-1.u1.s1', wordIds: ['beat-1.u1.w1', 'beat-1.u1.w2'], text: 'One dot.', startSec: 0, endSec: 1 }],
    }], pauses: [] }],
};

for (const outputMode of [undefined, 'text', 'validated-reference'] as const) {
  test(`generator scopes ${outputMode ?? 'default'} output mode to scenes, preserving editorial tasks`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'aha-scene-output-')); roots.push(root);
    const tasks: AgentTask[] = [];
    // Stop at the model boundary: no provider, speech synthesis, or audio fixtures are needed.
    const stoppedAtScene = new Error('Scene task captured');
    const narration = {
      available: true,
      async submit() { return { id: packet.id, status: 'complete' }; },
      async scenePackage() { return packet; },
    } as unknown as NarrationService;
    const runner = { async run(task: AgentTask) {
      tasks.push(task);
      if (task.prompt.startsWith('Write')) return JSON.stringify(lesson);
      if (task.prompt.startsWith('Review')) return JSON.stringify({ schemaVersion: 1, verdict: 'pass',
        summary: 'The example counts one object.', issues: [], checks: ['One dot represents one object.'] });
      throw stoppedAtScene;
    } };
    const generator = outputMode === undefined
      ? createPiGenerator(runner, narration, root)
      : createPiGenerator(runner, narration, root, { outputMode });
    await expect(generator({ title: 'Counting', topic: 'One dot', documents: [] }, 0,
      { videoId: crypto.randomUUID(), owner: 'test-owner', signal: new AbortController().signal })).rejects.toBe(stoppedAtScene);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].outputMode).toBeUndefined();
    expect(tasks[1].outputMode).toBeUndefined();
    expect(tasks[2].outputMode).toBe(outputMode ?? 'text');
    expect(tasks[2].validate).toBeFunction();
    expect(tasks[0].sceneTools).toBeUndefined();
    expect(tasks[1].sceneTools).toBeUndefined();
    expect(tasks[2].sceneTools?.inspect).toBeFunction();
    expect(tasks[2].sceneTools?.preview).toBeUndefined();
    expect(tasks[2].prompt).toContain('saved-narration.beat-1');
    for (const task of tasks) {
      expect(task.prompt).toContain('"modelCatalog":[]');
      expect(task.prompt).not.toContain('"fixtureId":"1crn-surface"');
      expect(task.systemPrompt).not.toContain('# Molecular planning');
      expect(task.systemPrompt).not.toContain('# Molecular scene craft');
    }
  });
}

test('scene agent publishes generated models, validates references and persists its asset manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aha-model-generation-')); roots.push(root);
  const prior = process.env.MODEL_ASSET_DIR; process.env.MODEL_ASSET_DIR = join(root, 'assets');
  const videoId=crypto.randomUUID(), signal=new AbortController().signal;
  let publishedId='';
  const stop=new Error('Published and validated');
  const narration={available:true,async submit(){return {id:packet.id,status:'complete'};},async scenePackage(){return packet;}} as unknown as NarrationService;
  const runner={async run(task:AgentTask){
    if(task.prompt.startsWith('Write'))return JSON.stringify(lesson);
    if(task.prompt.startsWith('Review'))return JSON.stringify({schemaVersion:1,verdict:'pass',summary:'Correct',issues:[],checks:['One object']});
    expect(task.publishModel).toBeFunction();
    const published=await task.publishModel!({generated:JSON.stringify({parts:[{name:'Panel',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],baseColor:[1,0,0,1]}]})},signal) as {id:string};
    publishedId=published.id;
    const input=JSON.parse(task.prompt.slice(task.prompt.indexOf('\n')+1));
    await task.validate!(`export default scene({audio:${JSON.stringify(input.audioAssetId)},end:${JSON.stringify(input.endMode)}},s=>{s.model('panel',{asset:${JSON.stringify(published.id)}});s.wait(${input.scene.durationSec});});`);
    throw stop;
  }};
  try {
    await expect(createPiGenerator(runner,narration,root)({title:'Counting',topic:'One dot',documents:[]},0,{videoId,owner:'test',signal})).rejects.toBe(stop);
    const saved=JSON.parse(await readFile(join(root,videoId,'model-assets.json'),'utf8'));
    expect(saved[publishedId].kind).toBe('model');expect(saved[publishedId].metadata.parts[0].name).toBe('Panel');
    expect((await readFile(join(root,'assets',`${saved[publishedId].sha256}.glb`))).byteLength).toBeGreaterThan(100);
  }finally{if(prior===undefined)delete process.env.MODEL_ASSET_DIR;else process.env.MODEL_ASSET_DIR=prior;}
});

test('bundled protein publication preserves scientific identity and is available after a job restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aha-protein-publication-')); roots.push(root);
  const prior = process.env.MODEL_ASSET_DIR; process.env.MODEL_ASSET_DIR = join(root, 'assets');
  const videoId=crypto.randomUUID(), signal=new AbortController().signal, stop=new Error('Protein inspected');
  const narration={available:true,async submit(){return {id:packet.id,status:'complete'};},async get(){return {id:packet.id,status:'complete'};},async scenePackage(){return packet;}} as unknown as NarrationService;
  let id='', runs=0;
  const runner={async run(task:AgentTask){
    if(task.prompt.startsWith('Write'))return JSON.stringify(lesson);
    if(task.prompt.startsWith('Review'))return JSON.stringify({schemaVersion:1,verdict:'pass',summary:'Correct',issues:[],checks:['One object']});
    const input=JSON.parse(task.prompt.slice(task.prompt.indexOf('\n')+1));
    if(runs++===0){
      const published=await task.publishModel!({fixtureId:'1crn-surface'} as Parameters<NonNullable<AgentTask['publishModel']>>[0],signal) as {id:string;context:{fixtureId:string;units:string;provenance:{sourceHash:string;fidelity:string}}};
      id=published.id;
      expect(published.context.fixtureId).toBe('1crn-surface');
      expect(published.context.units).toBe('angstrom');
      expect(published.context.provenance.sourceHash).toBe('42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811');
      expect(published.context.provenance.fidelity).toContain('schematic Gaussian envelope');
      await task.validate!(`export default scene({audio:${JSON.stringify(input.audioAssetId)},end:${JSON.stringify(input.endMode)}},s=>{const m=s.model('protein',{asset:${JSON.stringify(id)}});m.part('residue-0');s.wait(${input.scene.durationSec});});`);
    }else{
      expect(input.modelAssetContext[id].fixtureId).toBe('1crn-surface');
      expect(input.modelAssetContext[id].provenance.selection).toContain('chain A');
      expect(input.modelAssets[id].parts).toHaveLength(45);
    }
    throw stop;
  }};
  try{
    const request={title:'Counting',topic:'One dot',documents:[]};
    const context={videoId,owner:'test',signal};
    await expect(createPiGenerator(runner,narration,root)(request,0,context)).rejects.toBe(stop);
    const saved=JSON.parse(await readFile(join(root,videoId,'model-assets.json'),'utf8'));
    const parsed=await parseModelGLB(new Uint8Array(await readFile(join(root,'assets',`${saved[id].sha256}.glb`))));
    expect(parsed.metadata.parts).toHaveLength(45);
    expect(parsed.metadata.triangles).toBe(8676);
    expect(parsed.primitives.every(p=>p.geometry.shading==='smooth'&&p.geometry.normals?.length===p.geometry.vertices?.length)).toBe(true);
    await expect(createPiGenerator(runner,narration,root)(request,0,context)).rejects.toBe(stop);
  }finally{if(prior===undefined)delete process.env.MODEL_ASSET_DIR;else process.env.MODEL_ASSET_DIR=prior;}
});

test('model publication rejects unknown fixture selectors and mixed sources without attaching an asset', async () => {
  const root=await mkdtemp(join(tmpdir(),'aha-protein-selection-'));roots.push(root);
  const videoId=crypto.randomUUID(),signal=new AbortController().signal,stop=new Error('Selection checked');
  const narration={available:true,async submit(){return {id:packet.id,status:'complete'};},async scenePackage(){return packet;}} as unknown as NarrationService;
  const runner={async run(task:AgentTask){
    if(task.prompt.startsWith('Write'))return JSON.stringify(lesson);
    if(task.prompt.startsWith('Review'))return JSON.stringify({schemaVersion:1,verdict:'pass',summary:'Correct',issues:[],checks:['One object']});
    for(const fixtureId of ['../1crn-surface','1crn-surface.json','1bna'])await expect(task.publishModel!({fixtureId} as Parameters<NonNullable<AgentTask['publishModel']>>[0],signal)).rejects.toThrow('Unknown bundled model');
    await expect(task.publishModel!({fixtureId:'1crn-surface',generated:'{}'} as Parameters<NonNullable<AgentTask['publishModel']>>[0],signal)).rejects.toThrow('exactly one');
    await expect(task.publishModel!({fixtureId:'1crn-surface',url:'https://example.test/protein.glb'} as Parameters<NonNullable<AgentTask['publishModel']>>[0],signal)).rejects.toThrow('exactly one');
    throw stop;
  }};
  await expect(createPiGenerator(runner,narration,root)({title:'Counting',topic:'One dot',documents:[]},0,{videoId,owner:'test',signal})).rejects.toBe(stop);
  await expect(readFile(join(root,videoId,'model-assets.json'))).rejects.toMatchObject({code:'ENOENT'});
});

test('the same compact protein inventory reaches planning, review, repair and scene authoring', async () => {
  const root=await mkdtemp(join(tmpdir(),'aha-protein-inventory-'));roots.push(root);
  const tasks:AgentTask[]=[],stop=new Error('Inventory captured');let drafts=0;
  const molecularLesson = structuredClone(lesson);
  molecularLesson.markdown = '# Molecular structure\n\n## Beat 1\n\nContent needed: Compare molecular residue anchors and atoms.\n\nNarration: One protein.';
  Object.assign(molecularLesson.plan.scenes[0], { purpose: 'Compare molecular residue anchors and atoms',
    keyPoints: ['Protein molecular representation'], visualDescription: 'A molecular protein model with its residue anchors' });
  const narration={available:true,async submit(){return {id:packet.id,status:'complete'};},async scenePackage(){return packet;}} as unknown as NarrationService;
  const runner={async run(task:AgentTask){
    tasks.push(task);
    if(task.logContext?.stage==='draft'){drafts++;return JSON.stringify(molecularLesson);}
    if(task.logContext?.stage==='review')return JSON.stringify({schemaVersion:1,verdict:drafts===1?'revise':'pass',summary:'Use the structure accurately',issues:drafts===1?[{severity:'error',sceneId:'beat-1',detail:'Keep the distinction between residue anchors and atoms.'}]:[],checks:['Representation accuracy']});
    throw stop;
  }};
  await expect(createPiGenerator(runner,narration,root)({title:'Molecular structure',topic:'Compare molecular protein residue anchors with atoms',documents:[]},0,{videoId:crypto.randomUUID(),owner:'test',signal:new AbortController().signal})).rejects.toBe(stop);
  expect(tasks).toHaveLength(5);
  for(const task of tasks){
    expect(task.prompt).toContain('"fixtureId":"1crn-surface"');
    expect(task.prompt).toContain('"fixtureId":"1crn-sticks"');
    expect(task.prompt).toContain('"fixtureId":"1crn-beads"');
    expect(task.prompt).toContain('"units":"angstrom"');
    expect(task.prompt).toContain('"sourceHash":"42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811"');
    expect(task.prompt).not.toContain('"vertices":');
  }
});
