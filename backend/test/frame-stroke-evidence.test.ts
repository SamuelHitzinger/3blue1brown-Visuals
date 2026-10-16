import { expect, test } from 'bun:test';
import { parseFrameEvidence, frameRenderRequest } from '../src/agents/frame-renderer.js';
import type { StrokeWarningEvidence } from '../src/agents/frame-renderer.js';

const frame = { time: 1, width: 1280, height: 720, path: 'frame.png' };
const evidence = { backend: 'fixture', frames: [frame], sheets: [{ ...frame, times: [1], columns: 1 }] };
const record = (index: number): StrokeWarningEvidence['records'][number] => ({ time:frame.time,width:frame.width,height:frame.height, warning: { kind: 'text-stroke-overlap', severity: 'warning', elements: ['label', `line-${index}`],
  bounds: {left: 1, top: 2, right: 3, bottom: 4}, elementBounds: [{left: 0, top: 0, right: 4, bottom: 4}, {left: 1, top: 2, right: 3, bottom: 4}], witness: [2, 3] } });

test('render request forwards only explicit stroke opt-in and preserves legacy shape', () => {
  const input = { source: 'source', times: [1], directory: 'fixture', signal: new AbortController().signal };
  expect(frameRenderRequest(input)).not.toHaveProperty('includeStrokeWarnings');
  expect(frameRenderRequest({...input, includeStrokeWarnings: false})).not.toHaveProperty('includeStrokeWarnings');
  expect(frameRenderRequest({...input, includeStrokeWarnings: true})).toHaveProperty('includeStrokeWarnings', true);
});

test('worker JSON preserves optional advisory records, caps and deduplicates them', () => {
  expect(parseFrameEvidence(JSON.stringify(evidence))).toEqual(evidence);
  const records = Array.from({length: 40}, (_, i) => record(i));
  records.splice(1, 0, record(0));
  const parsed = parseFrameEvidence(JSON.stringify({...evidence, strokeWarnings: { records, truncated: false, elapsedMs: 12 }}));
  expect(parsed.strokeWarnings?.records).toHaveLength(32);
  expect(parsed.strokeWarnings?.truncated).toBe(true);
  expect(parsed.strokeWarnings?.elapsedMs).toBe(12);
  expect(parsed.strokeWarnings?.records[1].warning.elements).toEqual(['label', 'line-1']);
});

test('malformed optional diagnostics cannot suppress otherwise usable rendered evidence', () => {
  const parsed = parseFrameEvidence(JSON.stringify({...evidence, strokeWarnings: {records: [{time: 'oops'}], elapsedMs: -1, truncated: false}}));
  expect(parsed.frames).toEqual(evidence.frames);
  expect(parsed.strokeWarnings?.records).toEqual([]);
  expect(parsed.strokeWarnings?.truncated).toBe(true);
});

test('worker diagnostics drop unknown payload fields and reject invalid element bounds', () => {
  const clean = record(0), oversized = {...clean, extra: 'X'.repeat(100000), warning: {...clean.warning, unexpected: 'Y'.repeat(100000)}};
  const invalid = record(1); invalid.warning.elementBounds[0].left = Infinity;
  const parsed = parseFrameEvidence(JSON.stringify({...evidence,strokeWarnings:{records:[oversized,invalid],truncated:false,elapsedMs:1,extra:'Z'.repeat(100000)}}));
  expect(parsed.strokeWarnings?.records).toHaveLength(1);
  expect(parsed.strokeWarnings?.truncated).toBe(true);
  expect(JSON.stringify(parsed.strokeWarnings).length).toBeLessThan(1000);
  expect(parsed.strokeWarnings?.records[0].warning).toEqual(clean.warning);
  expect(parsed.strokeWarnings?.records[0]).not.toHaveProperty('extra');
});
