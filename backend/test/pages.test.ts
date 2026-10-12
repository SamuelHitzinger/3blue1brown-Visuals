import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../src/server.js";

let site: string;
const html = '<!doctype html><title>Aha!</title><div id="root"></div>';
beforeAll(async () => {
  site = await mkdtemp(join(tmpdir(), "aha-pages-"));
  await writeFile(join(site, "index.html"), html);
});
afterAll(async () => { await rm(site, { recursive: true, force: true }); });

test("workspace, library, subject plans, and player deep links serve the app shell", async () => {
  const handle = createHandler(site);
  for (const route of ["/", "/library", "/plan", "/plan/analysis", "/plan/diskrete-mathematik", "/courses", "/courses/analysis", "/courses/course-new", "/settings", "/watch/demo"]) {
    const response = await handle(new Request(`http://localhost${route}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
    const head = await handle(new Request(`http://localhost${route}`, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  }
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
