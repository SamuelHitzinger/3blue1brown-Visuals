import { describe, expect, it } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { buildScene } from '../src/runtime.js';

const timing = { durationSec: 5, words: { w1: { startSec: 1, endSec: 2 } },
  utterances: { answer: { startSec: 3, endSec: 4, role: 'reveal' } },
  pauses: { thinking: { startSec: 2, endSec: 3 } },
  cues: { move: { startSec: 1, endSec: 2 } } };
const literal = `export default scene({},s=>{
  const dot=s.circle('thing/dot',{radius:.2,fill:'BLUE'});
  const label=s.text('thing/label',{text:'Position',position:[0,.5]});
  const group=s.group('thing',[dot,label]);
  s.wait(1);s.play(dot.moveTo([2,0]),{duration:1});
  s.wait(1);s.play(label.fadeIn(),{duration:1});s.wait(1);s.keep(group);
});`;
const authored = `export default scene({},s=>{
  const parts=s.compose('thing',{
    dot:{kind:'circle',props:{radius:.2,fill:'BLUE'}},
    label:(s,id)=>s.text(id,{text:'Position',position:[0,.5]})
  });
  s.schedule(${JSON.stringify(timing)},[
    {id:'move',at:{cue:'move'},through:{cue:'move',edge:'end'},actions:parts.get('dot').moveTo([2,0])},
    {id:'answer',at:{utterance:'answer'},through:{utterance:'answer',edge:'end'},reveal:[parts.get('label')],notBefore:{utterance:'answer'}}
  ]);
  s.keep(parts.group);
});`;

describe('compositions and measured cue scheduling', () => {
  it('preserves custom parts, ordinary IDs, cue windows and bidirectional sampled state', async () => {
    const [actual, expected] = await Promise.all([compileSource(authored), compileSource(literal)]);
    expect(actual.duration).toBe(5);
    expect(actual.tracks.map(track=>[track.start,track.duration])).toEqual([[1,1],[3,1]]);
    for (const t of [0,1,1.5,2,2.5,3,3.5,4,5,2,0]) {
      // Persistence becomes visible at its authored time; this fixture marks both at the end.
      expect(evaluateScene(actual,t)).toEqual(evaluateScene(expected,t));
    }
  });

  it('runs the same API through native runtime and the production VM', async () => {
    const native=buildScene({},s=>{
      const p=s.compose('thing',{dot:{kind:'circle',props:{radius:.2,fill:'BLUE'}}});
      s.wait(.5);
      s.schedule(timing,[{id:'move',at:{word:'w1'},through:{word:'w1',edge:'end'},actions:p.get('dot').moveTo([2,0])}]);
    });
    const vm=await compileSource(`export default scene({},s=>{
      const p=s.compose('thing',{dot:{kind:'circle',props:{radius:.2,fill:'BLUE'}}});s.wait(.5);
      s.schedule(${JSON.stringify(timing)},[{id:'move',at:{word:'w1'},through:{word:'w1',edge:'end'},actions:p.get('dot').moveTo([2,0])}]);
    });`);
    expect({...vm,options:{...vm.options,palette:undefined}}).toEqual(native);
  });

  it('keeps a composition usable in the next scene', async () => {
    const first=await compileSource(authored);
    const previous=evaluateScene(first,5);
    const next=await compileSource(`export default scene({},s=>{const p=s.previous.get('thing');s.play(p.moveTo([1,0]),{duration:1});s.keep(p);});`,{previous});
    const frame=evaluateScene(next,1);
    expect(frame.elements.map(e=>e.id)).toEqual(['thing/dot','thing/label','thing']);
    expect(frame.elements.find(e=>e.id==='thing/dot')!.position).toEqual([2,0,0]);
    expect(frame.elements.find(e=>e.id==='thing')!.position).toEqual([1,0,0]);
  });

  it.each([
    ["s.compose('x',{dot:{kind:'circle'}});s.compose('x',{dot:{kind:'circle'}})",'Duplicate'],
    ["s.compose('x',{'a/b':{kind:'circle'}})",'part'],
    ["s.compose('x',{dot:{kind:'circle'}}).get('missing')",'Unknown composition part'],
  ])('rejects invalid composition %s', async (body,message) => {
    await expect(compileSource(`export default scene({},s=>{${body}});`)).rejects.toThrow(message);
  });

  it.each([
    ["[{id:'bad',at:{cue:'missing'},actions:d.fadeIn()}]",'Unknown cue'],
    ["[{id:'bad',at:{word:'w1'},duration:2,actions:d.moveTo([1,0])}]",'pause'],
    ["[{id:'bad',at:{word:'w1'},duration:0,reveal:[d],notBefore:{utterance:'answer'}}]",'before'],
    ["[{id:'one',at:{word:'w1'},duration:.8,actions:d.moveTo([1,0])},{id:'two',at:{word:'w1'},actions:d.fadeOut()}]",'overlap'],
    ["[{id:'bad',at:{utterance:'answer'},duration:3,actions:d.moveTo([1,0])}]",'duration'],
  ])('rejects invalid schedule %s', async (beats,message) => {
    await expect(compileSource(`export default scene({},s=>{const d=s.circle('d');s.schedule(${JSON.stringify(timing)},${beats});});`)).rejects.toThrow(message);
  });

  it('preflights all timing windows before adding any tracks', () => {
    const compiled=buildScene({},s=>{
      const d=s.circle('d');
      expect(()=>s.schedule(timing,[{id:'ok',at:{word:'w1'},actions:d.fadeIn()},
        {id:'bad',at:{cue:'absent'},actions:d.fadeOut()}])).toThrow('Unknown cue');
      s.wait(5);
    });
    expect(compiled.tracks).toEqual([]);
  });

  it('uses the named cue span directly and preserves simultaneous action semantics',async()=>{
    const compiled=await compileSource(`export default scene({},s=>{
      const d=s.circle('d');const label=s.text('label',{text:'Move',position:[0,1]});
      s.schedule(${JSON.stringify(timing)},[{id:'move',cue:'move',actions:[d.moveTo([2,0]),label.fadeIn()]}]);
    });`);
    expect(compiled.tracks.map(t=>[t.start,t.duration])).toEqual([[1,1],[1,1]]);
    expect(evaluateScene(compiled,1.5).elements.find(e=>e.id==='d')!.position).toEqual([1,0,0]);
  });

  it.each([
    ["{id:'bad',cue:'move',at:{word:'w1'},actions:d.fadeIn()}",'exactly one'],
    ["{id:'bad',cue:'move',duration:1,actions:d.fadeIn()}",'full span'],
    ["{id:'bad',at:{word:'w1',cue:'move'},actions:d.fadeIn()}",'exactly one'],
    ["{id:'bad',at:{word:'w1'},duration:-1,actions:d.fadeIn()}",'interval'],
  ])('rejects ambiguous or invalid timing shorthand %s',async(operation,message)=>{
    await expect(compileSource(`export default scene({},s=>{const d=s.circle('d');s.schedule(${JSON.stringify(timing)},[${operation}]);});`)).rejects.toThrow(message);
  });
});
