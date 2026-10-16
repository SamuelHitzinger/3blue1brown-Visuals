import {expect,test} from 'bun:test';
import {CommittedContextJournal,type CommittedOperationInput} from './committed-context.js';

const add=(revision=1,source='export default scene({},s=>{s.wait(8)});'):CommittedOperationInput=>({
  revision,runId:'run-a',planId:`plan-${revision}`,committedAtMs:revision*100,
  evidence:{changes:[{id:'chunk-0',version:1}],context:[]},operation:{action:'add',programId:`program-${revision}`,source},
});

test('retained parameter commits keep exact bounded detached history',()=>{
  const journal=new CommittedContextJournal();journal.record(add());
  const patch={baseRevision:1,programId:'program-1',values:{slope:2}};
  journal.record({...add(2),operation:{action:'parameters',patch}});
  patch.values.slope=99;
  expect(journal.snapshot(10000).records[1].operation).toEqual({action:'parameters',patch:{baseRevision:1,programId:'program-1',values:{slope:2}}});
  for(const values of [{}, {slope:Infinity}, Object.fromEntries(Array.from({length:33},(_,i)=>[`p${i}`,1]))]){
    expect(()=>journal.record({...add(3),operation:{action:'parameters',patch:{baseRevision:2,programId:'program-1',values}}})).toThrow();
  }
  expect(journal.snapshot(10000).latestRevision).toBe(2);
});

test('committed source and patch remain exact detached records; rendering is separate',()=>{
  const journal=new CommittedContextJournal(),first=add();journal.record(first);
  first.evidence.changes[0].id='mutated';
  const patch={baseRevision:1,changes:[{id:'point',props:{position:[1,2,3] as [number,number,number]},duration:2}],remove:[]};
  journal.record({...add(2),runId:'run-b',operation:{action:'edit',patch}});
  patch.changes[0].props.position[0]=99;
  const snapshot=journal.snapshot(10000);
  expect(snapshot.wholeHistoryComplete).toBe(true);expect(snapshot.opaque).toBe(false);
  expect(snapshot.records[0]).toMatchObject({semanticCompletion:'unknown',renderingStatus:'not-observed',evidence:{changes:[{id:'chunk-0',version:1}]}});
  expect(snapshot.records[1].operation).toEqual({action:'edit',patch:{baseRevision:1,changes:[{id:'point',props:{position:[1,2,3]},duration:2}],remove:[]}});
  snapshot.records[0].evidence.changes[0].id='also-mutated';
  expect(journal.markRendered(1)).toBe(true);
  expect(journal.snapshot(10000).records[0]).toMatchObject({renderingStatus:'render-submitted',evidence:{changes:[{id:'chunk-0',version:1}]}});
  expect(journal.snapshot(10000).records[1].runId).toBe('run-b');
});

test('entry eviction and skipped revisions retain bounded honest omission ranges',()=>{
  const journal=new CommittedContextJournal({maxEntries:2});
  journal.record(add(1));journal.record(add(3));journal.record(add(5));
  expect(journal.snapshot(10000)).toMatchObject({latestRevision:5,wholeHistoryComplete:false,opaque:true,
    omittedRevisionCount:3,omittedRevisionRanges:[{from:1,to:2},{from:4,to:4}]});
  expect(journal.snapshot(10000).records.map(record=>record.revision)).toEqual([3,5]);
  expect(journal.markRendered(1)).toBe(false);
});

test('oversized newest source is wholly omitted while existing exact records survive',()=>{
  const journal=new CommittedContextJournal({maxCharacters:1000});journal.record(add(1));journal.record(add(2,'x'.repeat(2000)));
  const snapshot=journal.snapshot(10000);
  expect(snapshot.records.map(record=>record.revision)).toEqual([1]);
  expect(snapshot.omittedRevisionRanges).toEqual([{from:2,to:2}]);
  expect(snapshot.opaque).toBe(true);expect(journal.markRendered(2)).toBe(false);
});

test('character pressure evicts older records independently of entry count',()=>{
  const journal=new CommittedContextJournal({maxCharacters:650,maxEntries:64});
  journal.record(add(1,'a'.repeat(100)));journal.markRendered(1);journal.record(add(2,'b'.repeat(100)));
  const snapshot=journal.snapshot(10000);
  expect(snapshot.records.map(record=>record.revision)).toEqual([2]);
  expect(snapshot.omittedRevisionRanges).toEqual([{from:1,to:1}]);
});

test('snapshot obeys its complete serialized budget and selects recent whole records',()=>{
  const journal=new CommittedContextJournal();journal.record(add(1,'a'.repeat(300)));journal.record(add(2,'b'.repeat(300)));
  const both=journal.snapshot(10000),budget=JSON.stringify(both).length-100;
  const limited=journal.snapshot(budget);
  expect(JSON.stringify(limited).length).toBeLessThanOrEqual(budget);
  expect(limited.records).toHaveLength(1);expect(limited.records[0].revision).toBe(2);
  expect(limited.records[0].operation).toEqual(add(2,'b'.repeat(300)).operation);
  expect(limited.omittedRevisionRanges).toEqual([{from:1,to:1}]);
  expect(()=>journal.snapshot(1)).toThrow('budget');
});

test('optional UTF-8 budget omits whole Unicode and astral records despite character fit',()=>{
  const journal=new CommittedContextJournal();
  journal.record(add(1,'ascii'));journal.record(add(2,'漢🧪'.repeat(300)));
  const full=journal.snapshot(10000),serialized=JSON.stringify(full),bytes=new TextEncoder().encode(serialized).length;
  expect(bytes).toBeGreaterThan(serialized.length);
  const limited=journal.snapshot(10000,serialized.length);
  expect(JSON.stringify(limited).length).toBeLessThanOrEqual(10000);
  expect(new TextEncoder().encode(JSON.stringify(limited)).length).toBeLessThanOrEqual(serialized.length);
  expect(limited.records.map(record=>record.revision)).toEqual([1]);
  expect(limited.records[0].operation).toEqual(add(1,'ascii').operation);
  expect(limited.omittedRevisionRanges).toEqual([{from:2,to:2}]);
  expect(limited.wholeHistoryComplete).toBe(false);
  expect(journal.snapshot(10000)).toEqual(full);
  expect(journal.snapshot(10000,bytes)).toEqual(full);
});

test('impossible or invalid byte ceilings throw without mutating retained history',()=>{
  const journal=new CommittedContextJournal();journal.record(add());const before=journal.snapshot(10000);
  for(const bytes of [1,0,-1,NaN,Infinity,1.5])expect(()=>journal.snapshot(10000,bytes)).toThrow('budget');
  expect(journal.snapshot(10000)).toEqual(before);
});

test('Unicode request envelope overhead plus bounded world fits server byte and character ceilings',()=>{
  const journal=new CommittedContextJournal(),encoder=new TextEncoder();
  journal.record(add(1,'漢🧪'.repeat(9000)));journal.record(add(2,'界🌍'.repeat(9000)));
  const description={summary:{revision:2},elements:[{id:'漢字',position:[0,0,0]}],elementsTruncated:false};
  const envelope={runId:'run-a',planId:'plan-3',baseRevision:2,evidence:[{id:'語句',version:1}],context:[],deadlineServerMs:10000,world:null as unknown};
  const field=',"committedOperations":',descriptionJson=JSON.stringify(description);
  const requestOverheadBytes=encoder.encode(JSON.stringify(envelope)).length-4;
  const remainingCharacters=60000-descriptionJson.length-field.length;
  const remainingBytes=120000-requestOverheadBytes-encoder.encode(descriptionJson).length-encoder.encode(field).length;
  const unboundedWorld={...description,committedOperations:journal.snapshot(remainingCharacters)};
  expect(JSON.stringify(unboundedWorld).length).toBeLessThanOrEqual(60000);
  expect(encoder.encode(JSON.stringify({...envelope,world:unboundedWorld})).length).toBeGreaterThan(120000);
  const world={...description,committedOperations:journal.snapshot(remainingCharacters,remainingBytes)};
  const requestJson=JSON.stringify({...envelope,world});
  expect(JSON.stringify(world).length).toBeLessThanOrEqual(60000);
  expect(encoder.encode(requestJson).length).toBeLessThanOrEqual(120000);
  expect(encoder.encode(requestJson).length).toBe(requestOverheadBytes+encoder.encode(JSON.stringify(world)).length);
  expect(world.committedOperations.records.map(record=>record.revision)).toEqual([2]);
  expect(world.committedOperations.omittedRevisionRanges).toEqual([{from:1,to:1}]);
});

test('invalid, duplicate and decreasing revisions cannot mutate journal state',()=>{
  const journal=new CommittedContextJournal();journal.record(add(2));const before=journal.snapshot(10000);
  for(const record of [add(2),add(1),{...add(3),committedAtMs:NaN},
    {...add(3),operation:{action:'defer',reason:'pending'}},
    {...add(3),operation:{action:'edit',patch:{baseRevision:2,changes:[],remove:[]}}}])
    expect(()=>journal.record(record as CommittedOperationInput)).toThrow();
  expect(journal.snapshot(10000)).toEqual(before);
  expect(()=>journal.markRendered(3)).toThrow();
});

test('storage stays bounded across many runs and does not claim semantic rollback',()=>{
  const journal=new CommittedContextJournal({maxEntries:3,maxCharacters:1500});
  for(let revision=1;revision<=1000;revision++)journal.record({...add(revision),runId:`run-${revision}`});
  const snapshot=journal.snapshot(10000);
  expect(snapshot.records.length).toBeLessThanOrEqual(3);
  expect(snapshot.omittedRevisionRanges.length).toBeLessThanOrEqual(4);
  expect(snapshot.omittedRevisionCount+snapshot.records.length).toBe(1000);
  expect(snapshot.limitation).toContain('per run');expect(snapshot.limitation).toContain('rollback');
});
