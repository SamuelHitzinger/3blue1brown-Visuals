import {createConnections} from './connections.mjs';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const string={type:'string'},number={type:'number'},object={type:'object'},array={type:'array',items:object};
const checks={type:'array',maxItems:64,items:{type:'object',properties:{id:string,property:{enum:['position','rotation','opacity','scale','radius','fill']},expected:{},tolerance:number},required:['id','property','expected']}};
const common={sessionId:string,baseRevision:{type:'integer',minimum:0},verify:{type:'object',properties:{checks},required:['checks']},preview:{type:'boolean'}};
const tool=(name,description,properties={},required=[],session=true)=>({name:`animlib_${name}`,description,inputSchema:{type:'object',properties:{...(session?common:{}),...properties},required:[...(session?['sessionId']:[]),...required],additionalProperties:false}});
export const TOOLS=[
  tool('sessions','List existing local and registered sessions. Reuse intended connected viewer.',{},[],false),
  tool('create','Create persistent animlib session. Open returned viewerUrl once before editing.',{title:string},[],false),
  tool('connect','Register another local Animlib Studio runtime file for viewer reuse.',{runtimePath:string},['runtimePath'],false),
  tool('help','Compact schemas and examples; no repository reads needed.',{topic:{enum:['scene','flow','program','verification']}},[],false),
  tool('scene','Add structured geometry or recipe to retained world; one call may verify and preview. IDs must be new.',{scene:object,recipe:{enum:['orbit','molecule','wave']},programId:string}),
  tool('patch','Atomic patch of existing objects; preserve untouched motion. duration in seconds, 0–60.',{changes:array,remove:{type:'array',items:string}}),
  tool('program','Add arbitrary sandboxed animlib source. Existing authoring library available; live-world restrictions apply.',{id:string,source:string},['id','source']),
  tool('replace','Replace one existing sandbox program, preserving its epoch and compatible host overrides.',{id:string,source:string},['id','source']),
  tool('parameters','Update declared reactive slider values without replacing program.',{programId:string,values:object},['programId','values']),
  tool('motion','Set constant local velocity [x,y,z] on existing objects. Retained host channel, no per-frame tool calls.',{changes:array},['changes']),
  tool('flow','Submit sequenced patch cues. Interrupt replaces future queue; append continues. Uses local animlib interpolation.',{source:string,sequence:{type:'integer',minimum:0},mode:{enum:['interrupt','append']},cues:array},['source','sequence','cues']),
  tool('control','Pause/resume virtual time or cancel future cues. Cancel keeps already-running transitions.',{operation:{enum:['pause','resume','cancel']}},['operation']),
  tool('inspect','Compact revision, programs, IDs, parameters and flow status. Source omitted.'),
  tool('verify','Check sampled native properties; optionally return rendered PNG. No semantic quality claim.',{checks},['checks']),
];
const names=new Set(TOOLS.map(t=>t.name));
export function createTools(bridge){
  const connections=createConnections(bridge);
  return async(name,args={})=>{
    if(name==='animlib_runtime'){
      if(args.operation==='status')return {protocol:1,sessions:bridge.list()};
      if(args.operation==='command'){
        if(!['scene','patch','program','replace','parameters','motion','flow','pause','resume','cancel','inspect','verify'].includes(args.kind))throw Error('Unknown runtime command');
        return bridge.command(args.sessionId,args.kind,args.params??{});
      }
      throw Error('Unknown runtime operation');
    }
    if(!names.has(name))throw Error('Unknown tool');
    const kind=name.slice(8);
    if(kind==='sessions')return {sessions:await connections.list()};
    if(kind==='create')return bridge.create(args);
    if(kind==='connect')return connections.connect(args.runtimePath);
    if(kind==='help')return help(args.topic);
    const {sessionId,...params}=args;
    if(typeof sessionId!=='string')throw Error('sessionId required');
    let command=kind;
    if(kind==='control'){command=params.operation;delete params.operation;if(!['pause','resume','cancel'].includes(command))throw Error('Invalid control');}
    const result=await connections.command(sessionId,command,params);
    if(result.imageData){
      const file=path.join(bridge.dataDir,'exports',`${randomUUID()}.png`);
      await writeFile(file,Buffer.from(result.imageData,'base64'),{flag:'wx'});
      result.preview={path:file,format:'png'};
    }
    return result;
  };
}
function help(topic){
  const workflow='sessions → scene/program/patch with optional verify:{checks:[...]} and preview:true in ONE call. Reuse explicit session. Viewer stays open. No per-frame tool calls. Acceptance is not semantic verification.';
  if(topic==='flow')return {workflow,example:{source:'lecture',sequence:1,cues:[{id:'move',durationMs:500,changes:[{id:'ball',props:{position:[2,0,0]}}]}]},
    timing:'atMs uses session playhead; omit for sequential scheduling. Interrupt replaces pending queue, current property tweens rebase on sampled pose. Append starts after prior queue. Duration 0–60000 ms. Queue 128. More than 1 second late skips cue and reports lastError.',
    recovery:'Restored sessions are paused. control resume explicitly. cancel removes pending cues only; pause freezes active motion too.'};
  if(topic==='program')return {workflow,example:{id:'custom',source:'export default scene({mode:"3d",end:"hold"},s=>{ const b=s.box("box",{width:1,height:1,depth:1,fill:"BLUE"});s.bind(b,[s.time],t=>({rotation:[0,t,0]}));s.wait(3600); });'},
    api:'Existing animlib s.compose/s.schedule, scientific geometry, custom mesh, binding and timeline APIs remain available. Source runs in bounded QuickJS. No imports or browser APIs.',
    limitations:'LiveWorld rejects audio, behavior controls, animated cameras/views and cross-program attachments. First program chooses camera. Time bindings stop at authored duration. Parameter-bound properties require parameters or program replacement.'};
  if(topic==='verification')return {workflow,example:{checks:[{id:'ball',property:'position',expected:[2,0,0],tolerance:.001}],preview:true},
    properties:['position','rotation','opacity','scale','radius','fill'],scope:'Checks sample now; wait for a transition endpoint or pause deliberately. PNG is native renderer evidence, not semantic approval. Applied changes remain even when checks fail.'};
  return {workflow,scene:{mode:'2d',objects:[{id:'ball',type:'circle',props:{radius:.5,fill:'BLUE'}}]},
    patch:{changes:[{id:'ball',props:{position:[2,0,0],fill:'TEAL'},duration:.35}]},
    primitives:['circle','sphere','rectangle','box','line','arrow','path','text','latex','mesh'],
    colors:'Use animlib palette tokens BLUE, TEAL, YELLOW, WHITE, RED, GREY, PURPLE; none for transparent.',
    recipes:{orbit:'Schematic rotating 3D planet; 1 hour native time binding.',molecule:'Schematic water geometry; supplied illustrative coordinates, not simulation.',wave:'Animated sampled sine wave.'},
    limits:'32 retained programs, 2000 lifetime object IDs, 256 objects per structured call, 128 KB source, 512 recorded mutations/2 MB checkpoint. Start new session at limit. Use patches for edits.'};
}
export function mcpResult(result){
  const {imageData,...summary}=result;
  return {content:[{type:'text',text:JSON.stringify(summary)},...(imageData?[{type:'image',mimeType:'image/png',data:imageData}]:[])],structuredContent:summary};
}
