import { describe, expect, it, vi } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { BehaviorRuntime } from '../src/behaviors.js';
import { cameraRay, pick, SpatialFrame, planePoint } from '../src/spatial.js';
import { project } from '../src/geometry.js';
import type { CompiledScene, Frame, Vec3 } from '../src/types.js';

const compile = (body: string) => compileSource(`export default scene({},s=>{${body}});`);
const raw = (scene: CompiledScene, time = 0) => evaluateScene(scene,time,{bindings:false});
const at = (frame: Frame, id: string) => frame.elements.find(e=>e.id===id)!;
const ray = (x: number, y = 0) => ({origin:[x,y,10] as Vec3,direction:[0,0,-1] as Vec3});

describe('declarative behaviors and bindings',()=>{
  it('clamps bounded dragging in world space and updates attached geometry',async()=>{
    const scene=await compile(`const a=s.sphere('a'),label=s.text('label',{text:'A'});
      const g=s.group('g',[a]);s.play(g.scaleTo(2),{duration:0});
      s.attach(label,a,{offset:[0,1,0]});
      s.behavior(a,{type:'drag',plane:'xy',bounds:{min:[-2,-1,0],max:[2,1,0]}});s.wait(1);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0.2)});
    runtime.input('a',{type:'move',ray:ray(20,20)});
    let frame=runtime.evaluate(scene,raw(scene),0,0),space=new SpatialFrame(frame);
    expect(space.world('a')).toEqual([2,1,0]);expect(space.world('label')).toEqual([2,2,0]);
    runtime.input('a',{type:'move',ray:ray(-20,-20)});
    frame=runtime.evaluate(scene,raw(scene),0,0);expect(new SpatialFrame(frame).world('a')).toEqual([-2,-1,0]);
    runtime.input('a',{type:'end'});expect(runtime.heldTarget).toBeUndefined();
    expect(new SpatialFrame(runtime.evaluate(scene,raw(scene),0,0)).world('a')).toEqual([-2,-1,0]);
  });

  it('keeps open-path movement on adjacent segments and clamps endpoints',async()=>{
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[4,0,0],[4,4,0],[0,4,0]]}});s.wait(1);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0)});
    const move=(x:number,y:number)=>{runtime.input('a',{type:'move',ray:ray(x,y)});return at(runtime.evaluate(scene,raw(scene),0,0),'a').position;};
    expect(move(2,0)).toEqual([2,0,0]);
    expect(move(2,4)).toEqual([2,0,0]); // Cannot jump to the opposite parallel road.
    expect(move(8,8)).toEqual([4,0,0]); // Visit the corner before changing segments.
    expect(move(8,8)).toEqual([4,4,0]);
    expect(move(-8,4)).toEqual([0,4,0]);
    expect(move(-8,8)).toEqual([0,4,0]);
    runtime.input('a',{type:'cancel'});expect(runtime.heldTarget).toBeUndefined();
    runtime.reset();expect(at(runtime.evaluate(scene,raw(scene),0,0),'a').position).toEqual([0,0,0]);
  });

  it('traverses a closed path through its closing segment and preserves the grab offset',async()=>{
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[4,0,0],[4,4,0],[0,4,0]],closed:true}});s.wait(1);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0.2,0.2)});
    for(const [x,y] of [[4,0],[4,4],[0,4],[0,0],[2,0]]) {
      runtime.input('a',{type:'move',ray:ray(x+0.2,y+0.2)});
      const p=at(runtime.evaluate(scene,raw(scene),0,0),'a').position;
      expect(p[0]).toBeCloseTo(x);expect(p[1]).toBeCloseTo(y);
    }
  });

  it('combines axis dragging with bounds without moving the fixed coordinates',async()=>{
    const scene=await compile(`const a=s.sphere('a',{position:[0,2,0]});s.behavior(a,{type:'drag',axis:'x',bounds:{min:[-1,1,-1],max:[1,3,1]}});s.wait(1);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0,2)});runtime.input('a',{type:'move',ray:ray(50,20)});
    expect(at(runtime.evaluate(scene,raw(scene),0,0),'a').position).toEqual([1,2,0]);
  });

  it('keeps highly damped springs bounded and converges after release',async()=>{
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'drag'});s.behavior(a,{type:'spring',stiffness:1000,damping:1000});s.wait(1);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0)});runtime.input('a',{type:'move',ray:ray(1)});runtime.input('a',{type:'end'});
    let previous=1;
    for(let i=0;i<600;i++){
      const x=at(runtime.evaluate(scene,raw(scene),0,1/60),'a').position[0];
      expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(previous);previous=x;
    }
    expect(previous).toBe(0);expect(runtime.active).toBe(false);
  });

  it('resolves a live source and bound parent before updating a held child',async()=>{
    const scene=await compile(`const child=s.sphere('child'),source=s.sphere('source',{position:[2,0,0]});
      const group=s.group('group',[child]);s.attach(group,source);
      s.behavior(child,{type:'drag'});s.behavior(source,{type:'custom',name:'move'});s.wait(1);`);
    let sourceX=2;
    const runtime=new BehaviorRuntime({move:()=>({update:c=>{c.setWorldPosition([sourceX,0,0]);}})});
    let frame=runtime.evaluate(scene,raw(scene),0,0);
    expect(new SpatialFrame(frame).world('child')).toEqual([2,0,0]);
    runtime.input('child',{type:'start',ray:ray(2)});
    for(const x of [2,3,4]){
      sourceX=x;frame=runtime.evaluate(scene,raw(scene),0,1/60);
      expect(new SpatialFrame(frame).world('group')).toEqual([x,0,0]);
      expect(new SpatialFrame(frame).world('child')).toEqual([2,0,0]);
    }
  });
  it.each([
    `s.behavior(a,{type:'drag',plane:'wrong'});`,
    `s.behavior(a,{type:'drag',bounds:{min:[0,0,0],max:[1,1,1]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',bounds:{min:[2,0,0],max:[1,1,1]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',bounds:{min:[0,0],max:[1,1,1]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0]]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[0,0,0]]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[1,1,1]]}});`,
    `s.behavior(a,{type:'drag',plane:'screen',path:{points:[[0,0,0],[1,0,0]]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[1,0,0]],closed:true}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:[[0,0,0],[1,0,0],[0,0,0]],closed:true}});`,
    `s.behavior(a,{type:'drag',plane:'xy',path:{points:Array.from({length:257},(_,i)=>[i,0,0])}});`,
    `s.behavior(a,{type:'drag',plane:'xy',bounds:{min:[0,0,0],max:[1,1,1]},path:{points:[[0,0,0],[1,0,0]]}});`,
    `s.behavior(a,{type:'drag',plane:'xy',axis:'x'});`,
    `s.behavior(a,{type:'spring',stiffness:-1});`,
    `s.behavior(a,{type:'spring',damping:0});`,
    `s.behavior(a,{type:'spring'});s.behavior(a,{type:'spring'});`,
    `s.attach(a,b);s.attach(b,a);`,
    `s.attach(a,b);s.attach(a,b);`,
    `s.attach(a,b);s.behavior(a,{type:'drag'});`,
    `const g=s.group('g',[a]);s.attach(g,a);`,
    `s.connect(a,a,b);`,
  ])('rejects invalid declarations: %s', async body=>{
    await expect(compile(`const a=s.sphere('a'),b=s.sphere('b');${body}s.wait(1);`)).rejects.toThrow();
  });

  it('keeps a grabbed atom at its world position as its authored timeline advances, then springs to the moving target',async()=>{
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'drag'});s.behavior(a,{type:'spring'});s.play(a.moveTo([2,0,0]),{duration:2,ease:'linear'});`);
    const runtime=new BehaviorRuntime();
    runtime.evaluate(scene,raw(scene),0,0);
    expect(runtime.input('a',{type:'start',ray:ray(0),normal:[0,0,1]})).toBe(true);
    runtime.input('a',{type:'move',ray:ray(3)});
    expect(at(runtime.evaluate(scene,raw(scene,1),1,1/60),'a').position).toEqual([3,0,0]);
    runtime.input('a',{type:'end'});
    let frame=runtime.evaluate(scene,raw(scene,2),2,1/60);
    expect(runtime.active).toBe(true);
    for(let i=0;i<300;i++)frame=runtime.evaluate(scene,raw(scene,2),2,1/60);
    expect(at(frame,'a').position).toEqual([2,0,0]);expect(runtime.active).toBe(false);
    expect(at(raw(scene,1),'a').position).toEqual([1,0,0]);
  });

  it('dragging without a spring retains an offset and constrains axes',async()=>{
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'drag',axis:'x'});s.play(a.moveTo([2,0,0]),{duration:2,ease:'linear'});`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0)});runtime.input('a',{type:'move',ray:ray(3,4)});
    runtime.input('a',{type:'end'});
    const frame=runtime.evaluate(scene,raw(scene,1),1,1/60);
    expect(at(frame,'a').position).toEqual([4,0,0]);expect(runtime.active).toBe(false);
  });

  it('resolves labels, chained attachments and clipped connectors after drag under transformed parents',async()=>{
    const scene=await compile(`const a=s.sphere('a',{radius:0.5}),b=s.sphere('b',{radius:0.5,position:[3,0,0]});
      const label=s.text('label',{text:'A'}),label2=s.text('label2',{text:'B'}),bond=s.line3D('bond',{});
      s.attach(label2,label,{offset:[0,1,0]});s.attach(label,a,{offset:[0,1,0]});s.connect(bond,a,b,{endpoints:'surface'});
      const parent=s.group('parent',[a]);s.play([parent.scaleTo(2),parent.rotateTo(Math.PI/2)],{duration:0});
      s.behavior(a,{type:'drag'});s.wait(2);`);
    const runtime=new BehaviorRuntime();runtime.evaluate(scene,raw(scene),0,0);
    runtime.input('a',{type:'start',ray:ray(0),normal:[0,0,1]});runtime.input('a',{type:'move',ray:ray(1)});
    const frame=runtime.evaluate(scene,raw(scene),0,0), space=new SpatialFrame(frame);
    expect(space.world('a')[0]).toBeCloseTo(1);
    expect(space.world('label')).toEqual([1,1,0]);expect(space.world('label2')).toEqual([1,2,0]);
    expect(at(frame,'bond').geometry.points).toEqual([[2,0,0],[2.5,0,0]]);
    expect(at(evaluateScene(scene,0),'bond').geometry.points).toEqual([[1,0,0],[2.5,0,0]]);
  });

  it('reveals a connector when dragging initially overlapping endpoints apart',async()=>{
    const scene=await compile(`const a=s.sphere('a'),b=s.sphere('b');const line=s.line3D('line',{});s.connect(line,a,b,{endpoints:'surface'});s.behavior(b,{type:'drag'});s.wait(1);`);
    const runtime=new BehaviorRuntime();expect(at(runtime.evaluate(scene,raw(scene),0,0),'line').opacity).toBe(0);
    runtime.input('b',{type:'start',ray:ray(0)});runtime.input('b',{type:'move',ray:ray(3)});
    const frame=runtime.evaluate(scene,raw(scene),0,0);
    expect(at(frame,'line').opacity).toBe(1);expect(at(frame,'line').geometry.points).toEqual([[0.5,0,0],[2.5,0,0]]);
  });

  it('runs host-defined stateful behaviors, handles keyboard input and disposes on recompile/removal/reset',async()=>{
    const dispose=vi.fn();let ticks=0;
    const runtime=new BehaviorRuntime({pulse:options=>({update:ctx=>{ticks++;ctx.element.opacity=Number(options);return ticks<3;},input:event=>event.type==='key',dispose})});
    const scene=await compile(`const a=s.sphere('a');s.behavior(a,{type:'custom',name:'pulse',options:0.4});s.wait(1);s.remove(a);s.wait(1);`);
    expect(()=>new BehaviorRuntime().validate([scene])).toThrow('Unregistered behavior');runtime.validate([scene]);
    expect(at(runtime.evaluate(scene,raw(scene),0,0),'a').opacity).toBe(0.4);expect(runtime.active).toBe(true);
    expect(runtime.input('a',{type:'key',key:'Enter'})).toBe(true);
    runtime.evaluate(scene,raw(scene,2),2,0);expect(dispose).toHaveBeenCalledTimes(1);
    runtime.evaluate(scene,raw(scene),0,0);runtime.reset();expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('resets offsets on compilation changes even when element IDs are reused',async()=>{
    const source=`const a=s.sphere('a');s.behavior(a,{type:'drag'});s.wait(1);`;
    const first=await compile(source),second=await compile(source),runtime=new BehaviorRuntime();
    runtime.evaluate(first,raw(first),0,0);runtime.input('a',{type:'start',ray:ray(0)});runtime.input('a',{type:'move',ray:ray(3)});
    expect(at(runtime.evaluate(second,raw(second),0,0),'a').position).toEqual([0,0,0]);expect(runtime.heldTarget).toBeUndefined();
  });
});

describe('camera and hit testing',()=>{
  it.each(['circle','rectangle'])('picks interpolated %s dimensions during growth and shrinkage',async kind=>{
    const small=kind==='circle'?{radius:.5}:{width:1,height:1};
    const large=kind==='circle'?{radius:2}:{width:4,height:4};
    for(const [from,to] of [[small,large],[large,small]]){
      const scene=await compile(`const a=s.${kind}('a',${JSON.stringify(from)});s.play(a.morphTo(${JSON.stringify({kind,...to})}),{duration:2,ease:'linear'});`);
      const frame=raw(scene,1),targets=new Set(['a']);
      expect(pick(frame,ray(1),targets,frame.camera,640,480)?.id).toBe('a');
      expect(pick(frame,ray(1.4),targets,frame.camera,640,480)).toBeUndefined();
      expect(pick(frame,ray(0,1),targets,frame.camera,640,480)?.id).toBe('a');
      expect(pick(frame,ray(0,1.4),targets,frame.camera,640,480)).toBeUndefined();
    }
  });
  it('round trips world coordinates through rotated, panned and blended perspective cameras',()=>{
    for(const perspective of [0,0.3,1])for(const yaw of [-1,0,1])for(const pitch of [-0.4,0,0.4]){
      const camera={target:[1,2,0] as Vec3,yaw,pitch,perspective,height:8,distance:12},point:[number,number,number]=[0.3,0.5,0];
      const pixel=project(point,camera,713,491),ray=cameraRay(pixel.x,pixel.y,camera,713,491);
      const hit=planePoint(ray,point,[0,0,1])!;for(let i=0;i<3;i++)expect(hit[i]).toBeCloseTo(point[i],9);
    }
  });
  it('picks the nearest sphere surface, including grouped targets, and ignores transparent elements',async()=>{
    const scene=await compile(`const back=s.sphere('back',{radius:1}),front=s.sphere('front',{radius:0.5,position:[0,0,2]});s.group('g',[front]);s.sphere('hidden',{radius:1,position:[0,0,5],opacity:0});s.wait(1);`);
    const frame=raw(scene);expect(pick(frame,ray(0),new Set(['back','g','hidden']),frame.camera,640,480)?.id).toBe('g');
  });
});
