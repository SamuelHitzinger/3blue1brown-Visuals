// The team's backend, unchanged, plus the scenegen rules and checks.
// scenegen/prompts/planning.md is appended to the lesson-planning prompt and
// scenegen/prompts/visualization.md to the scene prompt (after scene-craft.md); both are
// re-read on use. The wrapper also adds validation (lesson plans must mark every scene
// 3D or 2D and keep yellow for the highlight; scenes must pass the render checks in
// scene-checks.ts) and trims the previous scene's frame in the scene prompt.
// Failures go back to the model like any other validation error and are logged to
// out/scenegen-check-failures.log.
//
// Run from backend/ (so .env.local and data/ resolve as usual):
//   bun ../scenegen/backend/dev.ts
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHandler } from "../../backend/src/server.js";
import { VideoService } from "../../backend/src/videos.js";
import { NarrationService } from "../../backend/src/narration/service.js";
import { agentConfig } from "../../backend/src/agents/config.js";
import { PiAgentRunner } from "../../backend/src/agents/runtime.js";
import type { AgentRunner, AgentTask } from "../../backend/src/agents/runtime.js";
import { compileSource } from "animlib/core";
import type { Frame } from "animlib/core";
import { createPiGenerator, sceneSource } from "../../backend/src/agents/generator.js";
import { DEAD_CONTROL_HINT, deadControls, renderProblems } from "./scene-checks.ts";
import { PLANNING_CONTRACT } from "../../backend/src/agents/planning.js";
import { loadPrompt } from "../../backend/src/agents/prompts.js";
import { ChromiumScenePreview } from "../../backend/src/agents/scene-preview.js";
import { createThumbnailGenerator, thumbnailAgentConfig } from "../../backend/src/agents/thumbnail.js";

const LOG_DIR = new URL("../../out/", import.meta.url);
/** The scenegen rules: scenegen/prompts/<name>.md, re-read on every use. */
export const scenegenPrompt = (name: "visualization" | "planning") => readFile(new URL(`../prompts/${name}.md`, import.meta.url), "utf8");

/** Adds the scenegen checks to the validate hook of planning and scene tasks. */
export class CheckedRunner implements AgentRunner {
  constructor(private inner: AgentRunner) {}
  async run(task: AgentTask): Promise<string> {
    if (!task.validate) return this.inner.run(task);
    const context = `${task.logContext?.videoId ?? "?"} ${task.logContext?.stage ?? ""} ${task.logContext?.sceneIndex ?? ""}`.trim();
    if (task.systemPrompt.includes(PLANNING_CONTRACT)) { // lesson authoring: plan + script
      return this.inner.run({ ...task, systemPrompt: `${task.systemPrompt}\n\n${await scenegenPrompt("planning")}`, validate: async output => {
        await task.validate!(output);
        await report(context, planProblems(output));
      } });
    }
    const [craft, visualization] = await Promise.all([loadPrompt("scene-craft"), scenegenPrompt("visualization")]);
    if (!task.systemPrompt.includes(craft)) return this.inner.run(task); // review, thumbnails, ...
    const systemPrompt = task.systemPrompt.replace(craft, () => craft + "\n\n" + visualization);
    // Formulas, view membership and layout only show up in the player; check them here so a broken scene cannot be published.
    const packet = scenePacket(task.prompt);
    const planned3D = /^\s*3D\s*:/i.test(packet.json?.planning?.current?.visualDescription ?? "");
    return this.inner.run({ ...task, systemPrompt, prompt: slimPrompt(task.prompt, packet), validate: async output => {
      await task.validate!(output);
      const previous = packet.json?.previousFrame;
      const compiled = await compileSource(sceneSource(output), { previous });
      const problems = renderProblems(compiled);
      if (planned3D && !(compiled as { views?: unknown[] }).views?.length) {
        problems.push('This scene is planned in 3D but has no 3D view. Put the model in s.view("model", { rect, orbit: true, camera }, v => { ... }).');
      }
      const dead = await deadControls(sceneSource(output), compiled, previous);
      if (dead.length) problems.push(`Controls without effect at the end: ${dead.join(", ")}.\n${DEAD_CONTROL_HINT}`);
      await report(context, problems);
    } });
  }
}

/** Logs the problems, then throws them so the model gets another attempt. */
async function report(context: string, problems: string[]) {
  if (!problems.length) return;
  const message = problems.join("\n\n");
  console.warn(`[scenegen] check failed (${context}): ${problems.map(problem => problem.split("\n")[0]).join(" | ")}`);
  await mkdir(LOG_DIR, { recursive: true }).then(() => appendFile(new URL("scenegen-check-failures.log", LOG_DIR),
    `${new Date().toISOString()} ${context}\n${message}\n\n`)).catch(() => {});
  throw new Error(message);
}

const VIEW_MARK = /^\s*(3D\s*:|2D\s*\(because\b)/i;
const RESERVED_COLOURS = new Set(["YELLOW", "GOLD"]);

/** Plan rules the backend's parser does not enforce. */
export function planProblems(output: string): string[] {
  let plan: { scenes?: { id: string; visualDescription?: string }[]; entities?: { id: string; color?: string }[] };
  try { plan = JSON.parse(output).plan ?? {}; } catch { return []; }
  const problems: string[] = [];
  // Every scene must state its view, so "3D by default" is a checked decision.
  const unmarked = (plan.scenes ?? []).filter(scene => !VIEW_MARK.test(scene.visualDescription ?? "")).map(scene => scene.id);
  if (unmarked.length) problems.push(`Start each scene's visualDescription with "3D:" or "2D (because <reason>):". Missing in: ${unmarked.join(", ")}. 3D is the default; 2D needs a real reason.`);
  const yellow = (plan.entities ?? []).filter(entity => RESERVED_COLOURS.has(String(entity.color).toUpperCase())).map(entity => entity.id);
  if (yellow.length) problems.push(`YELLOW and GOLD are reserved for the highlight frame; give these entities another colour: ${yellow.join(", ")}.`);
  return problems;
}

interface ScenePacket { start: number; json?: { previousFrame?: Frame; planning?: { current?: { visualDescription?: string } } } }

/** The scene task's prompt ends with one line of JSON: narration, plan and the previous scene's final frame. */
function scenePacket(prompt: string): ScenePacket {
  const start = prompt.lastIndexOf("\n{") + 1;
  try { return { start, json: JSON.parse(prompt.slice(start)) }; } catch { return { start }; }
}

/**
 * The previous frame is sent to the model in full, including every mesh vertex: often
 * most of the prompt, and nothing a scene author can use (objects are fetched with
 * s.previous.get(id)). Replace bulk geometry with its size; validation keeps the full frame.
 */
export function slimPrompt(prompt: string, packet: ScenePacket = scenePacket(prompt)): string {
  const frame = packet.json?.previousFrame as { elements?: { geometry?: Record<string, unknown> }[] } | undefined;
  if (!frame?.elements) return prompt;
  const elements = frame.elements.map(element => {
    const geometry = { ...element.geometry };
    for (const key of ["vertices", "triangles", "normals", "points"]) {
      const value = geometry[key];
      if (Array.isArray(value) && value.length > 24) geometry[key] = `[${value.length} entries omitted]`;
    }
    return { ...element, geometry };
  });
  return prompt.slice(0, packet.start) + JSON.stringify({ ...packet.json, previousFrame: { ...frame, elements } });
}

if (import.meta.main) {
  const narration = new NarrationService();
  const config = agentConfig();
  const preview = process.env.SCENE_PREVIEW !== "0" ? new ChromiumScenePreview() : undefined;
  const videos = new VideoService(process.env.VIDEO_DB_PATH ?? "data/videos.sqlite",
    createPiGenerator(new CheckedRunner(new PiAgentRunner(config)), narration, config.dataDir,
      { outputMode: config.sceneOutputMode, timingMode: config.sceneTimingMode, preview }), "pi",
    createThumbnailGenerator(new PiAgentRunner(thumbnailAgentConfig())));
  const handler = createHandler(process.env.FRONTEND_DIR || undefined, videos, narration);
  const localNarration = process.env.NODE_ENV !== "production" && process.env.NARRATION_ALLOW_LOCAL === "1";
  const server = Bun.serve({
    hostname: process.env.HOST ?? (localNarration ? "127.0.0.1" : "0.0.0.0"),
    port: Number(process.env.PORT ?? 8080),
    idleTimeout: 30,
    maxRequestBodySize: Infinity,
    fetch(request, server) {
      // Planning is a bounded model request and can exceed the default idle timeout.
      if (new URL(request.url).pathname === "/api/study-plans") server.timeout(request, 210);
      return handler(request);
    },
    error(error) { console.error(error); return Response.json({ detail: "Internal Server Error" }, { status: 500 }); },
  });
  console.log(`Aha! backend (scenegen checks) listening on ${server.url}`);
  let stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; server.stop(true); await videos.close(); await preview?.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
