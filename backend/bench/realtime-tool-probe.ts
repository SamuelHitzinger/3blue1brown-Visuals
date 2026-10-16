/** One structured model submission; no agent loop, execution, retry, repair or quality claim. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Type } from 'typebox';
import type { Model, AssistantMessage, AssistantMessageEvent, StreamOptions, ImageContent, TextContent, Tool, ToolCall } from '@earendil-works/pi-ai';
import { createModelRuntime } from '../src/agents/auth.js';
import { agentConfig, AgentError } from '../src/agents/config.js';
import { safeFailure } from './realtime-probe/metrics.js';
import { buildPrompt, cases } from './realtime-probe/prompts.js';
import type { ProbeCase } from './realtime-probe/prompts.js';
import { WORLD_LIMITS } from './realtime-world/world.js';
import type { WorldPatch } from './realtime-world/world.js';
import { Color, validateColor } from '../../shared/animlib/src/palette.js';

type Kind = 'scene' | 'brief' | 'world';
type Strict = 'require' | 'prefer';
type SceneSubmission = { source: string };
type BriefSubmission = { claim: string; basis: string; operation: string; objects: { id: string; meaning: string }[]; uncertainty: string };
type WorldChange = { id: string; props: Pick<WorldPatch['changes'][number]['props'], 'position' | 'rotation' | 'scale' | 'opacity' | 'fill'>; duration: number };
/** Normalized native properties: required wire nulls are omitted here, never interpreted as values. */
export interface SpeechAnchor { evidenceId:string;version:number;phrase:string;occurrence:number|null;utteranceId:string|null }
export interface WorldParameterValue { id:string;value:number }
export interface WorldMotionChange { id:string;velocity:[number,number,number] }
type EmptyParameters={parameterProgramId?:'';parameterValues?:[]};
type EmptyProgressive={motionChanges?:[];replacementProgramId?:''};
export type WorldSubmission = ((({ action: 'add'; source: string; changes: []; remove: [] }
  | { action: 'edit'; source: ''; changes: WorldChange[]; remove: string[] }
  | { action: 'defer'; reason: string; source: ''; changes: []; remove: [] }) & EmptyParameters
  | {action:'parameters';source:'';changes:[];remove:[];parameterProgramId:string;parameterValues:WorldParameterValue[]}) & EmptyProgressive
  | ({action:'motion';source:'';changes:[];remove:[];motionChanges:WorldMotionChange[];replacementProgramId:''}
  | {action:'replace';source:string;changes:[];remove:[];motionChanges:[];replacementProgramId:string}) & EmptyParameters) & {speechAnchor?:SpeechAnchor|null};
type Submission = SceneSubmission | BriefSubmission | WorldSubmission;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2), { flag: 'wx' });
const nameFor = (kind: Kind) => `submit_${kind}`;
const help = 'run --kind=scene|brief|world --model=ID --thinking=off|minimal|low|medium|high|xhigh|max --service-tier=priority|default --out=NEW_DIRECTORY [--case=cube|curve|diagram|external] [--action=create|edit] [--strict=require|prefer] [--prompt-file=PATH] [--system-file=PATH] [--image=PNG_OR_JPEG] [--timeout-ms=90000] [--max-tokens=2048]. Case defaults to cube, action to create, kind to scene, strict to require. External and brief require prompt-file. World requires case=external, prompt-file and system-file. This makes exactly one real request and never executes the result.';

const evidenceIdPattern='^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,191}$';
const parameterContract=' With retained parameters enabled, parameters is a separate branch: set parameterProgramId to one supplied program ID and parameterValues to 1–32 unique {id,value} entries using only host-exposed numeric parameter IDs and bounds. This applies immediately and atomically; source/reason must be empty and changes/remove empty. For add/edit/defer, parameterProgramId must be empty and parameterValues empty. Never infer control IDs or change source, native properties, and parameters in one operation.';
const progressiveContract=' With progressive world enabled, create known objects immediately without inventing unknown properties. All branches require motionChanges and replacementProgramId. For add/edit/defer/parameters keep motionChanges empty and replacementProgramId empty. motion sets 1–32 unique existing IDs with velocity [x,y,z] in local coordinates per host second, starting from each current pose at actual commit; zero velocity stops motion. Its source/reason, changes/remove, replacementProgramId and parameter fields must be empty. replace supplies complete native source and exact existing replacementProgramId, preserving that program ID, original epoch and unrelated world; reason, changes/remove, motionChanges and parameter fields must be empty. Use replacement when new geometry or behavior cannot fit existing controls. Speech-grounded motion/replace use the same supplied speech-anchor contract when enabled. Never combine branches.';
function checkSourceBudget(kind:Kind,sourceMaxChars?:number):void{
  if(sourceMaxChars!==undefined&&(kind==='brief'||!Number.isInteger(sourceMaxChars)||sourceMaxChars<64||sourceMaxChars>WORLD_LIMITS.sourceBytes))
    throw new AgentError('CONFIG',`Source budget requires scene/world and an integer from 64 to ${WORLD_LIMITS.sourceBytes}.`);
}
function checkExistingIds(kind:Kind,ids?:readonly string[]):void{
  if(ids!==undefined&&(kind!=='world'||!Array.isArray(ids)||ids.length>4096||new Set(ids).size!==ids.length
    ||!Array.from(ids).every(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(id))))
    throw new AgentError('CONFIG','Existing entity IDs require a world submission and at most 4096 unique valid IDs.');
}
function worldSchema(speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]) {
  const id = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$' });
  const targetId=existingEntityIds?.length?Type.String({pattern:'^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$',enum:[...existingEntityIds]}):id;
  // Pi rejects structured anyOf unions; nullable type arrays preserve its strict subset.
  const vector = Type.Unsafe({ type: ['array','null'], items: {type:'number',minimum:-1e6,maximum:1e6}, minItems:3, maxItems:3 });
  const scalar = (max: number) => Type.Unsafe({ type:['number','null'], minimum:0, maximum:max });
  return Type.Object({
    action: Type.String({enum:['add','edit','defer',...(retainedParameters?['parameters']:[]),...(progressiveWorld?['motion','replace']:[])]}), reason: Type.String({maxLength:512}), source: Type.String({maxLength:sourceMaxChars??WORLD_LIMITS.sourceBytes}),
    changes: Type.Array(Type.Object({ id:targetId, props: Type.Object({
      position:vector, rotation:vector, scale:scalar(1e6), opacity:scalar(1),
      fill:Type.Unsafe({type:['string','null'],enum:[...Object.values(Color),null]}),
    },{additionalProperties:false}), duration:Type.Number({minimum:0,maximum:60}) },{additionalProperties:false}),{maxItems:WORLD_LIMITS.changes}),
    remove:Type.Array(targetId,{maxItems:WORLD_LIMITS.changes}),
    ...(progressiveWorld?{
      motionChanges:Type.Array(Type.Object({id:targetId,velocity:Type.Array(Type.Number({minimum:-1e6,maximum:1e6}),{minItems:3,maxItems:3})},{additionalProperties:false}),{maxItems:32}),
      replacementProgramId:Type.String({pattern:'^(?:[A-Za-z0-9][A-Za-z0-9_./-]{0,127})?$'}),
    }:{}),
    ...(retainedParameters?{
      parameterProgramId:Type.String({pattern:'^(?:[A-Za-z0-9][A-Za-z0-9_./-]{0,127})?$'}),
      parameterValues:Type.Array(Type.Object({id,value:Type.Number()},{additionalProperties:false}),{maxItems:32}),
    }:{}),
    // Pi's strict subset permits nullable scalars, but rejects nullable objects.
    ...(speechAnchors?{speechAnchor:Type.Unsafe({type:'object',properties:{
      evidenceId:{type:['string','null'],pattern:evidenceIdPattern,maxLength:192},version:{type:['integer','null'],minimum:1,maximum:Number.MAX_SAFE_INTEGER},
      phrase:{type:['string','null'],minLength:1,maxLength:1000},occurrence:{type:['integer','null'],minimum:1,maximum:10000},
      utteranceId:{type:['string','null'],pattern:evidenceIdPattern,maxLength:192},
    },required:['evidenceId','version','phrase','occurrence','utteranceId'],additionalProperties:false})}:{}),
  },{additionalProperties:false});
}

export function submissionTool(kind: Kind, strict: Strict = 'require', speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]): Tool {
  checkSourceBudget(kind,sourceMaxChars);
  checkExistingIds(kind,existingEntityIds);
  if(speechAnchors&&kind!=='world')throw new Error('Speech anchors require world submissions');
  if(retainedParameters&&kind!=='world')throw new Error('Retained parameters require world submissions');
  if(progressiveWorld&&kind!=='world')throw new Error('Progressive operations require world submissions');
  return {
    name: nameFor(kind),
    description: kind === 'scene' ? 'Submit the complete native scene source exactly once.' : kind === 'world'
      ? 'Submit exactly one branch: add native source with empty changes/remove, edit native properties with empty source, or defer with a specific evidence-grounded reason when evidence is insufficient. Defer requires empty source/changes/remove; add/edit require empty reason. Null properties mean unchanged. Never combine branches.'+(retainedParameters?parameterContract:'')+(progressiveWorld?progressiveContract:'')+(speechAnchors?' speechAnchor must name an exact supplied evidence version and spoken phrase; host resolves measured times. For frame-only operations and deferrals, set all five speechAnchor fields to null. occurrence and utteranceId are null unless needed to disambiguate. Never invent timestamps.':'')
      : 'Submit one source-grounded causal visual brief, identifying uncertainty explicitly.',
    parameters: kind === 'scene'
      ? Type.Object({ source: Type.String(sourceMaxChars===undefined?{}:{maxLength:sourceMaxChars}) }, { additionalProperties: false })
      : kind === 'world' ? worldSchema(speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds) : Type.Object({ claim: Type.String(), basis: Type.String(), operation: Type.String(),
        objects: Type.Array(Type.Object({ id: Type.String(), meaning: Type.String() }, { additionalProperties: false })),
        uncertainty: Type.String() }, { additionalProperties: false }),
    constrainedSampling: { type: 'json_schema', strict },
  };
}

function closed(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid submission object');
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw new Error('Invalid submission fields');
  return value as Record<string, unknown>;
}
function boundedString(value: unknown, bytes: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || Buffer.byteLength(value) > bytes) throw new Error('Invalid submission string');
  return value;
}
function worldData(value: unknown, depth = 0): void {
  if(depth>16)throw new Error('World input nesting limit exceeded');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('World input must be finite plain JSON');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(value).length>20000||Object.getOwnPropertySymbols(value).length)throw new Error('Invalid world input members');
  for(const [key,descriptor]of Object.entries(descriptors)){
    if(['__proto__','constructor','prototype'].includes(key)||descriptor.get||descriptor.set)throw new Error('Unsafe world input member');
    worldData(descriptor.value,depth+1);
  }
}
function validateSpeechAnchor(value:unknown):SpeechAnchor|null {
  const item=closed(value,['evidenceId','version','phrase','occurrence','utteranceId']);
  if(Object.values(item).every(value=>value===null))return null;
  const validId=(value:unknown):value is string=>typeof value==='string'&&new RegExp(evidenceIdPattern).test(value);
  if(!validId(item.evidenceId)||!Number.isSafeInteger(item.version)||Number(item.version)<1
    ||item.occurrence!==null&&(!Number.isSafeInteger(item.occurrence)||Number(item.occurrence)<1||Number(item.occurrence)>10000)
    ||item.utteranceId!==null&&!validId(item.utteranceId))throw new Error('Invalid speech anchor identity or occurrence');
  return {evidenceId:item.evidenceId,version:item.version as number,phrase:boundedString(item.phrase,1000),
    occurrence:item.occurrence as number|null,utteranceId:item.utteranceId as string|null};
}
function validateWorld(args: unknown, speechAnchors=false,retainedParameters=false,progressiveWorld=false): WorldSubmission {
  worldData(args);
  if(JSON.stringify(args).length>WORLD_LIMITS.patchBytes)throw new Error('World submission size limit exceeded');
  const item=closed(args,['action','reason','source','changes','remove',...(speechAnchors?['speechAnchor']:[]),...(retainedParameters?['parameterProgramId','parameterValues']:[]),...(progressiveWorld?['motionChanges','replacementProgramId']:[])]);
  const anchor=speechAnchors?{speechAnchor:validateSpeechAnchor(item.speechAnchor)}:{};
  if(!Array.isArray(item.changes)||item.changes.length>WORLD_LIMITS.changes||!Array.isArray(item.remove)||item.remove.length>WORLD_LIMITS.changes)throw new Error('World change/removal limit exceeded');
  if(retainedParameters&&(!Array.isArray(item.parameterValues)||item.parameterValues.length>32))throw new Error('World parameter limit exceeded');
  const validId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(value);
  const progressive=progressiveWorld?{motionChanges:[] as [],replacementProgramId:'' as const}:{};
  if(progressiveWorld){
    if(!Array.isArray(item.motionChanges)||item.motionChanges.length>32)throw new Error('World motion limit exceeded');
    if(item.action==='motion'||item.action==='replace'){
      if(item.reason!==''||item.changes.length||item.remove.length||retainedParameters&&(item.parameterProgramId!==''||(item.parameterValues as unknown[]).length))throw new Error('Cannot combine progressive and another world operation');
      const parameters=retainedParameters?{parameterProgramId:'' as const,parameterValues:[] as []}:{};
      if(item.action==='replace'){
        if(item.motionChanges.length||!validId(item.replacementProgramId))throw new Error('Invalid replacement program or mixed motion');
        return {action:'replace',source:boundedString(item.source,WORLD_LIMITS.sourceBytes),changes:[],remove:[],motionChanges:[],replacementProgramId:item.replacementProgramId,...parameters,...anchor};
      }
      if(item.source!==''||item.replacementProgramId!==''||!item.motionChanges.length)throw new Error('Invalid motion branch');
      const ids=new Set<string>();
      const motionChanges:WorldMotionChange[]=Array.from(item.motionChanges,value=>{
        const change=closed(value,['id','velocity']),vector=change.velocity;
        if(!validId(change.id)||ids.has(change.id))throw new Error('Invalid or duplicate motion ID');
        if(!Array.isArray(vector)||vector.length!==3||!Array.from(vector).every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6))throw new Error('Invalid motion velocity');
        ids.add(change.id);return {id:change.id,velocity:[vector[0],vector[1],vector[2]]};
      });
      return {action:'motion',source:'',changes:[],remove:[],motionChanges,replacementProgramId:'',...parameters,...anchor};
    }
    if(item.motionChanges.length||item.replacementProgramId!=='')throw new Error('Other operations require empty progressive fields');
  }
  if(retainedParameters&&item.action==='parameters'){
    if(item.source!==''||item.reason!==''||item.changes.length||item.remove.length)throw new Error('Cannot combine parameters and another world operation');
    if(!validId(item.parameterProgramId)||!(item.parameterValues as unknown[]).length)throw new Error('Invalid parameter program or empty values');
    const ids=new Set<string>();
    const parameterValues=Array.from(item.parameterValues as unknown[],value=>{
      const parameter=closed(value,['id','value']);
      if(!validId(parameter.id)||ids.has(parameter.id)||typeof parameter.value!=='number'||!Number.isFinite(parameter.value))throw new Error('Invalid or duplicate numeric parameter');
      ids.add(parameter.id);return {id:parameter.id,value:parameter.value};
    });
    return {action:'parameters',source:'',changes:[],remove:[],parameterProgramId:item.parameterProgramId,parameterValues,...progressive,...anchor};
  }
  if(retainedParameters&&(item.parameterProgramId!==''||(item.parameterValues as unknown[]).length))throw new Error('Non-parameter operations require empty parameter fields');
  const parameters=retainedParameters?{parameterProgramId:'' as const,parameterValues:[] as []}:{};
  if(item.action==='defer'){
    if(item.source!==''||item.changes.length||item.remove.length||speechAnchors&&anchor.speechAnchor!==null)throw new Error('Cannot combine deferral and world operation or speech anchor');
    return {action:'defer',reason:boundedString(item.reason,512),source:'',changes:[],remove:[],...parameters,...progressive,...anchor};
  }
  if(item.reason!=='')throw new Error('World operations require empty reason');
  if(item.action==='add'){
    if(item.changes.length||item.remove.length)throw new Error('Cannot combine add and edit');
    return {action:'add',source:boundedString(item.source,WORLD_LIMITS.sourceBytes),changes:[],remove:[],...parameters,...progressive,...anchor};
  }
  if(item.action!=='edit'||item.source!==''||!item.changes.length&&!item.remove.length)throw new Error('Invalid world edit branch');
  const ids=new Set<string>();
  const stableId=(value:unknown)=>{
    if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(value)||ids.has(value))throw new Error('Invalid or duplicate world ID');
    ids.add(value);return value;
  };
  const changes:WorldChange[]=item.changes.map(value=>{
    const change=closed(value,['id','props','duration']), id=stableId(change.id);
    if(typeof change.duration!=='number'||!Number.isFinite(change.duration)||change.duration<0||change.duration>60)throw new Error('Invalid world transition duration');
    const wire=closed(change.props,['position','rotation','scale','opacity','fill']),props:WorldChange['props']={};
    for(const key of ['position','rotation']as const)if(wire[key]!==null){
      const vector=wire[key];
      if(!Array.isArray(vector)||vector.length!==3||!Array.from(vector).every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6))throw new Error('Invalid world vector');
      props[key]=[vector[0],vector[1],vector[2]];
    }
    for(const key of ['scale','opacity']as const)if(wire[key]!==null){
      const value=wire[key];
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>(key==='opacity'?1:1e6))throw new Error('Invalid world scalar');
      props[key]=value;
    }
    if(wire.fill!==null){if(typeof wire.fill!=='string')throw new Error('World fill requires a palette token');validateColor(wire.fill);props.fill=wire.fill;}
    return {id,props,duration:change.duration};
  });
  // Wire null means unchanged, including an entirely unchanged entry. Validate
  // every original entry and removal before dropping no-ops so invalid fields,
  // durations and duplicate identities cannot disappear during normalization.
  const remove=item.remove.map(stableId),effectiveChanges=changes.filter(change=>Object.keys(change.props).length>0);
  if(!effectiveChanges.length&&!remove.length)return {action:'defer',reason:'No property changes requested.',source:'',changes:[],remove:[],
    ...parameters,...progressive,...(speechAnchors?{speechAnchor:null}:{})};
  return {action:'edit',source:'',changes:effectiveChanges,remove,...parameters,...progressive,...anchor};
}
export function validateSubmission(kind: Kind, args: unknown, speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]): Submission {
  checkSourceBudget(kind,sourceMaxChars);
  checkExistingIds(kind,existingEntityIds);
  const suppliedSource=sourceMaxChars!==undefined&&args&&typeof args==='object'?Object.getOwnPropertyDescriptor(args,'source')?.value:undefined;
  if(typeof suppliedSource==='string'&&Array.from(suppliedSource).length>sourceMaxChars!)throw new Error('Submission source exceeds requested character budget');
  if(speechAnchors&&kind!=='world')throw new Error('Speech anchors require world submissions');
  if(retainedParameters&&kind!=='world')throw new Error('Retained parameters require world submissions');
  if(progressiveWorld&&kind!=='world')throw new Error('Progressive operations require world submissions');
  if (kind === 'scene') return { source: boundedString(closed(args, ['source']).source, 256000) };
  if (kind === 'world') {
    const result=validateWorld(args,speechAnchors,retainedParameters,progressiveWorld);
    if(existingEntityIds!==undefined){
      // validateWorld has checked the complete raw record, including no-ops.
      // Check original targets before normalization can discard unchanged IDs.
      const raw=args as {action:string;changes:{id:string}[];remove:string[];motionChanges?:{id:string}[]};
      const targets=raw.action==='edit'?[...raw.changes.map(change=>change.id),...raw.remove]:raw.action==='motion'?raw.motionChanges!.map(change=>change.id):[];
      const allowed=new Set(existingEntityIds);
      if(targets.some(id=>!allowed.has(id)))throw new Error('Unknown existing entity target');
    }
    return result;
  }
  const item = closed(args, ['claim', 'basis', 'operation', 'objects', 'uncertainty']);
  if (!Array.isArray(item.objects) || item.objects.length > 64) throw new Error('Invalid brief objects');
  const ids = new Set<string>();
  const objects = item.objects.map(value => {
    const object = closed(value, ['id', 'meaning']);
    const id = boundedString(object.id, 128), meaning = boundedString(object.meaning, 2048);
    if (ids.has(id)) throw new Error('Duplicate brief object ID');
    ids.add(id);
    return { id, meaning };
  });
  return { claim: boundedString(item.claim, 4096), basis: boundedString(item.basis, 8192),
    operation: boundedString(item.operation, 8192), objects, uncertainty: boundedString(item.uncertainty, 4096, true) };
}

/** toolcall_end arguments are authoritative, but incomplete/failed provider output is never accepted. */
export function acceptSubmission(kind: Kind, completed: ToolCall[], terminal: ToolCall[], providerComplete: boolean, speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]): Submission {
  if (!providerComplete || completed.length !== 1 || terminal.length !== 1) throw new Error('Expected one successful completed tool call');
  const call = completed[0], final = terminal[0];
  if (call.name !== nameFor(kind) || final.name !== call.name || !call.id || call.id !== final.id) throw new Error('Tool call identity mismatch');
  if(kind==='world'){
    worldData(call.arguments);worldData(final.arguments);
    if(JSON.stringify(call.arguments)!==JSON.stringify(final.arguments))throw new Error('World wire arguments mismatch');
  }
  const result = validateSubmission(kind, call.arguments,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
  if (JSON.stringify(result) !== JSON.stringify(validateSubmission(kind, final.arguments,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds))) throw new Error('Tool call arguments mismatch');
  return result;
}

export function submissionTrace() {
  return { commentary: '', completed: [] as ToolCall[], toolCallCompleteMs: null as number | null, validToolCallCompleteMs: null as number | null };
}
export function observeSubmission(trace: ReturnType<typeof submissionTrace>, kind: Kind, event: AssistantMessageEvent, elapsedMs: number, speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]) {
  if (event.type === 'text_delta') trace.commentary += event.delta;
  if (event.type === 'toolcall_end') {
    // Snapshot authoritative parsed arguments, never partial JSON or text commentary.
    trace.completed.push(JSON.parse(JSON.stringify(event.toolCall)) as ToolCall);
    trace.toolCallCompleteMs ??= elapsedMs;
    try {
      if (event.toolCall.name !== nameFor(kind)) throw new Error('Wrong submission tool');
      validateSubmission(kind, event.toolCall.arguments,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
      trace.validToolCallCompleteMs ??= elapsedMs;
    } catch { /* Retain invalid call evidence; acceptance rejects it. */ }
  }
}

/** Inspect only the known tool schema and options; never log messages, headers, keys or the full payload. */
export function preparePayload(payload: unknown, kind: Kind, strict: Strict, tier: string, speechAnchors=false,retainedParameters=false,progressiveWorld=false,sourceMaxChars?:number,existingEntityIds?:readonly string[]) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AgentError('CONFIG', 'Invalid adapter payload.');
  const data = payload as Record<string, any>;
  const tools = data.tools;
  if (data.service_tier !== tier || data.tool_choice !== 'required' || !Array.isArray(tools) || tools.length !== 1
    || tools[0].type !== 'function' || tools[0].name !== nameFor(kind)
    || strict === 'require' && tools[0].strict !== true) throw new AgentError('CONFIG', 'Adapter did not forward required tool settings.');
  const expected = submissionTool(kind, strict,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds).parameters;
  if (JSON.stringify(tools[0].parameters) !== JSON.stringify(expected)) throw new AgentError('CONFIG', 'Adapter changed the requested schema.');
  const outgoing = { ...data, parallel_tool_calls: false };
  const metadata = { toolChoice: data.tool_choice as string, parallelToolCalls: false,
    serviceTier: data.service_tier as string, reasoningEffort: typeof data.reasoning?.effort === 'string' ? data.reasoning.effort as string : null,
    maxOutputTokens: typeof data.max_output_tokens === 'number' ? data.max_output_tokens as number : null,
    tools: [{ name: tools[0].name as string, type: 'function', strict: tools[0].strict === true,
      parameters: tools[0].parameters as Record<string, any> }] };
  return { payload: outgoing, metadata };
}

function argumentsFor(args: string[]) {
  const flags: Record<string, string> = {};
  const allowed = new Set(['kind', 'case', 'action', 'model', 'thinking', 'service-tier', 'out', 'strict', 'prompt-file', 'system-file', 'image', 'timeout-ms', 'max-tokens']);
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(flags, match[1])) throw new AgentError('CONFIG', help);
    flags[match[1]] = match[2];
  }
  return flags;
}
async function promptFile(path: string) {
  const text = await readFile(resolve(path), 'utf8');
  if (!text.trim() || text.length > 128000) throw new AgentError('CONFIG', 'Prompt files must contain 1–128000 characters.');
  return text;
}

export interface ProbeRunOptions {
  signal?: AbortSignal;
  /** Opt-in world-only measured speech reference contract; resolution remains caller-owned. */
  speechAnchors?: boolean;
  /** Opt-in world-only numeric control updates; host validates exposed IDs and bounds. */
  retainedParameters?: boolean;
  /** Opt-in world-only late motion and complete native-program replacement. */
  progressiveWorld?: boolean;
  /** Optional per-request source length cap (Unicode code points); existing byte limits still apply. */
  sourceMaxChars?: number;
  /** Optional authoring inventory for edit/remove/motion targets; host authorization is unchanged. */
  existingEntityIds?: readonly string[];
  /** Preserve a frozen experiment's supplied system prompt; strict tool validation still applies. */
  exactSystemPrompt?: boolean;
  /** Reuse or inject the existing provider runtime without changing request settings. */
  createRuntime?: typeof createModelRuntime;
}
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
function immutable<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Same single-request protocol and write-once evidence as the CLI, without process-global output/status.
 * Acceptance is a provider receipt, not authorization to publish into a retained world. The caller must
 * recheck its signal, base revision and deadline at publication, including cancellation during evidence writes.
 */
export async function runProbe(args: string[], options: ProbeRunOptions = {}) {
  if (args[0] !== 'run') throw new AgentError('CONFIG', help);
  const flags = argumentsFor(args.slice(1));
  const kind = (flags.kind ?? 'scene') as Kind, strict = (flags.strict ?? 'require') as Strict;
  const sourceMaxChars=options.sourceMaxChars;checkSourceBudget(kind,sourceMaxChars);
  checkExistingIds(kind,options.existingEntityIds);
  const existingEntityIds=options.existingEntityIds===undefined?undefined:[...options.existingEntityIds];
  const speechAnchors=options.speechAnchors??false;
  if(typeof speechAnchors!=='boolean'||speechAnchors&&kind!=='world')throw new AgentError('CONFIG','Speech anchors require world submissions.');
  const retainedParameters=options.retainedParameters??false;
  if(typeof retainedParameters!=='boolean'||retainedParameters&&kind!=='world')throw new AgentError('CONFIG','Retained parameters require world submissions.');
  const progressiveWorld=options.progressiveWorld??false;
  if(typeof progressiveWorld!=='boolean'||progressiveWorld&&kind!=='world')throw new AgentError('CONFIG','Progressive operations require world submissions.');
  const exactSystemPrompt=options.exactSystemPrompt??false;
  if(typeof exactSystemPrompt!=='boolean'||exactSystemPrompt&&!flags['system-file'])throw new AgentError('CONFIG','Exact system prompts require a boolean opt-in and a system file.');
  const which = (flags.case ?? 'cube') as ProbeCase | 'external', action = (flags.action ?? 'create') as 'create' | 'edit';
  if (!flags.model || !flags.thinking || !flags.out || !['priority', 'default'].includes(flags['service-tier'])
    || !['scene', 'brief', 'world'].includes(kind) || !['require', 'prefer'].includes(strict)
    || (!Object.hasOwn(cases, which) && which !== 'external') || !['create', 'edit'].includes(action)
    || (which === 'external' || kind === 'brief') && !flags['prompt-file']
    || kind === 'world' && (which !== 'external' || !flags['prompt-file'] || !flags['system-file'])) throw new AgentError('CONFIG', help);
  const config = agentConfig({ ...process.env, AGENT_MODEL: flags.model, AGENT_THINKING: flags.thinking });
  const timeoutMs = Number(flags['timeout-ms'] ?? 90000), maxTokens = Number(flags['max-tokens'] ?? 2048);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000 || !Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 16384) throw new AgentError('CONFIG', help);
  const prompts = kind === 'scene' ? buildPrompt(which === 'external' ? 'diagram' : which, 'native-js', action)
    : { systemPrompt: 'Read the supplied evidence and produce a compact causal visual brief. Ground claims and objects in the evidence IDs provided in the prompt. State uncertainty; do not invent unreadable details.', prompt: '' };
  if (flags['prompt-file']) prompts.prompt = await promptFile(flags['prompt-file']);
  if (flags['system-file']) prompts.systemPrompt = await promptFile(flags['system-file']);
  if(!exactSystemPrompt){
  prompts.systemPrompt += `\n\nSubmission contract: call ${nameFor(kind)} exactly once with the complete ${kind === 'scene' ? 'native scene source in its source field' : kind === 'world' ? 'world branch in the specified fields: add uses native source and empty changes/remove; edit uses empty source and existing stable IDs, nullable unchanged properties, and explicit durations; add/edit require empty reason. If evidence is insufficient or ambiguous, defer with a specific evidence-grounded reason (at most 512 UTF-8 bytes) and empty source/changes/remove. Never fabricate a scene or edit to fill missing evidence' : 'causal brief in the specified fields'}. Do not put the submission in prose or a code fence. This is a single request; tools will not execute and no repair turn follows.`;
  if(speechAnchors)prompts.systemPrompt+=' Speech anchor contract: speechAnchor is a required object. For speech-grounded add/edit, reference exact supplied evidenceId/version and spoken phrase (at most 1000 UTF-8 bytes); use occurrence or utteranceId only to disambiguate, otherwise null. Host resolves measured words; do not calculate or invent timestamps. For frame-only operations and every deferral, set all five speechAnchor fields to null. Schema validity does not prove phrase matching or evidence availability.';
  if(retainedParameters)prompts.systemPrompt+=parameterContract+(speechAnchors?' Speech-grounded parameter operations use the same exact supplied speechAnchor evidence contract.':'');
  if(progressiveWorld)prompts.systemPrompt+=progressiveContract;
  }
  const images: ImageContent[] = [];
  let imageMetadata: { path: string; sha256: string; bytes: number; mimeType: string } | null = null;
  if (flags.image) {
    const path = resolve(flags.image), bytes = await readFile(path);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if ((!png && !jpeg) || bytes.length > 20 * 1024 * 1024) throw new AgentError('CONFIG', 'Image must be PNG or JPEG, at most 20 MiB.');
    const mimeType = png ? 'image/png' : 'image/jpeg';
    images.push({ type: 'image', data: bytes.toString('base64'), mimeType });
    imageMetadata = { path, sha256: hash(bytes), bytes: bytes.length, mimeType };
  }
  const tool = submissionTool(kind, strict,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
  const sourceHashes = Object.fromEntries(await Promise.all([
    ['probe', import.meta.url], ['prompts', new URL('./realtime-probe/prompts.ts', import.meta.url).href],
    ['auth', new URL('../src/agents/auth.ts', import.meta.url).href], ['config', new URL('../src/agents/config.ts', import.meta.url).href],
    ...(kind === 'world' ? [['world', new URL('./realtime-world/world.ts', import.meta.url).href]] : []),
  ].map(async ([name, path]) => [name, hash(await readFile(fileURLToPath(path)))])));
  const directory = resolve(flags.out);
  await mkdir(dirname(directory), { recursive: true });
  try { await mkdir(directory); } catch { throw new AgentError('CONFIG', 'Output directory must be new; retained runs cannot be overwritten.'); }
  const identity = { schemaVersion: 1, evidenceKind: 'single-structured-model-submission', kind, case: which, action,
    ...(speechAnchors?{speechAnchors:true}:{}),
    ...(retainedParameters?{retainedParameters:true}:{}),
    ...(progressiveWorld?{progressiveWorld:true}:{}),
    ...(exactSystemPrompt?{exactSystemPrompt:true}:{}),
    ...(sourceMaxChars===undefined?{}:{sourceMaxChars}),
    ...(existingEntityIds===undefined?{}:{existingEntityIds}),
    format: kind === 'scene' ? 'native-js' : kind === 'world' ? 'world-operation' : 'causal-brief', model: config.model, provider: config.provider, authMode: config.authMode,
    thinkingRequested: config.thinking, serviceTierRequested: flags['service-tier'], strictRequested: strict,
    maxTokensRequested: maxTokens, timeoutMs, maxRetries: 0, transportRequested: 'sse', systemPromptOverridden: !!flags['system-file'],
    promptSha256: hash(JSON.stringify(prompts)), promptBytes: Buffer.byteLength(prompts.systemPrompt + prompts.prompt),
    toolSchemaSha256: hash(JSON.stringify(tool.parameters)), image: imageMetadata, sourceHashes, piVersion: '1.1.0',
    startedAt: new Date().toISOString(),
    limitation: 'Tool completion and provider stop are model-only timestamps measured from request dispatch. They exclude input capture, compile, render and presentation, and do not establish execution, scientific correctness, source coverage, visual quality or ten-second readiness. JSON schema only constrains the argument container. No retry, repair or execution is performed.' };
  await save(join(directory, 'started.json'), identity);
  await save(join(directory, 'prompt.json'), prompts);
  await save(join(directory, 'tool.json'), tool);
  const started = performance.now();
  let requestStart: number | null = null, requestStartedAt: string | null = null;
  let providerTerminalMs: number | null = null;
  let final: AssistantMessage | undefined, providerComplete = false, accepted: Submission | null = null;
  let failure: ReturnType<typeof safeFailure> | null = null, submissionFailure: string | null = null;
  let payloadMetadata: ReturnType<typeof preparePayload>['metadata'] | null = null, actualTier: string | null = null;
  let modelMetadata: { id: string; api: string; reasoning: boolean; thinkingLevelMap: unknown; maxTokens: number } | null = null;
  const trace = submissionTrace(), events: { type: string; elapsedMs: number; chars?: number }[] = [];
  let requestSignal = options.signal;
  try {
    requestSignal?.throwIfAborted();
    const runtime = await (options.createRuntime ?? createModelRuntime)(config, { signal: options.signal });
    requestSignal?.throwIfAborted();
    const model = runtime.getModel(config.provider, config.model);
    if (!model) throw new AgentError('MODEL', 'Model is absent from local provider catalog.');
    modelMetadata = { id: model.id, api: model.api, reasoning: model.reasoning, thinkingLevelMap: model.thinkingLevelMap ?? null, maxTokens: model.maxTokens };
    if (!['openai-responses', 'openai-codex-responses'].includes(model.api)) throw new AgentError('CONFIG', 'Requires a Responses adapter with explicit serviceTier support.');
    if (model.thinkingLevelMap?.[config.thinking] === null) throw new AgentError('CONFIG', 'Requested reasoning level is unsupported.');
    const timeout = AbortSignal.timeout(timeoutMs);
    requestSignal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const requestOptions: StreamOptions & { serviceTier: 'priority' | 'default'; toolChoice: 'required'; reasoningEffort?: Exclude<typeof config.thinking, 'off'> } = {
      serviceTier: flags['service-tier'] as 'priority' | 'default', toolChoice: 'required',
      ...(config.thinking === 'off' ? {} : { reasoningEffort: config.thinking }),
      maxTokens, timeoutMs, maxRetries: 0, signal: requestSignal, transport: 'sse',
      onPayload(payload) {
        const prepared = preparePayload(payload, kind, strict, flags['service-tier'],speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
        payloadMetadata = prepared.metadata;
        return prepared.payload;
      },
      onProviderStreamEvent(event) {
        const data = event as { response?: { service_tier?: unknown }; service_tier?: unknown };
        const tier = data.response?.service_tier ?? data.service_tier;
        if (typeof tier === 'string' && ['auto','default','flex','scale','priority','fast'].includes(tier)) actualTier = tier;
      },
    };
    const content: (TextContent | ImageContent)[] = [{ type: 'text', text: prompts.prompt }, ...images];
    const context = { systemPrompt: prompts.systemPrompt, messages: [{ role: 'user' as const, content, timestamp: Date.now() }], tools: [tool] };
    requestStartedAt = new Date().toISOString();
    requestStart = performance.now();
    // Direct API options preserve serviceTier; streamSimple in Pi 1.1.0 omits it.
    const stream = model.api === 'openai-responses'
      ? runtime.stream(model as Model<'openai-responses'>, context, requestOptions)
      : runtime.stream(model as Model<'openai-codex-responses'>, context, requestOptions);
    for await (const event of stream) {
      requestSignal.throwIfAborted();
      const elapsedMs = performance.now() - requestStart;
      events.push({ type: event.type, elapsedMs, ...('delta' in event && typeof event.delta === 'string' ? { chars: event.delta.length } : {}) });
      observeSubmission(trace, kind, event, elapsedMs,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
      if (event.type === 'done' || event.type === 'error') {
        providerTerminalMs = elapsedMs;
        final = event.type === 'done' ? event.message : event.error;
        providerComplete = event.type === 'done' && ['stop', 'toolUse'].includes(event.reason);
        if (!providerComplete) failure = safeFailure(new Error('Provider did not complete successfully'));
      }
    }
    requestSignal.throwIfAborted();
    if (!final) failure = safeFailure(new Error('Incomplete provider stream'));
  } catch (error) { providerComplete = false; failure = safeFailure(error); }
  const { commentary, completed, toolCallCompleteMs, validToolCallCompleteMs } = trace;
  try {
    accepted = acceptSubmission(kind, completed, final?.content.filter((part): part is ToolCall => part.type === 'toolCall') ?? [], providerComplete,speechAnchors,retainedParameters,progressiveWorld,sourceMaxChars,existingEntityIds);
  } catch { submissionFailure = 'Expected exactly one schema-valid completed submission matching a successful terminal response.'; }
  const status = accepted ? 'complete' : 'failed';
  const acceptedText = accepted === null ? null : kind === 'scene' && 'source' in accepted ? accepted.source : JSON.stringify(accepted, null, 2);
  const report = { ...identity, status, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
    ...(kind === 'world' ? { worldOperation: accepted && 'action' in accepted ? accepted.action : null } : {}),
    requestStartedAt, requestElapsedMs: requestStart === null ? null : performance.now() - requestStart,
    toolCallCompleteMs, validToolCallCompleteMs, providerTerminalMs, providerComplete, submissionAccepted: accepted !== null,
    completedToolCalls: completed.length, payloadSent: payloadMetadata, serviceTierActual: actualTier,
    priorityConfirmed: actualTier === 'priority' || actualTier === 'fast', modelMetadata,
    acceptedToolCallWithin5s: accepted !== null && validToolCallCompleteMs !== null && validToolCallCompleteMs <= 5000,
    acceptedToolCallWithin10s: accepted !== null && validToolCallCompleteMs !== null && validToolCallCompleteMs <= 10000,
    completeProviderResponseWithin5s: providerComplete && providerTerminalMs !== null && providerTerminalMs <= 5000,
    completeProviderResponseWithin10s: providerComplete && providerTerminalMs !== null && providerTerminalMs <= 10000,
    stopReason: final?.stopReason ?? null, tokens: final?.usage && (providerComplete || final.usage.totalTokens > 0) ? {
      input: final.usage.input, output: final.usage.output, reasoning: final.usage.reasoning ?? null,
      cacheRead: final.usage.cacheRead, cacheWrite: final.usage.cacheWrite, total: final.usage.totalTokens,
    } : null, submissionSha256: acceptedText === null ? null : hash(acceptedText), submissionBytes: acceptedText === null ? null : Buffer.byteLength(acceptedText),
    commentaryBytes: Buffer.byteLength(commentary), failure, submissionFailure };
  await writeFile(join(directory, 'commentary.txt'), commentary, { flag: 'wx' });
  await save(join(directory, 'completed-tool-calls.json'), completed);
  await save(join(directory, 'terminal-tool-calls.json'), final?.content.filter(part => part.type === 'toolCall') ?? []);
  if (accepted !== null) {
    await save(join(directory, 'submission.json'), accepted);
    if (kind === 'world') await save(join(directory, 'world.json'), accepted);
    else if ('source' in accepted) await writeFile(join(directory, 'source.js'), accepted.source, { flag: 'wx' });
    else await save(join(directory, 'brief.json'), accepted);
  }
  await save(join(directory, 'events.json'), events);
  await save(join(directory, 'result.json'), report);
  return immutable(structuredClone({ report, submission: accepted, resultPath: join(directory, 'result.json'),
    submissionPath: accepted === null ? null : join(directory, 'submission.json') }));
}

export async function main(args = process.argv.slice(2)) {
  if (['help', '--help'].includes(args[0])) { console.log(help); return; }
  const result = await runProbe(args);
  const { status, toolCallCompleteMs, validToolCallCompleteMs, providerTerminalMs, providerComplete,
    submissionAccepted, serviceTierActual, failure, submissionFailure } = result.report;
  console.log(JSON.stringify({ status, result: result.resultPath, toolCallCompleteMs, validToolCallCompleteMs,
    providerTerminalMs, providerComplete, submissionAccepted, serviceTierActual, failure, submissionFailure }, null, 2));
  if (status !== 'complete') process.exitCode = 1;
}

if (import.meta.main) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', failure: safeFailure(error), hint: help }));
  process.exitCode = 1;
});
