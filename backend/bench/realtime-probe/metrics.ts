import { agentFailure } from '../../src/agents/config.js';

export type Format = 'native-js' | 'ops';
export function createTextMetrics(format: Format) {
  return { format, text: '', pendingLine: '', firstTextMs: null as number | null,
    firstLineMs: null as number | null, firstJsonRecordMs: null as number | null,
    completeOutputMs: null as number | null, completeLines: 0, jsonRecords: 0 };
}
export type TextMetrics = ReturnType<typeof createTextMetrics>;
function line(state: TextMetrics, value: string, elapsedMs: number) {
  if (!value.trim()) return;
  state.firstLineMs ??= elapsedMs;
  state.completeLines++;
  if (state.format !== 'ops') return;
  try {
    const record = JSON.parse(value);
    if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.op !== 'string') return;
    state.firstJsonRecordMs ??= elapsedMs;
    state.jsonRecords++;
  } catch { /* A completed line need not be valid JSON. No semantic validation here. */ }
}
export function observeText(state: TextMetrics, delta: string, elapsedMs: number) {
  state.text += delta;
  if (delta.trim()) state.firstTextMs ??= elapsedMs;
  const lines = (state.pendingLine + delta).split('\n');
  state.pendingLine = lines.pop()!;
  for (const value of lines) line(state, value, elapsedMs);
}
export function finishText(state: TextMetrics, elapsedMs: number, successful: boolean) {
  if (!successful) return;
  line(state, state.pendingLine, elapsedMs);
  state.pendingLine = '';
  state.completeOutputMs = elapsedMs;
}
export function safeFailure(error: unknown) {
  const failure = agentFailure(error);
  // Never persist raw provider errors, credentials, headers, or arbitrary codes.
  const allowed = new Set(['CONFIG', 'AUTH', 'MODEL', 'LIMIT', 'PROVIDER']);
  return { code: allowed.has(failure.code) ? failure.code : 'PROVIDER',
    reason: failure.diagnostics.reason ?? 'unknown', httpStatus: failure.diagnostics.httpStatus ?? null };
}
