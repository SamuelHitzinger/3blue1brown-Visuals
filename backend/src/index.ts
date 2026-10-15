import { createHandler } from "./server.js";
import { createCaptureGateway } from './capture-gateway.js';
import { createLectureWorkflow } from './lecture-workflow.js';
import { createVideoWorkflow } from './video-workflow.js';

const videoWorkflow = createVideoWorkflow();
const lectureWorkflow = createLectureWorkflow();
const { videos, narration } = videoWorkflow;
const { lectures, captures, liveBridge } = lectureWorkflow;

const localNarration = process.env.NODE_ENV !== "production" && process.env.NARRATION_ALLOW_LOCAL === "1";
const hostname = process.env.HOST ?? (localNarration ? "127.0.0.1" : "0.0.0.0");
if (localNarration && !["127.0.0.1", "localhost", "::1"].includes(hostname)) {
  throw new Error("NARRATION_ALLOW_LOCAL requires a backend bound to loopback. Disable it when using a shared server.");
}
const handler = createHandler(process.env.FRONTEND_DIR || undefined, videos, narration, undefined, lectures, captures, liveBridge);
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
// Capture-only links use this restricted listener. Full website sharing requires
// a separately authorized, access-controlled proxy and explicit APP_PUBLIC_ORIGIN.
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
  await Promise.all([videoWorkflow.close(), lectureWorkflow.close()]);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
