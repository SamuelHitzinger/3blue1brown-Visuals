import {afterEach,expect,test} from 'bun:test';
import {LiveWorld,type WorldOptions} from '../../../shared/animlib/src/live-world.js';
import {buildWorldContext} from '../../../shared/animlib/src/live-context.js';
import {CommittedContextJournal} from '../../../shared/animlib/src/live-journal.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds:LiveWorld[]=[];
afterEach(()=>{for(const world of worlds.splice(0))world.dispose();});
const source=`export default scene({end:'hold'},s=>{s.circle('AD',{radius:.3});s.wait(60);});`;
function world(options:WorldOptions={}){const result=new LiveWorld({clock:()=>0,...options});worlds.push(result);return result;}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}

test('opt-in namespaces isolate repeated local IDs and preserve exact source/context ownership',async()=>{
  const live=world({namespaceEntities:true});
  await live.addProgram({id:'first',source,baseRevision:0},0);
  await live.addProgram({id:'second',source,baseRevision:1},0);
  expect(live.summary().entityIds).toEqual(['p1/AD','p2/AD']);
  expect(live.programSource('first')).toBe(source);
  await live.apply({baseRevision:2,changes:[{id:'p1/AD',props:{radius:.6}}]},0);
  await live.setMotion({baseRevision:3,changes:[{id:'p2/AD',velocity:[2,0,0]}]},0);
  const frame=await live.sample(2);
  expect(frame.elements.find(e=>e.id==='p1/AD')?.geometry.radius).toBe(.6);
  expect(frame.elements.find(e=>e.id==='p1/AD')?.position).toEqual([0,0,0]);
  expect(frame.elements.find(e=>e.id==='p2/AD')?.position).toEqual([4,0,0]);
  expect(frame.elements.find(e=>e.id==='p2/AD')?.geometry.radius).toBe(.3);
  await expect(live.apply({baseRevision:4,changes:[{id:'AD',props:{radius:1}}]},2)).rejects.toThrow();
  const context=buildWorldContext({summary:live.summary(),sampledRevision:4,sampledAt:2,frame,requestOverheadBytes:0,journal:new CommittedContextJournal()});
  expect(context.summary.programs).toMatchObject([{id:'first',entityNamespace:'p1',ids:['p1/AD']},{id:'second',entityNamespace:'p2',ids:['p2/AD']}]);
  expect(context.elements.map(e=>e.id)).toEqual(['p1/AD','p2/AD']);
});

test('replacement retains namespace and host channels while new programs get fresh namespace',async()=>{
  const live=world({namespaceEntities:true});
  await live.addProgram({id:'first',source,baseRevision:0},0);
  await live.setMotion({baseRevision:1,changes:[{id:'p1/AD',velocity:[1,0,0]}]},0);
  await live.replaceProgram({id:'first',source:source.replace('radius:.3','radius:.7'),baseRevision:2},2);
  expect(live.summary().entityIds).toEqual(['p1/AD']);
  expect((await live.sample(3)).elements[0]).toMatchObject({id:'p1/AD',position:[3,0,0],geometry:{radius:.7}});
  await live.addProgram({id:'second',source,baseRevision:3},3);
  expect(live.summary().entityIds).toEqual(['p1/AD','p2/AD']);
});

test('cancelled asynchronous admission consumes namespace without publishing IDs or revision',async()=>{
  const entered=deferred(),gate=deferred();let block=true;
  const live=world({namespaceEntities:true,prepare:async()=>{if(block){entered.resolve();await gate.promise;}}});
  const controller=new AbortController();
  const pending=live.addProgram({id:'cancelled',source,baseRevision:0},0,{signal:controller.signal});
  const rejected=pending.catch(error=>error);
  await entered.promise;controller.abort(new Error('cancelled'));
  expect(await rejected).toMatchObject({message:'cancelled'});
  expect(live.summary()).toMatchObject({revision:0,reservedIdCount:0,pendingPrograms:0,entityIds:[]});
  block=false;gate.resolve();
  await live.addProgram({id:'next',source,baseRevision:0},0);
  expect(live.summary().entityIds).toEqual(['p2/AD']);
});

test('default world retains legacy duplicate-ID rejection and unqualified IDs',async()=>{
  const live=world();
  await live.addProgram({id:'first',source,baseRevision:0},0);
  await expect(live.addProgram({id:'second',source,baseRevision:1},0)).rejects.toThrow('Duplicate or previously owned entity ID: AD');
  expect(live.summary().entityIds).toEqual(['AD']);
  expect(live.summary().programs[0]).not.toHaveProperty('entityNamespace');
});

test('same local reactive targets retain separate values and replacement callbacks',async()=>{
  const live=world({namespaceEntities:true});
  const reactive=`export default scene({end:'hold'},s=>{const k=s.slider('k',{reactive:true,default:1,min:0,max:4});const body=s.circle('AD',{radius:.3});s.bind(body,[k],k=>({radius:k}));s.bind(body,[s.time],t=>({rotation:[0,0,t]}));s.wait(60);});`;
  await live.addProgram({id:'first',source:reactive,baseRevision:0},0);
  await live.addProgram({id:'second',source:reactive,baseRevision:1},0);
  await live.setParameters({baseRevision:2,programId:'first',values:{k:2}},2);
  await live.replaceProgram({id:'first',source:reactive.replace('radius:k','radius:k+.5'),baseRevision:3},3);
  const frame=await live.sample(4);
  expect(frame.elements.find(e=>e.id==='p1/AD')).toMatchObject({geometry:{radius:2.5},rotation:[0,0,4]});
  expect(frame.elements.find(e=>e.id==='p2/AD')).toMatchObject({geometry:{radius:1},rotation:[0,0,4]});
  expect(live.summary().programs[0].parameters[0]).toMatchObject({id:'k',value:2,dependents:[{target:'p1/AD',properties:['radius']}]});
});

test('competing admission cannot reuse cancelled prefix or disturb winning scene',async()=>{
  const entered=deferred(),gate=deferred();
  const live=world({namespaceEntities:true,prepare:async(scene)=>{
    if(scene.lifecycle.some(event=>event.ids.includes('p1/AD'))){entered.resolve();await gate.promise;}
  }});
  const losing=live.addProgram({id:'losing',source,baseRevision:0},0).catch(error=>error);
  await entered.promise;
  await live.addProgram({id:'winning',source,baseRevision:0},0);
  expect(await losing).toBeInstanceOf(Error);gate.resolve();
  expect(live.summary().entityIds).toEqual(['p2/AD']);
  await live.addProgram({id:'next',source,baseRevision:1},0);
  expect(live.summary().entityIds).toEqual(['p2/AD','p3/AD']);
});
