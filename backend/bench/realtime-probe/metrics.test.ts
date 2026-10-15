import { describe, expect, test } from 'bun:test';
import { createTextMetrics, observeText, finishText, safeFailure } from './metrics.js';

describe('model-only streaming observations', () => {
  test('fragmented records, blank lines and JSON completion have distinct timings', () => {
    const state = createTextMetrics('ops');
    observeText(state, '\n', 1);
    observeText(state, '{"op":', 12);
    observeText(state, '"add"}\n{"op":"commit"}', 18);
    expect(state.firstTextMs).toBe(12);
    expect(state.firstLineMs).toBe(18);
    expect(state.firstJsonRecordMs).toBe(18);
    expect(state.completeLines).toBe(1);
    finishText(state, 25, true);
    expect(state.completeOutputMs).toBe(25);
    expect(state.completeLines).toBe(2);
  });
  test('a native JS line is not reported as an executable or JSON record', () => {
    const state = createTextMetrics('native-js');
    observeText(state, 'export default scene({\n', 4);
    finishText(state, 8, false);
    expect(state.firstLineMs).toBe(4);
    expect(state.firstJsonRecordMs).toBeNull();
    expect(state.completeOutputMs).toBeNull();
  });
  test('an unterminated final line is only counted on successful completion', () => {
    const failed = createTextMetrics('ops');
    observeText(failed, '{"op":"commit"}', 3);
    finishText(failed, 10, false);
    expect(failed.firstLineMs).toBeNull();
    const completed = createTextMetrics('ops');
    observeText(completed, '{"op":"commit"}', 3);
    finishText(completed, 10, true);
    expect(completed.firstLineMs).toBe(10);
  });
  test('errors never echo provider messages or arbitrary error codes', () => {
    expect(JSON.stringify(safeFailure(new Error('secret token bearer example')))).not.toContain('secret');
    expect(JSON.stringify(safeFailure({ code: 'SECRET', message: 'private' }))).not.toContain('SECRET');
  });
});
