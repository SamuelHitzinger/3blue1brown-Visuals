import assert from 'node:assert/strict';
import { compileSource } from 'animlib/core';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { ChromiumScenePreview } from '../backend/src/agents/scene-preview.js';
import { inspectInWorker, sampleInWorker } from '../backend/src/agents/scene-inspection-client.js';
import type { Browser } from 'puppeteer-core';
import { modelSmokeFixture } from '../shared/animlib/tools/model-smoke-fixture.mjs';

// No AI provider, narration, network, or GPU. Runs inside the actual read-only deployment container.
const source = `export default scene({}, s => {
  const dot = s.circle('dot', { radius: 0.6, fill: Color.BLUE, stroke: Color.NONE, position: [-2, 0] });
  s.text('caption', { text: 'Preview ready', position: [0, 2], fontSize: 0.4 });
  s.play(dot.moveTo([2, 0]), { duration: 1 }); s.wait(1);
});`;
const compiled = await compileSource(source), candidate = { source, compiled };
const report = await inspectInWorker(candidate, { times: [0, 2], objectIds: ['dot'] });
assert(report.bounds[0].bounds!.left < report.bounds[1].bounds!.left);
const renderer = new ChromiumScenePreview();
try {
  const start = performance.now();
  const frames = await renderer.render(compiled, await sampleInWorker(candidate, { times: [0, 1, 2] }));
  assert.equal(frames.length, 3);
  const centers: number[] = [];
  for (const frame of frames) {
    const image = await loadImage(Buffer.from(frame.image.data, 'base64'));
    assert.equal(image.width, 960); assert.equal(image.height, 540);
    const canvas = createCanvas(960, 540), context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 960, 540).data;
    let count = 0, sumX = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 2] > pixels[i] + 50 && pixels[i + 1] > pixels[i] + 50) { count++; sumX += (i / 4) % 960; }
    }
    assert(count > 100, 'Software-rendered frame must contain the blue circle, not a blank canvas');
    centers.push(sumX / count);
  }
  assert(centers[1] > centers[0] + 100, 'Seeking must move the rendered object');
  assert(Math.abs(centers[2] - centers[1]) < 1, 'Settled frames must be deterministic');
  const models=await modelSmokeFixture();
  const modelSource=`export default scene({},s=>{s.model('panel',{asset:'fixture'});s.wait(1);});`;
  const modelCompiled=await compileSource(modelSource,{models:{fixture:models.assets.fixture.metadata}});
  const modelFrames=await renderer.render(modelCompiled,await sampleInWorker({source:modelSource,compiled:modelCompiled},{times:[1]}),undefined,models);
  const modelImage=await loadImage(Buffer.from(modelFrames[0].image.data,'base64'));
  const modelCanvas=createCanvas(960,540),modelContext=modelCanvas.getContext('2d');modelContext.drawImage(modelImage,0,0);
  const pixels=modelContext.getImageData(0,0,960,540).data;let red=0,green=0,blue=0;
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i]>240&&pixels[i+1]<20&&pixels[i+2]<20)red++;
    if(pixels[i]<20&&pixels[i+1]>240&&pixels[i+2]<20)green++;
    if(pixels[i]<20&&pixels[i+1]<20&&pixels[i+2]>240)blue++;
  }
  assert(Math.min(red,green,blue)>100,'Scene previews must include actual model textures');
  const warmStart = performance.now();
  const cropped = await renderer.render(compiled, await sampleInWorker(candidate, { times: [2], focusObjectId: 'dot' }));
  const crop = await loadImage(Buffer.from(cropped[0].image.data, 'base64'));
  assert(crop.width < 960 && crop.height < 540);
  const warmCropMs = Math.round(performance.now() - warmStart);
  // A compilation-successful glyph error must reach the caller, and leave the worker usable.
  const unsupportedSource = `export default scene({},s=>{s.text('unsupported',{text:'🙂'});s.wait(1);});`;
  const unsupported = { source: unsupportedSource, compiled: await compileSource(unsupportedSource) };
  await assert.rejects(renderer.render(unsupported.compiled, await sampleInWorker(unsupported, { times: [0] })), /glyph/);
  const samples = await sampleInWorker(candidate, { times: [0, 1, 2] });
  const active = renderer.render(compiled, samples);
  const controller = new AbortController();
  const queued = renderer.render(compiled, samples, controller.signal);
  controller.abort(new Error('Cancelled queued preview'));
  await assert.rejects(queued, /Cancelled queued preview/);
  assert.equal((await active).length, 3);
  if (process.platform !== 'win32') {
    // Reproduce an unresponsive browser. Cancellation must release the serial queue
    // without waiting for a protocol timeout, and the next request must replace it.
    const browser = await (renderer as unknown as { browser: Promise<Browser> }).browser;
    const pid = browser.process()!.pid!;
    process.kill(pid, 'SIGSTOP');
    try {
      const cancellation = new AbortController();
      const stalled = renderer.render(compiled, samples, cancellation.signal);
      await Bun.sleep(50);
      cancellation.abort(new Error('Cancel stalled browser'));
      await assert.rejects(stalled, /Cancel stalled browser/);
      const recovered = await renderer.render(compiled, samples, AbortSignal.timeout(10_000));
      assert.equal(recovered.length, 3);
      const replacement = await (renderer as unknown as { browser: Promise<Browser> }).browser;
      assert.notEqual(replacement.process()!.pid, pid, 'Cancelled browser must not be reused');
    } finally {
      try { process.kill(pid, 'SIGCONT'); } catch { /* Cancellation already killed it. */ }
    }
  }
  console.log(JSON.stringify({ scenePreview: 'passed', coldBatchMs: Math.round(warmStart - start), warmCropMs }));
} finally { await renderer.close(); }
