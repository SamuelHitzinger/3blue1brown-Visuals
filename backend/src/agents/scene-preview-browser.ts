import { ModelStore } from '../../../shared/animlib/dist/model-store.js';
import type { RenderModelAssets } from '../model-assets.js';
// Trusted browser entry: receives only QuickJS-evaluated data, never generated JavaScript.
import { CanvasRenderer } from '../../../shared/animlib/dist/renderer.js';
import type { CompiledScene } from 'animlib/core';
import type { FrameSample } from './scene-inspection.js';

Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
const canvas = document.createElement('canvas');
canvas.width = 960; canvas.height = 540;
canvas.style.width = '960px'; canvas.style.height = '540px';
document.body.append(canvas);
let files:Record<string,string>={};
const models=new ModelStore({}, {read:async asset=>Uint8Array.from(atob(files[asset.url]??''),c=>c.charCodeAt(0))});
const renderer = new CanvasRenderer(canvas,undefined,models);
let options: CompiledScene['options'];
let renderError: Error | undefined;
renderer.onError = error => { renderError = error; };
const api = {
  async prepare(compiled: CompiledScene, payload?: RenderModelAssets) {
    files=payload?.files??{};
    // The server verified the published hashes before crossing this isolated boundary.
    // about:blank has no SubtleCrypto; decode the trusted bytes without a second digest.
    models.register(Object.fromEntries(Object.entries(payload?.assets??{}).map(([id,a])=>[id,{...a,sha256:undefined}])));
    await models.prepare([compiled]);
    options = compiled.options;
    await renderer.prepare([compiled]);
    if (renderer.backend !== 'webgl2') throw new Error('Preview requires the production WebGL2 renderer.');
  },
  render(sample: FrameSample) {
    renderError = undefined;
    const context = renderer.canvasElement.getContext('webgl2');
    if (!context || context.isContextLost()) throw new Error('Preview WebGL2 context was lost.');
    renderer.render(sample.frame, options);
    if (renderError) throw renderError;
    const source = renderer.canvasElement;
    // Copy in the same task as rendering: WebGL's drawing buffer may be discarded afterward.
    if (!sample.focus) return source.toDataURL('image/png');
    const b = sample.focus, left = Math.max(0, Math.floor(b.left - 16)), top = Math.max(0, Math.floor(b.top - 16));
    const width = Math.min(960, Math.ceil(b.right + 16)) - left, height = Math.min(540, Math.ceil(b.bottom + 16)) - top;
    if (width <= 0 || height <= 0) throw new Error('Focused object is outside the viewport.');
    const crop = document.createElement('canvas'); crop.width = width; crop.height = height;
    crop.getContext('2d')!.drawImage(source, left, top, width, height, 0, 0, width, height);
    return crop.toDataURL('image/png');
  },
};
(globalThis as unknown as { scenePreview: typeof api }).scenePreview = api;
