import {integrationPlayerRegression} from './integration-player.browser.js';
import {integrationCases} from './integration-cases.js';
import { capClippingCases, capClippingIssues, explanatoryCases, explanatoryMorphSource, labelProjectionCases, labelProjectionIssues } from './explanatory-cases.js';
import { project } from '../src/geometry.js';
import { CanvasRenderer } from '../src/renderer.js';
import { SceneSequence } from '../src/sequence.js';
import { audioDurationRegression } from './time-audio.browser.js';
import { pauseDuringRefreshRegression } from './playback-intent.browser.js';
import { createPlayer } from '../src/player.js';
import { compositionCases } from './composition-cases.js';
import { waveSource } from './dynamic-surface-cases.js';
import { reactiveCases } from './reactive-cases.js';
import { lightingCases } from './lighting-cases.js';
import { materialCases, materialSource, bumpSource } from './material-cases.js';
import { textureCases, texturePixelIssues, noiseFilteringSources, noiseFilteringIssues } from './texture-cases.js';
import { retainedPrecisionCases,retainedCases, occlusionGateSource, occlusionGateFrames } from './retained-cases.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { transparencyCases } from './transparency-cases.js';
import { Color, paletteResolver, parseColor } from '../src/palette.js';
import { initialSources } from '../demo/scenes.js';
import { interactionSource } from '../demo/interaction.js';
import { plantSource } from '../demo/plant.js';
import { lessonScenes } from '../../../frontend/app/src/lessonScenes.js';
import { lessons } from '../../../frontend/app/tests/fixtures/lessons.js';
import type { ColorValue, SceneSource } from '../src/types.js';

// Deliberately runs in a real browser, independently of the mocked Vitest suite.
// The host exposes window.webglTests (Promise) and window.webglResult for automation.
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, label: string) {
  const end = performance.now() + 8000;
  while (!predicate()) { assert(performance.now() < end, `Timed out: ${label}`); await delay(20); }
}
function pixels(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2')!;
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  assert(gl.getError() === gl.NO_ERROR, 'WebGL reported an error after drawing/readback');
  return data;
}
function foreground(data: Uint8Array, background: ColorValue = Color.BLACK) {
  const rgb = parseColor(paletteResolver().resolve(background)).slice(0, 3).map(v => Math.round(v * 255));
  let count = 0;
  for (let i = 0; i < data.length; i += 4) if (rgb.some((v, j) => Math.abs(data[i+j] - v) > 8)) count++;
  return count;
}
function different(a: Uint8Array, b: Uint8Array) { return a.length !== b.length || a.some((v, i) => v !== b[i]); }
function at(data: Uint8Array, canvas: HTMLCanvasElement, x: number, y: number) {
  const index = ((canvas.height - 1 - Math.round(y)) * canvas.width + Math.round(x)) * 4;
  return Array.from(data.subarray(index, index + 3));
}
function artifact(canvas: HTMLCanvasElement, label: string) {
  const figure = document.createElement('figure'), image = new Image(), caption = document.createElement('figcaption');
  image.src = canvas.toDataURL(); image.alt = label; caption.textContent = label;
  figure.append(image, caption); document.querySelector('#gallery')!.append(figure);
}

export async function runWebGLTests() {
  const tests: { name: string; ok: boolean; error?: string }[] = [];
  const stage = document.querySelector<HTMLDivElement>('#stage')!;
  const originalGPU = Object.getOwnPropertyDescriptor(navigator, 'gpu');
  const originalDPR = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const forceGPU = (value: unknown) => Object.defineProperty(navigator, 'gpu', { value, configurable: true });
  const errors: string[] = [];
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); tests.push({ name, ok: true }); }
    catch (error) { tests.push({ name, ok: false, error: error instanceof Error ? error.stack : String(error) }); }
    document.querySelector('#results')!.textContent = JSON.stringify(tests, null, 2);
  };
  const canvas = document.createElement('canvas'); stage.append(canvas);
  forceGPU(undefined);
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  const renderer = new CanvasRenderer(canvas);
  renderer.onError = error => errors.push(error.message);
  const sequence = new SceneSequence({ prepare: scenes => renderer.prepare(scenes) });
  const load = async (source: string) => {
    renderer.resetInteraction();
    const result = await sequence.submit({ type: 'load', scenes: [{ id: 'test', source }] });
    assert(result.ok, JSON.stringify(result));
  };
  const draw = (time = 0, index = 0) => {
    renderer.render(sequence.frame(index, time), sequence.compiled[index].options);
    return pixels(renderer.canvasElement);
  };
  try {
    await test('explanatory morph pixels after backwards seek',async()=>{
      await load(explanatoryMorphSource);const a=draw(0),b=draw(1),c=draw(2),again=draw(1);
      assert(different(a,b)&&different(b,c),'Scalar and clipping morph must change pixels');
      assert(!different(b,again),'Backwards seek must reproduce identical pixels');
    });
    for(const fixture of labelProjectionCases) await test(`explanatory projection: ${fixture.name}`,async()=>{
      const images:Uint8Array[]=[];
      for(const source of fixture.sources){await load(source);images.push(draw());}
      const issues=labelProjectionIssues(images.map(image=>(x,y)=>at(image,canvas,x,y)));
      assert(issues.length===0,issues.join('; '));
    });
    for(const dpr of [1,2])for(const fixture of capClippingCases)await test(`explanatory DPR ${dpr}: ${fixture.name}`,async()=>{
      Object.defineProperty(window,'devicePixelRatio',{value:dpr,configurable:true});
      (renderer as unknown as {resize():void}).resize();
      try {
        const images:Uint8Array[]=[];
        for(const source of fixture.sources){await load(source);images.push(draw());}
        assert(canvas.width===640*dpr&&canvas.height===480*dpr,'Cap target must match requested DPR');
        assert(renderer.backend==='webgl2','Cap checks must use WebGL2');
        const issues=capClippingIssues(images.map(image=>(x,y)=>at(image,canvas,x*dpr,y*dpr)),fixture.laterCut);
        assert(issues.length===0,issues.join('; '));artifact(canvas,`DPR ${dpr}: ${fixture.name}`);
      } finally {
        Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
        (renderer as unknown as {resize():void}).resize();
      }
    });
    for(const fixture of explanatoryCases) await test(`explanatory: ${fixture.name}`,async()=>{
      await load(fixture.source);const image=draw();
      const issues=fixture.check((x,y)=>at(image,canvas,x,y));
      assert(issues.length===0,issues.join('; '));artifact(canvas,fixture.name);
    });
    for (const {name,source} of retainedCases) await test('retained/reference pixels: '+name,async()=>{
      await load(source);
      for (const [yaw,pitch,time] of [[0,0,0],[0.7,0.35,0.5],[-0.8,-0.4,1]]) {
        const frame=sequence.frame(0,time);frame.camera={...frame.camera,yaw,pitch};
        renderer.render(frame,sequence.compiled[0].options);const optimized=pixels(renderer.canvasElement);
        const get=RetainedGeometry.prototype.get;RetainedGeometry.prototype.get=()=>undefined;
        try {renderer.render(frame,sequence.compiled[0].options);} finally {RetainedGeometry.prototype.get=get;}
        const reference=pixels(renderer.canvasElement);
        assert(foreground(optimized)>200,'Retained scene was empty');
        assert(optimized.filter((v,i)=>Math.abs(v-reference[i])>3).length<optimized.length*0.002,'Retained and CPU world geometry diverged');
      }
    });
    for (const {name,source,retained,orbit} of retainedPrecisionCases) await test('retained precision/reference pixels: '+name,async()=>{
      await load(source);
      (renderer as unknown as {retained:RetainedGeometry}).retained.clear();
      let warm=false;
      for (const [yaw,pitch,time] of [[0,0,0],[0,0,0],[0.3,0.15,1],[0,0,0]]) {
        const frame=sequence.frame(0,time);frame.camera={...frame.camera,yaw:orbit===false?0:yaw,pitch:orbit===false?0:pitch};
        const gl=renderer.canvasElement.getContext('webgl2')!,indexed=gl.drawElementsInstanced;
        let indexedCalls=0,geometryUploads=0;
        const allocate=gl.bufferData,upload=gl.bufferSubData;
        gl.bufferData=new Proxy(allocate,{apply(target,receiver,args){geometryUploads++;return Reflect.apply(target,receiver,args);}});
        gl.bufferSubData=new Proxy(upload,{apply(target,receiver,args){geometryUploads++;return Reflect.apply(target,receiver,args);}});
        gl.drawElementsInstanced=new Proxy(indexed,{apply(target,receiver,args){indexedCalls++;return Reflect.apply(target,receiver,args);}});
        try {renderer.render(frame,sequence.compiled[0].options);} finally {gl.drawElementsInstanced=indexed;gl.bufferData=allocate;gl.bufferSubData=upload;}
        const optimized=pixels(renderer.canvasElement);
        const get=RetainedGeometry.prototype.get;RetainedGeometry.prototype.get=()=>undefined;
        try {renderer.render(frame,sequence.compiled[0].options);} finally {RetainedGeometry.prototype.get=get;}
        const reference=pixels(renderer.canvasElement);
        assert(foreground(reference)>200,'Precision reference scene was empty');
        assert(!optimized.some((v,i)=>Math.abs(v-reference[i])>3),'Precision-sensitive geometry diverged from CPU world packing');
        assert((indexedCalls>0)===retained,'Unexpected precision fallback/indexed submission');
        if(warm&&retained)assert(geometryUploads===0,'Warm precision control uploaded geometry');
        renderer.render(frame,sequence.compiled[0].options);pixels(renderer.canvasElement);warm=true;
      }
    });
    await test('label occlusion integration gate keeps transformed occluders in world space',async()=>{
      await load(occlusionGateSource);
      const frame=sequence.frame(0,0),options=sequence.compiled[0].options;
      const gl=renderer.canvasElement.getContext('webgl2')!,indexed=gl.drawElementsInstanced;
      let indexedCalls=0;
      gl.drawElementsInstanced=new Proxy(indexed,{apply(target,receiver,args){indexedCalls++;return Reflect.apply(target,receiver,args);}});
      try {
        renderer.render(frame,options);pixels(renderer.canvasElement);assert(indexedCalls>0,'Ordinary scene did not use indexed geometry');
        for(const dependent of occlusionGateFrames(frame)) {
          indexedCalls=0;renderer.render(dependent,options);
          assert(foreground(pixels(renderer.canvasElement))>200,'Occlusion gate scene was empty');
          assert(indexedCalls===0,'Label visibility received retained local-space occluders');
        }
      } finally {gl.drawElementsInstanced=indexed;}
    });
    await test('retained indexed instances skip geometry uploads on camera movement',async()=>{
      await load(`export default scene({mode:'3d'},s=>{for(let i=0;i<8;i++)s.sphere('s'+i,{radius:0.2,position:[i/2-2,0,0],fill:'BLUE'});s.wait(2);});`);
      draw();
      const gl=renderer.canvasElement.getContext('webgl2')!,upload=gl.bufferSubData,allocate=gl.bufferData,instanced=gl.drawElementsInstanced;
      let uploads=0,allocations=0,maxInstances=0;
      gl.bufferSubData=new Proxy(upload,{apply(target,receiver,args){uploads++;return Reflect.apply(target,receiver,args);}});
      gl.bufferData=new Proxy(allocate,{apply(target,receiver,args){allocations++;return Reflect.apply(target,receiver,args);}});
      gl.drawElementsInstanced=function(...args:Parameters<typeof instanced>){maxInstances=Math.max(maxInstances,args[4]);return instanced.apply(this,args);};
      try {
        const frame=sequence.frame(0,1);frame.camera.yaw=0.4;renderer.render(frame,sequence.compiled[0].options);
        assert(foreground(pixels(renderer.canvasElement))>100,'Retained spheres were empty');
        assert(uploads===0&&allocations===0,'Camera movement uploaded geometry');
        assert(maxInstances===8,'Repeated spheres did not instance');
      } finally {gl.bufferSubData=upload;gl.bufferData=allocate;gl.drawElementsInstanced=instanced;}
    });
    await test('missing WebGPU: real WebGL2 triangle colors', async () => {
      await load(`export default scene({},s=>{s.rectangle('r',{width:3,height:2,fill:'PURE_RED',stroke:'none'});s.wait(1)});`);
      assert(renderer.backend === 'webgl2', 'Fallback was not selected');
      assert(at(draw(), canvas, 320, 240).join() === '255,0,0', 'Center must be pure red');
      assert(foreground(draw()) > 15000, 'Expected a filled rectangle');
    });
    await test('combined production-player seek/control/end/append handoffs',async()=>{await integrationPlayerRegression(createPlayer);});
    for(const entry of integrationCases)await test('cross-feature: '+entry.name,async()=>{
      renderer.resetInteraction();
      await entry.run({sequence,draw:async(frame,options,reference=false)=>{
        const get=RetainedGeometry.prototype.get,gl=renderer.canvasElement.getContext('webgl2')!;
        const allocate=gl.bufferData,upload=gl.bufferSubData,draw=gl.drawElementsInstanced;
        let uploads=0,indexed=0;if(reference)RetainedGeometry.prototype.get=()=>undefined;
        gl.bufferData=new Proxy(allocate,{apply(fn,self,args){uploads++;return Reflect.apply(fn,self,args);}});
        gl.bufferSubData=new Proxy(upload,{apply(fn,self,args){uploads++;return Reflect.apply(fn,self,args);}});
        gl.drawElementsInstanced=new Proxy(draw,{apply(fn,self,args){indexed++;return Reflect.apply(fn,self,args);}});
        try {renderer.render(frame,options);return {pixels:pixels(renderer.canvasElement),indexed,uploads,
          resources:(renderer as unknown as {gl:{meshes:Map<unknown,unknown>}}).gl.meshes.size};}
        finally{RetainedGeometry.prototype.get=get;gl.bufferData=allocate;gl.bufferSubData=upload;gl.drawElementsInstanced=draw;}
      }});
    });
    for(const entry of lightingCases) await test('lighting: '+entry.name,async()=>{
      await entry.run(async(source,yaw=0,time=0)=>{
        (renderer as unknown as {retained:RetainedGeometry}).retained.clear();
        await load(source);renderer.setOrbit({yaw,pitch:0});
        const image=draw(time),flipped=new Uint8Array(image.length);
        for(let y=0;y<480;y++)flipped.set(image.subarray(y*640*4,(y+1)*640*4),(479-y)*640*4);
        return flipped;
      });
      artifact(canvas,'lighting: '+entry.name);
    });
    for(const metal of [false,true]) await test(`bump normals with constant albedo, metal=${metal}`,async()=>{
      const images:Uint8Array[]=[];
      for(const strength of [undefined,0,0.15,-0.15]){await load(bumpSource(strength,false,metal));images.push(draw());}
      assert(!different(images[0],images[1]),'Zero bump changed baseline pixels');
      assert(images[1].filter((v,i)=>Math.abs(v-images[2][i])>5).length>1000,'Bump did not affect lighting');
      assert(images[2].filter((v,i)=>Math.abs(v-images[3][i])>5).length>1000,'Negative bump did not invert relief');
      for(let i=0;i<images[0].length;i+=4)assert((images[2][i]>0)===(images[0][i]>0),'Bump changed silhouette');
    });
    await test('bump leaves unlit pixels unchanged',async()=>{
      await load(bumpSource(0,true));const original=draw();await load(bumpSource(0.2,true));
      assert(!different(original,draw()),'Bump affected unlit color');
    });
    for(const {name,a,b} of materialCases) await test(`material ${name} changes real shaded pixels`,async()=>{
      await load(materialSource(a));const first=draw();await load(materialSource(b));const second=draw();
      assert(first.filter((v,i)=>Math.abs(v-second[i])>5).length>100,`${name} did not change pixels`);
    });
    await test('emission adds exact color to unlit geometry',async()=>{
      await load(materialSource('{emissive:"PURE_BLUE",emissiveIntensity:0.5}','mesh'));
      const rgb=at(draw(),canvas,320,240);
      assert(rgb[0]===0&&rgb[1]===0&&Math.abs(rgb[2]-128)<=1,'Wrong emission color/intensity');
    });
    await test('noise filters fine relief before broad color and converges to its mean',async()=>{
      const images:Uint8Array[]=[];
      for(const source of noiseFilteringSources){await load(source);images.push(draw());}
      const issues=noiseFilteringIssues(images.map(image=>(x,y)=>at(image,canvas,x,y)));
      assert(issues.length===0,issues.join('; '));
    });
    for(const {pattern,source} of textureCases) await test(`procedural ${pattern} fragments and translation`,async()=>{
      await load(source);const original=draw();
      assert(texturePixelIssues(pattern,(x,y)=>at(original,canvas,x,y)).length===0,
        texturePixelIssues(pattern,(x,y)=>at(original,canvas,x,y)).join('; '));
      const moved=draw(1);
      for(let y=160;y<320;y+=9)for(let x=240;x<390;x+=9) {
        const a=at(original,canvas,x,y),b=at(moved,canvas,x+60,y);
        assert(a.every((value,i)=>Math.abs(value-b[i])<=2),'Texture slipped during translation');
      }
      assert(!different(draw(),original),'Texture changed after seeking');
    });
    await test('real audio duration controls worker sampling and batch/append handoffs',async()=>{
      await audioDurationRegression(createPlayer);
    });
    await test('Pause during reconstruction/replacement beats automatic resume after a real worker sample',async()=>{
      await pauseDuringRefreshRegression(createPlayer);
    });
    await test('retained wave seeks and paused input match rebuilt pixels in clipped isolated views',async()=>{
      const reference=new SceneSequence({prepare:scenes=>renderer.prepare(scenes)});
      renderer.resetInteraction();
      try {
        await load(waveSource());const original=sequence.compiled[0];let first:Uint8Array|undefined;
        for(const [time,amplitude,roughness] of [[0.5,0.6,0.45],[2,1,0.15],[0.5,0.6,0.45]]) {
          await sequence.setControl('test','amplitude',amplitude);await sequence.setControl('test','roughness',roughness);
          assert((await reference.submit({type:'load',scenes:[{id:'reference',source:waveSource(time,amplitude,roughness)}]})).ok,'Reference compilation failed');
          renderer.render(reference.frame(0,time),reference.compiled[0].options);const expected=pixels(canvas);
          renderer.render(await sequence.evaluate(0,time),original.options);const actual=pixels(canvas);
          assert(!different(actual,expected),'Dynamic wave differs from static reference');assert(foreground(actual)>1000,'Wave is empty');
          if(first && time===0.5)assert(!different(actual,first),'Wave seek is not deterministic');first??=actual;
          assert(sequence.compiled[0]===original,'Wave rebuilt the scene');
        }
        artifact(canvas,'Retained dynamic wave, clipped independent views');
      }finally{reference.dispose();}
    });
    for (const fixture of reactiveCases) await test(`reactive/rebuilt pixels: ${fixture.name}`, async () => {
      const legacy = new SceneSequence({ prepare: scenes => renderer.prepare(scenes) });
      try {
        const result = await legacy.submit({type:'load',scenes:[{id:'test',source:fixture.legacy}]});
        assert(result.ok, JSON.stringify(result));
        await load(fixture.reactive);
        const original = sequence.compiled[0];
        for (const value of [0.1, 2.5, 1]) {
          for (const id of ['x','y']) { await legacy.setControl('test',id,value); await sequence.setControl('test',id,value); }
          assert(sequence.compiled[0] === original, 'Reactive update rebuilt the scene');
          for (const time of [0,1.5,3]) {
            renderer.render(legacy.frame(0,time),legacy.compiled[0].options);
            const expected=pixels(canvas),actual=draw(time);
            assert(!different(expected,actual), `Pixels differ for ${fixture.name}, value=${value}, time=${time}`);
          }
        }
      } finally { legacy.dispose(); }
    });
    await test('real worker callback errors roll back and worker loss recovers', async () => {
      await load(`export default scene({},s=>{
        const x=s.slider('x',{reactive:true,default:1,min:0.1,max:3});const a=s.circle('a');
        s.bind(a,[x],x=>{if(x===2)throw Error('callback failed');return {radius:x};});s.wait(3);
      });`);
      await sequence.setControl('test','x',1.5);
      const before=draw();let rejected=false;
      try {await sequence.setControl('test','x',2);}catch {rejected=true;}
      assert(rejected && sequence.compiled[0].controls[0].value===1.5,'Failed callback committed');
      assert(!different(before,draw()),'Failed callback changed pixels');
      const worker=(sequence as unknown as {compiler:{worker:Worker}}).compiler.worker;
      worker.dispatchEvent(new ErrorEvent('error',{message:'Test worker loss',cancelable:true}));
      await sequence.setControl('test','x',2.5);
      assert(Number(sequence.compiled[0].controls[0].value)===2.5 && different(before,draw()),'Worker recovery lost values');
      const recovered=sequence.compiled[0];
      await sequence.setControl('test','x',1);
      assert(sequence.compiled[0]===recovered,'Recovered worker did not retain its new callback');
    });
    await test('mixed control burst uses new slider bounds in the real worker', async () => {
      const surface=document.createElement('canvas');stage.append(surface);
      const player=createPlayer({canvas:surface});
      try {
        const result=await player.submit({type:'load',scenes:[{id:'mixed',source:`export default scene({},s=>{
          const wide=s.toggle('wide',{default:false});
          const x=s.slider('x',{reactive:true,default:1,min:0,max:wide?10:3});
          const a=s.circle('a');s.bind(a,[x],x=>({radius:x}));s.wait(2);
        });`}]});
        assert(result.ok,JSON.stringify(result));
        await Promise.all([
          player.setControl({scene:'mixed',id:'x',value:2}),
          player.setControl({scene:'mixed',id:'wide',value:true}),
          player.setControl({scene:'mixed',id:'x',value:8}),
        ]);
        assert(player.getState().controls.find(c=>c.id==='x')?.value===8,'Later value was clamped against obsolete bounds');
        assert(foreground(pixels(surface))>1000,'Mixed control scene failed to render');
      }finally{player.dispose();surface.remove();}
    });
    for (const {name,source,time,samples} of compositionCases) await test(name, async () => {
      await load(source);
      for (const t of [time,0,time]) {
        const image=draw(t);
        if(t===time)for(const [x,y,rgb] of samples){const actual=at(image,canvas,x,y);assert(rgb.every((v,c)=>Math.abs(actual[c]-v)<=2),`${name} at ${x},${y}: ${actual} expected ${rgb}`);}
      }
    });
    for (const {name,source,x,y,red} of transparencyCases) await test(name, async () => {
      await load(source);
      const rgb=at(draw(),canvas,x,y);
      assert(Math.abs(rgb[0]-red)<=2, `${name}: red ${rgb[0]} expected ${red}`);
      assert(rgb[2]>20, `${name}: missing blue surface`);
    });
    for (const [name, gpu] of [
      ['null adapter', { requestAdapter: async () => null }],
      ['rejected adapter', { requestAdapter: async () => { throw new Error('test denied'); } }],
      ['rejected device', { requestAdapter: async () => ({ requestDevice: async () => { throw new Error('test device denied'); } }) }],
    ] as const) await test(`${name}: real WebGL2 output`, async () => {
      forceGPU(gpu);
      const surface = document.createElement('canvas'); stage.append(surface);
      const fallback = new CanvasRenderer(surface);
      try {
        await fallback.prepare(sequence.compiled);
        fallback.render(sequence.frame(0, 0), sequence.compiled[0].options);
        assert(fallback.backend === 'webgl2' && foreground(pixels(surface)) > 15000, 'No fallback pixels');
      } finally { fallback.dispose(); surface.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); surface.remove(); forceGPU(undefined); }
    });
    await test('context-locked canvas is replaced and restored on disposal', async () => {
      const surface=document.createElement('canvas');surface.className='preserved';surface.setAttribute('aria-label','Test surface');stage.append(surface);
      // A real, permanently context-locked canvas, even without a WebGPU adapter.
      assert(surface.getContext('webgpu') || surface.getContext('2d'),'Could not lock test canvas');
      const fallback=new CanvasRenderer(surface);
      let replacement:HTMLCanvasElement|undefined;
      fallback.onCanvasChange=value=>{replacement=value;};
      try {
        await fallback.prepare(sequence.compiled);
        assert(replacement && replacement!==surface && replacement.isConnected,'Did not replace locked canvas');
        assert(replacement.className==='preserved' && replacement.getAttribute('aria-label')==='Test surface','Lost canvas attributes');
        fallback.render(sequence.frame(0,0),sequence.compiled[0].options);
        assert(foreground(pixels(replacement))>15000,'Replacement did not render');
      } finally {fallback.dispose();assert(surface.isConnected,'Original canvas ownership not restored');surface.remove();}
    });
    await test('curved paths: holes, Bézier morphs and deterministic seek', async () => {
      await load(`export default scene({},s=>{
        s.path('ring',{d:'M-2 -2H2V2H-2Z M-1 -1H1V1H-1Z',fill:Color.PURE_GREEN});
      });`);
      const ring=draw();
      assert(at(ring,canvas,320,240).join()==='0,0,0','Compound path filled its hole');
      assert(at(ring,canvas,230,240).join()==='0,255,0','Missing compound path fill');
      await load(`export default scene({},s=>{
        const p=s.path('curve',{d:'M-2 -1C-2 1 2 1 2 -1Z',fill:Color.PURE_GREEN});
        s.play(p.morphTo({kind:'path',d:'M-2 -1C-2 3 2 3 2 -1Z'}),{duration:2,ease:'linear'});
      });`);
      assert(at(draw(0),canvas,320,180).join()==='0,0,0','Initial curve has the wrong bounds');
      assert(at(draw(2),canvas,320,180).join()==='0,255,0','Curve morph did not expand');
      const middle=draw(1);draw(0);draw(2);
      assert(!different(middle,draw(1)),'Curved morph seek was nondeterministic');
    });
    await test('curved plant: production player geometry and growth', async () => {
      await load(plantSource.source);
      const duration=sequence.compiled[0].duration,finished=draw(duration);
      assert(foreground(finished)>10000,'Plant did not render');
      artifact(canvas,'Curved plant');
      assert(different(finished,draw(2)),'Plant growth did not change the image');
      const bending=draw(5.5);draw(duration);draw(0);
      assert(!different(bending,draw(5.5)),'Plant bending changed after seeking');
    });
    await test('all production demos, LaTeX morphs and deterministic seek', async () => {
      const result = await sequence.submit({ type: 'load', scenes: initialSources }); assert(result.ok, JSON.stringify(result));
      for (let i = 0; i < sequence.compiled.length; i++) {
        const scene = sequence.compiled[i], time = scene.duration * 0.65;
        const middle = draw(time, i); assert(foreground(middle, scene.options.background) > 1000, `Empty demo ${i}`);
        artifact(canvas, `Demo ${i + 1}`);
        for (const fraction of [0, 0.25, 0.5, 0.999]) draw(scene.duration * fraction, i);
        assert(!different(middle, draw(time, i)), `Seek changed demo ${i}`);
      }
    });
    await test('all six lessons in light/dark themes', async () => {
      for (const lesson of lessons) for (const dark of [false, true]) {
        const background = dark ? Color.BLACK : Color.WHITE;
        const result = await sequence.submit({ type: 'load', scenes: lessonScenes(lesson, { background, ink: dark ? Color.WHITE : Color.GREY_E, accent: dark ? Color.BLUE : Color.BLUE_E }) });
        assert(result.ok, JSON.stringify(result));
        const time = sequence.compiled[0].duration / 2;
        const middle = draw(time); assert(foreground(middle, background) > 1000, `Empty lesson ${lesson.title}`);
        draw(0); assert(!different(middle, draw(time)), 'Lesson seeking was nondeterministic');
      }
      artifact(canvas, 'Aha lesson');
    });
    await test('3D depth occlusion and lighting', async () => {
      await load(`export default scene({mode:'3d'},s=>{
        s.sphere('atom',{radius:1,fill:'PURE_BLUE',stroke:'none'});
        s.line('bond',{points:[[0,0,0],[2,0,0]],stroke:'WHITE',strokeWidth:0.08});s.wait(1)});`);
      const image = draw(), center = at(image, canvas, 320, 240);
      assert(center[0] === 0 && center[2] > 150, 'Sphere did not occlude the bond');
      const bond=project([1.6,0,0],sequence.frame(0,0).camera,640,480);
      assert(at(image, canvas, bond.x, bond.y)[0] > 240, 'Exposed bond missing');
      artifact(canvas, 'Lit sphere and occluded bond');
    });
    await test('transparency preserves rear contributions', async () => {
      await load(`export default scene({mode:'3d'},s=>{
        s.mesh('a',{vertices:[[-2,-2,2],[2,-2,-2],[0,2,0]],triangles:[[0,1,2]],fill:'PURE_RED',stroke:'none',opacity:0.5});
        s.mesh('b',{vertices:[[-2,-2,0],[2,-2,0],[0,2,0]],triangles:[[0,1,2]],fill:'PURE_BLUE',stroke:'none',opacity:0.5});s.wait(1)});`);
      const image = draw();
      for (const x of [280, 360]) { const rgb = at(image, canvas, x, 240); assert(rgb[0] > 40 && rgb[2] > 40, 'Lost rear translucent contribution'); }
    });
    await test('regional viewport Y orientation, scissor and screen overlays', async () => {
      await load(`export default scene({},s=>{
        s.view('top',{rect:[0,0,1,0.5],camera:{perspective:0}},v=>v.rectangle('r',{width:100,height:100,fill:'PURE_RED',stroke:'none'}));
        s.view('bottom',{rect:[0,0.5,1,0.5],camera:{perspective:0}},v=>v.rectangle('b',{width:100,height:100,fill:'PURE_BLUE',stroke:'none'}));
        s.rectangle('label',{space:'screen',width:40,height:40,fill:'PURE_GREEN',stroke:'none'});s.wait(1)});`);
      const image = draw();
      assert(at(image, canvas, 100, 60).join() === '255,0,0', 'Top viewport/scissor incorrect');
      assert(at(image, canvas, 100, 420).join() === '0,0,255', 'Bottom viewport/scissor incorrect');
      assert(at(image, canvas, 320, 240).join() === '0,255,0', 'Global screen overlay is occluded');
    });
    await test('round 3D lines and arrows visible from side and end', async () => {
      await load(`export default scene({mode:'3d'},s=>{s.line3D('l',{points:[[-2,-0.7,0],[2,-0.7,0]],strokeWidth:0.15,stroke:'BLUE'});s.arrow3D('a',{points:[[-2,0.7,0],[2,0.7,0]],strokeWidth:0.08,stroke:'RED'});s.wait(1)});`);
      const frame = sequence.frame(0, 0);
      for (const [yaw, pitch, min] of [[0,0,1000],[0,Math.PI/2,1000],[Math.PI/2,0,80]]) {
        renderer.render({ ...frame, camera: { ...frame.camera, yaw, pitch, perspective: 0 } }, sequence.compiled[0].options);
        assert(foreground(pixels(canvas)) > min, 'Missing round geometry');
      }
    });
    await test('interactive demo, retained orbit and responsive DPR resizing', async () => {
      const result = await sequence.submit({ type: 'load', scenes: [interactionSource] }); assert(result.ok, JSON.stringify(result));
      const before = draw(); assert(foreground(before) > 1000, 'Interactive scene missing');
      const frame = sequence.frame(0, 0), region = frame.views?.find(v => v.orbit);
      renderer.setOrbit({ yaw: 0.7, pitch: 0.2 }, region?.id ?? '');
      assert(different(before, draw()), 'Orbit did not change pixels');
      stage.style.width = '360px'; stage.style.height = '780px';
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
      await until(() => canvas.width === 720 && canvas.height === 1560, 'portrait resize/DPR');
      assert(foreground(draw()) > 1000, 'Portrait render empty'); artifact(canvas, 'Portrait DPR 2');
      stage.style.width = '640px'; stage.style.height = '480px';
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
      await until(() => canvas.width === 640 && canvas.height === 480, 'restore size');
    });
    await test('identical text/LaTeX/shape morphs preserve pixels', async () => {
      for (const geometry of [{kind:'text',text:'A',fontSize:2},{kind:'latex',tex:String.raw`\animpart{letter}{O}`,fontSize:2},{kind:'rectangle',width:3,height:2}]) {
        await load(`export default scene({background:'GREY_E'},s=>{const e=s.${geometry.kind}('e',${JSON.stringify({...geometry,fill:'WHITE',stroke:'none',opacity:0.5})});s.wait(1);s.play(e.morphTo(${JSON.stringify(geometry)}${geometry.kind==='latex'?',{map:{letter: "letter"}}':''}),{duration:2});s.wait(1)});`);
        const before = draw(0);
        for (const time of [1, 1.5, 2, 2.999, 3]) assert(!different(before, draw(time)), `Morph altered ${geometry.kind} at ${time}`);
      }
    });
    await test('player sliders/toggles, append clock continuity and previous-scene handoffs', async () => {
      renderer.dispose(); canvas.remove();
      const surface = document.createElement('canvas'); stage.append(surface);
      const player = createPlayer({ canvas: surface, controlsRoot: stage });
      try {
        const first: SceneSource = { id: 'one', source: `export default scene({end:'advance'},s=>{
          const r=s.slider('radius',{default:0.5,min:0.2,max:2});const show=s.toggle('show',{default:true});
          const e=s.circle('dot',{radius:r,fill:'BLUE',stroke:'none',opacity:show?1:0});s.keep(e);s.wait(3)});` };
        assert((await player.submit({ type:'load', scenes:[first] })).ok, 'Player load failed');
        assert(player.backend === 'webgl2', 'Player did not use fallback');
        await player.seek({ scene:'one', time:0 }); const small = foreground(pixels(surface));
        const slider = stage.querySelector<HTMLInputElement>('input[type=range]')!;
        slider.value = '1.5'; slider.dispatchEvent(new Event('input', {bubbles:true}));
        await until(() => player.getState().controls[0].value === 1.5, 'native slider');
        await player.seek({scene:'one',time:0}); assert(foreground(pixels(surface)) > small * 4, 'Slider did not change geometry');
        const toggle = stage.querySelector<HTMLInputElement>('input[type=checkbox]')!;
        toggle.checked=false; toggle.dispatchEvent(new Event('change',{bubbles:true}));
        await until(() => player.getState().controls[1].value === false, 'native toggle');
        await player.seek({scene:'one',time:0}); assert(foreground(pixels(surface)) === 0, 'Toggle did not hide geometry');
        await player.setControl({scene:'one',id:'show',value:true});
        await player.play(); await delay(100);
        const time = player.getState().time;
        assert((await player.submit({type:'insert',after:'one',scenes:[{id:'two',source:`export default scene({},s=>{const e=s.previous.get('dot');s.play(e.moveTo([2,0]),{duration:1});s.wait(1)});`}]})).ok, 'Append failed');
        assert(player.getState().status === 'playing' && player.getState().time >= time, 'Append interrupted playback');
        player.pause();
        await player.seek({scene:'two',time:0}); const inherited = pixels(surface);
        assert(foreground(inherited) > small * 4, 'Previous-scene handoff lost live radius');
        await player.seek({scene:'two',time:1}); assert(different(inherited,pixels(surface)), 'Animation did not move');
        await player.seek({scene:'two',time:0}); assert(!different(inherited,pixels(surface)), 'Player seek differs');
        const gl = surface.getContext('webgl2')!, extension = gl.getExtension('WEBGL_lose_context');
        assert(extension, 'Context loss extension required for this browser test');
        await player.play(); extension.loseContext();
        await until(() => player.getState().status === 'blocked', 'context loss pauses player');
        const stopped = player.getState().time; await delay(100);
        assert(player.getState().time === stopped, 'Lost context left playback clock running');
        let rejected=false; try {await player.play();} catch {rejected=true;} assert(rejected,'Play must remain blocked while context is lost');
        extension.restoreContext(); await until(() => player.getState().status === 'paused' && !player.getState().error, 'context restoration: ' + JSON.stringify(player.getState()));
        await player.seek({scene:'two',time:0}); assert(!different(inherited,pixels(surface)), 'Restored frame differs');
        await player.play(); await delay(100); assert(player.getState().time > 0, 'Restored player cannot resume');
      } finally { player.dispose(); surface.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); surface.remove(); }
    });
    await test('real WAV audio clock, progressive append, seeking and loss/disposal', async () => {
      const NativeAudioContext=window.AudioContext;
      const contexts:AudioContext[]=[], starts:{offset:number;clock:number}[]=[], stops:number[]=[];
      class ObservedAudioContext extends NativeAudioContext {
        constructor() {super();contexts.push(this);}
        override createBufferSource():AudioBufferSourceNode {
          const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source);
          source.start=(when=0,offset=0,duration?:number)=>{starts.push({offset,clock:this.currentTime});start(when,offset,duration);};
          source.stop=(when=0)=>{stops.push(this.currentTime);stop(when);};
          return source;
        }
      }
      window.AudioContext=ObservedAudioContext;
      const surface=document.createElement('canvas');stage.append(surface);
      const player=createPlayer({canvas:surface,controlsRoot:false,assets:{tone:{kind:'audio',url:'/assets/scene-tone.wav'}}});
      try {
        // Unlock from the browser test's click-authorized origin; audio itself is native.
        await player.unlockAudio();
        const result=await player.submit({type:'load',scenes:[{id:'audio',source:`export default scene({audio:'tone'},s=>{const x=s.slider('x',{reactive:true,default:1,min:0.1,max:3});const dot=s.circle('dot',{fill:'BLUE'});s.bind(dot,[x],x=>({radius:x}));s.wait(20)});`}]});
        assert(result.ok,JSON.stringify(result));
        await player.play();
        const context=contexts[0],start=starts[0];
        await until(()=>context.state==='running' && player.getState().time>0,'native audio clock start');
        assert(Math.abs(player.getState().time-(context.currentTime-start.clock))<0.05,'Player is not synchronized to audio');
        assert((await player.submit({type:'insert',after:'audio',scenes:[{id:'suffix',source:`export default scene({},s=>s.wait(1));`}]})).ok,'Audio append failed');
        assert(Number(starts.length)===1 && Number(stops.length)===0 && player.getState().status==='playing','Append restarted audio');
        const timeBeforeInput=player.getState().time;
        await player.setControl({scene:'audio',id:'x',value:2});
        assert(Number(starts.length)===1 && Number(stops.length)===0 && player.getState().status==='playing','Reactive input restarted native audio');
        assert(player.getState().time>=timeBeforeInput && Math.abs(player.getState().time-(context.currentTime-start.clock))<0.05,'Reactive input lost audio synchronization');
        player.pause();assert(Number(stops.length)===1,'Pause did not stop audio');
        await player.seek({scene:'audio',time:1});await player.play();await delay(100);
        assert(starts.at(-1)!.offset===1,'Seek restarted audio at the wrong offset');
        const seekStart=starts.at(-1)!;
        assert(Math.abs(player.getState().time-(1+context.currentTime-seekStart.clock))<0.05,'Seek lost audio synchronization');
        const ext=surface.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
        ext.loseContext();await until(()=>player.getState().status==='blocked','audio context-loss block');
        assert(Number(stops.length)===2,'Graphics loss did not stop audio');
        const time=player.getState().time;await delay(100);assert(player.getState().time===time,'Audio advanced during graphics loss');
        ext.restoreContext();await until(()=>player.getState().status==='paused','audio graphics recovery');
        assert(Number(starts.length)===2,'Recovery unexpectedly restarted audio');
        await player.play();assert(Math.abs(starts.at(-1)!.offset-time)<0.05,'Resume did not retain audio offset');
        player.dispose();await until(()=>context.state==='closed','audio disposal');
      } finally {player.dispose();surface.remove();window.AudioContext=NativeAudioContext;}
    });
    assert(errors.length === 0, errors.join('\n'));
  } catch(error) { tests.push({name:'unexpected renderer error',ok:false,error:String(error)}); }
  finally {
    sequence.dispose(); renderer.dispose(); canvas.remove();
    if (originalGPU) Object.defineProperty(navigator,'gpu',originalGPU); else Reflect.deleteProperty(navigator,'gpu');
    if (originalDPR) Object.defineProperty(window,'devicePixelRatio',originalDPR);
  }
  return { passed: tests.filter(t=>t.ok).length, failed: tests.filter(t=>!t.ok).length, tests };
}
