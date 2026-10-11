import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/runtime.js';
import { evaluateScene } from '../src/timeline.js';
import type { ElementHandle } from '../src/types.js';

describe('group ownership and failed construction', () => {
  it('rejects foreign handles even when their IDs match local elements', () => {
    let foreign!: ElementHandle;
    buildScene({}, s => { foreign = s.circle('same'); });
    buildScene({}, s => {
      const local = s.circle('same');
      expect(() => s.group('foreign-group', [foreign])).toThrow(/handle|scene/i);
      s.group('local-group', [local]);
    });
  });

  it('rejects duplicate children before reserving any parent membership', () => {
    const scene = buildScene({}, s => {
      const a = s.circle('a');
      expect(() => s.group('bad', [a, a])).toThrow(/duplicate|parent/i);
      s.group('good', [a]);
    });
    expect(evaluateScene(scene, 0).elements.find(e => e.id === 'good')?.geometry.children).toEqual(['a']);
  });

  it('leaves all children available after a later child or group ID fails', () => {
    buildScene({}, s => {
      const a = s.circle('a'), b = s.circle('b');
      s.group('existing-parent', [b]);
      expect(() => s.group('bad-parent', [a, b])).toThrow(/parent/i);
      expect(() => s.group('b', [a])).toThrow(/duplicate/i);
      s.group('good', [a]);
    });
  });

  it('accepts current-scene handles returned for persistent elements', () => {
    const first = buildScene({}, s => { const a = s.circle('a'); s.keep(a); });
    const previous = evaluateScene(first, 0);
    const second = buildScene({}, s => { s.group('kept', [s.previous.get('a')]); }, { previous });
    expect(evaluateScene(second, 0).elements.find(e => e.id === 'kept')?.geometry.children).toEqual(['a']);
  });
});
