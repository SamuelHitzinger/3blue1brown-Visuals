import { expect, test } from 'bun:test';
import { createLectureTranscriber, lectureTranscriptionConfig } from '../src/lecture-transcription.js';

const clip = new File(['audio'], 'clip.webm', { type: 'audio/webm' });
const signal = () => new AbortController().signal;

test('configured Deepgram receives audio bytes and multilingual options, silence is valid', async () => {
  let calls = 0;
  const transcribe = createLectureTranscriber({ provider: 'deepgram', apiKey: 'test-key' }, async (url, init) => {
    calls++; expect(new URL(url).searchParams.get('detect_language')).toBe('true');
    expect(new URL(url).searchParams.get('model')).toBe('nova-3');
    expect(new Headers(init.headers).get('Authorization')).toBe('Token test-key');
    expect(init.body).toBe(clip);
    return Response.json({ results: { channels: [{ alternatives: [{ transcript: calls === 1 ? 'A vector.' : '' }] }] } });
  });
  expect(await transcribe(clip, signal())).toBe('A vector.');
  expect(await transcribe(clip, signal())).toBe('');
});

test('transient transcription failure retries; quota failures give actionable errors without retry or leakage', async () => {
  let attempts = 0;
  const transcribe = createLectureTranscriber({ provider: 'elevenlabs', apiKey: 'test-key' }, async (_url, init) => {
    expect((init.body as FormData).get('model_id')).toBe('scribe_v2');
    return ++attempts === 1 ? new Response('private provider error', { status: 503 }) : Response.json({ text: 'Recovered speech.' });
  });
  expect(await transcribe(clip, signal())).toBe('Recovered speech.'); expect(attempts).toBe(2);
  attempts = 0;
  const quota = createLectureTranscriber({ provider: 'elevenlabs', apiKey: 'test-key' }, async () => {
    attempts++; return Response.json({ detail: { status: 'quota_exceeded', message: 'private balance secret' } }, { status: 401 });
  });
  await expect(quota(clip, signal())).rejects.toThrow(/credits/);
  expect(attempts).toBe(1);
});

test('missing keys, auth, malformed responses and cancellation cannot become silent transcripts', async () => {
  expect(lectureTranscriptionConfig({ LECTURE_TRANSCRIPTION_PROVIDER: 'deepgram', DEEPGRAM_API_KEY: 'key' }).apiKey).toBe('key');
  expect(() => lectureTranscriptionConfig({ LECTURE_TRANSCRIPTION_PROVIDER: 'typo' })).toThrow();
  await expect(createLectureTranscriber({ provider: 'deepgram', apiKey: '' })(clip, signal())).rejects.toThrow(/not connected/);
  const auth = createLectureTranscriber({ provider: 'deepgram', apiKey: 'key' }, async () => new Response('secret', { status: 403 }));
  await expect(auth(clip, signal())).rejects.toThrow(/key/);
  const malformed = createLectureTranscriber({ provider: 'deepgram', apiKey: 'key' }, async () => Response.json({}));
  await expect(malformed(clip, signal())).rejects.toThrow(/invalid/);
  let calls = 0;
  const controller = new AbortController();
  const cancelled = createLectureTranscriber({ provider: 'deepgram', apiKey: 'key' }, async () => { calls++; controller.abort(); return new Response('', { status: 503 }); });
  await expect(cancelled(clip, controller.signal)).rejects.toThrow(); expect(calls).toBe(1);
});
