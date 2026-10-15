/** Experimental persistent world. No production player or scene protocol changes.
 * New sandbox programs own new IDs. Host property overrides layer over freshly
 * sampled old programs, retaining their untouched tracks and time callbacks.
 * There is deliberately no replay history, controls, input behavior, camera
 * authoring, cross-program attachment, or live rebase of a callback-owned tween.
 */
import { SourceCompiler } from '../../../shared/animlib/src/compiler-client.js';
import { validateCompiledScene } from '../../../shared/animlib/src/compiler.js';
import { evaluateScene } from '../../../shared/animlib/src/timeline.js';
import { applyBindings } from '../../../shared/animlib/src/bindings.js';
import { applyReactiveProperties, mergeReactiveUpdates, validateReactiveProperties } from '../../../shared/animlib/src/reactive.js';
import { SceneAssets } from '../../../shared/animlib/src/scene-assets.js';
import { paletteResolver } from '../../../shared/animlib/src/palette.js';
import { validateModelMetadata } from '../../../shared/animlib/src/model-metadata.js';
import type { ModelMetadata } from '../../../shared/animlib/src/model-types.js';
import type { AssetRegistry } from '../../../shared/animlib/src/asset-types.js';
import type { CameraState, ColorPalette, ColorValue, CompiledScene, ElementState, Frame, ReactiveProperties } from '../../../shared/animlib/src/types.js';

export interface WorldOptions {
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
type Property = keyof ReactiveProperties;
type Override = { from: unknown; to: unknown; start: number; duration: number };
type Program = { id: string; compiler: SourceCompiler; scene: CompiledScene; ids: Set<string>; epoch: number; readers: number; retired: boolean };
type Candidate = { id: string; compiler: SourceCompiler; controller: AbortController; scene?: CompiledScene };
type Sample = { program: Program; scene: CompiledScene };
const geometryKeys = new Set(['radius','vertices','normals','material','texture','scalarColors','points']);
const limits = { sourceBytes: 128_000, patchBytes: 1_000_000, changes: 256, vertices: 100_000 };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function id(value: unknown): asserts value is string { check(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(value),'Invalid stable ID'); }
function time(value: unknown): asserts value is number { check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12,'Invalid world time'); }
function json(value: unknown, depth=0): void {
  check(depth<=16,'Input nesting limit exceeded');
  if (value===null||typeof value==='string'||typeof value==='boolean') return;
  if(typeof value==='number'){check(Number.isFinite(value),'Input must be finite');return;}
  check(typeof value==='object'&&value!==null,'Input must contain JSON values');
  check(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null,'Input must contain plain data');
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

export class LiveWorld {
  private version=0;
  private stopped=false;
  private programs=new Map<string,Program>();
  private pending=new Set<Candidate>();
  private owners=new Map<string,Program>();
  private reserved=new Set<string>();
  private removed=new Set<string>();
  private overrides=new Map<string,Map<Property,Override>>();
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
  get rendererOptions():CompiledScene['options']{return structuredClone(this.renderOptions);}
  private alive(){check(!this.stopped,'World disposed');}
  private fresh(revision:number){this.alive();check(Number.isSafeInteger(revision)&&revision===this.version,'Stale world revision');}
  private now(lowerBound:number){time(lowerBound);const value=this.clock();time(value);return Math.max(value,lowerBound);}
  private scenes(){return [...this.programs.values()].map(program=>program.scene).concat([...this.pending].flatMap(candidate=>candidate.scene?[candidate.scene]:[]));}
  private cancelOthers(except?:Candidate){for(const candidate of this.pending)if(candidate!==except)candidate.controller.abort(new Error('Stale world revision'));}
  private cleanup(program:Program){if(program.retired&&program.readers===0)program.compiler.dispose();}
  private retire(program:Program){program.retired=true;this.cleanup(program);}

  private inspect(scene:CompiledScene):Set<string>{
    validateCompiledScene(scene,this.options.assets?.catalog);
    check(scene.controls.length===0,'Controls are not implemented by the experimental world');
    check(!scene.options.audio,'Audio is not implemented by the experimental world');
    check(!scene.views?.length&&!scene.tracks.some(track=>track.action.type==='camera'),'Program camera/view authoring is not implemented');
    check(!scene.behaviors?.length,'Behaviors are not implemented');
    // validateCompiledScene has already checked binding references, spaces and
    // dependency cycles within this program. Disjoint IDs prevent cross-program access.
    const all=[...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])];
    const ids=new Set<string>();let vertices=0;
    for(const element of all){id(element.id);ids.add(element.id);vertices+=(element.geometry.vertices?.length??0)+(element.geometry.points?.length??0);}
    check(ids.size>0,'Program must create geometry');check(vertices<=limits.vertices,'Program geometry limit exceeded');
    check(this.reserved.size+ids.size<=this.maxObjects,'World object limit exceeded');
    for(const key of ids)check(!this.reserved.has(key),`Duplicate or previously owned entity ID: ${key}`);
    return ids;
  }

  async addProgram(request:ProgramRequest,nowSeconds:number,options:WorldTransactionOptions={}):Promise<WorldCommit>{
    options={signal:options.signal,beforeCommit:options.beforeCommit};options.signal?.throwIfAborted();
    this.alive();json(request);this.fresh(request.baseRevision);time(nowSeconds);id(request.id);
    check(typeof request.source==='string'&&request.source.length>0&&new TextEncoder().encode(request.source).length<=limits.sourceBytes,'Source size limit exceeded');
    check(this.programs.size<this.maxPrograms&&this.pending.size<this.maxPending,'World program/pending limit exceeded');
    check(!this.programs.has(request.id)&&![...this.pending].some(candidate=>candidate.id===request.id),'Duplicate program ID');
    // Copy before awaiting: callers cannot change the submitted transaction.
    const input=structuredClone(request);
    const candidate:Candidate={id:input.id,compiler:new SourceCompiler(),controller:new AbortController()};
    const cancel=()=>candidate.controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort',cancel,{once:true});
    this.pending.add(candidate);let published=false;
    try{
      // No previous frame: the sandbox cannot acquire or mutate existing IDs.
      const scene=candidate.scene=await aborted(candidate.controller.signal,candidate.compiler.compile(input.source,{palette:this.palette,assetCatalog:this.options.assets?.catalog,models:this.models}));
      this.fresh(input.baseRevision);candidate.controller.signal.throwIfAborted();this.inspect(scene);
      this.assetGeometry.prepare(scene);
      if(this.options.prepare)await aborted(candidate.controller.signal,this.options.prepare(scene,this.assetGeometry,candidate.controller.signal));
      this.fresh(input.baseRevision);candidate.controller.signal.throwIfAborted();
      check(this.programs.size<this.maxPrograms,'World program limit exceeded');const ids=this.inspect(scene);
      beforeCommit(options);
      const committedAt=this.now(nowSeconds);
      const program:Program={id:input.id,compiler:candidate.compiler,scene,ids,epoch:committedAt,readers:0,retired:false};
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
      const local=Math.max(0,Math.min(program.scene.duration,nowSeconds-program.epoch));
      if(!program.scene.reactiveBindings?.some(binding=>binding.time))return {program,scene:program.scene};
      const updates=await program.compiler.update(program.scene,{},[],{},local);
      return {program,scene:{...program.scene,reactiveBindings:mergeReactiveUpdates(program.scene,updates,[],local),reactiveTime:local}};
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
    this.overrides=nextOverrides;this.removed=nextRemoved;this.version++;this.cancelOthers();
    for(const [key,program] of this.programs)if([...program.ids].every(entity=>this.removed.has(entity))){
      this.programs.delete(key);for(const entity of program.ids)this.owners.delete(entity);this.retire(program);
    }
    this.assetGeometry.retain(this.scenes());return {revision:this.version,committedAt,originSampledAt};
  }

  summary(){return {revision:this.version,disposed:this.stopped,pendingPrograms:this.pending.size,
    programs:[...this.programs.values()].map(program=>({id:program.id,epoch:program.epoch,duration:program.scene.duration,ids:[...program.ids].filter(key=>!this.removed.has(key))})),
    entityIds:[...this.owners.keys()].filter(key=>!this.removed.has(key)),reservedIdCount:this.reserved.size,
    limitations:['No controls, behavior/input, cross-program attachments, audio, or per-program views/camera animation','First committed program chooses world camera; later program camera defaults are ignored',
      'Time callbacks stop at the authored program duration','Animated edits to time-callback-owned properties require a separate rebase policy','No history replay before committed mutations']};}
  dispose(){if(this.stopped)return;this.stopped=true;for(const candidate of this.pending){candidate.controller.abort(new Error('World disposed'));candidate.compiler.dispose();}
    for(const program of this.programs.values())this.retire(program);this.programs.clear();this.owners.clear();this.overrides.clear();this.assetGeometry.dispose();}
}
