import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createServer as createHTTPServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const home = await mkdtemp(join(tmpdir(), 'aha-plugin-smoke-'));
process.env.AHA_VIDEO_HOME = home;
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
await writeFile(join(home, 'config.json'), JSON.stringify({ port }));
const { start, stop, running, findChromium, runtimeRoot } = await import('../scripts/runtime.mjs');
const { VideoClient } = await import('../scripts/client.mjs');
let browser;
let embedHost;
let mcp;
try {
  const state = await start({ smoke: true });
  const client = new VideoClient(state.origin);
  const source = join(home, 'source.md');
  await writeFile(source, '# Exact supplied material\nπ = 3.14159\n');
  const request = { title: 'Plugin interaction smoke', topic: 'Exercise the existing interactive pipeline.', documents: [] };
  const video = await client.create(request, 'smoke-same-key', [source]);
  assert.equal((await client.create(request, 'smoke-same-key', [source])).id, video.id);
  await assert.rejects(client.create({ ...request, topic: 'Different request' }, 'smoke-same-key', [source]), /different request/);
  let manifest;
  for (let attempt = 0; attempt < 60; attempt++) {
    manifest = await client.status(video.id);
    if (manifest.status === 'complete') break;
    assert.notEqual(manifest.status, 'failed', manifest.error);
    await delay(500);
  }
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.scenes.length, 3);
  assert.ok(manifest.scenes.every(scene => scene.source.includes("s.slider('distance'")));
  const audio = Buffer.from(await (await fetch(`${state.origin}${manifest.scenes[0].audio.url}`)).arrayBuffer());
  assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
  const playerUrl = `${state.origin}/watch/${video.id}`;
  const html = await (await fetch(playerUrl)).text();
  assert.match(html, /\/static\/assets\//);
  const stream = await fetch(`${state.origin}/api/videos/${video.id}/events`);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: manifest/);
  await reader.cancel();

  await stop();
  assert.equal(await running(), undefined);
  await start({ smoke: true });
  assert.deepEqual((await client.status(video.id)).scenes, manifest.scenes);
  assert.equal((await client.list()).length, 1);

  if (process.argv.includes('--browser')) {
    const require = createRequire(join(runtimeRoot, 'backend/package.json'));
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: findChromium(), headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1280, height: 800 } });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(playerUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[aria-label="Video progress"]:not(:disabled)', { timeout: 30_000 });
    const ranges = await page.$$('input[type="range"]');
    assert.ok(ranges.length >= 2, 'Timeline plus authored Distance control must exist');
    await page.click('button[aria-label="Captions"]');
    assert.equal(await page.$eval('button[aria-label="Captions"]', element => element.getAttribute('aria-pressed')), 'true');
    await page.$eval('input[aria-label="Video progress"]', element => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(element, '2'); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Video progress"]').value) >= 1.9);
    const control = await page.$('input[type="range"]:not([aria-label="Video progress"])');
    const before = await control.evaluate(element => element.value);
    await control.focus();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await control.evaluate(element => element.value), before);
    await page.click('button[aria-label="Play lesson"]');
    await page.waitForSelector('button[aria-label="Pause lesson"]');
    await page.click('button[aria-label="Pause lesson"]');
    await page.click('canvas', { button: 'right', offset: { x: 150, y: 150 } });
    await page.waitForSelector('input[aria-label="Question about the selected region"]');
    await page.type('input[aria-label="Question about the selected region"]', 'Show the distance as an interactive toy.');
    await page.click('button[aria-label="Add scenes"]');
    await page.waitForSelector('.scene-request-status button:not(:disabled)', { timeout: 30_000 });
    await page.screenshot({ path: join(home, 'interactive-player.png') });
    assert.deepEqual(errors, []);

    // Real MCP tool transport, original player in one UI frame, no browser network.
    const { playerResource } = await import('../scripts/widget.mjs');
    const resource = await playerResource(state.origin);
    const embedded = await browser.newPage();
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    mcp = new Client({ name: 'native-player-test', version: '1.0.0' });
    await mcp.connect(new StdioClientTransport({ command: process.execPath,
      args: [fileURLToPath(new URL('../scripts/mcp.mjs', import.meta.url))], env: { ...process.env }, stderr: 'pipe' }));
    const toolCalls = [];
    await embedded.exposeFunction('callPlayerTool', async params => {
      toolCalls.push(params.name);
      return await mcp.callTool(params);
    });
    const embeddedErrors = [];
    embedded.on('pageerror', error => embeddedErrors.push(error.message));
    embedded.on('console', message => { if (message.type() === 'error') embeddedErrors.push(message.text()); });
    embedHost = createHTTPServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<iframe id="app" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="autoplay; fullscreen" style="width:100%;height:760px;border:0"></iframe>');
    });
    await new Promise(resolve => embedHost.listen(0, '127.0.0.1', resolve));
    await embedded.goto(`http://127.0.0.1:${embedHost.address().port}`);
    await embedded.evaluate(() => {
      window.appMessages = [];
      window.addEventListener('message', async event => {
        if (event.source !== document.querySelector('#app').contentWindow) return;
        window.appMessages.push(event.data);
        if (event.data.method === 'ui/initialize') event.source.postMessage({ jsonrpc: '2.0', id: event.data.id, result: {} }, '*');
        if (event.data.method === 'tools/call') {
          try { event.source.postMessage({ jsonrpc: '2.0', id: event.data.id, result: await window.callPlayerTool(event.data.params) }, '*'); }
          catch (error) { event.source.postMessage({ jsonrpc: '2.0', id: event.data.id, error: { message: error.message } }, '*'); }
        }
      });
    });
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline'; worker-src blob:; font-src data:; img-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'">`;
    await embedded.$eval('#app', (element, html) => { element.srcdoc = html; }, resource.text.replace('<head>', `<head>${csp}`));
    await embedded.waitForFunction(() => window.appMessages.some(message => message.method === 'ui/notifications/initialized'));
    await embedded.$eval('#app', (element, result) => element.contentWindow.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: result } }, '*'), { id: video.id, playerUrl, title: request.title, duration: 18, status: 'complete' });
    const lessonFrame = await (await embedded.$('#app')).contentFrame();
    try {
      await lessonFrame.waitForSelector('input[aria-label="Video progress"]:not(:disabled)', { timeout: 30_000 });
    } catch (error) {
      console.error(JSON.stringify({ embeddedErrors, body: await lessonFrame.$eval('body', element => element.innerText), secureContext: await lessonFrame.evaluate(() => isSecureContext) }));
      throw error;
    }
    assert.ok((await lessonFrame.$$('input[type="range"]')).length >= 2);
    assert.equal((await lessonFrame.$$('iframe')).length, 0);
    await lessonFrame.click('button[aria-label="Captions"]');
    const embeddedControl = await lessonFrame.$('input[type="range"]:not([aria-label="Video progress"])');
    const embeddedValue = await embeddedControl.evaluate(element => element.value);
    await embeddedControl.focus(); await embedded.keyboard.press('ArrowRight');
    assert.notEqual(await embeddedControl.evaluate(element => element.value), embeddedValue);
    await lessonFrame.click('canvas', { button: 'right', offset: { x: 150, y: 150 } });
    await lessonFrame.waitForSelector('input[aria-label="Question about the selected region"]');
    await lessonFrame.type('input[aria-label="Question about the selected region"]', 'Add another scene through MCP.');
    await lessonFrame.click('button[aria-label="Add scenes"]');
    await lessonFrame.waitForFunction(() => !document.querySelector('input[aria-label="Question about the selected region"]'));
    await lessonFrame.waitForSelector('.scene-request-status button:not(:disabled)', { timeout: 30_000 });
    assert.ok(toolCalls.includes('player_request_scenes'));
    await embedded.screenshot({ path: join(home, 'embedded-player.png') });
    await embedded.$eval('#app', element => element.contentWindow.postMessage({ jsonrpc: '2.0', id: 2, method: 'ping' }, '*'));
    await embedded.waitForFunction(() => window.appMessages.some(message => message.id === 2 && message.result));
    await lessonFrame.click('button[aria-label="Play lesson"]');
    await lessonFrame.waitForSelector('button[aria-label="Pause lesson"]');
    await lessonFrame.waitForFunction(() => Number(document.querySelector('input[aria-label="Video progress"]').value) > 0.5);
    assert.deepEqual(embeddedErrors, []);
    await embedded.$eval('#app', element => element.contentWindow.postMessage({ jsonrpc: '2.0', id: 3, method: 'ui/resource-teardown', params: {} }, '*'));
    await embedded.waitForFunction(() => window.appMessages.some(message => message.id === 3 && message.result) && !document.querySelector('#app').contentDocument.querySelector('canvas'));
  }
  console.log(JSON.stringify({ ok: true, mode: 'simulated-test-only', id: video.id, sourceUpload: true, idempotency: true,
    persistence: true, audio: true, progressiveEvents: true, interactiveControls: Boolean(browser), evidenceDirectory: home }, null, 2));
} finally {
  await browser?.close();
  await mcp?.close();
  if (embedHost) await new Promise(resolve => embedHost.close(resolve));
  await stop();
}
