import {expect,test} from 'bun:test';
import {compileSource} from '../../../shared/animlib/src/compiler.js';
import {evaluateScene} from '../../../shared/animlib/src/timeline.js';
import {markerSource,objectSource,surfaceSource} from './fixtures.js';
import {LiveWorld} from '../realtime-world/world.js';

test('progressive object fixtures retain identity and local label without invented motion',async()=>{
  const cube=await compileSource(objectSource('cube')),sphere=await compileSource(objectSource('sphere'));
  const cubeElements=evaluateScene(cube,0).elements,sphereElements=evaluateScene(sphere,0).elements;
  expect(cube.duration).toBe(2);expect(sphere.duration).toBe(2);
  expect(cubeElements.map(item=>item.id)).toEqual(sphereElements.map(item=>item.id));
  expect(cubeElements.find(item=>item.id==='object')?.geometry.kind).toBe('mesh');
  expect(sphereElements.find(item=>item.id==='object')?.geometry.kind).toBe('sphere');
  expect(cube.reactiveBindings??[]).toHaveLength(0);
  expect(cube.bindings).toEqual([{type:'attach',target:'object-label',source:'object',offset:[0,-1,0],anchor:'origin'}]);
});

test('independent marker and custom surface compile through native scene API',async()=>{
  const marker=await compileSource(markerSource),surface=await compileSource(surfaceSource);
  expect(marker.duration).toBe(20);
  expect(marker.reactiveBindings?.some(binding=>binding.target==='epoch-marker'&&binding.time)).toBe(true);
  const geometry=evaluateScene(surface,0).elements.find(item=>item.id==='novel-surface')?.geometry;
  expect(geometry?.vertices).toHaveLength(1089);expect(geometry?.triangles).toHaveLength(2048);
});

test('scripted sequence attaches late motion, preserves pose and label through replacement, then adds a custom surface',async()=>{
  const previousWorker=globalThis.Worker;Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
  let clock=0;const world=new LiveWorld({clock:()=>clock});
  const sample=async()=>{const frame=await world.sample(clock);return {frame,object:frame.elements.find(item=>item.id==='object')!,label:frame.elements.find(item=>item.id==='object-label')!};};
  try{
    await world.addProgram({id:'reference',source:markerSource,baseRevision:0},clock);
    await world.addProgram({id:'object-program',source:objectSource('cube'),baseRevision:1},clock);
    clock=3;expect((await sample()).object.position[0]).toBe(-2);
    await world.setMotion({baseRevision:2,changes:[{id:'object',velocity:[.6,0,0]}]},clock);
    clock=5;const before=(await sample()).object.position[0];expect(before).toBeCloseTo(-.8,10);
    await world.setMotion({baseRevision:3,changes:[{id:'object',velocity:[-.4,0,0]}]},clock);
    expect((await sample()).object.position[0]).toBeCloseTo(before,10);
    clock=7;expect((await sample()).object.position[0]).toBeCloseTo(-1.6,10);
    await world.setMotion({baseRevision:4,changes:[{id:'object',velocity:[0,0,0]}]},clock);
    clock=8;await world.replaceProgram({id:'object-program',source:objectSource('sphere'),baseRevision:5},clock);
    const replaced=await sample();expect(replaced.object.geometry.kind).toBe('sphere');
    expect(replaced.object.position[0]).toBeCloseTo(-1.6,10);
    expect(replaced.label.position[0]).toBeCloseTo(replaced.object.position[0],10);
    expect(replaced.label.position[1]).toBeCloseTo(replaced.object.position[1]-1,10);
    expect(world.summary().programs.find(program=>program.id==='object-program')?.epoch).toBe(0);
    clock=9;await world.addProgram({id:'surface-program',source:surfaceSource,baseRevision:6},clock);
    const final=await sample();expect(final.frame.elements.some(item=>item.id==='novel-surface')).toBe(true);
    const rotation=final.frame.elements.find(item=>item.id==='epoch-marker')!.rotation;
    [2.7,4.5,1.8].forEach((value,index)=>expect(rotation[index]).toBeCloseTo(value,10));
    expect(world.revision).toBe(7);
  }finally{world.dispose();Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:previousWorker});}
});
