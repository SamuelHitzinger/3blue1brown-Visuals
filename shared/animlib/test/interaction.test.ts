import { afterEach, expect, it, vi } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { ViewInteraction } from '../src/interaction.js';
import { CanvasRenderer } from '../src/renderer.js';
import { interactionSource } from '../demo/interaction.js';
import { project } from '../src/geometry.js';
import type { Vec3 } from '../src/types.js';

const source = `export default scene({orbit:true,mode:"3d"}, s => {
  let left, right;
  s.view("left", {rect:[0,0,0.5,1]}, v => {
    const size=v.slider("size",{default:1,min:0.5,max:2,position:[0.1,0.05],width:180});
    const a=v.sphere("a",{radius:size});
    v.keep(a);
    left=v.camera;
  });
  s.view("right", {rect:[0.5,0,0.5,1],camera:{yaw:-0.5}}, v => {
    v.sphere("b",{position:[1,0,1]});right=v.camera;
  });
  s.wait(2);
  s.play(left.animate({yaw:1,pitch:0.2}),{duration:2,ease:"linear"});
  s.wait(2);
  s.play(right.animate({yaw:2}),{duration:0});
  s.wait(2);
});`;

afterEach(() => vi.unstubAllGlobals());

it('compiles independent geometry/cameras, reevaluates controls, and inherits kept view elements', async () => {
  const scene=await compileSource(source);
  const frame=evaluateScene(scene,3);
  expect(frame.views?.map(v=>[v.id,v.cameraAnimated])).toEqual([['left',true],['right',false]]);
  expect(frame.cameraAnimated).toBe(false);
  expect(frame.views?.[0].camera.yaw).toBeCloseTo(0.775);
  expect(frame.views?.[1].camera.yaw).toBe(-0.5);
  expect(frame.elements.map(e=>[e.id,e.view])).toEqual([['a','left'],['b','right']]);
  expect(scene.controls[0]).toMatchObject({position:[0.1,0.05],width:180});
  const changed=await compileSource(source,{controls:{size:1.5}});
  expect(evaluateScene(changed,3).elements[0].geometry.radius).toBe(1.5);
  const next=await compileSource('export default scene({},s=>{s.previous.get("a");s.wait(1);})',{previous:evaluateScene(scene,8)});
  expect(next.views?.map(v=>v.id)).toEqual(['left']);
  expect(next.views?.[0].camera.yaw).toBe(1);
  expect(evaluateScene(next,0).elements[0].view).toBe('left');
  expect(await compileSource(interactionSource.source)).toMatchObject({duration:14,views:[{id:'left'},{id:'right'}]});
});

it.each([
  's.view("bad",{rect:[0,0,2,1]},v=>{});',
  's.view("bad",{rect:[0,0,0,1]},v=>{});',
  's.view("bad",{rect:[0,0,1,1],camera:{height:0}},v=>{});',
  's.view("same",{rect:[0,0,1,1]},v=>{});s.view("same",{rect:[0,0,1,1]},v=>{});',
  's.view("one",{rect:[0,0,1,1]},v=>s.view("two",{rect:[0,0,1,1]},w=>{}));',
  'const a=s.sphere("a");s.view("one",{rect:[0,0,1,1]},v=>v.group("g",[a]));',
  's.slider("a",{default:1,min:0,max:2,position:[-0.1,0]});',
  's.slider("a",{default:1,min:0,max:2,width:0});',
])('rejects invalid view or overlay declarations: %s',async body=>{
  await expect(compileSource(`export default scene({},s=>{${body}s.wait(1);})`)).rejects.toThrow();
});

it('lets distinct view cameras animate simultaneously',async()=>{
  const scene=await compileSource(`export default scene({},s=>{
    let a,b;
    s.view("a",{rect:[0,0,0.5,1]},v=>a=v.camera);
    s.view("b",{rect:[0.5,0,0.5,1]},v=>b=v.camera);
    s.play([a.animate({yaw:1}),b.animate({yaw:-1})],{duration:2});
  });`);
  expect(evaluateScene(scene,1).views?.every(v=>v.cameraAnimated)).toBe(true);
});

it('blends into authored rotations and restores authored poses when seeking across them',async()=>{
  const scene=await compileSource(source);
  const interaction=new ViewInteraction();
  interaction.sync('scene',1,scene);
  interaction.set({yaw:0.6,pitch:0.1},'left');
  interaction.set({yaw:0.7,pitch:0.2},'right');
  interaction.set({yaw:0.3,pitch:0.1});
  interaction.sync('scene',1.5,scene);
  expect(interaction.get('left').yaw).toBe(0.6);
  interaction.sync('scene',3,scene);
  expect(interaction.get('left').yaw).toBeCloseTo(0.3);
  expect(interaction.get('left').pitch).toBeCloseTo(0.05);
  expect(interaction.get('right').yaw).toBe(0.7);
  expect(interaction.get().yaw).toBe(0.3);
  interaction.sync('scene',5,scene);
  interaction.set({yaw:0.9,pitch:0.4},'left');
  interaction.sync('scene',1,scene);
  expect(interaction.get('left')).toEqual({yaw:0,pitch:0});
  expect(evaluateScene(scene,1).views?.[0].camera.yaw).toBe(0.55);
  interaction.set({yaw:0.8,pitch:0.1},'left');
  interaction.sync('scene',5,scene); // Jump completely over the track.
  expect(interaction.get('left').yaw).toBe(0);
  expect(evaluateScene(scene,5).views?.[0].camera.yaw).toBe(1);
  interaction.sync('scene',7,scene); // Cross a zero-duration right-camera rotation.
  expect(interaction.get('right').yaw).toBe(0);
  interaction.set({yaw:0.8,pitch:0.1},'right');
  interaction.sync('scene',5,scene);
  expect(interaction.get('right').yaw).toBe(0);
  expect(evaluateScene(scene,5).views?.[1].camera.yaw).toBe(-0.5);
});

it.each([['linear',0.25],['smooth',0.15625],['in',0.0625],['out',0.4375]] as const)(
  'uses the viewer angle as the start with %s easing, including paused refreshes and recompilation',async(ease,progress)=>{
    const code=`export default scene({mode:"3d",orbit:true},s=>{
      s.wait(2);s.play(s.camera.animate({yaw:1.4,pitch:-0.2}),{duration:4,ease:"${ease}"});s.wait(1);
    });`;
    const scene=await compileSource(code),interaction=new ViewInteraction();
    const pose=(time:number)=>{
      const camera=evaluateScene(scene,time).camera,offset=interaction.get();
      return {yaw:camera.yaw+offset.yaw,pitch:camera.pitch+offset.pitch};
    };
    interaction.sync('scene',1,scene);interaction.set({yaw:0.8,pitch:-0.3});
    const start=pose(1);
    interaction.sync('scene',2,scene);
    expect(pose(2).yaw).toBeCloseTo(start.yaw);expect(pose(2).pitch).toBeCloseTo(start.pitch);
    interaction.sync('scene',3,scene);
    const expected={yaw:start.yaw+(1.4-start.yaw)*progress,pitch:start.pitch+(-0.2-start.pitch)*progress};
    expect(pose(3).yaw).toBeCloseTo(expected.yaw);expect(pose(3).pitch).toBeCloseTo(expected.pitch);
    for(let i=0;i<3;i++)interaction.sync('scene',3,scene);
    interaction.sync('scene',3,await compileSource(code));
    expect(pose(3).yaw).toBeCloseTo(expected.yaw);expect(pose(3).pitch).toBeCloseTo(expected.pitch);
    interaction.sync('scene',6,scene);
    expect(interaction.get()).toEqual({yaw:0,pitch:0});expect(pose(6)).toEqual({yaw:1.4,pitch:-0.2});
  },
);

it('replays a captured handoff while scrubbing and recaptures only after rewinding before it',async()=>{
  const scene=await compileSource(source),interaction=new ViewInteraction();
  interaction.sync('scene',1,scene);interaction.set({yaw:0.8,pitch:0.2},'left');
  interaction.sync('scene',3,scene);
  const middle=interaction.get('left');
  interaction.sync('scene',5,scene);interaction.set({yaw:1.3,pitch:0.4},'left');
  interaction.sync('scene',3,scene);expect(interaction.get('left')).toEqual(middle);
  interaction.sync('scene',2.5,scene);
  expect(interaction.get('left').yaw).toBeCloseTo(0.6);
  interaction.sync('scene',3,scene);expect(interaction.get('left')).toEqual(middle);
  interaction.sync('scene',1,scene);expect(interaction.get('left')).toEqual({yaw:0,pitch:0});
  interaction.set({yaw:-0.4,pitch:-0.2},'left');interaction.sync('scene',3,scene);
  expect(interaction.get('left').yaw).toBeCloseTo(-0.2);expect(interaction.get('left').pitch).toBeCloseTo(-0.1);
});

it('takes the short yaw route after viewer spins without altering untouched authored turns',async()=>{
  const scene=await compileSource(`export default scene({mode:"3d",orbit:true},s=>{
    s.wait(1);s.play(s.camera.animate({yaw:0.1}),{duration:2,ease:"linear"});s.wait(1);
    s.play(s.camera.animate({yaw:${Math.PI*4+0.1}}),{duration:2,ease:"linear"});
  });`),interaction=new ViewInteraction();
  interaction.sync('scene',0,scene);interaction.set({yaw:Math.PI*8-0.2-0.55,pitch:0.4});
  interaction.sync('scene',1,scene);
  expect(scene.camera.yaw+interaction.get().yaw).toBeCloseTo(-0.2);
  interaction.sync('scene',2,scene);
  expect(evaluateScene(scene,2).camera.yaw+interaction.get().yaw).toBeCloseTo(-0.05);
  expect(interaction.get().pitch).toBeCloseTo(0.2); // A yaw-only track gently restores authored tilt too.
  interaction.sync('scene',3,scene);expect(interaction.get()).toEqual({yaw:0,pitch:0});
  interaction.sync('scene',5,scene);
  expect(interaction.get().yaw).toBe(0);
  expect(evaluateScene(scene,5).camera.yaw).toBeCloseTo(Math.PI*2+0.1);
});

it('captures parallel yaw/pitch actions once and keeps consecutive handoffs separate',async()=>{
  const scene=await compileSource(`export default scene({mode:"3d",orbit:true},s=>{
    s.wait(1);s.play([s.camera.animate({yaw:1}),s.camera.animate({pitch:0.1})],{duration:2,ease:"linear"});
    s.wait(1);s.play(s.camera.animate({yaw:1.5,pitch:0.5}),{duration:2,ease:"linear"});s.wait(1);
  });`),interaction=new ViewInteraction();
  interaction.sync('scene',0,scene);interaction.set({yaw:0.4,pitch:0.2});
  interaction.sync('scene',2,scene);
  expect(interaction.get().yaw).toBeCloseTo(0.2);expect(interaction.get().pitch).toBeCloseTo(0.1);
  interaction.sync('scene',3,scene);interaction.set({yaw:0.8,pitch:0.4});
  interaction.sync('scene',5,scene);
  expect(interaction.get().yaw).toBeCloseTo(0.4);expect(interaction.get().pitch).toBeCloseTo(0.2);
  interaction.sync('scene',2,scene); // Rewind across the later track into the earlier blend.
  expect(interaction.get().yaw).toBeCloseTo(0.2);expect(interaction.get().pitch).toBeCloseTo(0.1);
  interaction.sync('scene',5,scene);expect(interaction.get()).toEqual({yaw:0,pitch:0});
});

it('preserves viewer angles through framing-only animations and fades them through a 3D-to-2D transition',async()=>{
  const scene=await compileSource(`export default scene({mode:"3d",orbit:true},s=>{
    s.wait(1);s.play(s.camera.animate({height:5}),{duration:2});s.wait(1);
    s.play(s.camera.to2D(),{duration:2,ease:"linear"});
  });`),interaction=new ViewInteraction();
  interaction.sync('scene',0,scene);interaction.set({yaw:0.7,pitch:0.2});
  interaction.sync('scene',2,scene);expect(interaction.get()).toEqual({yaw:0.7,pitch:0.2});
  interaction.sync('scene',4,scene);expect(interaction.get()).toEqual({yaw:0.7,pitch:0.2});
  interaction.sync('scene',5,scene);expect(interaction.get()).toEqual({yaw:0.35,pitch:0.1});
  interaction.sync('scene',6,scene);expect(interaction.get()).toEqual({yaw:0,pitch:0});
});

it('isolates viewer state by scene and preserves it across unchanged recompilation',async()=>{
  const scene=await compileSource(source),interaction=new ViewInteraction();
  interaction.sync('one',1,scene);interaction.set({yaw:1,pitch:0},'left');
  interaction.sync('two',1,scene);expect(interaction.get('left').yaw).toBe(0);
  interaction.set({yaw:2,pitch:0},'left');
  interaction.sync('one',1,await compileSource(source,{controls:{size:1.2}}));
  expect(interaction.get('left').yaw).toBe(1);
  interaction.reset();interaction.sync('one',1,scene);
  expect(interaction.get('left').yaw).toBe(0);
});

it('routes captured pointer drags to one region and blocks a locked region without rotating the main camera',async()=>{
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  const handlers=new Map<string,(event:PointerEvent)=>void>();
  const captured=new Set<number>();
  const canvas={width:800,height:400,style:{},getBoundingClientRect:()=>({left:100,top:50,width:800,height:400}),
    addEventListener:(name:string,handler:(event:PointerEvent)=>void)=>handlers.set(name,handler),
    removeEventListener:vi.fn(),setPointerCapture:(id:number)=>captured.add(id),hasPointerCapture:(id:number)=>captured.has(id),releasePointerCapture:(id:number)=>captured.delete(id),
  } as unknown as HTMLCanvasElement;
  const renderer=new CanvasRenderer(canvas),scene=await compileSource(source);
  const send=(type:string,x:number,y:number,id=1,button=0)=>handlers.get(type)!({clientX:x,clientY:y,pointerId:id,button,preventDefault:vi.fn()} as unknown as PointerEvent);
  renderer.syncInteraction('scene',1,scene,evaluateScene(scene,1));renderer.setOrbitEnabled(true);
  send('pointerdown',200,200);send('pointermove',600,230); // Capture retains the left view even outside its bounds.
  expect(renderer.getOrbit('left').yaw).toBeCloseTo(-Math.PI);
  expect(renderer.getOrbit('right').yaw).toBe(0);expect(renderer.orbit.yaw).toBe(0);
  send('pointerup',600,230,2);expect(captured.has(1)).toBe(true);
  send('pointerup',600,230);expect(captured.size).toBe(0);
  renderer.syncInteraction('scene',3,scene,evaluateScene(scene,3));
  send('pointerdown',200,200);expect(captured.size).toBe(0);
  send('pointerdown',600,200);send('pointermove',620,200);send('pointerup',620,200);
  expect(renderer.getOrbit('right').yaw).toBeCloseTo(-Math.PI/20);expect(renderer.orbit.yaw).toBe(0);
  send('pointerdown',600,200,1,2);expect(captured.size).toBe(1);send('pointerup',600,200,1,2);
  send('pointerdown',600,200);send('lostpointercapture',600,200);expect(captured.size).toBe(0);
  renderer.dispose();expect(canvas.removeEventListener).toHaveBeenCalledTimes(6);
});

it('starts geometry-targeted orbit on a model, not empty space or standalone text', async()=>{
  const {renderer,send}=orbitHarness();
  try {
    const scene=await compileSource(`export default scene({},s=>{
      s.view("model",{rect:[0,0,1,1],orbit:true,orbitHitTest:"geometry",camera:{yaw:0,pitch:0,height:8}},v=>{
        v.keep(v.sphere("ball",{radius:0.6}));
        v.latex("caption",{tex:"x",position:[3,0,0]});
      });s.wait(1);
    });`);
    const frame=evaluateScene(scene,0);
    renderer.syncInteraction('scene',0,scene,frame);
    Object.assign(renderer,{lastFrame:frame,lastOptions:scene.options});
    const drag=(x:number,y:number)=>{send('pointerdown',x,y);send('pointermove',x+20,y);send('pointerup',x+20,y);};
    drag(100,100);expect(renderer.getOrbit('model').yaw).toBe(0);
    drag(550,200);expect(renderer.getOrbit('model').yaw).toBe(0);
    drag(400,200);expect(renderer.getOrbit('model').yaw).not.toBe(0);
    const next=await compileSource('export default scene({},s=>{s.previous.get("ball");s.wait(1);});',{previous:frame});
    expect(evaluateScene(next,0).views?.[0].orbitHitTest).toBe('geometry');
  } finally {renderer.dispose();}
});

function orbitHarness(width=800,height=400) {
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  const handlers=new Map<string,(event:PointerEvent)=>void>();
  const canvas={width,height,style:{},getBoundingClientRect:()=>({left:100,top:50,width,height}),
    addEventListener:(name:string,handler:(event:PointerEvent)=>void)=>handlers.set(name,handler),
    removeEventListener:vi.fn(),setPointerCapture:vi.fn(),hasPointerCapture:()=>false,
  } as unknown as HTMLCanvasElement;
  const renderer=new CanvasRenderer(canvas);
  const send=(type:string,x:number,y:number)=>handlers.get(type)!({clientX:100+x,clientY:50+y,pointerId:1,button:0,preventDefault:vi.fn()} as unknown as PointerEvent);
  return {renderer,send};
}

it.each([0,Math.PI/2,Math.PI,3*Math.PI/2])('makes the near surface follow both drag directions at yaw %s without rolling',async yaw=>{
  const {renderer,send}=orbitHarness();
  try {
    const scene=await compileSource(`export default scene({},s=>{
      s.view("view",{rect:[0,0,1,1],camera:{yaw:${yaw},pitch:0.35}},v=>{});s.wait(1);
    });`);
    const frame=evaluateScene(scene,0),camera=frame.views![0].camera;
    renderer.syncInteraction('scene',0,scene,frame);
    // A point on the surface directly facing the camera, defined in world space.
    const near:Vec3=[Math.sin(yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch),Math.cos(yaw)*Math.cos(camera.pitch)];
    const before=project(near,camera,800,400);
    for(const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]]) {
      renderer.setOrbit({yaw:0,pitch:0},'view');
      send('pointerdown',400,200);send('pointermove',400+dx,200+dy);send('pointerup',400+dx,200+dy);
      const offset=renderer.getOrbit('view');
      const afterCamera={...camera,yaw:camera.yaw+offset.yaw,pitch:camera.pitch+offset.pitch};
      const after=project(near,afterCamera,800,400);
      if(dx)expect((after.x-before.x)*dx).toBeGreaterThan(0);
      if(dy)expect((after.y-before.y)*dy).toBeGreaterThan(0);
      const origin=project([0,0,0],afterCamera,800,400),up=project([0,1,0],afterCamera,800,400);
      expect(up.x).toBeCloseTo(origin.x);expect(up.y).toBeLessThan(origin.y);
    }
  } finally {renderer.dispose();}
});

it.each([[800,400,1],[1600,800,2]])('scales drags to unequal regions and the full canvas at %s x %s / DPR %s',async(width,height,dpr)=>{
  vi.stubGlobal('devicePixelRatio',dpr);
  const {renderer,send}=orbitHarness(width,height);
  try {
    const scene=await compileSource(`export default scene({mode:"3d",orbit:true},s=>{
      s.view("small",{rect:[0,0,0.25,0.5]},v=>{});
      s.view("large",{rect:[0.5,0,0.5,1]},v=>{});s.wait(1);
    });`);
    renderer.syncInteraction('scene',0,scene,evaluateScene(scene,0));renderer.setOrbitEnabled(true);
    for(const [id,x,y,shortSide] of [['small',width*0.1,height*0.2,height/2],['large',width*0.7,height*0.3,height],['',width*0.3,height*0.6,height]] as const) {
      send('pointerdown',x,y);send('pointermove',x+shortSide/10,y+shortSide/10);send('pointerup',x+shortSide/10,y+shortSide/10);
      const offset=renderer.getOrbit(id);
      expect(offset.yaw).toBeCloseTo(-Math.PI/10);expect(offset.pitch).toBeCloseTo(-Math.PI/10);
    }
  } finally {renderer.dispose();}
});

it.each([-1,1])('stops before a pole and responds immediately when reversing direction %s',async direction=>{
  const {renderer,send}=orbitHarness();
  try {
    const scene=await compileSource(`export default scene({},s=>{
      s.view("view",{rect:[0,0,1,1],camera:{pitch:0.6}},v=>{});s.wait(1);
    });`);
    renderer.syncInteraction('scene',0,scene,evaluateScene(scene,0));
    send('pointerdown',400,200);send('pointermove',400,200+direction*1000);
    const atPole=0.6+renderer.getOrbit('view').pitch;
    expect(atPole).toBeCloseTo(-direction*(Math.PI/2-0.02));
    send('pointermove',400,200+direction*999);
    expect(Math.abs(0.6+renderer.getOrbit('view').pitch)).toBeLessThan(Math.abs(atPole));
    send('pointerup',400,200+direction*999);
  } finally {renderer.dispose();}
});

it('compiles round 3D lines and arrows and retains their profile through geometry morphs',async()=>{
  const scene=await compileSource(`export default scene({mode:"3d"},s=>{
    const line=s.line3D("line",{points:[[0,0,0],[0,0,2]],strokeWidth:0.1});
    s.arrow3D("arrow",{points:[[0,0,0],[1,2,3]]});
    s.play(line.morphTo({kind:"line",points:[[0,0,0],[2,0,0]]}),{duration:2});
  });`);
  for(const time of [0,1,2])expect(evaluateScene(scene,time).elements.every(e=>e.strokeProfile==='round')).toBe(true);
  await expect(compileSource('export default scene({},s=>{s.line3D("bad",{points:[[0,0],[1,1]],space:"screen"});})')).rejects.toThrow('world space');
  await expect(compileSource('export default scene({},s=>{s.line("bad",{points:[[0,0],[1,1]],strokeProfile:"bad"});})')).rejects.toThrow('stroke profile');
});


it('retains escaped view builders, detached constructors, groups, and bindings in their owning view', async () => {
  const compiled = await compileSource(`export default scene({}, s => {
    let left, sphere;
    s.text('heading', {text:'Global overlay',space:'screen'});
    s.view('left', {rect:[0,0,0.5,1]}, v => { left=v; sphere=v.sphere; });
    const a=sphere('a');
    s.view('right', {rect:[0.5,0,0.5,1]}, v => {
      const b=left.sphere('b');
      left.group('pair',[a,b]);
      v.sphere('right-ball');
    });
    const label=left.text('label',{text:'A',billboard:true});
    left.attach(label,a,{offset:[0,1,0]});
    s.sphere('global-ball');
    left.keep(a);
    s.wait(1);
  });`);
  const frame = evaluateScene(compiled, 1);
  expect(frame.elements.map(e => [e.id,e.view])).toEqual([
    ['heading',undefined], ['a','left'], ['b','left'], ['pair','left'],
    ['right-ball','right'], ['label','left'], ['global-ball',undefined],
  ]);
  expect(frame.elements.find(e => e.id === 'a')?.persistent).toBe(true);
  const next = await compileSource(`export default scene({},s=>{s.previous.get('a');s.wait(1);});`, {previous:frame});
  expect(next.views?.map(v=>v.id)).toEqual(['left']);
  expect(evaluateScene(next,0).elements[0].view).toBe('left');
});

it('still rejects grouping elements from different escaped view builders', async () => {
  await expect(compileSource(`export default scene({},s=>{
    let left;
    s.view('left',{rect:[0,0,0.5,1]},v=>left=v);
    const global=s.sphere('global');
    left.group('mixed',[global]);s.wait(1);
  });`)).rejects.toThrow('same view');
});
