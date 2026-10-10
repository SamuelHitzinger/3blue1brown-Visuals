import { VERTEX_FLOATS } from '../src/texture-shader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {SceneAssets} from '../src/scene-assets.js';
import {imageInput} from './image-fixture.js';

// These tests verify selection/lifetime/submission contracts, NOT rasterization.
// Actual GLSL compilation and pixels are tested by webgl.browser.ts in a browser.
const glState = vi.hoisted(() => ({ constructors: vi.fn(), render: vi.fn(), dispose: vi.fn() }));
vi.mock('../src/webgl.js', () => ({ WebGLBackend: class {
  maxSize = 4096;
  constructor(readonly gl: unknown) { glState.constructors(gl); }
  render = glState.render;
  dispose = glState.dispose;
} }));
import { CanvasRenderer } from '../src/renderer.js';

it('rejects images exceeding actual device limits during preparation',async()=>{
  const {renderer,device}=setup();device.limits.maxTextureDimension2D=1;
  const registry=await createAssetRegistry([imageInput()],{colorPolicy:'source'});
  const scene=await compileSource("export default scene({},s=>s.image('card',{asset:'corners'}));",{assetCatalog:registry.catalog});
  const assets=new SceneAssets(registry);assets.prepare(scene);
  try{await expect(renderer.prepare([scene],assets)).rejects.toThrow(/image.*dimension/i);}
  finally{renderer.dispose();assets.dispose();}
});

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
function setup(failure = '') {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('GPUBufferUsage', { UNIFORM: 1, COPY_DST: 2, VERTEX: 4, INDEX: 8 });
  vi.stubGlobal('GPUTextureUsage', { RENDER_ATTACHMENT: 1 });
  let lose!: (info: { message: string }) => void;
  const buffer = () => ({ destroy: vi.fn() });
  const device = {
    limits: { maxTextureDimension2D: 8192, maxBufferSize: 268435456 }, destroy: vi.fn(), addEventListener: vi.fn(),
    lost: new Promise(resolve => { lose = resolve; }),
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: failure === 'shader' ? [{ type: 'error', message: 'bad shader' }] : [] }) }),
    createRenderPipelineAsync: vi.fn(async () => { if (failure === 'pipeline') throw new Error('bad pipeline'); return { getBindGroupLayout: () => ({}) }; }),
    createBuffer: vi.fn(buffer), createBindGroup: vi.fn(() => ({})),
    createTexture: vi.fn(({ size }: { size: number[] }) => ({ ...buffer(), width: size[0], height: size[1] })),
  };
  const gpu = {
    requestAdapter: vi.fn(async () => {
      if (failure === 'adapter-rejected') throw new Error('adapter rejected');
      if (failure === 'adapter-null') return null;
      return { requestDevice: async () => { if (failure === 'device') throw new Error('device rejected'); return device; } };
    }),
    getPreferredCanvasFormat: () => 'bgra8unorm',
  };
  vi.stubGlobal('navigator', failure === 'missing' ? {} : { gpu });
  const context = { configure: vi.fn(() => { if (failure === 'configure') throw new Error('configure rejected'); }), unconfigure: vi.fn() };
  function surface() {
    const gl = {};
    const events = new Map<string, EventListener>();
    const canvas = {
      width: 640, height: 480, style: {}, getBoundingClientRect: () => ({ width: 640, height: 480 }),
      getContext: vi.fn((kind: string) => kind === 'webgpu' ? (failure === 'context' ? null : context) : gl),
      addEventListener: vi.fn((name: string, handler: EventListener) => events.set(name, handler)),
      removeEventListener: vi.fn((name: string) => events.delete(name)),
      cloneNode: vi.fn(() => surface().canvas), replaceWith: vi.fn(),
    };
    return { canvas, gl, events };
  }
  const { canvas, gl, events } = surface();
  const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement);
  return { renderer, canvas, gl, events, device, context, gpu, lose: () => lose({ message: 'test loss' }) };
}

it.each(['missing', 'adapter-null', 'adapter-rejected', 'device', 'shader', 'pipeline', 'context', 'configure'])(
  'falls back after %s and releases any acquired GPU resources', async failure => {
    const { renderer, canvas, gl, device, context } = setup(failure);
    await renderer.prepare([]);
    expect(renderer.backend).toBe('webgl2');
    if (failure === 'configure') {
      expect(canvas.cloneNode).toHaveBeenCalledOnce();
      expect(canvas.getContext).not.toHaveBeenCalledWith('webgl2', expect.anything());
      expect(context.unconfigure).toHaveBeenCalledOnce();
      expect(renderer.canvasElement).not.toBe(canvas);
    } else expect(glState.constructors).toHaveBeenCalledWith(gl);
    if (['shader', 'pipeline', 'context', 'configure'].includes(failure)) expect(device.destroy).toHaveBeenCalledOnce();
    if (['missing', 'adapter-null', 'adapter-rejected', 'device', 'shader', 'pipeline'].includes(failure))
      expect(canvas.getContext).not.toHaveBeenCalledWith('webgpu');
    renderer.dispose(); renderer.dispose();
    expect(glState.dispose).toHaveBeenCalledOnce();
  },
);
it('keeps WebGPU preferred and switches a lost device to a fresh WebGL2 surface', async () => {
  const { renderer, canvas, lose, device } = setup();
  const changed = vi.fn(); renderer.onCanvasChange = changed;
  await renderer.prepare([]);
  expect(renderer.backend).toBe('webgpu'); expect(glState.constructors).not.toHaveBeenCalled();
  lose(); await Promise.resolve();
  expect(renderer.backend).toBe('webgl2'); expect(changed).toHaveBeenCalledWith(renderer.canvasElement);
  expect(canvas.replaceWith).toHaveBeenCalledWith(renderer.canvasElement);
  expect(device.destroy).toHaveBeenCalledOnce();
  renderer.dispose();
});
it('does not acquire or replace a canvas after disposal when the device is lost', async () => {
  const { renderer, canvas, lose } = setup();
  await renderer.prepare([]); renderer.dispose(); lose(); await Promise.resolve();
  expect(glState.constructors).not.toHaveBeenCalled(); expect(canvas.cloneNode).not.toHaveBeenCalled();
});
it('uses WebGL2 on insecure origins too, without requesting WebGPU', async () => {
  const { renderer, gpu } = setup(); vi.stubGlobal('isSecureContext', false);
  await renderer.prepare([]); expect(renderer.backend).toBe('webgl2'); expect(gpu.requestAdapter).not.toHaveBeenCalled(); renderer.dispose();
});
it('submits shared lit geometry, opacity ordering, and viewport offsets to WebGL2', async () => {
  const { renderer } = setup('missing');
  const scene = await compileSource(`export default scene({mode:'3d'},s=>{
    s.sphere('opaque',{fill:'BLUE',viewportOffset:[0.2,0.1]});
    s.rectangle('alpha',{fill:'RED',opacity:0.5});s.wait(1);
  });`);
  await renderer.prepare([scene]); renderer.render(evaluateScene(scene, 0), scene.options);
  const [data, batches] = glState.render.mock.calls[0];
  expect(data).toBeInstanceOf(Float32Array);
  const opaque=batches[0].commands.find((c:any)=>c.mesh);
  expect(opaque.mesh.indices.length).toBeGreaterThan(100);
  expect(opaque.mesh.vertices[11]).toBe(1); expect(opaque.instances[0][18]).toBeCloseTo(0.2);
  expect(data[6]).toBe(0.5);
  renderer.dispose();
});
it('reports loss once, rebuilds WebGL resources on restore and detaches handlers on disposal', async () => {
  const { renderer, events } = setup('missing');
  const error = vi.fn(), recovered = vi.fn(); renderer.onError = error; renderer.onRecovered = recovered;
  await renderer.prepare([]);
  const event = new Event('webglcontextlost', { cancelable: true });
  events.get('webglcontextlost')!(event); expect(event.defaultPrevented).toBe(true); expect(error).toHaveBeenCalledOnce();
  events.get('webglcontextrestored')!(new Event('webglcontextrestored'));
  expect(glState.constructors).toHaveBeenCalledTimes(2); expect(recovered).toHaveBeenCalledOnce();
  renderer.dispose(); expect(events.size).toBe(0);
});

it('falls back when a device is lost during initialization, before acquiring a canvas context', async () => {
  const { renderer, canvas, lose, device } = setup();
  lose(); await renderer.prepare([]);
  expect(renderer.backend).toBe('webgl2');
  expect(canvas.getContext).not.toHaveBeenCalledWith('webgpu');
  expect(device.destroy).toHaveBeenCalledOnce(); renderer.dispose();
});
it('reports both backend initialization failures and cleans the device', async () => {
  const { renderer, device } = setup('pipeline');
  glState.constructors.mockImplementationOnce(() => { throw new Error('GL shader rejected'); });
  await expect(renderer.prepare([])).rejects.toThrow('WebGPU: bad pipeline WebGL2: GL shader rejected');
  expect(device.destroy).toHaveBeenCalledOnce();expect(renderer.backend).toBeUndefined();renderer.dispose();
});
it('recovers a WebGPU frame acquisition failure without throwing into the playback loop', async () => {
  const { renderer, context, device } = setup();
  await renderer.prepare([]);
  // Fail before submission, as a canvas/device can do just before device.lost arrives.
  Object.assign(device,{createCommandEncoder:()=>{throw new Error('GPU stopped');},queue:{}});
  const error=vi.fn();renderer.onError=error;
  const scene=await compileSource(`export default scene({},s=>s.wait(1));`);
  expect(()=>renderer.render(evaluateScene(scene,0),scene.options)).not.toThrow();
  expect(renderer.backend).toBe('webgl2');expect(glState.render).toHaveBeenCalledOnce();
  expect(context.unconfigure).toHaveBeenCalledOnce();expect(error).not.toHaveBeenCalled();renderer.dispose();
});

it('does not recover a budget rejection when the retry instead fails both backends',async()=>{
  const {renderer,device}=setup();await renderer.prepare([]);
  const error=vi.fn(),recovered=vi.fn();renderer.onError=error;renderer.onRecovered=recovered;
  const scene=await compileSource("export default scene({},s=>{s.rectangle('r');s.wait(1)});");
  device.limits.maxBufferSize=256;
  renderer.render(evaluateScene(scene,0),scene.options);
  expect(error.mock.calls[0][0].name).toBe('VertexBufferLimitError');
  expect(recovered).not.toHaveBeenCalled();
  device.limits.maxBufferSize=268435456;
  Object.assign(device,{queue:{writeBuffer:()=>{}},createCommandEncoder:()=>{throw new Error('GPU stopped');}});
  glState.render.mockImplementationOnce(()=>{throw new Error('GL stopped');});
  renderer.render(evaluateScene(scene,0),scene.options);
  expect(error.mock.calls.at(-1)![0].message).toBe('GL stopped');
  expect(recovered).not.toHaveBeenCalled();
  renderer.render(evaluateScene(scene,0),scene.options);
  expect(glState.render).toHaveBeenCalledOnce();expect(recovered).not.toHaveBeenCalled();renderer.dispose();
});

function allowGPUFrames({device,context}:ReturnType<typeof setup>) {
  const pass={setPipeline(){},setBindGroup(){},setVertexBuffer(){},setIndexBuffer(){},drawIndexed(){},draw(){},end(){}};
  Object.assign(device,{queue:{writeBuffer(){},submit:vi.fn()},createCommandEncoder:()=>({beginRenderPass:()=>pass,finish:()=>({})})});
  Object.assign(context,{getCurrentTexture:()=>({createView:()=>({})})});
  for(const result of device.createTexture.mock.results)Object.assign(result.value,{createView:()=>({})});
}
function uncaptured(device:ReturnType<typeof setup>['device'],message='GPU validation failed') {
  device.addEventListener.mock.calls.find(([type])=>type==='uncapturederror')![1]({error:{message}});
}
it.each(['budget first','backend first','reentrant backend failure'])(
  'preserves uncaptured backend errors across successful frames: %s',async order=>{
    const state=setup(),{renderer,device}=state;await renderer.prepare([]);allowGPUFrames(state);
    const scene=await compileSource("export default scene({},s=>{s.rectangle('r');s.wait(1)});");
    const errors:Error[]=[],recovered=vi.fn();renderer.onRecovered=recovered;
    const render=()=>renderer.render(evaluateScene(scene,0),scene.options);
    renderer.onError=error=>{
      errors.push(error);
      if(order==='reentrant backend failure'&&error.name==='VertexBufferLimitError'){
        uncaptured(device);device.limits.maxBufferSize=268435456;render();
      }
    };
    if(order==='backend first')uncaptured(device);
    device.limits.maxBufferSize=256;render();
    if(order==='budget first')uncaptured(device);
    device.limits.maxBufferSize=268435456;render();render();
    expect(errors.at(-1)?.message).toBe('GPU validation failed');
    expect(recovered).not.toHaveBeenCalled();
    renderer.dispose();
  },
);
it('acknowledges a budget-only retry once before a reentrant refresh',async()=>{
  const state=setup(),{renderer,device}=state;await renderer.prepare([]);allowGPUFrames(state);
  const scene=await compileSource("export default scene({},s=>{s.rectangle('r');s.wait(1)});");
  const render=()=>renderer.render(evaluateScene(scene,0),scene.options);
  const recovered=vi.fn(()=>render());renderer.onRecovered=recovered;
  device.limits.maxBufferSize=256;render();device.limits.maxBufferSize=268435456;render();
  expect(recovered).toHaveBeenCalledOnce();renderer.dispose();
});
it.each(['success','render failure','reentrant context loss'])(
  'requires actual backend recovery after budget plus uncaptured errors: %s',async outcome=>{
    const state=setup(),{renderer,device,canvas,lose}=state;await renderer.prepare([]);
    const scene=await compileSource("export default scene({},s=>{s.rectangle('r');s.wait(1)});");
    const errors:Error[]=[],recovered=vi.fn();renderer.onError=e=>errors.push(e);renderer.onRecovered=recovered;
    device.limits.maxBufferSize=256;renderer.render(evaluateScene(scene,0),scene.options);uncaptured(device);
    if(outcome==='render failure')glState.render.mockImplementationOnce(()=>{throw new Error('GL render failed');});
    if(outcome==='reentrant context loss')glState.render.mockImplementationOnce(()=>{
      const replacement=canvas.cloneNode.mock.results[0].value;
      replacement.addEventListener.mock.calls.find(([type]:[string])=>type==='webglcontextlost')[1](new Event('webglcontextlost',{cancelable:true}));
    });
    lose();await Promise.resolve();
    if(outcome==='success')expect(recovered).toHaveBeenCalledOnce();
    else{
      expect(recovered).not.toHaveBeenCalled();
      expect(errors.at(-1)?.message).toContain(outcome==='render failure'?'GL render failed':'WebGL2 context lost');
    }
    // Events from the released WebGPU device must not supersede GL's state.
    const count=errors.length;uncaptured(device,'stale GPU error');expect(errors).toHaveLength(count);
    if(outcome==='reentrant context loss'){
      const replacement=canvas.cloneNode.mock.results[0].value;
      replacement.addEventListener.mock.calls.find(([type]:[string])=>type==='webglcontextrestored')[1]();
      expect(recovered).toHaveBeenCalledOnce();
    }
    renderer.dispose();
  },
);
