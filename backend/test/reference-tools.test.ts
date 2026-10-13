import { expect, test } from 'bun:test';
import { createReferenceTools } from '../src/agents/reference-tools.js';

const signal = new AbortController().signal;
const section = { id: 'recipe', title: 'A complete recipe', content: '0123456789'.repeat(3501) };

test('bounded reference pages reconstruct complete text without truncation', async () => {
  const tools = createReferenceTools([section]);
  const pieces: string[] = [];
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const page = await tools.read({ id: 'recipe', offset }, signal);
    expect(page.content.length).toBeLessThanOrEqual(12_000);
    expect(page.totalChars).toBe(section.content.length);
    pieces.push(page.content); offset = page.nextOffset;
  }
  expect(pieces.join('')).toBe(section.content);
});

test('reference lookup only accepts known IDs and bounded integer windows', async () => {
  const tools = createReferenceTools([section]);
  for (const input of [{ id: '../reference.md' }, { id: 'missing' }, { id: 'recipe', offset: -1 },
    { id: 'recipe', offset: 0.5 }, { id: 'recipe', limit: 16_001 }, { id: 'recipe', limit: 999 },
    { id: 'recipe', offset: section.content.length + 1 }]) {
    await expect(tools.read(input, signal)).rejects.toThrow();
  }
  expect((await tools.read({ id: 'recipe', limit: 16_000 }, signal)).content).toHaveLength(16_000);
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await expect(tools.read({ id: 'recipe' }, controller.signal)).rejects.toThrow('cancelled');
  expect(() => createReferenceTools([section, section])).toThrow('Duplicate');
});

test('reference tools retain an immutable snapshot for author and reviewer', async () => {
  const copy = { ...section };
  const tools = createReferenceTools([copy]); copy.content = 'changed';
  expect((await tools.read({ id: copy.id }, signal)).content).toBe(section.content.slice(0, 12_000));
});
