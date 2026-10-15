import { VideoService } from './videos.js';
import { NarrationService } from './narration/service.js';
import { agentConfig } from './agents/config.js';
import { PiAgentRunner } from './agents/runtime.js';
import { createPiGenerator } from './agents/generator.js';
import { createThumbnailGenerator, thumbnailAgentConfig } from './agents/thumbnail.js';
import { ChromiumScenePreview } from './agents/scene-preview.js';

/** Full-video composition owns storyline, narration, scene policy and library jobs. */
export function createVideoWorkflow(env: Record<string, string | undefined> = process.env) {
  const generation = env.VIDEO_GENERATOR ?? 'pi';
  if (generation !== 'pi' && generation !== 'simulated') throw new Error('VIDEO_GENERATOR must be pi or simulated.');
  const narration = new NarrationService();
  const config = generation === 'pi' ? agentConfig(env) : undefined;
  const preview = config && env.SCENE_PREVIEW !== '0'
    ? new ChromiumScenePreview(env.SCENE_PREVIEW_CHROMIUM, env.SCENE_PREVIEW_NO_SANDBOX === '1') : undefined;
  const videos = new VideoService(env.VIDEO_DB_PATH ?? 'data/videos.sqlite',
    config ? createPiGenerator(new PiAgentRunner(config), narration, config.dataDir,
      { outputMode: config.sceneOutputMode, timingMode: config.sceneTimingMode, preview }) : undefined, generation,
    config ? createThumbnailGenerator(new PiAgentRunner(thumbnailAgentConfig(env))) : undefined);
  return { videos, narration, async close() {
    await videos.close();
    await preview?.close();
  } };
}
