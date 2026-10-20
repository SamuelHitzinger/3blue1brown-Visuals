import { expect, test } from 'bun:test';
import { compileSource } from 'animlib/core';
import { validateSceneQuality } from '../src/agents/scene-quality.js';

test('source-dependent rendering errors reach author repair before GPU review', async () => {
  const compiled = await compileSource(`export default scene({}, s => {
    const x=s.latex('formula',{tex:'x'});
    s.play(x.morphTo({kind:'latex',tex:'y'},{map:{missing:'alsoMissing'}}),{duration:1});
  });`);
  expect(() => validateSceneQuality(compiled)).toThrow(/Unknown source LaTeX part/);
});

test('new orbitable views require geometry-only interaction', async () => {
  const make = (targeted: boolean) => compileSource(`export default scene({}, s => {
    s.view('model',{rect:[0,0,1,1],orbit:true${targeted ? ',orbitHitTest:"geometry"' : ''}},v=>v.sphere('ball'));
    s.wait(1);
  });`);
  const bad = await make(false), good = await make(true);
  expect(() => validateSceneQuality(bad)).toThrow(/orbitHitTest/);
  expect(() => validateSceneQuality(good)).not.toThrow();
  const wholeCanvas = await compileSource(`export default scene({mode:'3d'},s=>{s.sphere('ball');s.text('label',{text:'DNA'});s.wait(1);});`);
  expect(() => validateSceneQuality(wholeCanvas)).toThrow(/whole-scene orbit/);
  expect(() => validateSceneQuality(wholeCanvas, { legacyOrbit: true })).not.toThrow();
  expect(() => validateSceneQuality(bad, { legacyOrbit: true })).not.toThrow();
});

test('settled glyph collisions return bounded, actionable library diagnostics', async () => {
  const compiled = await compileSource(`export default scene({}, s => {
    s.text('template-label', {text:'HH',fontSize:1});
    s.text('rna-label', {text:'HH',fontSize:1}); s.wait(2);
  });`);
  expect(() => validateSceneQuality(compiled)).toThrow(/template-label/);
  expect(() => validateSceneQuality(compiled)).toThrow(/rna-label/);
  expect(() => validateSceneQuality(compiled)).toThrow(/seconds/);
  expect(() => validateSceneQuality(compiled, { legacyOrbit: true })).toThrow(/Text overlap/);
});

test('separated text and intentionally overlapping geometry pass', async () => {
  const compiled = await compileSource(`export default scene({}, s => {
    s.circle('model'); s.circle('other');
    s.text('a', {text:'HH',position:[-2,0],fontSize:0.4});
    s.text('b', {text:'HH',position:[2,0],fontSize:0.4}); s.wait(2);
  });`);
  expect(() => validateSceneQuality(compiled)).not.toThrow();
});

test('moving glyph collisions are rejected before otherwise separated endpoints', async () => {
  const source = (end: number) => `export default scene({}, s => {
    s.text('a', {text:'H',fontSize:0.5});
    const b=s.text('b', {text:'H',fontSize:0.5,position:[-2,0]});
    s.play(b.moveTo([${end},0]),{duration:2}); s.wait(1);
  });`;
  const good = await compileSource(source(2));
  expect(() => validateSceneQuality(good)).toThrow(/Text overlap/);
  const bad = await compileSource(source(0));
  expect(() => validateSceneQuality(bad)).toThrow(/Text overlap/);
});


test('brief label crossings are checked at track interiors, not only the sample grid', async () => {
  const compiled = await compileSource(`export default scene({},s=>{
    s.text('anchor',{text:'HH',fontSize:.5});
    const label=s.text('moving',{text:'HH',fontSize:.5,position:[-2,0]});
    s.wait(.1); s.play(label.moveTo([2,0]),{duration:.1}); s.wait(1);
  });`);
  expect(() => validateSceneQuality(compiled)).toThrow(/moving/);
});

test('visible whole-expression crossfades fail but hidden replacements pass', async () => {
  const source=(hidden: boolean)=>`export default scene({},s=>{
    const label=s.latex('rate',{tex:'x+y',opacity:${hidden ? 0 : 1}});
    s.play(label.morphTo({kind:'latex',tex:'z+w'},{map:{}}),{duration:.1});
    ${hidden ? 's.play(label.fadeIn(),{duration:.2});' : ''} s.wait(1);
  });`;
  const visible=await compileSource(source(false)), hidden=await compileSource(source(true));
  expect(() => validateSceneQuality(visible)).toThrow(/whole-expression/);
  expect(() => validateSceneQuality(hidden)).not.toThrow();
});


test('compact viewport glyph collisions are checked', async () => {
  const compiled=await compileSource(`export default scene({},s=>{
    s.text('world',{text:'HH',fontSize:.5,position:[0,0]});
    s.text('screen',{text:'HH',fontSize:45,space:'screen',position:[-240,0],viewportOffset:[.25,0]});s.wait(1);
  });`);
  expect(() => validateSceneQuality(compiled)).toThrow(/960x720/);
});


test('labels may relocate while hidden', async () => {
  const compiled = await compileSource(`export default scene({},s=>{
    s.text('anchor',{text:'HH',fontSize:.5});
    const label=s.text('moving',{text:'HH',fontSize:.5,position:[-2,0],opacity:0});
    s.play(label.moveTo([2,0]),{duration:.1});
    s.play(label.fadeIn(),{duration:.2});s.wait(1);
  });`);
  expect(() => validateSceneQuality(compiled)).not.toThrow();
});


test('hidden parent replacements and meaningful named-term transforms remain valid', async () => {
  const hidden=await compileSource(`export default scene({},s=>{
    const label=s.latex('label',{tex:'x'});
    s.group('container',[label],{opacity:0});
    s.play(label.morphTo({kind:'latex',tex:'y'},{map:{}}),{duration:1});
  });`);
  const mapped=await compileSource(String.raw`export default scene({},s=>{
    const label=s.latex('term',{tex:'\\animpart{x}{x}+1'});
    s.play(label.morphTo({kind:'latex',tex:'1+\\animpart{x}{x}'},{map:{x:'x'}}),{duration:1});
  });`);
  expect(() => validateSceneQuality(hidden)).not.toThrow();
  expect(() => validateSceneQuality(mapped)).not.toThrow();
});
