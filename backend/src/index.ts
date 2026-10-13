import { createHandler } from "./server.js";
import { VideoService } from './videos.js';
import { NarrationService } from './narration/service.js';
import { agentConfig } from './agents/config.js';
import { PiAgentRunner } from './agents/runtime.js';
import { createPiGenerator } from './agents/generator.js';
import { createThumbnailGenerator, thumbnailAgentConfig } from './agents/thumbnail.js';
import { ChromiumScenePreview } from './agents/scene-preview.js';
import { dirname, join } from 'node:path';
import { LectureService } from './lectures.js';
import { generateLectureNotes } from './agents/lecture.js';
import { createLectureVisualGenerator } from './agents/lecture-visual.js';

const generation = process.env.VIDEO_GENERATOR ?? 'pi';
if (generation !== 'pi' && generation !== 'simulated') throw new Error('VIDEO_GENERATOR must be pi or simulated.');
const narration = new NarrationService();
const config = generation === 'pi' ? agentConfig() : undefined;
const preview = config && process.env.SCENE_PREVIEW !== '0' ? new ChromiumScenePreview() : undefined;
const videos = new VideoService(process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite',
  config ? createPiGenerator(new PiAgentRunner(config), narration, config.dataDir,
    { outputMode: config.sceneOutputMode, timingMode: config.sceneTimingMode, preview }) : undefined, generation,
  config ? createThumbnailGenerator(new PiAgentRunner(thumbnailAgentConfig())) : undefined);
const lectureConfig = config && { ...config, model: process.env.LECTURE_MODEL ?? 'gpt-6.1-sol', thinking: 'medium' as const };
const lectureRunner = lectureConfig ? new PiAgentRunner(lectureConfig) : undefined;
const lectures = new LectureService(process.env.LECTURE_DB_PATH ?? join(dirname(process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite'), 'lectures.sqlite'),
  lectureRunner ? (input, signal) => generateLectureNotes(lectureRunner, input, signal) : undefined,
  { visualize: config ? createLectureVisualGenerator(new PiAgentRunner(config), config.dataDir, { preview }) : undefined });

const localNarration = process.env.NODE_ENV !== "production" && process.env.NARRATION_ALLOW_LOCAL === "1";
const hostname = process.env.HOST ?? (localNarration ? "127.0.0.1" : "0.0.0.0");
if (localNarration && !["127.0.0.1", "localhost", "::1"].includes(hostname)) {
  throw new Error("NARRATION_ALLOW_LOCAL requires a backend bound to loopback. Disable it when using a shared server.");
}
const handler = createHandler(process.env.FRONTEND_DIR || undefined, videos, narration, undefined, lectures);
const server = Bun.serve({
  hostname,
  port: Number(process.env.PORT ?? 8080),
  idleTimeout: 30,
  maxRequestBodySize: Infinity,
  fetch(request, server) {
    // Planning is a bounded model request and can exceed the default idle timeout.
    if (new URL(request.url).pathname === '/api/study-plans') server.timeout(request, 210);
    return handler(request);
  },
  error(error) {
    console.error(error);
    return Response.json({ detail: "Internal Server Error" }, { status: 500 });
  },
});

console.log(`Aha! backend listening on ${server.url}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.stop(true);
  await videos.close();
  await lectures.close();
  await preview?.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
