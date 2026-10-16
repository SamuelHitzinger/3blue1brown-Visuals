import { expect, test, spyOn } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertResponsesTools } from '../../node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js';
import type { AssistantMessage, AssistantMessageEvent, StreamOptions, ToolCall } from '@earendil-works/pi-ai';
import type { createModelRuntime } from '../src/agents/auth.js';
import * as probe from './realtime-tool-probe.js';
import { LiveWorld } from './realtime-world/world.js';
import { submissionTool, validateSubmission, acceptSubmission, preparePayload, submissionTrace, observeSubmission } from './realtime-tool-probe.js';

const source = 'export default scene({}, s => {\n  s.text("label", { text: "quoted \\\"word\\\"" });\n});';
const call = { type: 'toolCall' as const, id: 'call-1', name: 'submit_scene', arguments: { source } };

test('stream text and partial argument deltas cannot contaminate completed source or satisfy completion', () => {
  const trace = submissionTrace();
  const partial = { content: [] } as unknown as AssistantMessage;
  observeSubmission(trace, 'scene', { type: 'text_delta', contentIndex: 0, delta: 'Here is code: WRONG', partial }, 100);
  observeSubmission(trace, 'scene', { type: 'toolcall_delta', contentIndex: 1, delta: '{"source":"partial', partial }, 200);
  expect(trace.completed).toEqual([]);
  expect(trace.toolCallCompleteMs).toBeNull();
  observeSubmission(trace, 'scene', { type: 'toolcall_end', contentIndex: 1, toolCall: call, partial }, 700);
  observeSubmission(trace, 'scene', { type: 'text_delta', contentIndex: 2, delta: 'More commentary.', partial }, 800);
  expect(trace.commentary).toBe('Here is code: WRONGMore commentary.');
  expect(trace.toolCallCompleteMs).toBe(700);
  expect(trace.validToolCallCompleteMs).toBe(700);
  expect(acceptSubmission('scene', trace.completed, [call], true)).toEqual({ source });
  expect(() => acceptSubmission('scene', trace.completed, [call], false)).toThrow();
});

test('extracts exact source only from a completed call agreeing with the terminal message', () => {
  expect(acceptSubmission('scene', [call], [call], true)).toEqual({ source });
  expect(() => acceptSubmission('scene', [], [call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call, call], [call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [call, call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [{ ...call, id: 'different' }], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [{ ...call, arguments: { source: 'changed' } }], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [call], false)).toThrow();
  expect(() => acceptSubmission('scene', [{ ...call, name: 'other' }], [call], true)).toThrow();
});

test('closed bounded scene arguments reject extras, wrong types and prototype keys', () => {
  for (const args of [{}, { source: '' }, { source: 12 }, { source, commentary: 'extra' },
    { source: 'x'.repeat(256001) }, JSON.parse('{"source":"ok","__proto__":{}}')]) {
    expect(() => validateSubmission('scene', args)).toThrow();
  }
  expect(validateSubmission('scene', { source: '  exact whitespace  ' })).toEqual({ source: '  exact whitespace  ' });
});

test('brief is a closed causal record without a source answer or topic template', () => {
  const brief = { claim: 'Observed change', basis: 'image evidence-1', operation: 'move then compare',
    objects: [{ id: 'a', meaning: 'observed object' }], uncertainty: '' };
  expect(validateSubmission('brief', brief)).toEqual(brief);
  expect(() => validateSubmission('brief', { ...brief, source: 'code' })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, objects: [...brief.objects, ...brief.objects] })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, objects: [{ id: 'a', meaning: 'x', extra: true }] })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, basis: '' })).toThrow();
});

test('real Pi conversion sends strict closed JSON schema and a forced single tool', () => {
  for (const kind of ['scene', 'brief', 'world'] as const) {
    const tool = submissionTool(kind, 'require');
    const converted = convertResponsesTools([tool], { supportsStrictMode: true });
    const prepared = preparePayload({ tools: converted, tool_choice: 'required', parallel_tool_calls: true,
      service_tier: 'priority', reasoning: { effort: 'low' }, max_output_tokens: 2048,
      input: 'private prompt content must not be in metadata' }, kind, 'require', 'priority');
    expect(prepared.payload.parallel_tool_calls).toBe(false);
    expect(prepared.metadata.tools[0].strict).toBe(true);
    expect(prepared.metadata.tools[0].parameters.additionalProperties).toBe(false);
    expect(prepared.metadata.tools[0].parameters.required).toContain(kind === 'scene' ? 'source' : kind === 'world' ? 'action' : 'claim');
    if (kind === 'world') {
      expect(prepared.metadata.tools[0].parameters.required).toContain('reason');
      expect(prepared.metadata.tools[0].parameters.properties.action.enum).toEqual(['add','edit','defer']);
      expect(prepared.metadata.tools[0].parameters.properties.reason.maxLength).toBe(512);
    }
    expect(JSON.stringify(prepared.metadata)).not.toContain('private prompt');
    expect(() => preparePayload({ ...prepared.payload, service_tier: 'default' }, kind, 'require', 'priority')).toThrow();
    expect(() => preparePayload({ ...prepared.payload, tool_choice: 'auto' }, kind, 'require', 'priority')).toThrow();
    expect(() => preparePayload({ ...prepared.payload, tools: [{ ...converted[0], strict: false }] }, kind, 'require', 'priority')).toThrow();
  }
});

test('unknown model remains offline, writes immutable sanitized evidence and no accepted source', async () => {
  const directory = join(await mkdtemp(join(tmpdir(), 'aha-tool-probe-')), 'run');
  const cli = fileURLToPath(new URL('./realtime-tool-probe.ts', import.meta.url));
  const args = [process.execPath, cli, 'run', '--kind=scene', '--case=cube', '--model=offline-nonexistent-probe-model',
    '--thinking=low', '--service-tier=priority', `--out=${directory}`];
  const env = { ...process.env, AGENT_AUTH_MODE: 'api-key', AGENT_PROVIDER: 'openai', OPENAI_API_KEY: 'offline-test-placeholder' };
  const first = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await first.exited).toBe(1);
  const resultPath = join(directory, 'result.json');
  const before = await readFile(resultPath, 'utf8');
  const result = JSON.parse(before);
  expect(result.status).toBe('failed');
  expect(result.failure.code).toBe('MODEL');
  expect(result.requestElapsedMs).toBeNull();
  expect(result.toolCallCompleteMs).toBeNull();
  expect(result.providerTerminalMs).toBeNull();
  expect(result.submissionAccepted).toBe(false);
  expect(result.priorityConfirmed).toBe(false);
  expect(before).not.toContain('offline-test-placeholder');
  expect(await readFile(join(directory, 'commentary.txt'), 'utf8')).toBe('');
  const second = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await second.exited).toBe(1);
  expect(await readFile(resultPath, 'utf8')).toBe(before);
});

const terminalFor = (toolCall: ToolCall): AssistantMessage => ({
  role: 'assistant', content: [toolCall], api: 'openai-responses', provider: 'openai', model: 'offline-test-model',
  usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  stopReason: 'toolUse', timestamp: 0,
});
async function requestArgs(kind: 'scene' | 'brief' | 'world' = 'scene') {
  const parent = await mkdtemp(join(tmpdir(), 'aha-library-probe-')), directory = join(parent, 'run');
  const prompt = join(parent, 'prompt.txt');
  await writeFile(prompt, 'Evidence e1: one observed object changes position.');
  return { directory, args: ['run', `--kind=${kind}`, '--case=external', '--model=offline-test-model',
    '--thinking=low', '--service-tier=priority', `--out=${directory}`, `--prompt-file=${prompt}`] };
}
function runtimeFor(events: (options: StreamOptions) => AsyncIterable<AssistantMessageEvent>) {
  // Only the provider/runtime boundary is replaced; request validation and evidence writes remain real.
  return (async () => ({
    getModel: () => ({ id: 'offline-test-model', api: 'openai-responses', reasoning: true, maxTokens: 2048 }),
    stream: (_model: unknown, _context: unknown, options: StreamOptions) => events(options),
  })) as unknown as typeof createModelRuntime;
}

test('library pre-abort writes failed evidence without dispatch, stdout or exit-code mutation', async () => {
  expect(probe.runProbe).toBeFunction();
  const { directory, args } = await requestArgs(), controller = new AbortController();
  controller.abort(new Error('private abort detail'));
  let runtimeCalls = 0;
  const log = spyOn(console, 'log').mockImplementation(() => {}), exitBefore = process.exitCode;
  try {
    const result = await probe.runProbe(args, { signal: controller.signal, createRuntime: async () => {
      runtimeCalls++; throw new Error('Runtime must not be opened for pre-abort');
    } });
    expect(runtimeCalls).toBe(0);
    expect(result.report.submissionAccepted).toBe(false);
    expect(result.report.requestStartedAt).toBeNull();
    expect(result.submission).toBeNull();
    expect(result.submissionPath).toBeNull();
    expect(result.resultPath).toBe(join(directory, 'result.json'));
    expect(JSON.parse(await readFile(result.resultPath, 'utf8'))).toEqual(result.report);
    expect(JSON.stringify(result.report)).not.toContain('private abort detail');
    expect(log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(exitBefore);
  } finally { log.mockRestore(); process.exitCode = exitBefore; }
});

const worldSource = 'export default scene({end:"hold",orbit:false},s=>{s.circle("dot",{radius:.2,fill:"BLUE"});s.circle("old",{radius:.1});s.wait(8)});';
const addWorld = { action: 'add' as const, reason: '', source: worldSource, changes: [], remove: [] };
const propsWire = (props: Record<string, unknown> = {}) => ({ position: null, rotation: null, scale: null, opacity: null, fill: null, ...props });
const editWorld = { action: 'edit' as const, reason: '', source: '', changes: [{ id: 'dot', props: propsWire({ position: [2,0,0], fill: 'TEAL' }), duration: 2 }], remove: ['old'] };
const deferWorld = { action: 'defer' as const, reason: 'Evidence e1 does not identify what moved or its destination.', source: '', changes: [], remove: [] };
const speechAnchor = {evidenceId:'chunk-0001',version:2,phrase:'moves to the right',occurrence:null,utteranceId:null};
const emptySpeechAnchor = {evidenceId:null,version:null,phrase:null,occurrence:null,utteranceId:null};

test('speech anchor schema is an opt-in strict object with null scalar sentinel and unchanged legacy world contract', () => {
  const legacy=submissionTool('world'),anchored=submissionTool('world','require',true);
  const parameters=anchored.parameters as Record<string,any>;
  expect((legacy.parameters as Record<string,any>).properties).not.toHaveProperty('speechAnchor');
  expect(parameters.required).toContain('speechAnchor');
  expect(parameters.properties.speechAnchor.type).toBe('object');
  expect(parameters.properties.speechAnchor.properties.evidenceId.type).toEqual(['string','null']);
  expect(parameters.properties.speechAnchor.required).toEqual(['evidenceId','version','phrase','occurrence','utteranceId']);
  const converted=convertResponsesTools([anchored],{supportsStrictMode:true});
  const payload={tools:converted,tool_choice:'required',service_tier:'priority'};
  expect(preparePayload(payload,'world','require','priority',true).metadata.tools[0].parameters).toEqual(parameters);
  expect(()=>preparePayload(payload,'world','require','priority')).toThrow('schema');
  expect(()=>submissionTool('scene','require',true)).toThrow();
});

test('speech anchors preserve exact qualified identity and reject invalid, ambiguous wire shapes', () => {
  const anchored={...addWorld,speechAnchor};
  expect(validateSubmission('world',anchored,true)).toMatchObject({action:'add',speechAnchor});
  expect(validateSubmission('world',{...editWorld,speechAnchor:emptySpeechAnchor},true)).toHaveProperty('speechAnchor',null);
  expect(validateSubmission('world',{...deferWorld,speechAnchor:emptySpeechAnchor},true)).toMatchObject({...deferWorld,speechAnchor:null});
  expect(()=>validateSubmission('world',anchored)).toThrow();
  expect(()=>validateSubmission('world',addWorld,true)).toThrow();
  expect(()=>validateSubmission('world',{...deferWorld,speechAnchor},true)).toThrow();
  const badAnchors=[null,{},[],{...emptySpeechAnchor,phrase:'partial sentinel'},{...speechAnchor,extra:1},{...speechAnchor,evidenceId:'bad id'},{...speechAnchor,evidenceId:'x'.repeat(193)},
    {...speechAnchor,version:0},{...speechAnchor,version:1.2},{...speechAnchor,version:Number.MAX_SAFE_INTEGER+1},
    {...speechAnchor,phrase:''},{...speechAnchor,phrase:'é'.repeat(501)},
    {...speechAnchor,occurrence:0},{...speechAnchor,occurrence:1.5},{...speechAnchor,occurrence:10001},
    {...speechAnchor,utteranceId:''},{...speechAnchor,utteranceId:'x'.repeat(193)}];
  for(const anchor of badAnchors)expect(()=>validateSubmission('world',{...addWorld,speechAnchor:anchor},true)).toThrow();
  const wire={...call,name:'submit_world',arguments:anchored};
  const trace=submissionTrace();
  observeSubmission(trace,'world',{type:'toolcall_end',contentIndex:0,toolCall:wire,partial:terminalFor(wire)},250,true);
  expect(trace.validToolCallCompleteMs).toBe(250);
  expect(acceptSubmission('world',trace.completed,[wire],true,true)).toMatchObject({speechAnchor});
  expect(()=>acceptSubmission('world',trace.completed,[{...wire,arguments:{...anchored,speechAnchor:{...speechAnchor,version:3}}}],true,true)).toThrow();
});

test('opt-in library request records anchored schema and preserves accepted speech anchor without provider access', async () => {
  const {directory,args}=await requestArgs('world'),system=join(directory,'..','system.txt');
  await writeFile(system,'Use measured speech evidence.');
  const wire={...call,name:'submit_world',arguments:{...addWorld,speechAnchor}},message=terminalFor(wire);
  const result=await probe.runProbe([...args,`--system-file=${system}`],{speechAnchors:true,createRuntime:runtimeFor(async function*(options){
    const tools=convertResponsesTools([submissionTool('world','require',true)],{supportsStrictMode:true});
    await options.onPayload!({tools,tool_choice:'required',service_tier:'priority'},{} as Parameters<NonNullable<StreamOptions['onPayload']>>[1]);
    yield {type:'toolcall_end',contentIndex:0,toolCall:wire,partial:message};
    yield {type:'done',reason:'toolUse',message};
  })});
  expect(result.report.submissionAccepted).toBe(true);expect(result.report.validToolCallCompleteMs).not.toBeNull();
  expect(result.submission).toMatchObject({speechAnchor});
  expect(result.report).toHaveProperty('speechAnchors',true);
  expect(JSON.parse(await readFile(join(directory,'started.json'),'utf8'))).toHaveProperty('speechAnchors',true);
  expect(JSON.parse(await readFile(join(directory,'world.json'),'utf8'))).toMatchObject({speechAnchor});
});

test('world validates one branch and normalizes only nullable native patch fields', () => {
  const {reason: _reason, ...normalizedAdd} = addWorld;
  expect(validateSubmission('world', addWorld)).toEqual(normalizedAdd);
  expect(validateSubmission('world', editWorld)).toEqual({ action: 'edit', source: '',
    changes: [{ id: 'dot', props: { position: [2,0,0], fill: 'TEAL' }, duration: 2 }], remove: ['old'] });
  const worldCall = { ...call, name: 'submit_world', arguments: editWorld as ToolCall['arguments'] };
  expect(acceptSubmission('world', [worldCall], [worldCall], true)).toEqual(validateSubmission('world', editWorld));
  const reordered = { ...worldCall, arguments: { source: '', action: 'edit', reason: '', changes: editWorld.changes, remove: ['old'] } as ToolCall['arguments'] };
  expect(() => acceptSubmission('world', [worldCall], [reordered], true)).toThrow();
});

test('world rejects branch mixing, unsupported properties, malformed bounds and duplicate identities', () => {
  const change = (props: Record<string, unknown>, extra = {}) => ({ ...editWorld, remove: [], changes: [{ id: 'dot', props: propsWire(props), duration: 0, ...extra }] });
  for (const invalid of [
    { ...addWorld, changes: editWorld.changes }, { ...addWorld, remove: ['old'] }, { ...addWorld, source: '' },
    { ...addWorld, source: 'x'.repeat(128001) }, { ...addWorld, action: 'both' }, { ...addWorld, baseRevision: 0 },
    { ...editWorld, source: worldSource }, { ...editWorld, changes: [], remove: [] },
    { ...editWorld, changes: [...editWorld.changes, ...editWorld.changes] }, { ...editWorld, remove: ['old','old'] },
    { ...editWorld, remove: ['dot'] }, { ...editWorld, remove: ['@bad'] },
    { ...editWorld, changes: Array.from({length:257},(_,i)=>({...editWorld.changes[0],id:'d'+i})) },
    { ...editWorld, remove: Array.from({length:257},(_,i)=>'d'+i) },
    change({}), change({radius:1}), change({position:[0,0]}), change({position:[0,0,NaN]}), change({rotation:[0,Infinity,0]}),
    change({position:[1000001,0,0]}), change({scale:-1}), change({scale:1000001}), change({opacity:1.01}),
    change({fill:'#ff0000'}), change({fill:{color:'BLUE',opacity:.5}}), change({scale:1},{duration:61}),
    change({scale:1},{duration:NaN}), change({scale:1},{id:'bad id'}), change({scale:1},{extra:1}),
    {...editWorld,changes:[{id:'dot',props:{position:[0,0,0]},duration:0}]},
    JSON.parse('{"action":"edit","source":"","changes":[],"remove":["old"],"__proto__":{}}'),
  ]) expect(() => validateSubmission('world', invalid)).toThrow();
  expect(validateSubmission('world', {action:'edit',reason:'',source:'',changes:[],remove:['old']})).toEqual({action:'edit',source:'',changes:[],remove:['old']});
});

test('world deferral requires a bounded evidence reason, empty operation and exact terminal agreement', () => {
  expect(validateSubmission('world', deferWorld)).toEqual(deferWorld);
  const boundaryReason = {...deferWorld,reason:'é'.repeat(256)};
  expect(validateSubmission('world', boundaryReason)).toEqual(boundaryReason);
  for (const invalid of [
    {...deferWorld,reason:''}, {...deferWorld,reason:'  '}, {...deferWorld,reason:123},
    {...deferWorld,reason:'é'.repeat(257)}, {...deferWorld,reason:'x'.repeat(513)},
    {...deferWorld,source:worldSource}, {...deferWorld,changes:editWorld.changes}, {...deferWorld,remove:['old']},
    {...deferWorld,extra:true}, {...addWorld,reason:'unknown'}, {...editWorld,reason:' '},
    {action:'defer',source:'',changes:[],remove:[]}, {action:'add',source:worldSource,changes:[],remove:[]},
  ]) expect(()=>validateSubmission('world',invalid)).toThrow();
  const deferred = {...call,name:'submit_world',arguments:deferWorld};
  expect(acceptSubmission('world',[deferred],[deferred],true)).toEqual(deferWorld);
  expect(()=>acceptSubmission('world',[deferred],[{...deferred,arguments:{...deferWorld,reason:'Changed reason'}}],true)).toThrow();
  expect(()=>acceptSubmission('world',[deferred],[deferred],false)).toThrow();
  expect(()=>acceptSubmission('world',[deferred,deferred],[deferred],true)).toThrow();
});

for (const cancelled of [false,true]) test(`world deferral receipt preserves evidence and terminal cancellation=${cancelled}`, async () => {
  const {directory,args}=await requestArgs('world'), system=join(directory,'..','system.txt'), controller=new AbortController();
  await writeFile(system,'Defer when incoming evidence is insufficient.');
  const deferred={...call,name:'submit_world',arguments:deferWorld}, message=terminalFor(deferred);
  const result=await probe.runProbe([...args,`--system-file=${system}`],{signal:controller.signal,createRuntime:runtimeFor(async function*(){
    yield {type:'toolcall_end',contentIndex:0,toolCall:deferred,partial:message};
    yield {type:'done',reason:'toolUse',message};
    if(cancelled)controller.abort();
  })});
  expect(result.report.submissionAccepted).toBe(!cancelled);
  expect(result.report.worldOperation).toBe(cancelled?null:'defer');
  expect(result.report.action).toBe('create');
  expect(result.submission).toEqual(cancelled?null:deferWorld);
  expect(JSON.parse(await readFile(join(directory,'completed-tool-calls.json'),'utf8'))[0].arguments).toEqual(deferWorld);
  expect(await readFile(join(directory,'source.js'),'utf8').catch(e=>e.code)).toBe('ENOENT');
  if(cancelled){
    expect(result.report.status).toBe('failed');
    expect(await readFile(join(directory,'world.json'),'utf8').catch(e=>e.code)).toBe('ENOENT');
  }else{
    expect(result.report.status).toBe('complete');
    expect(JSON.parse(await readFile(join(directory,'world.json'),'utf8'))).toEqual(deferWorld);
    expect(JSON.parse(await readFile(result.submissionPath!,'utf8'))).toEqual(deferWorld);
    expect(Object.isFrozen(result.submission)).toBe(true);
  }
});

test('world requires external evidence and system instructions before opening a runtime', async () => {
  const { args } = await requestArgs('world');
  const options = { createRuntime: async () => { throw new Error('Runtime must not be opened'); } };
  await expect(probe.runProbe(args, options)).rejects.toMatchObject({code:'CONFIG'});
  await expect(probe.runProbe(args.map(v=>v==='--case=external'?'--case=cube':v), options)).rejects.toMatchObject({code:'CONFIG'});
});

test('accepted world evidence stays separate and exact native add/edit fixtures run in LiveWorld', async () => {
  Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
  const world = new LiveWorld({clock:()=>0});
  try {
    for (const wire of [addWorld,editWorld]) {
      const { directory, args } = await requestArgs('world'), system = join(directory,'..','system.txt');
      await writeFile(system,'Use the provided native scene API and stable world IDs.');
      const worldCall = { ...call, name:'submit_world', arguments:wire as ToolCall['arguments'] }, message=terminalFor(worldCall);
      const result=await probe.runProbe([...args,`--system-file=${system}`],{createRuntime:runtimeFor(async function*(){
        yield {type:'toolcall_end',contentIndex:0,toolCall:worldCall,partial:message};yield {type:'done',reason:'toolUse',message};
      })});
      expect(result.report.status).toBe('complete');
      expect(result.report.format).toBe('world-operation');
      expect(result.report.worldOperation).toBe(wire.action);
      expect(result.report.action).toBe('create');
      expect(JSON.parse(await readFile(join(directory,'completed-tool-calls.json'),'utf8'))[0].arguments).toEqual(wire);
      expect(JSON.parse(await readFile(join(directory,'world.json'),'utf8'))).toEqual(result.submission);
      expect(await readFile(join(directory,'source.js'),'utf8').catch(error=>error.code)).toBe('ENOENT');
      expect(await readFile(join(directory,'brief.json'),'utf8').catch(error=>error.code)).toBe('ENOENT');
      const accepted=structuredClone(result.submission) as probe.WorldSubmission | null;
      if(!accepted||!('action' in accepted))throw Error('Expected world submission');
      if(accepted.action==='add')await world.addProgram({id:'program-1',source:accepted.source,baseRevision:world.revision},0);
      else if(accepted.action==='edit')await world.apply({baseRevision:world.revision,changes:accepted.changes,remove:accepted.remove},0);
      else throw Error('Unexpected deferral');
    }
    const halfway=await world.sample(1),end=await world.sample(2);
    expect(halfway.elements.find(e=>e.id==='dot')!.position).toEqual([1,0,0]);
    expect(end.elements.find(e=>e.id==='dot')!.position).toEqual([2,0,0]);
    expect(end.elements.find(e=>e.id==='dot')!.fill).toBe('TEAL');
    expect(end.elements.some(e=>e.id==='old')).toBe(false);
    expect(world.revision).toBe(2);
    await expect(world.apply({baseRevision:2,changes:[{id:'missing',props:{opacity:0}}]},2)).rejects.toThrow();
    expect(world.revision).toBe(2);
  } finally { world.dispose(); }
});

for (const at of ['completed-call', 'terminal'] as const) test(`library rejects cancellation after ${at}, including a late successful provider response`, async () => {
  expect(probe.runProbe).toBeFunction();
  const { directory, args } = await requestArgs(), controller = new AbortController();
  let providerSignal: AbortSignal | undefined;
  const message = terminalFor(call);
  const result = await probe.runProbe(args, { signal: controller.signal, createRuntime: runtimeFor(async function* (options) {
    providerSignal = options.signal;
    yield { type: 'toolcall_end', contentIndex: 0, toolCall: call, partial: message };
    if (at === 'completed-call') controller.abort();
    // Intentionally simulate an adapter ignoring cancellation and completing late.
    yield { type: 'done', reason: 'toolUse', message };
    if (at === 'terminal') controller.abort();
  }) });
  expect(providerSignal?.aborted).toBe(true);
  expect(result.report.status).toBe('failed');
  expect(result.report.providerComplete).toBe(false);
  expect(result.report.submissionAccepted).toBe(false);
  expect(result.report.completedToolCalls).toBe(1);
  expect(result.submission).toBeNull();
  expect(result.submissionPath).toBeNull();
  expect(await readFile(join(directory, 'source.js'), 'utf8').catch(error => error.code)).toBe('ENOENT');
  expect(await readFile(join(directory, 'submission.json'), 'utf8').catch(error => error.code)).toBe('ENOENT');
});

for (const kind of ['scene', 'brief'] as const) test(`library returns deeply immutable accepted ${kind} and matching existing evidence`, async () => {
  expect(probe.runProbe).toBeFunction();
  const { directory, args } = await requestArgs(kind), controller = new AbortController();
  const argsValue: ToolCall['arguments'] = kind === 'scene' ? { source } : { claim: 'Observed motion', basis: 'e1', operation: 'move',
    objects: [{ id: 'a', meaning: 'observed object' }], uncertainty: '' };
  const submitted = { ...call, name: `submit_${kind}`, arguments: argsValue }, message = terminalFor(submitted);
  const log = spyOn(console, 'log').mockImplementation(() => {}), exitBefore = process.exitCode;
  try {
    const result = await probe.runProbe(args, { signal: controller.signal, createRuntime: runtimeFor(async function* (options) {
      expect(options.signal).not.toBe(controller.signal);
      expect(options.maxRetries).toBe(0);
      yield { type: 'toolcall_end', contentIndex: 0, toolCall: submitted, partial: message };
      yield { type: 'done', reason: 'toolUse', message };
    }) });
    expect(result.report.status).toBe('complete');
    expect(result.report.submissionAccepted).toBe(true);
    expect<unknown>(result.submission).toEqual(argsValue);
    expect(result.submissionPath).toBe(join(directory, 'submission.json'));
    expect(JSON.parse(await readFile(result.submissionPath!, 'utf8'))).toEqual(argsValue);
    expect(JSON.parse(await readFile(result.resultPath, 'utf8'))).toEqual(result.report);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.report.sourceHashes)).toBe(true);
    expect(Object.isFrozen(result.submission)).toBe(true);
    if (result.submission && 'objects' in result.submission) {
      expect(Object.isFrozen(result.submission.objects)).toBe(true);
      expect(Object.isFrozen(result.submission.objects[0])).toBe(true);
    }
    expect(log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(exitBefore);
  } finally { log.mockRestore(); process.exitCode = exitBefore; }
});

test('library external signal does not replace the request timeout', async () => {
  const { args } = await requestArgs(), controller = new AbortController(), message = terminalFor(call);
  let providerSignal: AbortSignal | undefined;
  const result = await probe.runProbe([...args, '--timeout-ms=100'], { signal: controller.signal,
    createRuntime: runtimeFor(async function* (options) {
      providerSignal = options.signal;
      yield { type: 'toolcall_end', contentIndex: 0, toolCall: call, partial: message };
      await new Promise(resolve => setTimeout(resolve, 130));
      yield { type: 'done', reason: 'toolUse', message };
    }) });
  expect(controller.signal.aborted).toBe(false);
  expect(providerSignal?.aborted).toBe(true);
  expect(result.report.status).toBe('failed');
  expect(result.submission).toBeNull();
});

const parametersWorld={action:'parameters',reason:'',source:'',changes:[],remove:[],parameterProgramId:'surface-program',
  parameterValues:[{id:'amplitude',value:-0.5},{id:'phase',value:0}]};
const emptyParameters={parameterProgramId:'',parameterValues:[]};

test('retained parameters are opt-in and preserve the legacy schema and operations',()=>{
  const legacy=submissionTool('world').parameters as any, enabled=submissionTool('world','require',false,true);
  expect(legacy.properties.action.enum).toEqual(['add','edit','defer']);
  expect(legacy.properties.parameterValues).toBeUndefined();
  expect((enabled.parameters as any).properties.action.enum).toEqual(['add','edit','defer','parameters']);
  const tools=convertResponsesTools([enabled],{supportsStrictMode:true});
  expect(preparePayload({tools,tool_choice:'required',service_tier:'priority'},'world','require','priority',false,true).payload.parallel_tool_calls).toBe(false);
  expect(()=>preparePayload({tools,tool_choice:'required',service_tier:'priority'},'world','require','priority')).toThrow();
  expect(()=>validateSubmission('world',parametersWorld)).toThrow();
  for(const wire of [addWorld,editWorld,deferWorld]){
    expect(()=>validateSubmission('world',wire,false,true)).toThrow();
    const expected=validateSubmission('world',wire);
    expect(validateSubmission('world',{...wire,...emptyParameters},false,true)).toEqual({...expected,...emptyParameters});
    expect(()=>validateSubmission('world',{...wire,...emptyParameters,parameterProgramId:'program'},false,true)).toThrow();
    expect(()=>validateSubmission('world',{...wire,...emptyParameters,parameterValues:[{id:'x',value:1}]},false,true)).toThrow();
  }
  for(const kind of ['scene','brief'] as const){
    expect(()=>submissionTool(kind,'require',false,true)).toThrow();
    expect(()=>validateSubmission(kind,{},false,true)).toThrow();
  }
});

test('parameter branch accepts one bounded plain numeric batch and rejects mixed or unsafe input',()=>{
  const {reason,...expected}=parametersWorld;
  expect(validateSubmission('world',parametersWorld,false,true)).toEqual(expected);
  expect(validateSubmission('world',{...parametersWorld,speechAnchor},true,true)).toEqual({...expected,speechAnchor});
  expect(validateSubmission('world',{...parametersWorld,parameterValues:Array.from({length:32},(_,i)=>({id:`p${i}`,value:i}))},false,true)).toMatchObject({action:'parameters'});
  for(const patch of [
    {parameterProgramId:''},{parameterProgramId:'bad id'},{parameterProgramId:'x'.repeat(129)},
    {parameterValues:[]},{parameterValues:Array.from({length:33},(_,i)=>({id:`p${i}`,value:i}))},
    {parameterValues:[{id:'x',value:1},{id:'x',value:2}]},{parameterValues:[{id:'bad id',value:1}]},
    {parameterValues:[{id:'',value:1}]},{parameterValues:[{id:'x',value:'1'}]},
    ...[NaN,Infinity,-Infinity].map(value=>({parameterValues:[{id:'x',value}]})),
    {parameterValues:[{id:'x',value:1,extra:true}]},{parameterValues:Array(1)},
    {source:worldSource},{reason:'change it'},{changes:editWorld.changes},{remove:['old']},
    {parameterValues:[Object.assign(Object.create({inherited:true}),{id:'x',value:1})]},
  ])expect(()=>validateSubmission('world',{...parametersWorld,...patch},false,true)).toThrow();
  let reads=0;
  const accessor={id:'x',get value(){reads++;return 1;}};
  expect(()=>validateSubmission('world',{...parametersWorld,parameterValues:[accessor]},false,true)).toThrow();
  expect(reads).toBe(0);
});

test('parameter receipt requires exact completed and terminal values',()=>{
  const wire={...call,name:'submit_world',arguments:parametersWorld};
  expect(acceptSubmission('world',[wire],[wire],true,false,true)).toMatchObject({action:'parameters',parameterValues:parametersWorld.parameterValues});
  expect(()=>acceptSubmission('world',[wire],[{...wire,arguments:{...parametersWorld,parameterValues:[{id:'amplitude',value:0.5}]}}],true,false,true)).toThrow();
  expect(()=>acceptSubmission('world',[wire],[wire],false,false,true)).toThrow();
});

test('runProbe carries parameter opt-in through strict adapter, observation, acceptance and immutable evidence',async()=>{
  const {directory,args}=await requestArgs('world'),system=join(directory,'..','system.txt');
  await writeFile(system,'Use host-exposed numeric parameters.');
  const wire={...call,name:'submit_world',arguments:{...parametersWorld,speechAnchor}},message=terminalFor(wire);
  const result=await probe.runProbe([...args,`--system-file=${system}`],{retainedParameters:true,speechAnchors:true,
    createRuntime:runtimeFor(async function*(options){
      const tools=convertResponsesTools([submissionTool('world','require',true,true)],{supportsStrictMode:true});
      await options.onPayload!({tools,tool_choice:'required',service_tier:'priority'},{} as Parameters<NonNullable<StreamOptions['onPayload']>>[1]);
      yield {type:'toolcall_end',contentIndex:0,toolCall:wire,partial:message};
      yield {type:'done',reason:'toolUse',message};
    })});
  expect(result.report.status).toBe('complete');
  expect(result.report.validToolCallCompleteMs).toBeNumber();
  expect(result.report.worldOperation).toBe('parameters');
  expect(result.report.retainedParameters).toBe(true);
  expect(result.submission).toMatchObject({action:'parameters',parameterProgramId:'surface-program',parameterValues:parametersWorld.parameterValues,speechAnchor});
  expect(Object.isFrozen((result.submission as any).parameterValues[0])).toBe(true);
  expect(JSON.parse(await readFile(join(directory,'world.json'),'utf8'))).toEqual(result.submission);
  expect(JSON.parse(await readFile(join(directory,'started.json'),'utf8')).retainedParameters).toBe(true);
  expect(JSON.parse(await readFile(join(directory,'prompt.json'),'utf8')).systemPrompt).toContain('parameterProgramId');
});

test('runProbe rejects invalid parameter options before opening a runtime',async()=>{
  let opened=false;
  const createRuntime=(async()=>{opened=true;throw new Error('Must not dispatch');}) as typeof createModelRuntime;
  for(const kind of ['scene','brief'] as const){
    const {args}=await requestArgs(kind);
    await expect(probe.runProbe(args,{retainedParameters:true,createRuntime})).rejects.toMatchObject({code:'CONFIG'});
  }
  const {args}=await requestArgs('world');
  await expect(probe.runProbe(args,{retainedParameters:'yes' as unknown as boolean,createRuntime})).rejects.toMatchObject({code:'CONFIG'});
  expect(opened).toBe(false);
});
