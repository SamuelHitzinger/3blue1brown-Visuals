import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from 'animlib/core';
import { verifySemantics } from './realtime-verify.js';

const curve = (reveal: string) => `export default scene({mode:'2d',end:'hold',orbit:false},s=>{
const x=s.arrow('x-axis',{points:[[-2.5,0],[2.5,0]]});
const y=s.arrow('y-axis',{points:[[0,-.5,0],[0,2.5,0]]});
const c=s.path('curve',{points:[[-2,2],[-1.5,1.125],[-1,.5],[-.5,.125],[0,0],[.5,.125],[1,.5],[1.5,1.125],[2,2]],stroke:'BLUE'});
const m=s.circle('marker',{position:[1,.5],radius:.1,fill:'YELLOW'});
const l=s.text('curve-label',{position:[-1,2.6],text:'y = x²/2',fontSize:.28});
${reveal}
s.wait(1);s.keep(x);s.keep(y);s.keep(c);s.keep(m);s.keep(l);
});`;

test('semantic oracle accepts equivalent 2D/3D point arrays and scheduled reveal', async () => {
  const scene = await compileSource(curve('s.play(c.fadeIn(),{duration:1});'));
  const samples = [0,.25,.5,.75,1,1.5,2].map(time => ({ time, frame: evaluateScene(scene, time) }));
  const checks = verifySemantics('curve', 'create', scene, samples);
  expect(checks.filter(check => !check.passed)).toEqual([]);
});

test('semantic oracle rejects an unscheduled fade despite successful compilation and correct endpoint', async () => {
  const scene = await compileSource(curve('c.fadeIn();s.wait(1);'));
  const samples = [0,.25,.5,.75,1,1.5,2].map(time => ({ time, frame: evaluateScene(scene, time) }));
  const checks = verifySemantics('curve', 'create', scene, samples);
  expect(checks.find(check => check.name === 'curve hidden initially')?.passed).toBe(false);
  expect(checks.find(check => check.name === 'curve reveal scheduled over 1s')?.passed).toBe(false);
  expect(checks.find(check => check.name === 'complete required object IDs')?.passed).toBe(true);
});

test('semantic oracle rejects missing persistence without inventing a geometry failure', async () => {
  const scene = await compileSource(curve('s.play(c.fadeIn(),{duration:1});').replace('s.keep(m);', ''));
  const samples = [0,.25,.5,.75,1,1.5,2].map(time => ({ time, frame: evaluateScene(scene, time) }));
  const checks = verifySemantics('curve', 'create', scene, samples);
  expect(checks.filter(check => !check.passed).map(check => check.name)).toEqual(['required objects remain persistent']);
});
