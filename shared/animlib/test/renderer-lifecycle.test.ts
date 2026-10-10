import { afterEach, expect, it, vi } from 'vitest';
import { CanvasRenderer } from '../src/renderer.js';

afterEach(() => vi.unstubAllGlobals());

it.each(['adapter', 'device', 'shader', 'opaque-pipeline', 'transparent-pipeline', 'image-shader', 'image-opaque-pipeline', 'image-transparent-pipeline'])(
  'disposal during %s initialization cannot reclaim a replacement canvas or allocate resources', async stage => {
    let release = () => {}, entered = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { entered = resolve; });
    const wait = async (name: string) => { if (stage === name) { entered(); await gate; } };
    const pipeline = { getBindGroupLayout: () => ({}) };
    let pipelineCount = 0,shaderCount=0;
    const device = {
      addEventListener: vi.fn(), lost: new Promise(() => {}), destroy: vi.fn(),
      createShaderModule: () => ({ getCompilationInfo: async () => { await wait(++shaderCount===1?'shader':'image-shader'); return { messages: [] }; } }),
      createRenderPipelineAsync: vi.fn(async () => { await wait(['opaque-pipeline','transparent-pipeline','image-opaque-pipeline','image-transparent-pipeline'][pipelineCount++]); return pipeline; }),
      createBuffer: vi.fn(() => ({ destroy: vi.fn() })), createBindGroup: vi.fn(),
    };
    const requestDevice = vi.fn(async () => { await wait('device'); return device; });
    vi.stubGlobal('navigator', { gpu: {
      requestAdapter: async () => { await wait('adapter'); return { requestDevice }; },
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const context = { configure: vi.fn(), unconfigure: vi.fn() };
    const canvas = {
      width: 640, height: 480, style: {}, getBoundingClientRect: () => ({ width: 640, height: 480 }),
      getContext: () => context, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas);
    const pending = expect(renderer.prepare([])).rejects.toThrow('Renderer is disposed');
    await reached;
    const configured = context.configure.mock.calls.length;
    const pipelines = device.createRenderPipelineAsync.mock.calls.length;
    renderer.dispose();
    context.configure({ device: 'replacement-player-device' });
    release();
    await pending;
    expect(context.configure).toHaveBeenCalledTimes(configured + 1);
    expect(context.configure.mock.calls.at(-1)?.[0]).toEqual({ device: 'replacement-player-device' });
    expect(device.createRenderPipelineAsync).toHaveBeenCalledTimes(pipelines);
    expect(device.createBuffer).not.toHaveBeenCalled();
    expect(device.createBindGroup).not.toHaveBeenCalled();
    expect(device.destroy).toHaveBeenCalledTimes(stage === 'adapter' ? 0 : 1);
    if (stage === 'adapter') expect(requestDevice).not.toHaveBeenCalled();
  },
);
