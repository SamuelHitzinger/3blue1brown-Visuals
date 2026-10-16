import { expect, test } from 'bun:test';
import { overlapInput } from './realtime-asr-overlap-probe.js';

const chunk = (index: number, value: number) => ({ index, sourceStartSec: 885 + index * 4,
  sourceEndSec: 889 + index * 4, sourceReadyAtMs: (index + 1) * 4000, readStartedAtMs: (index + 1) * 4000,
  pcm: Buffer.alloc(128000, value) });

test('independent arm uses current four seconds; overlap uses only released previous/current PCM', () => {
  const previous = chunk(0, 10), current = chunk(1, 20);
  const alone = overlapInput(previous, current, 'independent');
  expect(alone.sourceStartSec).toBe(889); expect(alone.sourceEndSec).toBe(893);
  expect(alone.pcm.equals(current.pcm)).toBe(true);
  const rolling = overlapInput(previous, current, 'rolling');
  expect(rolling.sourceStartSec).toBe(885); expect(rolling.sourceEndSec).toBe(893);
  expect(rolling.pcm.length).toBe(256000);
  expect(rolling.pcm.subarray(0, 128000).equals(previous.pcm)).toBe(true);
  expect(rolling.pcm.subarray(128000).equals(current.pcm)).toBe(true);
});

test('first endpoint is identical four-second control in both arms', () => {
  const current = chunk(0, 30);
  expect(overlapInput(undefined, current, 'rolling')).toEqual(overlapInput(undefined, current, 'independent'));
});

test('rejects missing, noncontiguous or malformed released context', () => {
  expect(() => overlapInput(undefined, chunk(1, 0), 'rolling')).toThrow('previous');
  expect(() => overlapInput(chunk(0, 0), chunk(2, 0), 'rolling')).toThrow('contiguous');
  expect(() => overlapInput(undefined, { ...chunk(0, 0), pcm: Buffer.alloc(1) }, 'rolling')).toThrow('four-second');
  expect(() => overlapInput(chunk(0, 0), { ...chunk(1, 0), sourceStartSec: 888 }, 'rolling')).toThrow('four-second');
});
