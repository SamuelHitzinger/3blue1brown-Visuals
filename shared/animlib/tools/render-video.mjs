/** Native production renderer → RGBA pipe → silent H.264, with subtitle sidecars.
 * node tools/render-video.mjs --manifest manifest.json --output film.mp4 --ffmpeg /path/to/ffmpeg
 * Defaults: --width 1280 --height 720 --fps 24 --crf 18 --preset medium
 */
import { create, globals } from 'webgpu';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { CanvasRenderer } from '../dist/renderer.js';
import { withOfflineScene } from '../dist/core.js';
import { loadAssetRegistry } from './load-assets.mjs';

function argumentsFor(argv) {
  const options = { width: 1280, height: 720, fps: 24, crf: 18, preset: 'medium', ffmpeg: 'ffmpeg' };
  const allowed = new Set(['manifest', 'output', 'ffmpeg', 'width', 'height', 'fps', 'crf', 'preset']);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !allowed.has(key) || !argv[i + 1]) throw new Error(`Invalid option: ${argv[i]}`);
    options[key] = ['width', 'height', 'fps', 'crf'].includes(key) ? Number(argv[i + 1]) : argv[i + 1];
  }
  if (!options.manifest || !options.output) throw new Error('Required: --manifest path/to/manifest.json --output path/to/film.mp4');
  for (const key of ['width', 'height']) if (!Number.isInteger(options[key]) || options[key] < 2 || options[key] % 2) throw new Error(`${key} must be a positive even integer.`);
  if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 120) throw new Error('fps must be greater than zero and at most 120.');
  if (!Number.isInteger(options.crf) || options.crf < 0 || options.crf > 51) throw new Error('crf must be an integer from 0 to 51.');
  if (!['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].includes(options.preset)) throw new Error('Invalid H.264 preset.');
  if (extname(options.output).toLowerCase() !== '.mp4') throw new Error('Output must have an .mp4 extension.');
  return options;
}

function validateManifest(manifest) {
  if (!Array.isArray(manifest.scenes) || !manifest.scenes.length) throw new Error('Manifest needs at least one scene.');
  const ids = new Set();
  for (const scene of manifest.scenes) {
    if (typeof scene.id !== 'string' || !scene.id || ids.has(scene.id)) throw new Error('Scene IDs must be nonempty and unique.');
    ids.add(scene.id);
    if (typeof scene.file !== 'string' || !/^[\w.-]+\.js$/.test(scene.file)) throw new Error(`Scene ${scene.id} needs a local .js filename.`);
    if (!Number.isFinite(scene.duration) || scene.duration <= 0) throw new Error(`Invalid duration for ${scene.id}.`);
  }
  const duration = manifest.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (!Array.isArray(manifest.captions ?? [])) throw new Error('captions must be an array.');
  for (const cue of manifest.captions ?? []) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > duration + 0.001 || typeof cue.text !== 'string') throw new Error('Invalid caption cue.');
  }
  return duration;
}

function stamp(seconds, separator) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
}
function subtitleText(captions, vtt) {
  return (vtt ? 'WEBVTT\n\n' : '') + captions.map((cue, index) => `${index + 1}\n${stamp(cue.start, vtt ? '.' : ',')} --> ${stamp(cue.end, vtt ? '.' : ',')}\n${cue.text.replace(/\r\n?/g, '\n')}\n`).join('\n');
}

async function main() {
  const options = argumentsFor(process.argv.slice(2));
  const manifestPath = resolve(options.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const modelAssets=manifest.modelAssets?await loadAssetRegistry(manifest.modelAssets.map(path=>resolve(dirname(manifestPath),path))):undefined;
  const duration = validateManifest(manifest);
  const output = resolve(options.output);
  await mkdir(dirname(output), { recursive: true });
  const partial = join(dirname(output), `.${basename(output, '.mp4')}.${process.pid}.partial.mp4`);
  const captioned = join(dirname(output), `.${basename(output, '.mp4')}.${process.pid}.captioned.mp4`);
  const { width, height, fps } = options;
  const frameCount = Math.ceil(duration * fps - 1e-8);
  let device, texture, readback, renderer, encoder, encoderDone, encoderError;
  let stderr = '', aborted = false;
  const stop = () => { aborted = true; encoder?.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    Object.assign(globalThis, globals);
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.devicePixelRatio = 1;
    const gpu = create([]);
    // Keep Dawn's native instance alive across long asynchronous exports and GC.
    globalThis.__animlibExportGpu = gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('Native WebGPU adapter unavailable.');
    device = await adapter.requestDevice();
    const format = gpu.getPreferredCanvasFormat();
    texture = device.createTexture({ size: [width, height], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    readback = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({ requestDevice: async () => device }), getPreferredCanvasFormat: () => format } } });
    const context = { configure() {}, unconfigure() {}, getCurrentTexture: () => texture };
    const canvas = { width, height, style: {}, getBoundingClientRect: () => ({ width, height }), getContext: kind => kind === 'webgpu' ? context : null, addEventListener() {}, removeEventListener() {} };
    renderer = new CanvasRenderer(canvas);
    let renderError;
    renderer.onError = error => { renderError = error; };
    device.addEventListener('uncapturederror', event => { renderError = event.error; });
    encoder = spawn(options.ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', options.preset, '-crf', String(options.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-frames:v', String(frameCount), partial], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    encoder.stderr.setEncoding('utf8');
    encoder.stderr.on('data', text => { stderr = (stderr + text).slice(-16000); });
    encoder.on('error', error => { encoderError = error; });
    encoder.stdin.on('error', error => { encoderError ??= error; });
    // Resolve on every exit path so early subprocess failures never become unhandled rejections.
    encoderDone = new Promise(resolveDone => {
      encoder.once('error', error => resolveDone({ error }));
      encoder.once('close', (code, signal) => resolveDone({ code, signal }));
    });
    const rgba = Buffer.allocUnsafe(width * height * 4);
    let frameIndex = 0, sceneStart = 0, previous;
    for (const entry of manifest.scenes) {
      if (aborted) throw new Error('Export interrupted.');
      const source = await readFile(join(dirname(manifestPath), entry.file), 'utf8');
      previous = await withOfflineScene(source, { previous }, async sampler => {
        const compiled = sampler.scene;
        if (Math.abs(compiled.duration - entry.duration) > 0.001) throw new Error(`Scene ${entry.id}: compiled duration ${compiled.duration} differs from manifest ${entry.duration}.`);
        if (compiled.options.audio) throw new Error(`Scene ${entry.id} declares audio; silent export requires silent source scenes.`);
        await renderer.prepare([compiled],sampler.assetGeometry);
        const sceneEnd = sceneStart + entry.duration;
        const endFrame = Math.min(frameCount, Math.ceil(sceneEnd * fps - 1e-8));
        process.stderr.write(`Rendering ${entry.id}: frames ${frameIndex}–${endFrame - 1}\n`);
        while (frameIndex < endFrame) {
          if (aborted) throw new Error('Export interrupted.');
          if (encoderError || encoder.exitCode !== null) throw encoderError ?? new Error(`FFmpeg exited early (${encoder.exitCode}).`);
          const time = Math.max(0, Math.min(compiled.duration, frameIndex / fps - sceneStart));
          if (process.env.ANIMLIB_EXPORT_DEBUG) process.stderr.write(`frame ${frameIndex}: evaluate/render\n`);
          renderer.render(sampler.sample(time), compiled.options);
          if (renderError) throw renderError;
          const commands = device.createCommandEncoder();
          commands.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow, rowsPerImage: height }, [width, height]);
          device.queue.submit([commands.finish()]);
          if (process.env.ANIMLIB_EXPORT_DEBUG) process.stderr.write(`frame ${frameIndex}: readback\n`);
          await readback.mapAsync(GPUMapMode.READ);
          try {
            const mapped = new Uint8Array(readback.getMappedRange());
            for (let y = 0; y < height; y++) rgba.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
            if (format === 'bgra8unorm') for (let i = 0; i < rgba.length; i += 4) [rgba[i], rgba[i + 2]] = [rgba[i + 2], rgba[i]];
          } finally { readback.unmap(); }
          if (renderError) throw renderError;
          if (process.env.ANIMLIB_EXPORT_DEBUG) process.stderr.write(`frame ${frameIndex}: encode\n`);
          // Await the write callback: bounded pipe buffering and safe reuse of the RGBA buffer.
          await new Promise((resolveWrite, rejectWrite) => encoder.stdin.write(rgba, error => error ? rejectWrite(error) : resolveWrite()));
          frameIndex++;
        }
        sceneStart = sceneEnd;
        return sampler.sample();
      },{modelAssets});
    }
    encoder.stdin.end();
    const result = await encoderDone;
    if (result.error || result.code !== 0 || aborted) throw result.error ?? new Error(`FFmpeg failed (${result.code ?? result.signal}).`);
    const subtitleBase = output.slice(0, -4);
    await writeFile(`${subtitleBase}.srt`, subtitleText(manifest.captions ?? [], false), 'utf8');
    await writeFile(`${subtitleBase}.vtt`, subtitleText(manifest.captions ?? [], true), 'utf8');
    const embeddedSubtitles = Boolean(manifest.captions?.length);
    if (embeddedSubtitles) {
      encoder = spawn(options.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', partial, '-i', `${subtitleBase}.srt`, '-map', '0:v:0', '-map', '1:0', '-c:v', 'copy', '-c:s', 'mov_text', '-an', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', captioned], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      encoder.stderr.setEncoding('utf8');
      encoder.stderr.on('data', text => { stderr = (stderr + text).slice(-16000); });
      encoderDone = new Promise(resolveDone => {
        encoder.once('error', error => resolveDone({ error }));
        encoder.once('close', (code, signal) => resolveDone({ code, signal }));
      });
      const muxed = await encoderDone;
      if (muxed.error || muxed.code !== 0 || aborted) throw muxed.error ?? new Error(`Subtitle mux failed (${muxed.code ?? muxed.signal}).`);
    }
    await rename(embeddedSubtitles ? captioned : partial, output);
    console.log(JSON.stringify({ output, backend: 'native-webgpu', codec: 'h264', pixelFormat: 'yuv420p', width, height, fps, frames: frameCount, duration: frameCount / fps, audio: false, embeddedSubtitles, subtitles: [`${subtitleBase}.srt`, `${subtitleBase}.vtt`] }, null, 2));
  } catch (error) {
    process.stderr.write(`Export failed: ${error instanceof Error ? error.stack : String(error)}\n`);
    if (stderr.trim()) process.stderr.write(`${stderr.trim()}\n`);
    throw error;
  } finally {
    if (encoder && encoder.exitCode === null) { encoder.stdin?.destroy(); encoder.kill(); }
    if (encoderDone) await encoderDone;
    readback?.destroy(); texture?.destroy(); renderer?.dispose(); device?.destroy();
    delete globalThis.__animlibExportGpu;
    await rm(partial, { force: true });
    await rm(captioned, { force: true });
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
