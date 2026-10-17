/** Persistent world shared by the live lecture screen and verification tools.
 * New sandbox programs own new IDs. Host property overrides layer over freshly
 * sampled old programs, retaining their untouched tracks and time callbacks.
 * Reactive sliders are host-controlled numeric parameters, without control UI.
 * There is deliberately no replay history, input behavior, camera
 * authoring, cross-program attachment, or live rebase of a callback-owned tween.
 */
import { SourceCompiler } from './compiler-client.js';
import { validateCompiledScene } from './compiler.js';
import { evaluateScene } from './timeline.js';
import { applyBindings } from './bindings.js';
import { applyReactiveProperties, mergeReactiveUpdates, validateReactiveProperties } from './reactive.js';
import { SceneAssets } from './scene-assets.js';
import { paletteResolver } from './palette.js';
import { validateModelMetadata } from './model-metadata.js';
import type { ModelMetadata } from './model-types.js';
import type { AssetRegistry } from './asset-types.js';
import type { CameraState, ColorPalette, ColorValue, CompiledScene, ElementState, Frame, ReactiveProperties } from './types.js';

export interface WorldOptions {
  /** Qualify local source IDs per program; host patches use qualified runtime IDs. */
  namespaceEntities?: boolean;
  /** Same monotonic seconds domain as method arguments. */
  clock?: () => number;
  palette?: ColorPalette;
  assets?: AssetRegistry;
  /** Immutable host inventory only. GLB bytes remain in the renderer's ModelStore. */
  models?: Record<string,ModelMetadata>;
  maxPrograms?: number;
  /** Lifetime ID budget, including tombstones: removed IDs are not reused. */
  maxObjects?: number;
  maxPendingPrograms?: number;
  /** Trusted host hook. Prepare resources only; honor cancellation; do not mutate scene. */
  prepare?: (scene: CompiledScene, assets: SceneAssets, signal: AbortSignal) => Promise<void>;
}
export interface ProgramRequest { id: string; source: string; baseRevision: number }
export interface WorldParameterPatch { baseRevision: number; programId: string; values: Record<string,number> }
export interface WorldMotionPatch { baseRevision: number; changes: { id: string; velocity: [number,number,number] }[] }
export interface WorldPatch {
  baseRevision: number;
  changes: { id: string; props: ReactiveProperties; duration?: number }[];
  remove?: string[];
}
export interface WorldCommit { revision: number; committedAt: number; originSampledAt?: number }
/** Trusted host controls, deliberately separate from serializable scene requests. */
export interface WorldTransactionOptions {
  signal?: AbortSignal;
  /** Synchronous evidence/deadline check immediately before publication. */
  beforeCommit?: () => void;
}
/** Host-only metadata append. Staging does not expose models to new programs. */
export interface WorldModelRegistration {
  revision: number;
  added: string[];
  assertCurrent(): void;
  commit(): number;
}
type Property = keyof ReactiveProperties;
type Override = { from: unknown; to: unknown; start: number; duration: number };
type Motion = { origin: [number,number,number]; velocity: [number,number,number]; start: number };
type ParameterState = { values: Record<string,number>; snapshot: CompiledScene; terminalScene?: Promise<CompiledScene> };
type Program = { id: string; source: string; entityNamespace?: string; compiler: SourceCompiler; scene: CompiledScene; ids: Set<string>; epoch: number; readers: number; retired: boolean;
  state: ParameterState; parameterPending?: boolean };
type Candidate = { id: string; compiler: SourceCompiler; controller: AbortController; scene?: CompiledScene };
type Sample = { program: Program; scene: CompiledScene };
const geometryKeys = new Set(['radius','vertices','normals','material','texture','scalarColors','points']);
export const WORLD_LIMITS = Object.freeze({ sourceBytes: 128_000, patchBytes: 1_000_000, changes: 256, vertices: 100_000, parameterChanges: 32, parameterEvaluations: 2 });
const limits = WORLD_LIMITS;
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function id(value: unknown): asserts value is string { check(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(value),'Invalid stable ID'); }
function time(value: unknown): asserts value is number { check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12,'Invalid world time'); }
function json(value: unknown, depth=0): void {
  check(depth<=16,'Input nesting limit exceeded');
  if (value===null||typeof value==='string'||typeof value==='boolean') return;
  if(typeof value==='number'){check(Number.isFinite(value),'Input must be finite');return;}
  check(typeof value==='object'&&value!==null,'Input must contain JSON values');
  check(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null,'Input must contain plain data');
  check(Object.getOwnPropertySymbols(value).length===0,'Unsafe input member');
  check(Object.keys(value).length<=20_000,'Input item limit exceeded');
  for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
    check(!['__proto__','prototype','constructor'].includes(key)&&!descriptor.get&&!descriptor.set,'Unsafe input member');
    json(descriptor.value,depth+1);
  }
}
function readProperty(element: ElementState, key: Property): unknown {
  if(geometryKeys.has(key)) return (element.geometry as unknown as Record<string,unknown>)[key];
  if(key==='strokeStart'||key==='dashOffset') return element[key]??0;
  if(key==='strokeEnd') return element[key]??1;
  return (element as unknown as Record<string,unknown>)[key];
}
function numericShape(a:unknown,b:unknown):boolean {
  if(typeof a==='number'&&typeof b==='number') return Number.isFinite(a)&&Number.isFinite(b);
  return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>numericShape(value,b[index]));
}
function interpolate(a:unknown,b:unknown,t:number):unknown {
  if(t>=1)return structuredClone(b);if(t<=0)return structuredClone(a);
  if(typeof a==='number'&&typeof b==='number')return a+(b-a)*t;
  return (a as unknown[]).map((value,index)=>interpolate(value,(b as unknown[])[index],t));
}
function aborted<T>(signal:AbortSignal|undefined,work:Promise<T>):Promise<T>{
  if(!signal)return work;
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal.removeEventListener('abort',stop);
    const stop=()=>{cleanup();reject(signal.reason??new Error('Transaction aborted'));};
    if(signal.aborted){work.catch(()=>{});stop();return;}
    signal.addEventListener('abort',stop,{once:true});
    work.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  });
}
function beforeCommit(options:WorldTransactionOptions):void{
  options.signal?.throwIfAborted();
  const result:unknown=options.beforeCommit?.();
  if(result!==null&&(typeof result==='object'||typeof result==='function')&&typeof (result as {then?:unknown}).then==='function'){
    // An accidentally async hook may already have rejected; observe it, never await it.
    void Promise.resolve(result).catch(()=>{});
    throw new Error('beforeCommit must be synchronous');
  }
}
function ownedProperties(properties:ReactiveProperties):string[]{
  const keys=Object.keys(properties);
  return keys.includes('vertices')&&!keys.includes('normals')?[...keys,'normals']:keys;
}

export class LiveWorld {
  private version=0;
  private nextEntityNamespace=0;
  private inventoryVersion=0;
  private stopped=false;
  private programs=new Map<string,Program>();
  private pending=new Set<Candidate>();
  private pendingParameters=0;
  private owners=new Map<string,Program>();
  private reserved=new Set<string>();
  private removed=new Set<string>();
  private overrides=new Map<string,Map<Property,Override>>();
  private motions=new Map<string,Motion>();
  private options:WorldOptions;
  private clock:()=>number;
  private palette:ColorPalette;
  private models:Record<string,ModelMetadata>;
  private maxPrograms:number;
  private maxObjects:number;
  private maxPending:number;
  private renderOptions:CompiledScene['options'];
  private camera:CameraState={yaw:0,pitch:0,target:[0,0,0],height:8,distance:12,perspective:0};
  private cameraInitialized=false;
  readonly assetGeometry:SceneAssets;

  constructor(options:WorldOptions={}) {
    this.options=options;this.clock=options.clock??(()=>performance.now()/1000);
    this.palette=paletteResolver(options.palette).palette;
    json(options.models??{});this.models=structuredClone(options.models??{});
    check(Object.keys(this.models).length<=64,'World model inventory limit exceeded');
    for(const [key,metadata] of Object.entries(this.models)){check(key.length>0&&key.length<=256,'Invalid model inventory ID');validateModelMetadata(metadata);}
    this.maxPrograms=options.maxPrograms??32;this.maxObjects=options.maxObjects??2000;this.maxPending=options.maxPendingPrograms??2;
    for(const value of [this.maxPrograms,this.maxObjects,this.maxPending])check(Number.isInteger(value)&&value>0&&value<=20_000,'Invalid world limit');
    this.assetGeometry=new SceneAssets(options.assets);
    this.renderOptions={mode:'2d',end:'hold',orbit:false,background:this.palette.background,palette:this.palette};
  }
  get revision(){return this.version;}
  get modelInventoryRevision(){return this.inventoryVersion;}
  get rendererOptions():CompiledScene['options']{return structuredClone(this.renderOptions);}
  private alive(){check(!this.stopped,'World disposed');}
  private fresh(revision:number){this.alive();check(Number.isSafeInteger(revision)&&revision===this.version,'Stale world revision');}
  private now(lowerBound:number){time(lowerBound);const value=this.clock();time(value);return Math.max(value,lowerBound);}
  private scenes(){return [...this.programs.values()].map(program=>program.scene).concat([...this.pending].flatMap(candidate=>candidate.scene?[candidate.scene]:[]));}
  private cancelOthers(except?:Candidate){for(const candidate of this.pending)if(candidate!==except)candidate.controller.abort(new Error('Stale world revision'));}
  private cleanup(program:Program){if(program.retired&&program.readers===0){delete program.state.terminalScene;program.compiler.dispose();}}
  private retire(program:Program){program.retired=true;this.cleanup(program);}

  stageModelRegistration(additions:Record<string,ModelMetadata>):WorldModelRegistration{
    this.alive();json(additions);
    check(additions&&typeof additions==='object'&&!Array.isArray(additions),'Invalid model inventory');
    const input=structuredClone(additions),next={...this.models},added:string[]=[];
    for(const [key,metadata] of Object.entries(input)){
      check(key.length>0&&key.length<=256,'Invalid model inventory ID');validateModelMetadata(metadata);
      if(Object.hasOwn(next,key))check(JSON.stringify(next[key])===JSON.stringify(metadata),`Model inventory is immutable: ${key}`);
      else{next[key]=metadata;added.push(key);}
    }
    check(Object.keys(next).length<=64,'World model inventory limit exceeded');
    const revision=this.inventoryVersion;
    const assertCurrent=()=>{this.alive();check(this.inventoryVersion===revision,'Stale model inventory revision');};
    return {revision,added:[...added],assertCurrent,commit:()=>{
      assertCurrent();
      if(added.length){this.models=next;this.inventoryVersion++;}
      return this.inventoryVersion;
    }};
  }

  private inspect(scene:CompiledScene,replacing?:Program):Set<string>{
    validateCompiledScene(scene,this.options.assets?.catalog);
    for(const control of scene.controls){
      id(control.id);check(!['__proto__','prototype','constructor'].includes(control.id),'Unsafe parameter ID');
      check(control.kind==='slider'&&control.reactive===true,'Only reactive slider controls are supported as world parameters');
      check(typeof control.min==='number'&&Number.isFinite(control.min)&&typeof control.max==='number'&&Number.isFinite(control.max)&&control.min<=control.max,'Invalid parameter bounds');
      check(scene.reactiveBindings?.some(binding=>binding.controls.includes(control.id)),`Unused parameter: ${control.id}`);
    }
    check(!scene.options.audio,'Audio is not implemented by the experimental world');
    check(!scene.views?.length&&!scene.tracks.some(track=>track.action.type==='camera'),'Program camera/view authoring is not implemented');
    check(!scene.behaviors?.length,'Behaviors are not implemented');
    // validateCompiledScene has already checked binding references, spaces and
    // dependency cycles within this program. Disjoint IDs prevent cross-program access.
    const all=[...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])];
    const ids=new Set<string>();let vertices=0;
    for(const element of all){id(element.id);ids.add(element.id);vertices+=(element.geometry.vertices?.length??0)+(element.geometry.points?.length??0);}
    check(ids.size>0,'Program must create geometry');check(vertices<=limits.vertices,'Program geometry limit exceeded');
    check(this.reserved.size+[...ids].filter(key=>!this.reserved.has(key)).length<=this.maxObjects,'World object limit exceeded');
    for(const key of ids)check(!this.reserved.has(key)||Boolean(replacing&&this.owners.get(key)===replacing&&!this.removed.has(key)),`Duplicate or previously owned entity ID: ${key}`);
    return ids;
  }

  async addProgram(request:ProgramRequest,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);id(request.id);
    check(typeof request.source==='string'&&request.source.length>0&&new TextEncoder().encode(request.source).length<=limits.sourceBytes,'Source size limit exceeded');
    check(this.programs.size<this.maxPrograms&&this.pending.size<this.maxPending,'World program/pending limit exceeded');
    check(!this.programs.has(request.id)&&![...this.pending].some(candidate=>candidate.id===request.id),'Duplicate program ID');
    // Copy before awaiting: callers cannot change the submitted transaction.
    const input=structuredClone(request),models=this.models;
    // Allocate before any await. Failed/cancelled admissions never reuse a prefix.
    const entityNamespace=this.options.namespaceEntities?`p${++this.nextEntityNamespace}`:undefined;
    const candidate:Candidate={id:input.id,compiler:new SourceCompiler(),controller:new AbortController()};
    const cancel=()=>candidate.controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort',cancel,{once:true});
    this.pending.add(candidate);let published=false;
    try{
      // No previous frame: the sandbox cannot acquire or mutate existing IDs.
      const scene=candidate.scene=await aborted(candidate.controller.signal,candidate.compiler.compile(input.source,{palette:this.palette,assetCatalog:this.options.assets?.catalog,models,entityNamespace}));
      this.fresh(input.baseRevision);candidate.controller.signal.throwIfAborted();this.inspect(scene);
      this.assetGeometry.prepare(scene);
      if(this.options.prepare)await aborted(candidate.controller.signal,this.options.prepare(scene,this.assetGeometry,candidate.controller.signal));
      this.fresh(input.baseRevision);candidate.controller.signal.throwIfAborted();
      check(this.programs.size<this.maxPrograms,'World program limit exceeded');const ids=this.inspect(scene);
      beforeCommit(options);
      const committedAt=this.now(nowSeconds);
      const program:Program={id:input.id,source:input.source,entityNamespace,compiler:candidate.compiler,scene,ids,epoch:committedAt,readers:0,retired:false,
        state:{values:Object.fromEntries(scene.controls.map(control=>[control.id,control.value as number])),snapshot:scene}};
      // No awaits or host hooks between these final checks and publication.
      candidate.controller.signal.throwIfAborted();this.fresh(input.baseRevision);
      this.programs.set(input.id,program);for(const key of ids){this.reserved.add(key);this.owners.set(key,program);}
      if(!this.cameraInitialized){this.camera=structuredClone(scene.camera);this.renderOptions=structuredClone({...scene.options,orbit:false});this.cameraInitialized=true;}
      published=true;this.version++;this.cancelOthers(candidate);return {revision:this.version,committedAt};
    }finally{
      options.signal?.removeEventListener('abort',cancel);
      this.pending.delete(candidate);if(!published)candidate.compiler.dispose();
      this.assetGeometry.retain(this.scenes());
    }
  }

  private async sampleProgram(program:Program,nowSeconds:number):Promise<Sample>{
    program.readers++;
    try{
      // Capture one committed state before awaiting. Old results/cache completions
      // can never merge with a newer parameter snapshot.
      const state=program.state,local=Math.max(0,Math.min(program.scene.duration,nowSeconds-program.epoch));
      if(!state.snapshot.reactiveBindings?.some(binding=>binding.time))return {program,scene:state.snapshot};
      const sample=async():Promise<CompiledScene>=>{
        const updates=await program.compiler.update(program.scene,state.values,[],{},local);
        return {...state.snapshot,reactiveBindings:mergeReactiveUpdates(state.snapshot,updates,[],local),reactiveTime:local};
      };
      if(local!==program.scene.duration)return {program,scene:await sample()};
      // Pure callbacks receive identical inputs forever after the authored end.
      // Keep the original scene as compiler/asset identity; never cache composed
      // frames, which must still reflect host edits, removals and bindings.
      const terminal=state.terminalScene??=sample();
      try{return {program,scene:await terminal};}
      catch(error){if(state.terminalScene===terminal)delete state.terminalScene;throw error;}
    }finally{program.readers--;this.cleanup(program);}
  }
  private async capture(nowSeconds:number):Promise<Sample[]>{
    return Promise.all([...this.programs.values()].filter(program=>program.epoch<=nowSeconds).map(program=>this.sampleProgram(program,nowSeconds)));
  }
  private compose(samples:Sample[],nowSeconds:number):Frame{
    const elements=samples.flatMap(({program,scene})=>evaluateScene(scene,Math.max(0,nowSeconds-program.epoch),{bindings:false}).elements)
      .filter(element=>!this.removed.has(element.id));
    for(const element of elements){
      if(element.geometry.children)element.geometry.children=element.geometry.children.filter(key=>!this.removed.has(key));
      const properties:Record<string,unknown>={};
      for(const [key,override] of this.overrides.get(element.id)??[]){
        const progress=override.duration===0?1:Math.max(0,Math.min(1,(nowSeconds-override.start)/override.duration));
        properties[key]=key==='fill'&&progress>0&&progress<1?paletteResolver(this.palette).interpolate(override.from as ColorValue,override.to as ColorValue,progress):interpolate(override.from,override.to,progress);
      }
      if(Object.keys(properties).length)applyReactiveProperties(element,properties as ReactiveProperties);
      const motion=this.motions.get(element.id);
      if(motion)element.position=motion.origin.map((value,index)=>value+motion.velocity[index]*Math.max(0,nowSeconds-motion.start)) as [number,number,number];
    }
    // Resolve against the final host-adjusted pose. Starting unbound also lets
    // connectors recover from a formerly collapsed pose; missing sources retain
    // native binding behavior (hide their directly dependent targets).
    return applyBindings({elements,camera:structuredClone(this.camera),cameraAnimated:false,views:[],...(this.renderOptions.lighting!==undefined?{lighting:structuredClone(this.renderOptions.lighting)}:{})},
      samples.flatMap(({scene})=>scene.bindings??[]));
  }
  async sample(nowSeconds:number):Promise<Frame>{
    this.alive();time(nowSeconds);
    for(let attempt=0;attempt<3;attempt++){
      const revision=this.version;
      try{const sampled=await this.capture(nowSeconds);this.alive();if(revision===this.version)return this.compose(sampled,nowSeconds);}
      catch(error){this.alive();if(revision===this.version)throw error;}
    }
    throw new Error('World changed repeatedly during sampling; retry the next frame');
  }

  private assertHostProperty(scene:CompiledScene,target:string,key:Property):void{
    for(const binding of scene.bindings??[])if(binding.target===target){
      check(key!==(binding.type==='attach'?'position':'points'),`Cannot override binding-owned property: ${key}`);
    }
    check(!scene.reactiveBindings?.some(binding=>binding.target===target&&ownedProperties(binding.properties).includes(key)),
      `Cannot override reactive-owned property: ${key}; replace the program to change ownership`);
  }

  /** Constant local-coordinate velocity begins at actual publication pose. Native
   * position tracks yield to this host channel; reactive/binding owners do not. */
  async setMotion(request:WorldMotionPatch,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);
    check(JSON.stringify(request).length<=limits.patchBytes,'Motion patch size limit exceeded');
    check(Array.isArray(request.changes)&&request.changes.length>0&&request.changes.length<=limits.changes,'Motion change limit exceeded');
    const input=structuredClone(request),seen=new Set<string>();
    for(const change of input.changes){
      id(change.id);check(!seen.has(change.id),'Duplicate changed ID');seen.add(change.id);
      check(Array.isArray(change.velocity)&&change.velocity.length===3&&change.velocity.every(v=>typeof v==='number'&&Number.isFinite(v)),'Invalid velocity');
      const owner=this.owners.get(change.id);check(owner&&!this.removed.has(change.id),'Unknown motion target ID');
      this.assertHostProperty(owner.scene,change.id,'position');
    }
    const originSampledAt=this.now(nowSeconds),sampled=await aborted(options.signal,this.capture(originSampledAt));
    options.signal?.throwIfAborted();this.fresh(input.baseRevision);
    beforeCommit(options);const committedAt=this.now(originSampledAt);
    options.signal?.throwIfAborted();this.fresh(input.baseRevision);
    const byId=new Map(this.compose(sampled,committedAt).elements.map(element=>[element.id,element]));
    const next=new Map(this.motions),overrides=new Map(this.overrides);let changed=false;
    for(const change of input.changes){
      const element=byId.get(change.id);check(element,'Unknown or invisible motion target ID');
      const prior=next.get(change.id);
      if(prior&&prior.velocity.every((v,i)=>v===change.velocity[i]))continue;
      next.set(change.id,{origin:[...element.position],velocity:[...change.velocity],start:committedAt});changed=true;
      const properties=new Map(overrides.get(change.id));properties.delete('position');
      if(properties.size)overrides.set(change.id,properties);else overrides.delete(change.id);
    }
    if(changed){this.motions=next;this.overrides=overrides;this.version++;this.cancelOthers();}
    return {revision:this.version,committedAt,originSampledAt};
  }

  /** Compile/preflight an isolated replacement, then swap ownership atomically.
   * Same-ID current controls retain values. Removed controls disappear; new
   * controls use authored defaults. Retained host channels must remain valid. */
  async replaceProgram(request:ProgramRequest,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);id(request.id);
    check(typeof request.source==='string'&&request.source.length>0&&new TextEncoder().encode(request.source).length<=limits.sourceBytes,'Source size limit exceeded');
    const input=structuredClone(request),previous=this.programs.get(input.id);
    check(previous&&!previous.retired,'Unknown replacement program');
    check(this.pending.size<this.maxPending,'World pending program limit exceeded');
    check(![...this.pending].some(candidate=>candidate.id===input.id),'Duplicate pending program ID');
    const candidate:Candidate={id:input.id,compiler:new SourceCompiler(),controller:new AbortController()};
    const cancel=()=>candidate.controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort',cancel,{once:true});this.pending.add(candidate);let published=false;
    const assertCurrent=()=>{candidate.controller.signal.throwIfAborted();this.fresh(input.baseRevision);check(this.programs.get(input.id)===previous&&!previous.retired,'Stale replacement program');};
    try{
      const scene=candidate.scene=await aborted(candidate.controller.signal,candidate.compiler.compile(input.source,{palette:this.palette,assetCatalog:this.options.assets?.catalog,models:this.models,entityNamespace:previous.entityNamespace}));
      assertCurrent();const ids=this.inspect(scene,previous),values=Object.fromEntries(scene.controls.map(control=>[control.id,control.value as number]));
      const common=scene.controls.filter(control=>Object.hasOwn(previous.state.values,control.id));
      for(const control of common){
        const value=previous.state.values[control.id];check(value>=control.min!&&value<=control.max!,`Retained parameter out of range: ${control.id}`);values[control.id]=value;
      }
      this.assetGeometry.prepare(scene);
      if(this.options.prepare)await aborted(candidate.controller.signal,this.options.prepare(scene,this.assetGeometry,candidate.controller.signal));
      assertCurrent();beforeCommit(options);assertCurrent();
      // Preparation may be slow. Preflight callbacks at the retained epoch only
      // after resources are ready, including programs with no shared controls.
      // This records a sampled-time preflight, not a proof about future callback
      // values. A second guard checks evidence again after asynchronous sampling.
      const originSampledAt=this.now(nowSeconds);
      let snapshot=scene;
      if(common.length||scene.reactiveBindings?.some(binding=>binding.time)){
        const local=Math.max(0,Math.min(scene.duration,originSampledAt-previous.epoch)),changed=common.map(control=>control.id);
        const updates=await aborted(candidate.controller.signal,candidate.compiler.update(scene,values,changed,{},local));assertCurrent();
        snapshot={...scene,controls:scene.controls.map(control=>({...control,value:values[control.id]})),reactiveBindings:mergeReactiveUpdates(scene,updates,changed,local),
          ...(scene.reactiveBindings?.some(binding=>binding.time)?{reactiveTime:local}:{})};
      }
      assertCurrent();this.inspect(scene,previous);beforeCommit(options);
      const committedAt=this.now(nowSeconds);assertCurrent();
      const frame=evaluateScene(snapshot,Math.max(0,committedAt-previous.epoch),{bindings:false}),byId=new Map(frame.elements.map(element=>[element.id,element]));
      for(const key of ids){
        if(!previous.ids.has(key))continue;
        const properties=this.overrides.get(key),motion=this.motions.get(key);
        if(!properties?.size&&!motion)continue;
        const element=byId.get(key);check(element,'Retained host target is invisible in replacement');
        for(const [property,override] of properties??[]){
          check(!geometryKeys.has(property)||!scene.tracks.some(track=>track.action.type==='morph'&&track.action.ids.includes(key)),
            `Retained host geometry conflicts with replacement morph: ${property}`);
          for(const owned of ownedProperties({[property]:override.to}))this.assertHostProperty(scene,key,owned as Property);
          validateReactiveProperties({[property]:override.to},element,scene);
          if(override.duration>0&&property!=='fill')check(numericShape(readProperty(element,property),override.to),'Retained host target shape changed');
        }
        if(motion)this.assertHostProperty(scene,key,'position');
      }
      const program:Program={id:input.id,source:input.source,entityNamespace:previous.entityNamespace,compiler:candidate.compiler,scene,ids,epoch:previous.epoch,readers:0,retired:false,state:{values,snapshot}};
      // Validation above is synchronous. No await or host hook until publication.
      this.programs.set(input.id,program);
      for(const key of previous.ids)if(!ids.has(key)){this.removed.add(key);this.owners.delete(key);this.overrides.delete(key);this.motions.delete(key);}
      for(const key of ids){this.reserved.add(key);this.owners.set(key,program);}
      published=true;this.version++;this.cancelOthers(candidate);this.retire(previous);
      return {revision:this.version,committedAt,originSampledAt};
    }finally{
      options.signal?.removeEventListener('abort',cancel);this.pending.delete(candidate);
      if(!published)candidate.compiler.dispose();this.assetGeometry.retain(this.scenes());
    }
  }

  /** Atomic publication of host values and geometry. Native callbacks must be pure
   * functions of inputs/immutable captures: their retained closure mutations are
   * not rollbackable, including after cancellation or rejected callback output. */
  async setParameters(request:WorldParameterPatch,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);id(request.programId);
    check(request.values&&typeof request.values==='object'&&!Array.isArray(request.values),'Invalid parameter values');
    check(JSON.stringify(request).length<=limits.patchBytes,'Parameter patch size limit exceeded');
    const input=structuredClone(request),program=this.programs.get(input.programId);
    check(program&&!program.retired,'Unknown parameter program');
    const state=program.state,nextValues={...state.values},keys=Object.keys(input.values),changed:string[]=[];
    check(keys.length>0&&keys.length<=limits.parameterChanges,'Parameter change limit exceeded');
    for(const key of keys){
      const control=program.scene.controls.find(control=>control.id===key),value=input.values[key];
      check(control&&control.kind==='slider'&&control.reactive===true,'Unknown numeric parameter');
      check(typeof value==='number'&&Number.isFinite(value)&&value>=control.min!&&value<=control.max!,`Parameter out of range: ${key}`);
      const dependents=program.scene.reactiveBindings?.filter(binding=>binding.controls.includes(key))??[];
      check(dependents.length>0,`Unused parameter: ${key}`);
      check(dependents.every(binding=>!this.removed.has(binding.target)),'Parameter target was removed');
      if(value!==state.values[key]){nextValues[key]=value;changed.push(key);}
    }
    const assertCurrent=()=>{
      options.signal?.throwIfAborted();this.fresh(input.baseRevision);
      check(this.programs.get(input.programId)===program&&!program.retired&&program.state===state,'Stale parameter program');
    };
    if(!changed.length){
      beforeCommit(options);const committedAt=this.now(nowSeconds);assertCurrent();
      return {revision:this.version,committedAt};
    }
    check(!program.parameterPending,'Parameter evaluation already pending for this program');
    check(this.pendingParameters<limits.parameterEvaluations,'World pending parameter evaluation limit exceeded');
    const originSampledAt=this.now(nowSeconds),local=Math.max(0,Math.min(program.scene.duration,originSampledAt-program.epoch));
    assertCurrent();program.parameterPending=true;this.pendingParameters++;program.readers++;
    const evaluate=async()=>{
      try{
        // Full values and current local time preserve mixed parameter/time bindings.
        const updates=await program.compiler.update(program.scene,nextValues,changed,{},local);
        // Validated reactive fields cannot change asset/model/image references or
        // topology; material/texture are inline numeric/procedural data only.
        // Existing leases and renderer initialization remain sufficient, as for
        // time samples. Resource-bearing reactive fields would need preparation.
        return {...state.snapshot,controls:state.snapshot.controls.map(control=>({...control,value:nextValues[control.id]})),
          reactiveBindings:mergeReactiveUpdates(state.snapshot,updates,changed,local),
          ...(state.snapshot.reactiveBindings?.some(binding=>binding.time)?{reactiveTime:local}:{})};
      }finally{
        // The cancellation wrapper may have returned already; do not release the
        // shared compiler or admission slot until its actual evaluation settles.
        program.parameterPending=false;this.pendingParameters--;program.readers--;this.cleanup(program);
      }
    };
    const snapshot=await aborted(options.signal,evaluate());assertCurrent();
    beforeCommit(options);const committedAt=this.now(originSampledAt);assertCurrent();
    // No awaits or hooks between final checks and this single state publication.
    program.state={values:nextValues,snapshot};this.version++;this.cancelOthers();
    return {revision:this.version,committedAt,originSampledAt};
  }

  async apply(request:WorldPatch,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);
    check(JSON.stringify(request).length<=limits.patchBytes,'Patch size limit exceeded');
    check(Array.isArray(request.changes)&&request.changes.length<=limits.changes,'Patch change limit exceeded');
    check(request.remove===undefined||Array.isArray(request.remove)&&request.remove.length<=limits.changes,'Removal limit exceeded');
    check(request.changes.length+(request.remove?.length??0)>0,'Empty patch');
    const input=structuredClone(request),originSampledAt=this.now(nowSeconds);
    // Cancellation abandons this sample; it must not dispose shared live compilers.
    const sampled=await aborted(options.signal,this.capture(originSampledAt));this.fresh(input.baseRevision);options.signal?.throwIfAborted();
    let committedAt=this.now(originSampledAt);
    // Re-evaluate native timeline tracks at actual commit. Time callbacks were
    // sampled at originSampledAt; animated edits to their properties are rejected.
    const frame=this.compose(sampled,committedAt),byId=new Map(frame.elements.map(element=>[element.id,element]));
    const nextOverrides=new Map(this.overrides),nextRemoved=new Set(this.removed),changed=new Set<string>();
    for(const change of input.changes){
      id(change.id);check(!changed.has(change.id),'Duplicate changed ID');changed.add(change.id);
      const element=byId.get(change.id),owner=this.owners.get(change.id);check(element&&owner,'Unknown or invisible target ID');
      const duration=change.duration??0;check(Number.isFinite(duration)&&duration>=0&&duration<=60,'Invalid transition duration');
      for(const binding of owner.scene.bindings??[])if(binding.target===change.id){
        const owned=binding.type==='attach'?'position':'points';
        check(!Object.hasOwn(change.props??{},owned),`Cannot override binding-owned property: ${owned}`);
      }
      validateReactiveProperties(change.props,element,owner.scene);
      const overrides=new Map(nextOverrides.get(change.id));
      for(const [rawKey,value] of Object.entries(change.props)){
        const key=rawKey as Property,from=readProperty(element,key);
        check(!owner.scene.reactiveBindings?.some(binding=>binding.target===change.id&&binding.controls.length>0&&ownedProperties(binding.properties).includes(key)),
          `Cannot override parameter-owned property: ${key}`);
        if(duration>0){
          check(!owner.scene.reactiveBindings?.some(binding=>binding.target===change.id&&binding.time&&Object.hasOwn(binding.properties,key)),
            'Animating a time-bound property requires a live rebase policy');
          check(key==='fill'||numericShape(from,value),'This property supports set only, not interpolation');
        }
        overrides.set(key,{from:structuredClone(from),to:structuredClone(value),start:committedAt,duration});
      }
      nextOverrides.set(change.id,overrides);
    }
    const removeTree=(key:string)=>{
      check(this.owners.has(key)&&!this.removed.has(key),'Unknown removed ID');
      check(!changed.has(key),'Cannot change and remove the same entity');
      if(nextRemoved.has(key))return;nextRemoved.add(key);nextOverrides.delete(key);
      const owner=this.owners.get(key)!;
      const definition=[...owner.scene.initial,...owner.scene.lifecycle.flatMap(event=>event.elements??[])].find(element=>element.id===key);
      for(const child of definition?.geometry.children??[])removeTree(child);
    };
    for(const key of input.remove??[]){id(key);removeTree(key);}
    beforeCommit(options);
    const publicationTime=this.now(committedAt);
    if(publicationTime!==committedAt){
      const latest=new Map(this.compose(sampled,publicationTime).elements.map(element=>[element.id,element]));
      for(const change of input.changes){
        const element=latest.get(change.id);check(element,'Target disappeared before publication');
        validateReactiveProperties(change.props,element,this.owners.get(change.id)!.scene);
        for(const key of Object.keys(change.props) as Property[]){
          const override=nextOverrides.get(change.id)!.get(key)!,from=readProperty(element,key);
          check(override.duration===0||key==='fill'||numericShape(from,override.to),'Target shape changed before publication');
          override.from=structuredClone(from);override.start=publicationTime;
        }
      }
      committedAt=publicationTime;
    }
    // No awaits after validation: publication is one host-JS transaction.
    options.signal?.throwIfAborted();this.fresh(input.baseRevision);
    this.overrides=nextOverrides;this.removed=nextRemoved;
    for(const change of input.changes)if(Object.hasOwn(change.props,'position'))this.motions.delete(change.id);
    for(const key of nextRemoved)this.motions.delete(key);
    this.version++;this.cancelOthers();
    for(const [key,program] of this.programs)if([...program.ids].every(entity=>this.removed.has(entity))){
      this.programs.delete(key);for(const entity of program.ids)this.owners.delete(entity);this.retire(program);
    }
    this.assetGeometry.retain(this.scenes());return {revision:this.version,committedAt,originSampledAt};
  }

  /** Caller receives immutable source text; source is deliberately absent from compact summaries. */
  programSource(programId:string):string|undefined{this.alive();return this.programs.get(programId)?.source;}
  summary(){return {revision:this.version,disposed:this.stopped,pendingPrograms:this.pending.size,
    motions:[...this.motions].map(([id,motion])=>({id,...structuredClone(motion)})),
    programs:[...this.programs.values()].map(program=>({id:program.id,epoch:program.epoch,duration:program.scene.duration,...(program.entityNamespace?{entityNamespace:program.entityNamespace}:{}),ids:[...program.ids].filter(key=>!this.removed.has(key)),
      parameters:program.scene.controls.map(control=>({id:control.id,label:control.label,default:control.default as number,value:program.state.values[control.id],min:control.min!,max:control.max!,step:control.step,
        dependents:(program.scene.reactiveBindings??[]).filter(binding=>binding.controls.includes(control.id)).map(binding=>({target:binding.target,properties:ownedProperties(binding.properties)}))}))})),
    entityIds:[...this.owners.keys()].filter(key=>!this.removed.has(key)),reservedIdCount:this.reserved.size,
    limitations:['Reactive sliders are host parameters only; no control UI, behavior/input, cross-program attachments, audio, or per-program views/camera animation','First committed program chooses world camera; later program camera defaults are ignored',
      'Time callbacks stop at the authored program duration','Animated edits to time-callback-owned properties require a separate rebase policy','No history replay before committed mutations']};}
  dispose(){if(this.stopped)return;this.stopped=true;for(const candidate of this.pending){candidate.controller.abort(new Error('World disposed'));candidate.compiler.dispose();}
    for(const program of this.programs.values())this.retire(program);this.programs.clear();this.owners.clear();this.overrides.clear();this.motions.clear();this.assetGeometry.dispose();}
}
