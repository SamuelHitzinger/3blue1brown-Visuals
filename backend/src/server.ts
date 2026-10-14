import { ModelAssets } from './model-assets.js';
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { VideoService } from './videos.js';
import { narrationRoutes } from "./narration/routes.js";
import type { NarrationService } from "./narration/service.js";
import { proxyUser } from './identity.js';
import { studyPlanRoutes } from './study-plans.js';
import { LectureService } from './lectures.js';
import { catalogRoutes } from './visualization-catalog.js';
import type { LectureCaptureService } from './lecture-capture.js';
import type { LectureLiveBridge } from './lecture-live-bridge.js';

const defaultFrontendDir = fileURLToPath(new URL("../../frontend/site/", import.meta.url));

function notFound() {
  return Response.json({ detail: "Not Found" }, { status: 404 });
}

function inside(root: string, path: string) {
  const suffix = relative(root, path);
  return suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

export function createHandler(frontendDir = defaultFrontendDir, videoService?: VideoService, narrationService?: NarrationService, models = new ModelAssets(), lectureService?: LectureService, captureService?: LectureCaptureService, liveBridge?: LectureLiveBridge) {
  const root = resolve(frontendDir);
  let videos = videoService;
  const narration = narrationRoutes(narrationService);
  const studyPlans = studyPlanRoutes();
  const catalog = catalogRoutes();
  let lectures = lectureService;

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
    if (path.startsWith('/api/live-bridge/')) return liveBridge ? liveBridge.handlePlugin(request) : Response.json({ detail: 'Lecture bridge is not configured.' }, { status: 503 });
    if (/^\/api\/lectures\/[^/]+\/live-bridge$/.test(path)) return liveBridge ? liveBridge.handleOwner(request) : Response.json({ detail: 'Lecture bridge is not configured.' }, { status: 503 });
    if (path.startsWith('/api/capture/')) return captureService ? captureService.handleDevice(request) : Response.json({detail:'Phone capture is not configured.'},{status:503});
    if (path === '/api/lecture-capture/config' || /^\/api\/lectures\/[^/]+\/capture-pairings(?:\/|$)/.test(path)) {
      return captureService ? captureService.handleOwner(request) : Response.json({detail:'Phone capture is not configured.'},{status:503});
    }
    if (path === '/api/visualization-catalog' || path.startsWith('/api/visualization-catalog/')) return catalog(request);
    if (path === '/api/lecture-view' || path.startsWith('/api/lecture-view/') || path === '/api/lectures' || path.startsWith('/api/lectures/')) {
      lectures ??= new LectureService(process.env.LECTURE_DB_PATH ?? join(dirname(process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite'), 'lectures.sqlite'));
      return path.startsWith('/api/lecture-view') ? lectures.handleView(request, models) : lectures.handle(request);
    }
    if (path === '/api/models' || path.startsWith('/api/models/')) return models.handle(request);
    if (path === '/api/study-plans' || path.startsWith('/api/study-plans/')) return studyPlans(request);
    if (path === '/api/videos' || path.startsWith('/api/videos/')) {
      videos ??= new VideoService(process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite');
      return videos.handle(request);
    }
    if (path === "/api/narrations" || path.startsWith("/api/narrations/")) return narration(request, path);

    const api = path === "/api/hello" || path === "/api/me" || path === "/healthz";
    const page = path === "/" || path === '/capture' || /^\/live\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(path) || path === '/videos/new' || path === '/lectures' || path === '/catalog' || /^\/lectures\/(?:course\/)?[^/]+$/.test(path) || path === "/plan" || path === "/courses" || /^\/(?:plan|courses)\/[^/]+$/.test(path) || path === "/library" || path === "/settings" || /^\/watch\/[^/]+$/.test(path);
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
    // Vite fingerprints these files; the app shell must pick up new references on deployment.
    if (response.ok && page) response.headers.set('Cache-Control', 'no-cache');
    else if (response.ok && /^\/static\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(path)) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (path === "/api/me" || path === "/api/hello") {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Vary", "X-User-Id, X-User-Name");
    }
    return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  };
}
