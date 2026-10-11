import { VERTEX_FLOATS } from '../src/texture-shader.js';
import { retainedPrecisionCases } from './retained-cases.js';
import { describe, expect, it } from 'vitest';
import { buildDrawItems } from '../src/render-geometry.js';
import { composeItems } from '../src/composition.js';
import { RetainedGeometry, MAX_INSTANCES, retentionForFrame, retainedPrecisionSafe, IDENTITY_INSTANCE } from '../src/retained-geometry.js';
import { paletteResolver, THREE_BLUE_ONE_BROWN_PALETTE } from '../src/palette.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import type { Frame, Geometry } from '../src/types.js';

const source = `export default scene({mode:'3d',orbit:true},s=>{
  for(let i=0;i<70;i++)s.sphere('s'+i,{radius:0.1+i/100,position:[i%10,Math.floor(i/10),0],fill:'BLUE'});
  s.wait(2);
});`;
const draw = (cache: RetainedGeometry, frame: Frame, palette = paletteResolver()) => {
  cache.beginFrame();
  const items = buildDrawItems(frame,frame.camera,800,600,palette,undefined,false,cache);
  cache.endFrame(); return items;
};
describe('retained local geometry',()=>{
  it('shares an indexed sphere across radii/instances, camera and object transforms, and fresh evaluated frames',async()=>{
    const scene=await compileSource(source), cache=new RetainedGeometry();
    const first=draw(cache,evaluateScene(scene,0)), mesh=first[0].mesh!;
    expect(first).toHaveLength(70); expect(first.every(item=>item.mesh===mesh)).toBe(true);
    expect(mesh.vertices.length/VERTEX_FLOATS).toBeLessThan(mesh.indices.length/3);
    const commands=composeItems(first,0).commands;
    expect(commands).toHaveLength(Math.ceil(70/MAX_INSTANCES));
    expect(commands.map(c=>'first' in c?c.instances!.length:0)).toEqual([32,32,6]);
    const frame=evaluateScene(scene,1); frame.camera.yaw=1;frame.camera.pitch=0.6;
    frame.elements[0].position=[2,3,4];frame.elements[0].rotation=[0.2,0.4,0.8];frame.elements[0].scale=2;
    const next=draw(cache,frame);expect(next.every(item=>item.mesh===mesh)).toBe(true);
    expect(next[0].instance).not.toEqual(first[0].instance);
  });
  it.each(['line','arrow'])('shares round %s geometry across oriented and translated endpoints',async kind=>{
    const scene=await compileSource(`export default scene({mode:'3d'},s=>{
      s.${kind}('a',{points:[[0,0,0],[2,0,0]],stroke:'BLUE',strokeProfile:'round'});
      s.${kind}('b',{points:[[1,1,1],[1,3,1]],stroke:'BLUE',strokeProfile:'round'});s.wait(1);
    });`);
    const items=draw(new RetainedGeometry(),evaluateScene(scene,0));
    expect(items).toHaveLength(2);expect(items[0].mesh).toBe(items[1].mesh);
    expect(composeItems(items,0).commands).toHaveLength(1);
    expect(items[0].instance).not.toEqual(items[1].instance);
  });
  it('keys effective arrays and styles by content, including in-place mutations and palette values',async()=>{
    const scene=await compileSource(`export default scene({},s=>{s.mesh('m',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],fill:'BLUE'});s.wait(1);});`);
    const cache=new RetainedGeometry(),frame=evaluateScene(scene,0);
    let mesh=draw(cache,frame)[0].mesh;
    const changed=()=>{expect(draw(cache,frame)[0].mesh).not.toBe(mesh);const next=draw(cache,frame)[0].mesh;expect(next).toBeDefined();expect(next).not.toBe(mesh);mesh=next;};
    frame.elements[0].geometry.vertices![0]=[0.2,0,0];changed();
    frame.elements[0].geometry.normals=[[0,0,1],[0,0,1],[0,0,1]];changed();
    frame.elements[0].geometry.material={roughness:0.2};changed();
    frame.elements[0].geometry.texture={pattern:'checker',color:'WHITE'};changed();
    frame.elements[0].fill='RED';changed();
    const palette=paletteResolver({...THREE_BLUE_ONE_BROWN_PALETTE,colors:{...THREE_BLUE_ONE_BROWN_PALETTE.colors,RED:'#00ff00'}});
    expect(draw(cache,frame,palette)[0].mesh).not.toBe(mesh);
    frame.elements[0].opacity=0.5;
    expect(draw(cache,frame).every(item=>!item.mesh&&item.transparent)).toBe(true);
    frame.elements[0].opacity=1;expect(draw(cache,frame)[0].mesh).toBeDefined();
  });
  it('updates billboard orientation without tessellation, and excludes morphs/adaptive paths/dependent features',async()=>{
    const scene=await compileSource(`export default scene({mode:'3d'},s=>{s.text('label',{text:'x',billboard:true});s.wait(1);});`);
    const cache=new RetainedGeometry(),frame=evaluateScene(scene,0),first=draw(cache,frame);
    frame.camera.yaw=1;const next=draw(cache,frame);
    expect(next[0].mesh).toBe(first[0].mesh);expect(next[0].instance).not.toEqual(first[0].instance);
    const element=frame.elements[0];element.morph={from:element.geometry,to:element.geometry,progress:0.5};
    expect(draw(cache,frame).every(item=>!item.mesh)).toBe(true);delete element.morph;
    for(const field of ['clipPlanes','outline','scalarColors','labelOcclusion']) {
      const geometry=element.geometry;element.geometry={...geometry,[field]:{}} as Geometry;
      expect(draw(cache,frame).every(item=>!item.mesh)).toBe(true);element.geometry=geometry;
    }
    expect(retentionForFrame({...frame,lighting:{receiver:{}}} as Frame)).toBe(false);
    expect(retentionForFrame(frame)).toBe(true);
  });
  it('streams changing geometry without reindexing until its content stabilizes',async()=>{
    const scene=await compileSource(`export default scene({},s=>{s.rectangle('r',{fill:'BLUE'});s.wait(1);});`);
    const cache=new RetainedGeometry(),frame=evaluateScene(scene,0);
    expect(draw(cache,frame)[0].mesh).toBeDefined();
    for(let i=1;i<5;i++) {
      frame.elements[0].geometry.width=i+10;
      expect(draw(cache,frame).every(item=>!item.mesh)).toBe(true);
    }
    expect(draw(cache,frame)[0].mesh).toBeDefined();
  });
  it('keeps occluders in world space for label visibility, including both morph endpoints',async()=>{
    const scene=await compileSource(`export default scene({mode:'3d'},s=>{
      s.sphere('occluder',{position:[1,2,3],scale:2,rotation:[0.2,0.4,0.6]});
      s.text('label',{text:'x',position:[1,2,0]});s.wait(1);
    });`);
    const frame=evaluateScene(scene,0),label=frame.elements[1],plain=label.geometry;
    expect(retentionForFrame(frame)).toBe(true);
    label.geometry={...plain,labelOcclusion:'depth'} as Geometry;expect(retentionForFrame(frame)).toBe(true);
    for(const mode of ['hide','fade','overlay']) {
      const dependent={...plain,labelOcclusion:mode} as Geometry;
      label.geometry=dependent;expect(retentionForFrame(frame)).toBe(false);
      frame.camera.yaw+=0.4;expect(retentionForFrame(frame)).toBe(false);
      label.geometry=plain;label.morph={from:dependent,to:plain,progress:1};expect(retentionForFrame(frame)).toBe(false);
      label.morph={from:plain,to:dependent,progress:0};expect(retentionForFrame(frame)).toBe(false);
      delete label.morph;label.geometry=dependent;label.space='screen';expect(retentionForFrame(frame)).toBe(true);label.space='world';
    }
  });
  it.each(retainedPrecisionCases)('preserves local detail before narrowing: $name',async({source,retained,orbit})=>{
    const scene=await compileSource(source),cache=new RetainedGeometry();
    for(const yaw of [0,0,0.3,0]) {
      const frame=evaluateScene(scene,0);frame.camera.yaw=orbit===false?0:yaw;
      const items=draw(cache,frame);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every(item=>Boolean(item.mesh)===retained)).toBe(true);
      if(!retained) {
        const reference=buildDrawItems(frame,frame.camera,800,600,paletteResolver());
        expect(items.map(item=>item.vertices)).toEqual(reference.map(item=>item.vertices));
      }
    }
  });
  it('rechecks precision on zoom and transforms without invalidating reusable content',async()=>{
    const scene=await compileSource(retainedPrecisionCases[0].source),cache=new RetainedGeometry(),frame=evaluateScene(scene,0);
    frame.camera.height=1000000;
    const mesh=draw(cache,frame)[0].mesh;expect(mesh).toBeDefined();
    frame.camera.height=.5;expect(draw(cache,frame).every(item=>!item.mesh)).toBe(true);
    frame.camera.height=1000000;expect(draw(cache,frame)[0].mesh).toBe(mesh);
    frame.elements[0].scale=1000000;expect(draw(cache,frame).every(item=>!item.mesh)).toBe(true);
    frame.elements[0].scale=1;expect(draw(cache,frame)[0].mesh).toBe(mesh);
  });
  it('rechecks clipping uncertainty on camera movement and preserves unrelated retention',async()=>{
    const scene=await compileSource(retainedPrecisionCases.find(c=>c.name==='orthographic near clipping uncertainty')!.source);
    const cache=new RetainedGeometry(),frame=evaluateScene(scene,0);
    const safe={...frame.elements[0],id:'safe',position:[0,0,0] as [number,number,number]};
    frame.elements.push(safe);
    const first=draw(cache,frame);
    expect(first[0].mesh).toBeUndefined();expect(first[1].mesh).toBeDefined();
    frame.camera.distance=12;
    const next=draw(cache,frame);expect(next.every(item=>item.mesh===first[1].mesh)).toBe(true);
    frame.camera.distance=10;
    const again=draw(cache,frame);expect(again[0].mesh).toBeUndefined();expect(again[1].mesh).toBe(first[1].mesh);
  });
  it('uses the same finite instance gate for screen-space geometry',async()=>{
    const scene=await compileSource(retainedPrecisionCases.find(c=>c.name==='nested scales overflow float32 instance matrix')!.source);
    const frame=evaluateScene(scene,0);frame.elements[0].space='screen';
    const items=draw(new RetainedGeometry(),frame);
    expect(items.every(item=>!item.mesh)).toBe(true);
    expect(items.map(item=>item.vertices)).toEqual(buildDrawItems(frame,frame.camera,800,600,paletteResolver()).map(item=>item.vertices));
  });
  it('rejects subnormal records and raw transform values lost before float32 packing',async()=>{
    const scene=await compileSource(`export default scene({},s=>{s.rectangle('r',{fill:'BLUE'});s.wait(1);});`);
    const frame=evaluateScene(scene,0),mesh=draw(new RetainedGeometry(),frame)[0].mesh!;
    const origin:[number,number,number]=[0,0,0],basis:[number,number,number][]=[[1,0,0],[0,1,0],[0,0,1]];
    const safe=(instance:Float32Array)=>retainedPrecisionSafe([mesh],origin,basis,instance,frame.camera,600,false);
    expect(safe(IDENTITY_INSTANCE)).toBe(true);
    for(let slot=0;slot<20;slot++)for(const value of [1e-38,-1e-38,1e-45,-1e-45]) {
      const instance=IDENTITY_INSTANCE.slice();instance[slot]=value;expect(safe(instance)).toBe(false);
    }
    for(const value of [1e-50,-1e-50]) {
      const instance=IDENTITY_INSTANCE.slice();origin[0]=value;instance[12]=value;
      expect(instance[12]).toBe(value<0?-0:0);expect(safe(instance)).toBe(false);origin[0]=0;
      basis[0][1]=value;instance[1]=value;instance[12]=0;
      expect(safe(instance)).toBe(false);basis[0][1]=0;
      instance[1]=0;instance[17]=value;expect(safe(instance)).toBe(false);
    }
  });
  it('bounds intermediate flushing even when local coordinates, basis and divisor are normal',async()=>{
    const scene=await compileSource(`export default scene({},s=>{
      s.mesh('m',{vertices:[[0,0,0],[1e-20,0,0],[0,1e-20,0]],triangles:[[0,1,2]],scale:1e-20,fill:'BLUE'});s.wait(1);
    });`);
    const frame=evaluateScene(scene,0),cache=new RetainedGeometry();
    // A world dot product may flush. At ordinary zoom its absolute error is
    // invisible, but sufficient magnification must conservatively stream it.
    expect(draw(cache,frame)[0].mesh).toBeDefined();
    frame.camera.height=1e-34;expect(draw(cache,frame)[0].mesh).toBeUndefined();
    frame.camera.height=8;expect(draw(cache,frame)[0].mesh).toBeDefined();
  });
  it('evicts geometry no longer present rather than retaining every seek/control sample',async()=>{
    const scene=await compileSource(source),cache=new RetainedGeometry(),frame=evaluateScene(scene,0);
    const first=draw(cache,frame)[0].mesh;
    draw(cache,{...frame,elements:[]});
    expect(draw(cache,frame)[0].mesh).not.toBe(first);
  });
});
