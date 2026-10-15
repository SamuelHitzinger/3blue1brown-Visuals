import { NarrationError, publicError } from "./errors.js";
import { buildNarrationPreview, buildSceneAgentInput } from "./handoff.js";
import { NarrationService } from "./service.js";
import { SHARED_OWNER } from '../identity.js';
import { isTrustedAppRequest } from '../request-origin.js';

async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new NarrationError("CONTENT_TYPE", "Send application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new NarrationError("INVALID_JSON", "A JSON request body is required.", 400);
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 300_000) { await reader.cancel(); throw new NarrationError("SCRIPT_SIZE", "Request body is too large.", 413); }
    parts.push(value);
  }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")); }
  catch { throw new NarrationError("INVALID_JSON", "Request body must be valid JSON.", 400); }
}
export function narrationRoutes(service = new NarrationService()) {
  return async (request: Request, path: string): Promise<Response> => {
    try {
      const owner = SHARED_OWNER;
      if (request.method === "POST" && !isTrustedAppRequest(request)) {
        throw new NarrationError("ORIGIN", "Cross-origin narration requests are not allowed.", 403);
      }
      const match = /^\/api\/narrations(?:\/([a-f0-9]{64})(?:\/(scene-agent|alignment|preview|retry|scenes\/([\w-]+)|audio\/([\w.-]+)))?)?$/.exec(path);
      if (!match) throw new NarrationError("NOT_FOUND", "Narration route not found.", 404);
      const [, id, action, sceneId, assetId] = match;
      const isWrite = !id || action === "retry";
      const allowed = isWrite ? ["POST"] : ["GET", "HEAD"];
      if (!allowed.includes(request.method)) return Response.json({ code: "METHOD", message: "Method not allowed." }, { status: 405, headers: { Allow: allowed.join(", ") } });
      let response: Response;
      if (!id || action === "retry") {
        const input = await body(request);
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new NarrationError("INVALID_JSON", "Send a JSON object.", 400);
        if (!id && typeof input.markdown !== "string") throw new NarrationError("SCRIPT_FORMAT", "Provide markdown as a string.");
        const job = id ? await service.retry(owner, id) : await service.submit(owner, input.markdown);
        const { owner: _, ...publicJob } = job;
        response = Response.json({ ...publicJob, statusUrl: `/api/narrations/${job.id}` }, { status: job.status === "complete" ? 200 : 202 });
      } else if (assetId) response = new Response(Bun.file(await service.audio(owner, id, assetId)), { headers: { "Content-Type": "audio/wav" } });
      else if (action === "scene-agent") response = new Response(await service.artifact(owner, id, "scene-agent.md"), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
      else if (action === "alignment") response = new Response(await service.artifact(owner, id, "alignment.raw.json"), { headers: { "Content-Type": "application/json" } });
      else if (action === "preview") response = Response.json(buildNarrationPreview(await service.package(owner, id)));
      else if (sceneId) response = Response.json(buildSceneAgentInput(await service.package(owner, id), sceneId));
      else {
        const { owner: _, ...job } = await service.get(owner, id);
        response = Response.json({ ...job, ...(job.status === "complete" ? { package: await service.package(owner, id) } : {}) });
      }
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
    } catch (error) {
      const failure = publicError(error);
      return Response.json({ code: failure.code, message: failure.message, retryable: failure.retryable }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
