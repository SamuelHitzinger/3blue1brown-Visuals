import { expect, test } from 'bun:test';
import { replacePromptFragments } from './prompt-substitution';

test('substitutes exact original fragments in one pass without rewriting inserted text', () => {
  const result = replacePromptFragments('prefix alpha beta suffix', {
    first: { original: 'alpha', candidate: 'beta alpha' },
    second: { original: 'beta', candidate: 'gamma' },
  });
  expect(result.text).toBe('prefix beta alpha gamma suffix');
  expect(result.matches).toEqual({ first: 1, second: 1 });
});

test('records unchanged baseline fragments and leaves unrelated host contracts intact', () => {
  const result = replacePromptFragments('contract\n(policy).*\nrequest', {
    policy: { original: '(policy).*', candidate: '(policy).*' },
  });
  expect(result.text).toBe('contract\n(policy).*\nrequest');
  expect(result.matches).toEqual({ policy: 1 });
});

test('rejects ambiguous identical originals with different replacements', () => {
  expect(() => replacePromptFragments('same', {
    one: { original: 'same', candidate: 'one' },
    two: { original: 'same', candidate: 'two' },
  })).toThrow('Ambiguous');
});
