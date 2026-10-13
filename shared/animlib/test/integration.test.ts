import {expect,it} from 'vitest';
import {SceneSequence} from '../src/sequence.js';
import {buildDrawItems} from '../src/render-geometry.js';
import {addPlanarShadows} from '../src/planar-shadows.js';
import {composeItems} from '../src/composition.js';
import {paletteResolver} from '../src/palette.js';
import {RetainedGeometry,retentionForFrame} from '../src/retained-geometry.js';
import {VERTEX_FLOATS} from '../src/texture-shader.js';
import {combinedSource} from './integration-cases.js';

it('packs effective deformation, caps and scalar colors before per-view shadow composition',async()=>{
 const sequence=new SceneSequence();
 try {
  expect((await sequence.submit({type:'load',scenes:[{id:'a',source:combinedSource}]})).ok).toBe(true);
  const scene=sequence.compiled[0],frame=await sequence.evaluate(0,1.2),palette=paletteResolver();
  expect(retentionForFrame(frame)).toBe(false);
  const region=frame.views![0],items=buildDrawItems(frame,region.camera,320,480,palette,region.id);
  const solid=items.filter(i=>i.elementId==='left-solid');
  const fills=solid.filter(i=>i.component==='fill'),edges=solid.filter(i=>i.component==='stroke');
  expect(fills.length).toBeGreaterThan(1); // Clipped original surface AND a cap.
  expect(fills.every(i=>i.castShadow)).toBe(true);
  expect(edges.length).toBeGreaterThan(0);expect(edges.every(i=>!i.castShadow)).toBe(true);
  expect(edges.some(i=>i.cameraDependentGeometry)).toBe(true);
  const shadowed=addPlanarShadows(items,frame.lighting,region.camera,palette);
  const masks=shadowed.filter(i=>i.groups?.some(g=>g.id.startsWith('@shadow:')));
  expect(masks).toHaveLength(7);expect(masks.every(i=>i.cameraDependentGeometry)).toBe(true);
  const reference=addPlanarShadows(items.filter(i=>i.castShadow),frame.lighting,region.camera,palette)
   .filter(i=>i.groups?.some(g=>g.id.startsWith('@shadow:')));
  expect(masks.map(i=>i.vertices)).toEqual(reference.map(i=>i.vertices)); // outlines never cast
  const receiver=composeItems(shadowed,0).commands.find(c=>'children'in c && c.receiverLight!==undefined)!;
  expect(receiver).toMatchObject({opaque:true,receiverColor:expect.any(Array),receiverShadow:expect.any(Number)});
  expect('children'in receiver && receiver.children.some(c=>'children'in c&&c.additive)).toBe(true);
  await sequence.setControl('a','amount',0.9);
  expect(sequence.compiled[0]).toBe(scene);
  const updated=await sequence.evaluate(0,1.2);
  const geometry=updated.elements.find(e=>e.id==='left-solid')!.geometry;
  expect(geometry.clipPlanes).toEqual(frame.elements.find(e=>e.id==='left-solid')!.geometry.clipPlanes);
  expect(geometry.outline).toBeDefined();expect(geometry.scalarColors!.values[0]).toBe(0.9);
  const changed=buildDrawItems(updated,region.camera,320,480,palette,region.id);
  expect(changed.filter(i=>i.component==='fill').map(i=>i.vertices)).not.toEqual(fills.map(i=>i.vertices));
  expect(addPlanarShadows(changed,updated.lighting,region.camera,palette).at(-1)!.vertices).not.toEqual(masks.at(-1)!.vertices);
 }finally{sequence.dispose();}
});

it('keeps projected labels world-batched with retained overlay geometry and gates hide/fade morph endpoints',async()=>{
 const sequence=new SceneSequence(),retained=new RetainedGeometry(),palette=paletteResolver();
 try {
  expect((await sequence.submit({type:'load',scenes:[{id:'a',source:`export default scene({},s=>{
   const b=s.box('b',{width:3,height:3,depth:1});s.group('g',[b],{position:[1,0,0]});
   s.text('label',{text:'M',position:[1,0,-2],labelOcclusion:'overlay'});s.wait(1);
  });`}]})).ok).toBe(true);
  const frame=await sequence.evaluate(0,0),label=frame.elements.find(e=>e.id==='label')!;
  expect(retentionForFrame(frame)).toBe(true);
  retained.beginFrame();
  const items=buildDrawItems(frame,frame.camera,640,480,palette,undefined,false,retained);
  retained.endFrame();
  expect(items.find(i=>i.elementId==='b')!.mesh).toBeDefined();
  const glyphs=items.filter(i=>i.elementId==='label');expect(glyphs.length).toBeGreaterThan(0);
  expect(glyphs.every(i=>!i.screen)).toBe(true);
  for(const item of glyphs)for(let i=7;i<item.vertices.length;i+=VERTEX_FLOATS)expect(item.vertices[i]).toBe(1);
  const from={...label.geometry};label.geometry={...label.geometry,labelOcclusion:'depth'};
  expect(retentionForFrame(frame)).toBe(true);
  retained.beginFrame();expect(buildDrawItems(frame,frame.camera,640,480,palette,undefined,false,retained).some(i=>i.mesh)).toBe(true);retained.endFrame();
  label.morph={from,to:label.geometry,progress:1};label.opacity=0;
  expect(retentionForFrame(frame)).toBe(true);
  for(const mode of ['hide','fade'] as const) {
    const dependent={...from,labelOcclusion:mode};
    label.morph={from:dependent,to:label.geometry,progress:1};
    expect(retentionForFrame(frame)).toBe(false);
    label.morph={from:label.geometry,to:dependent,progress:0};
    expect(retentionForFrame(frame)).toBe(false);
  }
 }finally{sequence.dispose();}
});
