import { expect, test } from 'bun:test';
import { cacheValidatedSources } from '../src/agents/validated-source-cache.js';

test('successful validation is reused only within matching asset revision and four-source budget', async () => {
  let calls = 0, revision = 0;
  const validate = cacheValidatedSources(async source => { calls++; return { source }; }, () => revision, new AbortController().signal);
  const first = await validate('one');
  expect(await validate('one')).toBe(first); expect(calls).toBe(1);
  revision++;
  expect(await validate('one')).not.toBe(first); expect(calls).toBe(2);
  for (const source of ['two', 'three', 'four', 'five']) await validate(source);
  await validate('one'); expect(calls).toBe(7);
});

test('failed, aborted, and superseded validation never enters reusable cache', async () => {
  let calls = 0, revision = 0;
  const controller = new AbortController();
  const validate = cacheValidatedSources(async source => {
    calls++;
    if (source === 'bad') throw new Error('invalid');
    if (source === 'asset-change') revision++;
    if (source === 'abort') controller.abort(new Error('cancelled'));
    return source;
  }, () => revision, controller.signal);
  await expect(validate('bad')).rejects.toThrow('invalid');
  await expect(validate('bad')).rejects.toThrow('invalid'); expect(calls).toBe(2);
  await validate('asset-change'); await validate('asset-change'); expect(calls).toBe(4);
  await validate('good');
  await expect(validate('abort')).rejects.toThrow('cancelled');
  await expect(validate('good')).rejects.toThrow('cancelled'); expect(calls).toBe(6);
});
