import { describe, expect, it } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { buildScene } from '../src/runtime.js';
import type { ScheduledWindow } from '../src/authoring-types.js';

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

  it('splits a named cue into hide, hidden instant LaTeX replacement and reveal in native and VM scenes', async () => {
    let receipt: readonly ScheduledWindow[] = [];
    const native = buildScene({}, s => {
      const label = s.latex('label', { tex: 'x' });
      receipt = s.schedule(timing, [{ id: 'replace', cue: 'move', ease: 'linear', steps: [
        { actions: label.fadeOut() },
        { weight: 0, actions: label.morphTo({ kind: 'latex', tex: 'y' }, { map: {} }) },
        { weight: 3, reveal: [label] },
      ] }]);
    });
    const source = `export default scene({},s=>{
      const label=s.latex('label',{tex:'x'});
      s.schedule(${JSON.stringify(timing)},[{id:'replace',cue:'move',ease:'linear',steps:[
        {actions:label.fadeOut()},
        {weight:0,actions:label.morphTo({kind:'latex',tex:'y'},{map:{}})},
        {weight:3,reveal:[label]}
      ]}]);
    });`;
    const manual = `export default scene({},s=>{
      const label=s.latex('label',{tex:'x'});s.wait(1);
      s.play(label.fadeOut(),{duration:.25,ease:'linear'});
      s.play(label.morphTo({kind:'latex',tex:'y'},{map:{}}),{duration:0,ease:'linear'});
      s.play(label.fadeIn(),{duration:.75,ease:'linear'});s.wait(3);
    });`;
    const actual = await compileSource(source), expected = await compileSource(manual);
    const explicitWindow = await compileSource(source.replace("cue:'move'", "at:{word:'w1'},through:{word:'w1',edge:'end'}"));
    expect({ ...actual, options: { ...actual.options, palette: undefined } }).toEqual(native);
    expect(actual).toEqual(expected);
    expect(explicitWindow).toEqual(expected);
    expect(receipt).toEqual([{ id: 'replace', startSec: 1, endSec: 2 }]);
    expect(Object.isFrozen(receipt) && Object.isFrozen(receipt[0])).toBe(true);
    expect(actual.tracks.map(track => [track.start, track.duration])).toEqual([[1, .25], [1.25, 0], [1.25, .75]]);
    expect(actual.tracks[1].from.label.opacity).toBe(0);
    expect(actual.tracks[1].action.map).toEqual({});
    for (const time of [0, 1, 1.125, 1.25 - 1e-8, 1.25, 1.25 + 1e-8, 1.625, 2, 5, 1.25, 0]) {
      const frame = evaluateScene(actual, time), label = frame.elements.find(element => element.id === 'label')!;
      expect(frame).toEqual(evaluateScene(expected, time));
      // No frame exposes an in-progress glyph crossfade; the update happens at zero opacity.
      expect(label.morph).toBeUndefined();
      expect(label.geometry.tex).toBe(time < 1.25 ? 'x' : 'y');
      if (time === 1.25) expect(label.opacity).toBe(0);
    }
    await expect(compileSource(source.replace(',{map:{}}', ''))).rejects.toThrow('explicit map');
  });

  it('preserves exact cue endpoints, ordered zero steps and finite weights whose sum would overflow', async () => {
    const compiled = await compileSource(`export default scene({},s=>{
      const d=s.circle('d');
      s.schedule({durationSec:2,cues:{move:{startSec:.1,endSec:1.1}}},[
        {id:'move',cue:'move',ease:'linear',steps:[
          {weight:0,actions:d.moveTo([1,0])},
          {weight:Number.MAX_VALUE,actions:d.moveTo([2,0])},
          {weight:Number.MAX_VALUE,actions:d.moveTo([3,0])},
          {weight:0,actions:d.moveTo([4,0])}
        ]}
      ]);
    });`);
    expect(compiled.duration).toBe(2);
    expect(compiled.tracks.map(track => track.start)).toEqual([.1, .1, .6, 1.1]);
    const last = compiled.tracks.at(-1)!;
    expect(last.start + last.duration).toBe(1.1);
    expect(evaluateScene(compiled, 1.1).elements[0].position).toEqual([4, 0, 0]);
  });

  it('allows zero-total weights for an instant explicit anchor window', () => {
    const compiled = buildScene({}, s => {
      const d = s.circle('d');
      s.schedule(timing, [{ id: 'instant', at: { word: 'w1' }, steps: [
        { weight: 0, actions: d.moveTo([1, 0]) },
        { weight: 0, actions: d.moveTo([2, 0]) },
      ] }]);
    });
    expect(compiled.tracks.map(track => [track.start, track.duration])).toEqual([[1, 0], [1, 0]]);
    expect(evaluateScene(compiled, 1).elements[0].position).toEqual([2, 0, 0]);
  });

  it.each(['conflicting actions', 'missing target'] as const)(
    'rolls back a failed schedule with %s before catch-and-continue in native and VM scenes', async failure => {
      const message = failure === 'conflicting actions' ? 'Conflicting animations' : 'missing or was removed';
      const native = buildScene({}, s => {
        const d = s.circle('d'); s.wait(.5);
        const invalid = failure === 'conflicting actions' ? [d.fadeOut(), d.fadeIn()]
          : { type: 'animate' as const, ids: ['missing'], properties: { opacity: 0 } };
        expect(() => s.schedule(timing, [{ id: 'move', cue: 'move', steps: [
          { actions: d.moveTo([1, 0]) }, { actions: invalid },
        ] }])).toThrow(message);
        s.play(d.moveTo([3, 0]), { duration: 0 }); s.wait(2);
      });
      const invalid = failure === 'conflicting actions' ? '[d.fadeOut(),d.fadeIn()]'
        : "{type:'animate',ids:['missing'],properties:{opacity:0}}";
      const vm = await compileSource(`export default scene({},s=>{
        const d=s.circle('d');s.wait(.5);
        try{s.schedule(${JSON.stringify(timing)},[{id:'move',cue:'move',steps:[
          {actions:d.moveTo([1,0])},{actions:${invalid}}
        ]}]);throw new Error('Unexpected acceptance');}
        catch(error){if(!error.message.includes(${JSON.stringify(message)}))throw error;}
        s.play(d.moveTo([3,0]),{duration:0});s.wait(2);
      });`);
      expect({ ...vm, options: { ...vm.options, palette: undefined } }).toEqual(native);
      expect(vm.duration).toBe(2.5);
      expect(vm.tracks.map(track => [track.start, track.duration])).toEqual([[.5, 0]]);
      expect(vm.tracks[0].from.d.position).toEqual([0, 0, 0]);
      expect(vm.tracks[0].from.d.opacity).toBe(1);
    },
  );

  it('restores existing tracks, groups, geometry, numeric slots and both cameras after a later failure', async () => {
    const setup = `const d=s.circle('d'),g=s.group('g',[d]);
      const n=s.latex('n',{tex:'1',numbers:{n:1}});let viewCamera;
      s.view('side',{rect:[0,0,1,1],camera:{yaw:0}},v=>{viewCamera=v.camera;});
      s.play(g.moveTo([.5,0]),{duration:.5});`;
    const failed = `try{s.schedule(${JSON.stringify(timing)},[{id:'move',cue:'move',steps:[
      {actions:[g.moveTo([1,0]),d.morphTo({kind:'rectangle',width:2,height:1}),n.countTo({n:2}),
        s.camera.animate({height:3}),viewCamera.animate({yaw:1})]},
      {actions:n.morphTo({kind:'latex',tex:'9',numbers:{n:9}},{map:{}})},
      {actions:n.countTo({missing:4})}
    ]}]);throw new Error('Unexpected acceptance');}
    catch(error){if(!error.message.includes('Unknown numeric slot'))throw error;}`;
    const continuation = `s.play([g.moveTo([2,0]),d.morphTo({kind:'circle',radius:1}),n.countTo({n:4}),
      s.camera.animate({height:4}),viewCamera.animate({yaw:2})],{duration:.5});s.keep(g);`;
    const actual = await compileSource(`export default scene({},s=>{${setup}${failed}${continuation}});`);
    const expected = await compileSource(`export default scene({},s=>{${setup}${continuation}});`);
    expect(actual).toEqual(expected);
    expect(actual.tracks[1].from.g.position).toEqual([.5, 0, 0]);
    expect(actual.tracks[2].from.d.geometry.kind).toBe('circle');
    expect(actual.tracks[3].from.n.geometry.numbers).toEqual({ n: 1 });
    expect(actual.tracks[4].cameraFrom!.height).toBe(8);
    expect(actual.tracks[5].cameraFrom!.yaw).toBe(0);
    for (const time of [0, .5, .75, 1, .5]) expect(evaluateScene(actual, time)).toEqual(evaluateScene(expected, time));
  });

  it.each([
    ['null', '1–64'], ['[]', '1–64'], ['{}', '1–64'],
    ['Array.from({length:65},()=>({actions:d.fadeIn()}))', '1–64'],
    ['[null]', 'step'], ['[[]]', 'step'], ['[{}]', 'actions or reveal'],
    ['[{steps:[{actions:d.fadeIn()}]}]', 'step'],
    ['[{duration:1,actions:d.fadeIn()}]', 'step'],
    ['[{weight:-1,actions:d.fadeIn()}]', 'weight'],
    ['[{weight:NaN,actions:d.fadeIn()}]', 'weight'],
    ['[{weight:Infinity,actions:d.fadeIn()}]', 'weight'],
    ['[{weight:"1",actions:d.fadeIn()}]', 'weight'],
    ['[{weight:null,actions:d.fadeIn()}]', 'weight'],
    ['[{weight:0,actions:d.fadeIn()}]', 'positive'],
    ['[{actions:null}]', 'action'], ['[{actions:[[]]}]', 'action'],
    ['[{actions:{ids:["d"]}}]', 'action'],
    ['[{actions:{type:"animate",ids:Array(1)}}]', 'action'],
    ['[{actions:{type:"morph",ids:["d"]}}]', 'action'],
    ['[{actions:{type:"morph",ids:["d"],geometry:{kind:1}}}]', 'action'],
    ['[{reveal:null}]', 'array'],
    ['[{reveal:[{}]}]', 'reveal'],
  ])('rejects malformed sequential steps %s before changing the timeline', async (steps, message) => {
    const body = `const d=s.circle('d');s.wait(.5);
      try{s.schedule(${JSON.stringify(timing)},[
        {id:'valid',at:{word:'w1'},actions:d.moveTo([1,0])},
        {id:'invalid',cue:'move',steps:${steps}}
      ]);throw new Error('Accepted invalid steps');}
      catch(error){if(!error.message.includes(${JSON.stringify(message)}))throw error;}
      s.play(d.fadeOut(),{duration:0});`;
    const compiled = await compileSource(`export default scene({},s=>{${body}});`);
    expect(compiled.tracks.map(track => [track.start, track.duration])).toEqual([[.5, 0]]);
  });

  it.each(['actions:d.fadeIn()', 'reveal:[d]'])(
    'rejects top-level %s together with steps', async effects => {
      await expect(compileSource(`export default scene({},s=>{
        const d=s.circle('d');s.schedule(${JSON.stringify(timing)},[
          {id:'bad',cue:'move',${effects},steps:[{actions:d.fadeOut()}]}
        ]);
      });`)).rejects.toThrow('steps');
    },
  );

  it.each([
    ["{id:'bad',cue:'move',at:{word:'w1'},actions:d.fadeIn()}",'exactly one'],
    ["{id:'bad',cue:'move',duration:1,actions:d.fadeIn()}",'full span'],
    ["{id:'bad',at:{word:'w1',cue:'move'},actions:d.fadeIn()}",'exactly one'],
    ["{id:'bad',at:{word:'w1'},duration:-1,actions:d.fadeIn()}",'interval'],
  ])('rejects ambiguous or invalid timing shorthand %s',async(operation,message)=>{
    await expect(compileSource(`export default scene({},s=>{const d=s.circle('d');s.schedule(${JSON.stringify(timing)},[${operation}]);});`)).rejects.toThrow(message);
  });
});
