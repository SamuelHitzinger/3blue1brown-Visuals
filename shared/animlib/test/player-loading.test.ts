import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Player } from '../src/player.js';
import { CanvasRenderer } from '../src/renderer.js';
import { ModelStore } from '../src/model-store.js';
import { AudioClock } from '../src/audio.js';
import { Canvas } from './canvas-stub.js';

const source = 'export default scene({}, s => { s.circle("dot"); s.wait(1); });';
const load = (id: string) => ({ type: 'load' as const, scenes: [{ id, source }] });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function gate() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function preparation() {
  const model = gate(), audio = gate(), renderer = gate();
  const models = vi.spyOn(ModelStore.prototype, 'prepare').mockImplementationOnce(() => model.promise).mockResolvedValue(undefined);
  const audios = vi.spyOn(AudioClock.prototype, 'prepare').mockImplementationOnce(async scenes => {
    await audio.promise;
    scenes[0].duration = 5;
  }).mockResolvedValue(undefined);
  const renderers = vi.spyOn(CanvasRenderer.prototype, 'prepare').mockImplementationOnce(() => renderer.promise).mockResolvedValue(undefined);
  return { model, audio, renderer, models, audios, renderers, release() { model.resolve(); audio.resolve(); renderer.resolve(); } };
}
function player() { return new Player({ canvas: new Canvas() as unknown as HTMLCanvasElement }); }

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(CanvasRenderer.prototype, 'render').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('overlaps resource preparation and renders only after every resource and the audio duration are ready', async () => {
  const p = player(), prep = preparation();
  const loading = p.submit(load('first'));
  try {
    await vi.waitFor(() => expect(prep.models).toHaveBeenCalledOnce());
    expect(prep.audios).toHaveBeenCalledOnce();
    expect(prep.renderers).toHaveBeenCalledOnce();
    prep.audio.resolve(); prep.renderer.resolve();
    await tick();
    expect(p.getState()).toMatchObject({ scene: null, status: 'empty', revision: 0 });
    expect(CanvasRenderer.prototype.render).not.toHaveBeenCalled();
    prep.model.resolve();
    expect((await loading).ok).toBe(true);
    expect(p.getState()).toMatchObject({ scene: 'first', duration: 5, status: 'paused', revision: 1 });
    expect(CanvasRenderer.prototype.render).toHaveBeenCalledOnce();
  } finally { prep.release(); await loading; p.dispose(); }
});

it('drains failed preparation before a queued submission can start and preserves the committed scene', async () => {
  const p = player();
  const renderers = vi.spyOn(CanvasRenderer.prototype, 'prepare').mockResolvedValue(undefined);
  expect((await p.submit(load('original'))).ok).toBe(true);
  renderers.mockRestore();
  const prep = preparation();
  let settled = false;
  const failed = p.submit(load('candidate')).then(result => { settled = true; return result; });
  let following: ReturnType<Player['submit']> | undefined;
  try {
    await vi.waitFor(() => expect(prep.models).toHaveBeenCalledOnce());
    expect(prep.audios).toHaveBeenCalledOnce();
    expect(prep.renderers).toHaveBeenCalledOnce();
    following = p.submit(load('following'));
    prep.model.reject(new Error('model preparation failed'));
    await tick();
    expect(settled).toBe(false);
    expect(p.getState()).toMatchObject({ scene: 'original', revision: 1 });
    expect(prep.models).toHaveBeenCalledOnce();
    prep.audio.reject(new Error('audio preparation failed'));
    await tick();
    expect(settled).toBe(false);
    prep.renderer.resolve();
    expect(await failed).toMatchObject({ ok: false, diagnostics: [{ message: 'model preparation failed' }] });
    expect((await following).ok).toBe(true);
    expect(p.getState()).toMatchObject({ scene: 'following', revision: 2 });
    expect(prep.models).toHaveBeenCalledTimes(2);
  } finally { prep.release(); await failed; await following; p.dispose(); }
});

it('disposes all resources during concurrent preparation without committing or rendering its scene', async () => {
  const p = player(), prep = preparation();
  const modelsDisposed = vi.spyOn(ModelStore.prototype, 'dispose');
  const audioDisposed = vi.spyOn(AudioClock.prototype, 'dispose');
  const rendererDisposed = vi.spyOn(CanvasRenderer.prototype, 'dispose');
  const loading = p.submit(load('first'));
  try {
    await vi.waitFor(() => expect(prep.models).toHaveBeenCalledOnce());
    expect(prep.audios).toHaveBeenCalledOnce();
    expect(prep.renderers).toHaveBeenCalledOnce();
    p.dispose(); prep.release();
    expect(await loading).toMatchObject({ ok: false, diagnostics: [{ message: 'Scene sequence is disposed' }] });
    expect(p.getState()).toMatchObject({ scene: null, revision: 0 });
    expect(CanvasRenderer.prototype.render).not.toHaveBeenCalled();
    expect(modelsDisposed).toHaveBeenCalledOnce();
    expect(audioDisposed).toHaveBeenCalledOnce();
    expect(rendererDisposed).toHaveBeenCalledOnce();
  } finally { prep.release(); await loading; p.dispose(); }
});
