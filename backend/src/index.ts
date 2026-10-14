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
import { LectureCaptureService } from './lecture-capture.js';
import { createLectureMediaExtractor } from './lecture-media.js';
import { createCaptureGateway } from './capture-gateway.js';

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
  { visualize: config ? createLectureVisualGenerator(new PiAgentRunner(config), config.dataDir, { preview }) : undefined, synthesisDebounceMs: 1_500 });
const captures = new LectureCaptureService(process.env.CAPTURE_DB_PATH ?? join(dirname(process.env.LECTURE_DB_PATH ?? process.env.VIDEO_DB_PATH ?? 'data/videos.sqlite'), 'lecture-capture.sqlite'), lectures, {
  extract: lectureRunner ? createLectureMediaExtractor(lectureRunner) : undefined,
  publicOrigin: process.env.CAPTURE_PUBLIC_ORIGIN,
  photo: !!lectureRunner, audio: !!lectureRunner && !!process.env.ELEVENLABS_API_KEY?.trim(),
});

const localNarration = process.env.NODE_ENV !== "production" && process.env.NARRATION_ALLOW_LOCAL === "1";
const hostname = process.env.HOST ?? (localNarration ? "127.0.0.1" : "0.0.0.0");
if (localNarration && !["127.0.0.1", "localhost", "::1"].includes(hostname)) {
  throw new Error("NARRATION_ALLOW_LOCAL requires a backend bound to loopback. Disable it when using a shared server.");
}
const handler = createHandler(process.env.FRONTEND_DIR || undefined, videos, narration, undefined, lectures, captures);
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
// Forward only this listener through private HTTPS. Never forward the anonymous desktop API.
const capturePort = process.env.CAPTURE_PORT === undefined ? undefined : Number(process.env.CAPTURE_PORT);
if (capturePort !== undefined && (!Number.isInteger(capturePort) || capturePort < 1 || capturePort > 65535)) throw new Error('CAPTURE_PORT must be an integer from 1 to 65535.');
const captureServer = capturePort === undefined ? undefined : Bun.serve({
  hostname: '127.0.0.1', port: capturePort, idleTimeout: 30,
  maxRequestBodySize: 5_100_000,
  fetch: createCaptureGateway(handler, captures),
  error() { return Response.json({detail:'Capture receiver could not respond. Please retry.'},{status:500}); },
});
if (captureServer) console.log(`Phone capture receiver listening on ${captureServer.url}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.stop(true);
  captureServer?.stop(true);
  await Promise.all([videos.close(), captures.close()]);
  await lectures.close();
  await preview?.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
