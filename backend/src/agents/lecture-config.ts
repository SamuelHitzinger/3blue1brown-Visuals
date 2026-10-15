import { dirname, join } from 'node:path';
import { agentConfig } from './config.js';

type Environment = Record<string, string | undefined>;
type LectureRole = 'notes' | 'live-notes' | 'visual' | 'visual-review';

/** Share authentication only; video model, timing and job settings never enter notes. */
export function lectureAgentConfig(role: LectureRole, env: Environment = process.env) {
  const visual = role === 'visual' || role === 'visual-review';
  return agentConfig({
    AGENT_AUTH_MODE: env.AGENT_AUTH_MODE,
    AGENT_PROVIDER: env.AGENT_PROVIDER,
    PI_CODING_AGENT_DIR: env.PI_CODING_AGENT_DIR,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    AGENT_DATA_DIR: env.LECTURE_AGENT_DATA_DIR ?? 'data/lecture-agents',
    AGENT_MODEL: role === 'visual-review' ? env.LECTURE_VISUAL_REVIEW_MODEL ?? env.LECTURE_VISUAL_MODEL ?? 'gpt-6-astra'
      : visual ? env.LECTURE_VISUAL_MODEL ?? 'gpt-6-astra' : env.LECTURE_MODEL ?? 'gpt-6.1-sol',
    AGENT_THINKING: role === 'live-notes' ? 'minimal' : role === 'visual-review' ? 'high' : 'medium',
  });
}

export function lectureWorkflowConfig(env: Environment = process.env) {
  const enabled = (key: string) => {
    const value = env[key] ?? 'pi';
    if (value !== 'pi' && value !== 'disabled') throw new Error(`${key} must be pi or disabled.`);
    return value === 'pi';
  };
  const dbPath = env.LECTURE_DB_PATH ?? 'data/lectures.sqlite';
  return {
    notesEnabled: enabled('LECTURE_GENERATOR'),
    visualsEnabled: enabled('LECTURE_VISUAL_GENERATOR'),
    previewEnabled: env.LECTURE_SCENE_PREVIEW !== '0',
    dbPath,
    captureDbPath: env.CAPTURE_DB_PATH ?? join(dirname(dbPath), 'lecture-capture.sqlite'),
    liveBridgeDbPath: env.LIVE_BRIDGE_DB_PATH ?? join(dirname(dbPath), 'lecture-live-bridge.sqlite'),
  };
}
