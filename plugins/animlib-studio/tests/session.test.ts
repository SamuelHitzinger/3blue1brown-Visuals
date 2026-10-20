import {afterEach, expect, test} from 'bun:test';
import {StudioSession} from '../src/session.js';
Object.defineProperty(globalThis, 'Worker', {configurable:true, writable:true, value:undefined});
const sessions:StudioSession[]=[];
afterEach(()=>{for(const s of sessions.splice(0))s.dispose();});
function fixture(){let time=0;const s=new StudioSession({clock:()=>time});sessions.push(s);return {s,set:(t:number)=>{time=t;}};}
const scene={mode:'2d',objects:[{id:'ball',type:'circle',props:{radius:.5,fill:'BLUE'}}]};
const ball=async(s:StudioSession)=>(await s.sample()).elements.find(e=>e.id==='ball')!;

test('structured geometry compiles once; patches keep identity and other motion',async()=>{
  const {s,set}=fixture();await s.execute('scene',{scene});
  await s.execute('motion',{changes:[{id:'ball',velocity:[1,0,0]}]});
  set(2);await s.execute('patch',{changes:[{id:'ball',props:{fill:'RED'}}]});
  expect((await ball(s)).position[0]).toBe(2);
  expect(s.world.summary().programs).toHaveLength(1);
  expect((await s.execute('inspect',{})).revision).toBe(3);
});
test('invalid multi-object patch and stale revision change nothing',async()=>{
  const {s}=fixture();await s.execute('scene',{scene});
  await expect(s.execute('patch',{baseRevision:0,changes:[{id:'ball',props:{radius:2}}]})).rejects.toThrow('Stale');
  await expect(s.execute('patch',{changes:[{id:'ball',props:{radius:2}},{id:'missing',props:{radius:1}}]})).rejects.toThrow();
  expect((await ball(s)).geometry.radius).toBe(.5);expect(s.world.revision).toBe(1);
});
test('flow interruption starts at current interpolated pose, rejects stale sequence',async()=>{
  const {s,set}=fixture();await s.execute('scene',{scene});
  await s.execute('flow',{source:'lesson',sequence:1,cues:[{id:'right',durationMs:2000,changes:[{id:'ball',props:{position:[4,0,0]}}]}]});
  await s.tick();set(1);expect((await ball(s)).position[0]).toBeCloseTo(2);
  await s.execute('flow',{source:'lesson',sequence:2,cues:[{id:'left',durationMs:1000,changes:[{id:'ball',props:{position:[0,0,0]}}]}]});
  await s.tick();expect((await ball(s)).position[0]).toBeCloseTo(2);
  set(1.5);expect((await ball(s)).position[0]).toBeCloseTo(1);
  await expect(s.execute('flow',{source:'lesson',sequence:2,cues:[]})).rejects.toThrow('Stale');
});
test('malformed flow is rejected before replacing valid queue',async()=>{
  const {s}=fixture();await s.execute('scene',{scene});
  await s.execute('flow',{source:'a',sequence:1,cues:[{id:'later',atMs:5000,changes:[{id:'ball',props:{radius:1}}]}]});
  await expect(s.execute('flow',{source:'a',sequence:2,cues:[{id:'bad',changes:[{id:'ball',props:{radius:-1}}]}]})).rejects.toThrow();
  expect((await s.execute('inspect',{})).flow.queued).toBe(1);
});
test('checkpoint replays edits, pauses clock and preserves pending flow',async()=>{
  const {s,set}=fixture();await s.execute('scene',{scene});
  await s.execute('patch',{changes:[{id:'ball',props:{position:[4,0,0]},duration:2}]});
  await s.execute('flow',{source:'a',sequence:1,cues:[{id:'later',atMs:5000,changes:[{id:'ball',props:{radius:1}}]}]});
  set(1);const saved=s.checkpoint();const f=fixture();await f.s.restore(saved);f.set(100);
  expect((await ball(f.s)).position[0]).toBeCloseTo(2);
  expect((await f.s.execute('inspect',{})).paused).toBe(true);
  expect((await f.s.execute('inspect',{})).flow.queued).toBe(1);
  await f.s.execute('resume',{});f.set(101);expect((await ball(f.s)).position[0]).toBeCloseTo(4);
});
test('failed verification reports failed checks, not successful scene semantics',async()=>{
  const {s}=fixture();await s.execute('scene',{scene});
  const result=await s.execute('verify',{checks:[{id:'ball',property:'radius',expected:2}]});
  expect(result.verification.passed).toBe(false);expect(result.verification.checks[0].actual).toBe(.5);
});
test('2D and 3D recipes use native animlib constructors',async()=>{
  for(const recipe of ['orbit','molecule','wave']){
    const {s}=fixture();await s.execute('scene',{recipe});
    expect((await s.sample()).elements.length).toBeGreaterThan(1);
  }
});
test('flow ownership failure preserves prior queue and running state',async()=>{
  const {s}=fixture();await s.execute('scene',{recipe:'orbit'});
  await s.execute('flow',{source:'a',sequence:1,cues:[{id:'valid',atMs:10000,changes:[{id:'sun',props:{radius:1}}]}]});
  await expect(s.execute('flow',{source:'a',sequence:2,cues:[{id:'invalid',changes:[{id:'planet',props:{position:[1,0,0]}}]}]})).rejects.toThrow('time-bound');
  const info=await s.execute('inspect');expect(info.paused).toBe(false);expect(info.flow.queued).toBe(1);
});
test('resume while already running does not rewind time',async()=>{
  const {s,set}=fixture();await s.execute('scene',{scene});set(3);await s.execute('resume');
  expect(s.time()).toBe(3);
});
test('efficiency-branch composition and cue scheduling run unchanged in studio sandbox',async()=>{
  const {s,set}=fixture();
  await s.execute('program',{id:'authored',source:`export default scene({end:'hold'},s=>{
    const parts=s.compose('item',{dot:{kind:'circle',props:{radius:.2,fill:'BLUE'}}});
    s.schedule({durationSec:3,cues:{move:{startSec:1,endSec:2}}},[
      {id:'move',cue:'move',actions:parts.get('dot').moveTo([2,0,0])}
    ]);s.keep(parts.group);
  });`});
  set(3);expect((await s.sample()).elements.find(e=>e.id==='item/dot')!.position[0]).toBe(2);
  await s.execute('patch',{changes:[{id:'item/dot',props:{radius:.4}}]});
  expect((await s.sample()).elements.find(e=>e.id==='item/dot')!.geometry.radius).toBe(.4);
});
test('append preserves chronology and pause freezes native motion and queued cues',async()=>{
  const {s,set}=fixture();await s.execute('scene',{scene});
  await s.execute('flow',{source:'a',sequence:1,cues:[{id:'out',durationMs:1000,changes:[{id:'ball',props:{position:[2,0,0]}}]}]});
  await s.execute('flow',{source:'a',sequence:2,mode:'append',cues:[{id:'back',durationMs:1000,changes:[{id:'ball',props:{position:[0,0,0]}}]}]});
  await s.tick();set(.5);await s.execute('pause');set(20);await s.tick();
  expect((await ball(s)).position[0]).toBeCloseTo(1);
  await s.execute('resume');set(20.5);await s.tick();set(21.5);await s.tick();
  expect((await ball(s)).position[0]).toBeCloseTo(0);
});
test('verification never passes an omitted expected value on an unsupported geometry property',async()=>{
  const {s}=fixture();await s.execute('scene',{scene:{objects:[{id:'line',type:'line',props:{points:[[0,0,0],[1,0,0]]}}]}});
  await expect(s.execute('verify',{checks:[{id:'line',property:'radius'}]})).rejects.toThrow('expected');
});
