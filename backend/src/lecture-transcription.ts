import { setTimeout as delay } from 'node:timers/promises';

export interface LectureTranscriptionConfig {
  provider: 'elevenlabs' | 'deepgram';
  apiKey?: string;
  language?: string;
}
export class LectureTranscriptionError extends Error {}
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export function lectureTranscriptionConfig(env: Record<string, string | undefined> = process.env): LectureTranscriptionConfig {
  const provider = env.LECTURE_TRANSCRIPTION_PROVIDER?.trim() || 'elevenlabs';
  if (provider !== 'elevenlabs' && provider !== 'deepgram') throw new Error('LECTURE_TRANSCRIPTION_PROVIDER must be elevenlabs or deepgram.');
  return { provider, apiKey: env[provider === 'deepgram' ? 'DEEPGRAM_API_KEY' : 'ELEVENLABS_API_KEY']?.trim(),
    language: env.LECTURE_TRANSCRIPTION_LANGUAGE?.trim() || undefined };
}

/** Complete short recordings permit durable retries after a lost connection. */
export function createLectureTranscriber(config: LectureTranscriptionConfig, fetcher: Fetcher = fetch) {
  return async (file: File, signal: AbortSignal): Promise<string> => {
    signal.throwIfAborted();
    const label = config.provider === 'deepgram' ? 'Deepgram' : 'ElevenLabs';
    if (!config.apiKey?.trim()) throw new LectureTranscriptionError(`${label} transcription is not connected. Configure its server API key, then retry the saved audio.`);
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
    let url: string, body: BodyInit, headers: Record<string, string>;
    if (config.provider === 'deepgram') {
      const query = new URLSearchParams({ model: 'nova-3', smart_format: 'true' });
      if (config.language) query.set('language', config.language); else query.set('detect_language', 'true');
      url = `https://api.deepgram.com/v1/listen?${query}`;
      body = file; headers = { Authorization: `Token ${config.apiKey}`, 'Content-Type': file.type };
    } else {
      url = 'https://api.elevenlabs.io/v1/speech-to-text';
      const form = new FormData(); form.set('file', file); form.set('model_id', 'scribe_v2'); form.set('tag_audio_events', 'false');
      if (config.language) form.set('language_code', config.language);
      body = form; headers = { 'xi-api-key': config.apiKey };
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      requestSignal.throwIfAborted();
      let response: Response;
      try { response = await fetcher(url, { method: 'POST', headers, body, signal: requestSignal }); }
      catch {
        requestSignal.throwIfAborted();
        if (attempt === 2) break;
        await delay(500 * 2 ** attempt, undefined, { signal: requestSignal }); continue;
      }
      requestSignal.throwIfAborted();
      // Provider bodies may contain account data. Only interpret known error codes.
      const result = await response.json().catch(() => null);
      requestSignal.throwIfAborted();
      if (response.ok) {
        const text = config.provider === 'deepgram' ? result?.results?.channels?.[0]?.alternatives?.[0]?.transcript : result?.text;
        if (typeof text !== 'string' || text.length > 40_000) throw new LectureTranscriptionError(`${label} returned an invalid transcript. The recording is saved for retry.`);
        return text.trim();
      }
      const code = result?.detail?.status ?? result?.err_code;
      if (response.status === 402 || ['quota_exceeded', 'insufficient_credits', 'INSUFFICIENT_CREDITS'].includes(code))
        throw new LectureTranscriptionError(`${label} has insufficient credits. Restore credits or configure another transcription provider, then retry the saved audio.`);
      if ([401, 403].includes(response.status)) throw new LectureTranscriptionError(`${label} transcription is unavailable because its key or permissions were rejected. Fix the server connection, then retry the saved audio.`);
      if (response.status !== 429 && response.status < 500) throw new LectureTranscriptionError(`${label} could not transcribe this recording. The audio is saved for retry.`);
      const retryAfter = response.headers.get('Retry-After') ?? '';
      const retryMs = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
      if (attempt === 2 || retryMs > 10_000) break;
      await delay(Math.max(retryMs, 500 * 2 ** attempt), undefined, { signal: requestSignal });
    }
    throw new LectureTranscriptionError(`${label} transcription is temporarily unavailable after retries. The audio is saved; retry processing shortly.`);
  };
}
