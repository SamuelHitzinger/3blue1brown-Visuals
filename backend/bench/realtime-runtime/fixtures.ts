import assert from 'node:assert/strict';
import type { Frame } from '../../../shared/animlib/src/types.js';

export const fixtures = [
  {
    id: 'cube', target: 'body',
    source: `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
      const gain=s.slider('gain',{label:'Size',reactive:true,default:1,min:.5,max:2});
      const body=s.box('body',{width:1.4,height:1.4,depth:1.4,fill:'BLUE'});
      s.bind(body,[gain],gain=>({scale:gain}));s.keep(body);
      s.play(body.moveTo([4,0,0]),{duration:4,ease:'linear'});
    });`,
  },
  {
    id: 'graph', target: 'curve',
    source: `export default scene({end:'hold'},s=>{
      const gain=s.slider('gain',{label:'Curvature',reactive:true,default:1,min:.5,max:2});
      s.line('x-axis',{points:[[-3,-1],[3,-1]],stroke:'WHITE'});
      s.line('y-axis',{points:[[0,-2],[0,2]],stroke:'WHITE'});
      const curve=s.line('curve',{points:Array.from({length:65},(_,i)=>{const x=-2+i/16;return [x,x*x/2-1];}),stroke:'BLUE',strokeWidth:.04});
      s.bind(curve,[gain],gain=>({points:Array.from({length:65},(_,i)=>{const x=-2+i/16;return [x,gain*x*x/2-1];})}));
      const marker=s.circle('marker',{radius:.12,position:[-2,-1],fill:'YELLOW'});
      s.keep(curve);s.keep(marker);s.play(marker.moveTo([2,-1]),{duration:4,ease:'linear'});
    });`,
  },
  {
    id: 'custom-diagram', target: 'signal',
    source: `export default scene({end:'hold'},s=>{
      const gain=s.slider('gain',{label:'Deflection',reactive:true,default:1,min:.5,max:2});
      s.path('boundary',{points:[[-.6,-2],[-.1,-1],[.4,-.5],[-.2,.4],[.6,1.4],[.1,2]],stroke:'TEAL',strokeWidth:.08});
      const positions=[[-2,-1.4],[-2,.2],[-1,1.4],[1.8,-1.3],[2,1]];
      positions.forEach((p,i)=>s.circle('node-'+i,{radius:.2,position:p,fill:i<3?'BLUE':'TEAL'}));
      const signal=s.arrow('signal',{points:[[-2,.2],[-.4,.5],[2,1]],stroke:'YELLOW'});
      s.bind(signal,[gain],gain=>({points:[[-2,.2],[-.4,.2+gain*.3],[2,gain]]}));
      const marker=s.circle('marker',{radius:.12,position:[-2,-1.9],fill:'YELLOW'});
      s.keep(signal);s.keep(marker);s.play(marker.moveTo([2,-1.9]),{duration:4,ease:'linear'});
    });`,
  },
] as const;

export type Fixture = typeof fixtures[number];
export function target(frame: Frame, id: string) {
  const element = frame.elements.find(element => element.id === id);
  assert(element, `Missing ${id}`);
  assert(element.opacity > 0, `${id} must be visible`);
  return element;
}
export function verifyFixture(fixture: Fixture, frame: Frame) {
  const element = target(frame, fixture.target);
  if (fixture.id === 'cube') {
    assert.equal(element.geometry.kind, 'mesh');
    assert((element.geometry.vertices?.length ?? 0) >= 8, 'Cube must have vertices');
    assert((element.geometry.triangles?.length ?? 0) >= 12, 'Cube must have faces');
  } else if (fixture.id === 'graph') {
    assert.equal(element.geometry.points?.length, 65, 'Graph must contain its sampled function');
    assert.equal(element.geometry.points?.[32][1], -1, 'Graph vertex must match y=x²/2-1');
    assert.equal(element.geometry.points?.[0][1], 1, 'Graph must encode its actual function');
    target(frame, 'x-axis'); target(frame, 'y-axis');
  } else {
    assert.equal(target(frame, 'boundary').geometry.points?.length, 6, 'Custom bent boundary must exist');
    assert.equal(frame.elements.filter(element => element.id.startsWith('node-')).length, 5);
    assert.equal(element.geometry.points?.length, 3, 'Custom connection must have its bend');
  }
}
export function verifyChanged(fixture: Fixture, before: Frame, after: Frame) {
  const a = target(before, fixture.target), b = target(after, fixture.target);
  if (fixture.id === 'cube') assert.notDeepEqual(a.scale, b.scale, 'Cube control must change scale');
  else assert.notDeepEqual(a.geometry.points, b.geometry.points, 'Control must change actual geometry');
}
