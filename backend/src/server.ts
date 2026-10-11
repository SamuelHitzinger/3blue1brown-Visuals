import { ModelAssets } from './model-assets.js';
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { VideoService } from './videos.js';
import { narrationRoutes } from "./narration/routes.js";
import type { NarrationService } from "./narration/service.js";
import { proxyUser } from './identity.js';
import { studyPlanRoutes } from './study-plans.js';

const defaultFrontendDir = fileURLToPath(new URL("../../frontend/site/", import.meta.url));

function notFound() {
  return Response.json({ detail: "Not Found" }, { status: 404 });
}

function inside(root: string, path: string) {
  const suffix = relative(root, path);
  return suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

export function createHandler(frontendDir = defaultFrontendDir, videoService?: VideoService, narrationService?: NarrationService, models = new ModelAssets()) {
  const root = resolve(frontendDir);
  let videos = videoService;
  const narration = narrationRoutes(narrationService);
  const studyPlans = studyPlanRoutes();

  async function serveFile(path: string) {
    const candidate = resolve(root, path);
    if (!inside(root, candidate)) return notFound();
    try {
      // Resolve symlinks as well as '..' before exposing files over HTTP.
      const [realRoot, realFile] = await Promise.all([realpath(root), realpath(candidate)]);
      if (!inside(realRoot, realFile) || !(await stat(realFile)).isFile()) return notFound();
      return new Response(Bun.file(realFile));
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return notFound();
      throw error;
    }
  }

  return async function handle(request: Request): Promise<Response> {
    let path: string;
    try { path = decodeURIComponent(new URL(request.url).pathname); }
    catch { return Response.json({ detail: "Invalid URL" }, { status: 400 }); }
    if (path.includes("\0")) return Response.json({ detail: "Invalid URL" }, { status: 400 });
    if (path === '/api/models' || path.startsWith('/api/models/')) return models.handle(request);
    if (path === '/api/study-plans' || path.startsWith('/api/study-plans/')) return studyPlans(request);
    if (path === '/api/videos' || path.startsWith('/api/videos/')) {
      videos ??= new VideoService(process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite');
      return videos.handle(request);
    }
    if (path === "/api/narrations" || path.startsWith("/api/narrations/")) return narration(request, path);

    const api = path === "/api/hello" || path === "/api/me" || path === "/healthz";
    const page = path === "/" || path === "/plan" || path === "/courses" || /^\/(?:plan|courses)\/[^/]+$/.test(path) || path === "/library" || path === "/settings" || /^\/watch\/[^/]+$/.test(path);
    const asset = path.startsWith("/static/");
    if (!api && !page && !asset) return notFound();
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json({ detail: "Method Not Allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    let response: Response;
    if (path === "/healthz") response = Response.json({
      ok: true,
      ...(process.env.APP_REVISION ? { revision: process.env.APP_REVISION } : {}),
    });
    else if (path === "/api/me") response = Response.json({ user: proxyUser(request) });
    else if (path === "/api/hello") response = Response.json({ message: "Hello from the 3yellow3white backend", user: proxyUser(request) });
    else response = await serveFile(page ? "index.html" : path.slice("/static/".length));
    if (path === "/api/me" || path === "/api/hello") {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Vary", "X-User-Id, X-User-Name");
    }
    return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  };
}
