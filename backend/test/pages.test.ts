import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../src/server.js";

let site: string;
const html = '<!doctype html><title>Aha!</title><div id="root"></div>';
const hashedAssets = ['index-5ibxAcN8.js', 'index-DhbIS3qf.css', 'compiler-worker-CeKaUpwC.js', 'emscripten-module-DHbYPfAp.wasm', 'dm-sans-latin-ext-500-normal-DR84L5F-.woff'];
beforeAll(async () => {
  site = await mkdtemp(join(tmpdir(), "aha-pages-"));
  await writeFile(join(site, "index.html"), html);
  await mkdir(join(site, 'assets'));
  await Promise.all([...hashedAssets, 'stable.js', 'index-AbCd123.js'].map(name => writeFile(join(site, 'assets', name), `asset:${name}`)));
  await writeFile(join(site, 'favicon.svg'), '<svg/>');
});
afterAll(async () => { await rm(site, { recursive: true, force: true }); });

test("workspace, library, subject plans, and player deep links serve the app shell", async () => {
  const handle = createHandler(site);
  for (const route of ["/", "/library", "/plan", "/plan/analysis", "/plan/diskrete-mathematik", "/courses", "/courses/analysis", "/courses/course-new", "/settings", "/watch/demo"]) {
    const response = await handle(new Request(`http://localhost${route}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(await response.text()).toBe(html);
    const head = await handle(new Request(`http://localhost${route}`, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(head.headers.get('Cache-Control')).toBe('no-cache');
    expect(await head.text()).toBe("");
  }
});

test('content-hashed bundles, workers, WASM and fonts are immutable for GET and HEAD', async () => {
  const handle = createHandler(site);
  for (const name of hashedAssets) {
    const response = await handle(new Request(`http://localhost/static/assets/${name}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(await response.text()).toBe(`asset:${name}`);
    const head = await handle(new Request(`http://localhost/static/assets/${name}`, { method: 'HEAD' }));
    expect(head.status).toBe(200);
    expect(head.headers.get('Cache-Control')).toBe(response.headers.get('Cache-Control'));
    expect(await head.text()).toBe('');
  }
});

test('unversioned assets and unsuccessful requests never receive immutable cache headers', async () => {
  const handle = createHandler(site);
  for (const route of ['/static/favicon.svg', '/static/assets/stable.js', '/static/assets/index-AbCd123.js']) {
    const response = await handle(new Request(`http://localhost${route}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control') ?? '').not.toContain('immutable');
  }
  for (const route of ['/static/assets/missing-AbCd1234.js', '/static/%2e%2e%2fprivate-AbCd1234.js']) {
    const response = await handle(new Request(`http://localhost${route}`));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control') ?? '').not.toContain('immutable');
    const head = await handle(new Request(`http://localhost${route}`, { method: 'HEAD' }));
    expect(head.status).toBe(404);
    expect(head.headers.get('Cache-Control') ?? '').not.toContain('immutable');
  }
  const response = await handle(new Request(`http://localhost/static/assets/${hashedAssets[0]}`, { method: 'POST' }));
  expect(response.status).toBe(405);
  expect(response.headers.get('Cache-Control') ?? '').not.toContain('immutable');
});

test("new app routes retain method restrictions and do not expose nested paths", async () => {
  const handle = createHandler(site);
  for (const route of ["/library", "/plan/analysis", "/courses", "/courses/course-new"]) {
    const response = await handle(new Request(`http://localhost${route}`, { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  }
  expect((await handle(new Request("http://localhost/plan/analysis/extra"))).status).toBe(404);
  expect((await handle(new Request("http://localhost/library/extra"))).status).toBe(404);
  expect((await handle(new Request("http://localhost/courses/analysis/extra"))).status).toBe(404);
});
