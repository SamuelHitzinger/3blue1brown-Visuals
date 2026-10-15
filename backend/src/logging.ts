import { AgentError } from './agents/config.js';

/** Only host-owned identifiers and metrics belong here: never prompts, headers, or error messages. */
export interface LogFields {
  videoId?: string;
  narrationId?: string;
  lectureId?: string;
  captureId?: string;
  sourceRevision?: number;
  pendingSources?: number;
  validationFailures?: number;
  stage?: 'sources' | 'script' | 'draft' | 'review' | 'repair' | 'narration' | 'scene' | 'thumbnail' | 'lecture-notes' | 'lecture-photo' | 'lecture-audio';
  sceneIndex?: number;
  sceneCount?: number;
  attempt?: number;
  completedChunks?: number;
  totalChunks?: number;
  elapsedMs?: number;
  providerCalls?: number;
  providerMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  warnings?: number;
  frames?: number;
  cached?: boolean;
  resumed?: boolean;
  code?: string;
  agentRunId?: string;
  providerAttempt?: number;
  retryDelayMs?: number;
  retryable?: boolean;
  reason?: AgentError['diagnostics']['reason'];
  httpStatus?: number;
}

export function logEvent(event: string, fields: LogFields = {}, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }));
  } catch { /* A broken log sink must not fail generation or hide its original error. */ }
}

/** Emit a heartbeat during slow model/speech stages, not on every poll or token. */
export async function logStage<T>(fields: LogFields, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const progress = () => ({ ...fields, elapsedMs: Math.round(performance.now() - started) });
  logEvent('stage.started', fields);
  const heartbeat = setInterval(() => logEvent('stage.running', progress()), 30_000);
  heartbeat.unref();
  try {
    const result = await operation();
    logEvent('stage.completed', progress());
    return result;
  } catch (error) {
    const code = error instanceof AgentError ? error.code : 'STAGE';
    logEvent('stage.failed', { ...progress(), code, ...(error instanceof AgentError ? error.diagnostics : {}) }, 'error');
    throw error;
  } finally { clearInterval(heartbeat); }
}
