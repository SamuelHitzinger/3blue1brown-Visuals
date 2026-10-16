import {expect,test} from 'bun:test';
import {LiveWorld} from '../realtime-world/world.js';
import type {Frame} from '../../../shared/animlib/src/types.js';
import {CommittedContextJournal} from './committed-context.js';
import {buildWorldContext} from './world-context.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
type Summary=ReturnType<LiveWorld['summary']>;
const encoded=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
function emptySummary():Summary{const world=new LiveWorld();try{return world.summary();}finally{world.dispose();}}
function journal(source='export default scene({},s=>s.wait(1));'){
  const value=new CommittedContextJournal();value.record({revision:1,runId:'run',planId:'plan',committedAtMs:1,evidence:{changes:[{id:'speech',version:1}],context:[]},operation:{action:'add',programId:'plot',source}});return value;
}
function within(context:ReturnType<typeof buildWorldContext>,overhead=0){expect(JSON.stringify(context).length).toBeLessThanOrEqual(60000);expect(encoded(context)+overhead).toBeLessThanOrEqual(120000);}

test('bounds the real 20 sliders by 100 shared bindings reproduction without clipping parameters or journal source',async()=>{
  const source=`export default scene({},s=>{const p=Array.from({length:20},(_,i)=>s.slider('p'+i,{reactive:true,default:1,min:0,max:4}));for(let i=0;i<100;i++)s.bind(s.sphere('ball'+i),p,(...v)=>({radius:v.reduce((a,b)=>a+b,0)/20}));s.wait(10);});`;
  expect(source.length).toBeLessThan(400);
  const world=new LiveWorld({clock:()=>0});
  try{
    await world.addProgram({id:'plot',source,baseRevision:0},0);const summary=world.summary(),frame=await world.sample(2);
    expect(JSON.stringify(summary).length).toBeGreaterThan(60000);
    const result=buildWorldContext({summary,frame,sampledRevision:1,sampledAt:{serverUpperMs:2000},requestOverheadBytes:1000,journal:journal(source)});
    within(result,1000);expect(result.summary.programs[0].parameters).toHaveLength(20);
    for(let i=0;i<20;i++){
      const parameter=result.summary.programs[0].parameters[i];expect(parameter).toMatchObject({id:'p'+i,min:0,max:4,default:1,value:1,usable:true,dependentCount:100});
      expect(parameter.omittedDependentCount+parameter.dependents.length).toBe(100);expect(parameter.opaque).toBe(true);
    }
    expect(result.omissions.dependencies).toBeGreaterThan(0);expect(result.opaque).toBe(true);
    expect(result.committedOperations.records[0]?.operation).toEqual({action:'add',programId:'plot',source});
    expect(summary.programs[0].parameters[0].dependents).toHaveLength(100);
  }finally{world.dispose();}
});

test('preserves exact included Unicode IDs and numeric descriptors within both independent budgets',()=>{
  const summary=emptySummary(),ids=Array.from({length:2000},(_,i)=>'物'.repeat(40)+i);
  summary.revision=1;summary.entityIds=ids;summary.reservedIdCount=2000;
  summary.programs=Array.from({length:32},(_,p)=>{
    const owned=ids.slice(p*62,(p+1)*62);
    return {id:'講義'.repeat(30)+p,epoch:0,duration:10,ids:owned,parameters:Array.from({length:100},(_,i)=>({
      id:'係数'.repeat(30)+i,label:'長い見出し'.repeat(200),default:1,value:1.234,min:.1,max:4,step:.1,
      dependents:owned.map(target=>({target,properties:['radius']})),
    }))};
  });
  const frame={elements:ids.map(id=>({id,geometry:{kind:'sphere'},position:[0,0,0],rotation:[0,0,0],scale:1,opacity:1,fill:'BLUE'}))} as Frame;
  for(const overhead of [0,60000,115000]){
    const result=buildWorldContext({summary,frame,sampledRevision:1,sampledAt:{unicode:'時'.repeat(10000)},requestOverheadBytes:overhead,journal:journal('source-'+ '解'.repeat(30000))});
    within(result,overhead);expect(result.omissions.parameters).toBeGreaterThan(0);expect(result.omissions.elements).toBeGreaterThan(0);
    expect(result.omissions.programs+result.summary.programs.length).toBe(32);
    expect(result.omissions.entityIds+result.summary.entityIds.length).toBe(2000);
    expect(result.committedOperations.opaque).toBe(true);expect(result.committedOperations.omittedRevisionRanges).toEqual([{from:1,to:1}]);
    for(const program of result.summary.programs){
      const original=summary.programs.find(candidate=>candidate.id===program.id)!;expect(original).toBeDefined();
      for(const parameter of program.parameters){const originalParameter=original.parameters.find(candidate=>candidate.id===parameter.id)!;
        expect(parameter).toMatchObject({id:originalParameter.id,value:1.234,min:.1,max:4,default:1,step:.1});
      }
    }
  }
});

test('describes unavailable parameter targets instead of advertising usable updates',async()=>{
  const world=new LiveWorld({clock:()=>0});
  try{
    await world.addProgram({id:'plot',source:"export default scene({},s=>{const k=s.slider('k',{reactive:true,default:1,min:0,max:4});const a=s.sphere('a'),b=s.sphere('b');s.bind(a,[k],k=>({radius:k}));s.bind(b,[k],k=>({radius:k}));s.wait(10);});",baseRevision:0},0);
    await world.apply({baseRevision:1,changes:[],remove:['a']},1);
    const result=buildWorldContext({summary:world.summary(),sampledRevision:2,sampledAt:null,requestOverheadBytes:0,journal:new CommittedContextJournal()});
    expect(result.summary.programs[0].parameters[0]).toMatchObject({id:'k',usable:false,reason:'dependent-target-removed',dependentCount:2});
    expect(result.unusableParameterCount).toBe(1);
  }finally{world.dispose();}
});

test('does not expose stale sampled elements as the current world',()=>{
  const summary=emptySummary();summary.revision=2;summary.entityIds=['present'];
  const result=buildWorldContext({summary,sampledRevision:1,sampledAt:{serverUpperMs:1},frame:{elements:[{id:'stale'}]} as Frame,requestOverheadBytes:0,journal:new CommittedContextJournal()});
  expect(result.elements).toEqual([]);expect(result.frameCurrent).toBe(false);expect(result.omissions.elements).toBe(1);expect(result.elementsTruncated).toBe(true);expect(result.opaque).toBe(true);
});

test('keeps omission metadata when overhead leaves little room and rejects impossible requests cleanly',()=>{
  const summary=emptySummary(),history=journal('large'+ 'x'.repeat(100000));
  const result=buildWorldContext({summary,sampledRevision:0,sampledAt:null,requestOverheadBytes:118000,journal:history});
  within(result,118000);expect(result.committedOperations.records).toEqual([]);expect(result.committedOperations.omittedRevisionCount).toBe(1);
  for(const overhead of [119999,120000,120001,-1,NaN])expect(()=>buildWorldContext({summary,sampledRevision:0,sampledAt:null,requestOverheadBytes:overhead,journal:history})).toThrow(/budget|overhead/i);
});

test('is deterministic, detached and leaves complete small history intact',()=>{
  const summary=emptySummary(),history=journal(),input={summary,sampledRevision:0,sampledAt:{browserAtMs:5},requestOverheadBytes:0,journal:history};
  const first=buildWorldContext(input),second=buildWorldContext(input);expect(first).toEqual(second);
  expect(first.committedOperations.wholeHistoryComplete).toBe(true);first.summary.limitations.length=0;
  expect(summary.limitations.length).toBeGreaterThan(0);(first.sampledAt as {browserAtMs:number}).browserAtMs=99;
  expect(input.sampledAt.browserAtMs).toBe(5);
});

test('final completeness flags cannot overrun a context at the exact byte boundary',()=>{
  const summary=emptySummary();
  for(let bytes=1000;bytes<=2000;bytes++){
    const overhead=120000-bytes;
    within(buildWorldContext({summary,sampledRevision:0,sampledAt:null,requestOverheadBytes:overhead,journal:new CommittedContextJournal()}),overhead);
  }
});

test('whole source records at the character and UTF-8 boundaries leave room for final completeness flags',()=>{
  const summary=emptySummary(),frame={elements:[]} as unknown as Frame;
  for(const source of ['x'.repeat(58459),'解'.repeat(19486)+'x'])for(const delta of [-2,-1,0,1,2]){
    const exactSource=delta<0?source.slice(0,delta):source+'x'.repeat(delta),overhead=source.startsWith('解')?60000:0;
    const result=buildWorldContext({summary,frame,sampledRevision:0,sampledAt:null,requestOverheadBytes:overhead,journal:journal(exactSource)});
    within(result,overhead);
    if(result.committedOperations.records.length){
      expect(result.committedOperations.records[0].operation).toEqual({action:'add',programId:'plot',source:exactSource});
      expect(result.committedOperations.omittedRevisionCount).toBe(0);
    }else{
      expect(result.committedOperations.omittedRevisionCount).toBe(1);expect(result.committedOperations.omittedRevisionRanges).toEqual([{from:1,to:1}]);
    }
  }
});
