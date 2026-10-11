import { NarrationError } from "./errors.js";
import { sampleCount, SAMPLE_RATE } from "./audio.js";
import { validateAlignment } from "./alignment.js";
import type { SpeechResult, SpeechSettings, SynthesisInput } from "./types.js";

export function settingsFromEnv(env: Record<string, string | undefined> = process.env): SpeechSettings {
  return { voiceId: env.ELEVENLABS_VOICE_ID ?? "", modelId: env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2", outputFormat: "pcm_24000",
    // Give Alexander a highly animated delivery, with broad variation and strong expressive emphasis.
    voiceSettings: { stability: 0.15, similarity_boost: 0.75, style: 0.9, use_speaker_boost: true, speed: 1.12 } };
}
export interface SpeechProvider {
  settings: SpeechSettings;
  synthesize(input: SynthesisInput): Promise<SpeechResult>;
}
export function createElevenLabs(settings: SpeechSettings, key = process.env.ELEVENLABS_API_KEY, fetcher: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): SpeechProvider {
  return { settings, async synthesize(input) {
    if (!key || !settings.voiceId) throw new NarrationError("NOT_CONFIGURED", "Set ELEVENLABS_API_KEY and an available ELEVENLABS_VOICE_ID on the server.", 503);
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.voiceId)}/with-timestamps?output_format=${settings.outputFormat}`, {
          method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({ text: input.text, model_id: settings.modelId, voice_settings: settings.voiceSettings,
            previous_text: input.previousText || undefined, next_text: input.nextText || undefined, apply_text_normalization: "auto" }),
        });
      } catch {
        // A timed-out POST may already have generated/billed audio; don't repeat it automatically.
        throw new NarrationError("PROVIDER_OUTCOME_UNKNOWN", "The speech request disconnected or timed out. Its billing outcome is unknown; explicitly retry to continue.", 502, true);
      }
      if (!response.ok) {
        const raw = await response.json().catch(() => null) as { detail?: { status?: string } } | null;
        const code = raw?.detail?.status;
        if (code === "quota_exceeded" || code === "insufficient_credits") throw new NarrationError("QUOTA", "ElevenLabs has insufficient credits for this narration.", 402);
        if (response.status === 401 || response.status === 403) throw new NarrationError("PROVIDER_AUTH", "ElevenLabs rejected the API key, permissions, voice, or audio format access.", 502);
        if (response.status === 404 || code === 'voice_not_found') throw new NarrationError("VOICE_UNAVAILABLE", "The configured voice is unavailable to this ElevenLabs account. Select an available ELEVENLABS_VOICE_ID.", 502);
        if ((response.status === 429 || response.status === 503) && attempt < 2) {
          const seconds = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 30_000) : 1000 * 2 ** attempt); continue;
        }
        throw new NarrationError("PROVIDER_REJECTED", `ElevenLabs rejected speech generation (HTTP ${response.status}).`, 502, response.status >= 500 || response.status === 429);
      }
      let data: { audio_base64?: string; alignment?: unknown; normalized_alignment?: unknown };
      try { data = await response.json(); } catch { throw new NarrationError("PROVIDER_INVALID", "ElevenLabs returned unreadable audio data.", 502); }
      if (typeof data.audio_base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio_base64) || data.audio_base64.length > 80_000_000) {
        throw new NarrationError("AUDIO_INVALID", "ElevenLabs returned invalid audio data.", 502);
      }
      const pcm = new Uint8Array(Buffer.from(data.audio_base64, "base64"));
      const duration = sampleCount(pcm) / SAMPLE_RATE;
      validateAlignment(data.normalized_alignment, duration);
      let alignment;
      if (data.alignment) { validateAlignment(data.alignment, duration); alignment = data.alignment; }
      return { pcm, normalizedAlignment: data.normalized_alignment, alignment, requestId: response.headers.get("request-id") ?? undefined };
    }
    throw new NarrationError("PROVIDER_REJECTED", "Speech generation exhausted its retry limit.", 502, true);
  } };
}
