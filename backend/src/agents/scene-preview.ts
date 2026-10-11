import type { RenderModelAssets } from '../model-assets.js';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import type { Browser, BrowserContext } from 'puppeteer-core';
import type { ImageContent } from '@earendil-works/pi-ai';
import type { CompiledScene } from 'animlib/core';
import type { FrameSample } from './scene-inspection.js';

export interface PreviewFrame { time: number; image: ImageContent }
export interface ScenePreviewRenderer {
  render(compiled: CompiledScene, samples: FrameSample[], signal?: AbortSignal, models?: RenderModelAssets): Promise<PreviewFrame[]>;
}

/** A single warm Chromium process; isolated context per batch, bounded serial rendering. */
export class ChromiumScenePreview implements ScenePreviewRenderer {
  private browser?: Promise<Browser>;
  private bundle?: Promise<string>;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private closed = false;

  constructor(private executablePath = process.env.SCENE_PREVIEW_CHROMIUM ?? '/usr/bin/chromium',
    private noSandbox = process.env.SCENE_PREVIEW_NO_SANDBOX === '1') {}

  async render(compiled: CompiledScene, samples: FrameSample[], signal?: AbortSignal, models?: RenderModelAssets): Promise<PreviewFrame[]> {
    signal?.throwIfAborted();
    if (this.closed) throw new Error('Scene preview renderer is closed.');
    if (!samples.length || samples.length > 6) throw new Error('Preview requires 1–6 frames.');
    if (this.pending >= 4) throw new Error('Scene preview worker is busy. Use analytical inspection or try again later.');
    this.pending++;
    const work = this.queue.then(() => this.renderBatch(compiled, samples, signal, models));
    this.queue = work.catch(() => undefined).finally(() => { this.pending--; });
    let abort: (() => void) | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      if (signal) {
        abort = () => reject(signal.reason ?? new Error('Scene preview cancelled.'));
        signal.addEventListener('abort', abort, { once: true });
      }
    });
    try { return await Promise.race([work, cancelled]); }
    finally { if (abort) signal?.removeEventListener('abort', abort); }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const pending = this.launchBrowser();
      this.browser = pending;
      pending.then(browser => browser.on('disconnected', () => {
        if (this.browser === pending) this.browser = undefined;
      }), () => { if (this.browser === pending) this.browser = undefined; });
    }
    return this.browser;
  }

  private async launchBrowser(): Promise<Browser> {
    // Chromium/Crashpad also write outside --user-data-dir. Keep all such files in
    // private temporary storage because the deployment's home/root filesystem is read-only.
    const directory = await mkdtemp(join(tmpdir(), 'aha-scene-preview-'));
    const config = join(directory, 'config'), cache = join(directory, 'cache');
    try {
      await Promise.all([mkdir(config), mkdir(cache)]);
      const browser = await puppeteer.launch({ executablePath: this.executablePath, headless: true, pipe: true,
        timeout: 15_000, protocolTimeout: 0, userDataDir: join(directory, 'profile'),
        env: { ...process.env, XDG_CONFIG_HOME: config, XDG_CACHE_HOME: cache },
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
          ...(this.noSandbox ? ['--no-sandbox'] : [])],
      });
      browser.once('disconnected', () => { void rm(directory, { recursive: true, force: true }).catch(() => {}); });
      return browser;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  /** Cancellation must not depend on an unresponsive browser answering a CDP command. */
  private discardBrowser(browser: Browser): void {
    this.browser = undefined;
    const child = browser.process();
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL'); // Puppeteer launches a detached process group.
      } catch { child.kill('SIGKILL'); }
    }
    void browser.disconnect().catch(() => {});
  }

  private async renderBatch(compiled: CompiledScene, samples: FrameSample[], signal?: AbortSignal, models?: RenderModelAssets): Promise<PreviewFrame[]> {
    signal?.throwIfAborted();
    if (this.closed) throw new Error('Scene preview renderer is closed.');
    let context: BrowserContext | undefined;
    let browser: Browser | undefined;
    let cancelled = false;
    let abort: () => void = () => {};
    const stop = new Promise<never>((_, reject) => {
      const cancel = (reason: unknown) => {
        cancelled = true;
        if (browser) this.discardBrowser(browser);
        reject(reason);
      };
      abort = () => cancel(signal?.reason ?? new Error('Scene preview cancelled.'));
      signal?.addEventListener('abort', abort, { once: true });
    });
    const work = (async () => {
      browser = await this.getBrowser();
      if (cancelled || this.closed) { this.discardBrowser(browser); throw new Error('Scene preview cancelled.'); }
      context = await browser.createBrowserContext();
      if (cancelled) throw new Error('Scene preview cancelled.');
      const page = await context.newPage();
      page.setDefaultTimeout(0);
      page.setDefaultNavigationTimeout(0);
      await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
      // No external content, audio, filesystem URLs, or generated code in Chromium.
      await page.setRequestInterception(true);
      page.on('request', request => { void request.abort().catch(() => {}); });
      await page.setContent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'"><body style="margin:0;background:black">');
      this.bundle ??= readFile(new URL('../../dist/scene-preview.js', import.meta.url), 'utf8').catch(error => { this.bundle = undefined; throw error; });
      await page.addScriptTag({ content: await this.bundle });
      await page.evaluate(async data => {
        await (globalThis as unknown as { scenePreview: { prepare(data: CompiledScene, models?: RenderModelAssets): Promise<void> } }).scenePreview.prepare(data.compiled, data.models);
      }, {compiled,models});
      const result: PreviewFrame[] = [];
      for (const sample of samples) {
        signal?.throwIfAborted();
        const data = await page.evaluate(sample => (globalThis as unknown as {
          scenePreview: { render(sample: FrameSample): string };
        }).scenePreview.render(sample), sample);
        if (!data.startsWith('data:image/png;base64,')) throw new Error('Preview returned no PNG frame.');
        result.push({ time: sample.time, image: { type: 'image', mimeType: 'image/png', data: data.slice('data:image/png;base64,'.length) } });
      }
      return result;
    })();
    try { return await Promise.race([work, stop]); }
    finally {
      try {
        // A cancelled launch must finish retiring its process before another batch can reuse it.
        if (cancelled && !browser) await work.catch(() => {});
        if (!cancelled && context) await Promise.race([context.close(), stop]);
      } catch { if (browser && !cancelled) this.discardBrowser(browser); }
      finally { signal?.removeEventListener('abort', abort); }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const browser = await this.browser?.catch(() => undefined);
    if (browser) this.discardBrowser(browser);
    await this.queue;
  }
}
