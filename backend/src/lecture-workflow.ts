import { LectureService } from './lectures.js';
import { LectureCaptureService } from './lecture-capture.js';
import { createLectureMediaExtractor } from './lecture-media.js';
import { lectureTranscriptionConfig } from './lecture-transcription.js';
import { lectureAgentConfig, lectureWorkflowConfig } from './agents/lecture-config.js';
import { PiAgentRunner } from './agents/runtime.js';
import type { AgentRunner } from './agents/runtime.js';
import type { AgentConfig } from './agents/config.js';
import { generateLectureNotes } from './agents/lecture.js';
import { createLectureVisualGenerator } from './agents/lecture-visual.js';
import { ChromiumScenePreview } from './agents/scene-preview.js';
import type { ScenePreviewRenderer } from './agents/scene-preview.js';

type Environment = Record<string, string | undefined>;
interface Dependencies {
  createRunner?: (config: AgentConfig) => AgentRunner;
  createPreview?: () => ScenePreviewRenderer & { close(): Promise<void> };
}

/** Owns all private notebook jobs; has no full-video service or generator dependency. */
export function createLectureWorkflow(env: Environment = process.env, dependencies: Dependencies = {}) {
  const settings = lectureWorkflowConfig(env);
  const createRunner = dependencies.createRunner ?? (config => new PiAgentRunner(config));
  const notesRunner = settings.notesEnabled ? createRunner(lectureAgentConfig('notes', env)) : undefined;
  const liveRunner = settings.notesEnabled ? createRunner(lectureAgentConfig('live-notes', env)) : undefined;
  const visualConfig = settings.visualsEnabled ? lectureAgentConfig('visual', env) : undefined;
  // Hardware/browser location may be shared; the queue and browser lifecycle are not.
  const preview = visualConfig && settings.previewEnabled ? (dependencies.createPreview?.() ?? new ChromiumScenePreview(
    env.LECTURE_SCENE_PREVIEW_CHROMIUM ?? env.SCENE_PREVIEW_CHROMIUM,
    (env.LECTURE_SCENE_PREVIEW_NO_SANDBOX ?? env.SCENE_PREVIEW_NO_SANDBOX) === '1',
  )) : undefined;
  const lectures = new LectureService(settings.dbPath,
    notesRunner ? (input, signal) => generateLectureNotes(input.previousNotes && input.previousSourceRevision ? liveRunner! : notesRunner, input, signal) : undefined,
    { visualize: visualConfig ? createLectureVisualGenerator(createRunner(visualConfig), visualConfig.dataDir,
      { preview, reviewRunner: createRunner(lectureAgentConfig('visual-review', env)) }) : undefined,
      synthesisDebounceMs: 150, concurrency: 3 });
  const transcription = lectureTranscriptionConfig(env);
  const captures = new LectureCaptureService(settings.captureDbPath, lectures, {
    extract: notesRunner ? createLectureMediaExtractor(notesRunner, { transcription }) : undefined,
    publicOrigin: env.CAPTURE_PUBLIC_ORIGIN,
    photo: !!notesRunner, audio: !!notesRunner && !!transcription.apiKey,
    transcriptionProvider: transcription.provider === 'deepgram' ? 'Deepgram' : 'ElevenLabs',
  });
  return { lectures, captures, async close() {
    await captures.close();
    await lectures.close();
    await preview?.close();
  } };
}
