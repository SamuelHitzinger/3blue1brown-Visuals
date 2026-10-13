import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioClock, AudioPlaybackError } from "../src/audio.js";
import type { CompiledScene } from "../src/types.js";

function scene(audio?: string, duration = 2): CompiledScene {
  return {
    options: { mode: "2d", end: "hold", orbit: false, background: "BLACK", audio },
    duration, controls: [], initial: [], lifecycle: [], tracks: [],
    camera: { yaw: 0, pitch: 0, target: [0, 0, 0], height: 8, distance: 10, perspective: 0 },
  };
}

function setup() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "suspended", currentTime: 0, destination: {},
    createGain: vi.fn(() => gain),
    decodeAudioData: vi.fn(async () => ({ duration: 5 })),
    createBufferSource: vi.fn(() => {
      const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
      sources.push(source);
      return source;
    }),
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => {}),
  };
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  vi.stubGlobal("fetch", fetch);
  const clock = new AudioClock({ voice: { kind: "audio", url: "/voice.wav" } }, () => context as unknown as AudioContext);
  return { clock, context, gain, sources, fetch };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("scene audio clock", () => {
  it('registers later assets without disturbing playing audio and rejects changed URLs', async () => {
    const { clock, sources, fetch } = setup();
    await clock.prepare([scene('voice')]); await clock.start('voice', 0);
    clock.register({ next: { kind: 'audio', url: '/next.wav' } });
    await clock.prepare([scene('next')]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sources[0].stop).not.toHaveBeenCalled();
    expect(() => clock.register({ next: { kind: 'audio', url: '/changed.wav' } })).toThrow('immutable');
    clock.dispose();
  });
  it("prepares duration without starting predecessor audio, and caches decoded assets", async () => {
    const { clock, context, fetch } = setup();
    const scenes = [scene("voice"), scene("voice", 8), scene(undefined, 3)];
    await clock.prepare(scenes);
    expect(scenes.map(scene => scene.duration)).toEqual([5, 8, 3]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
    clock.dispose();
  });

  it("rejects unregistered audio instead of fetching a scene-supplied URL", async () => {
    const { clock, fetch } = setup();
    await expect(clock.prepare([scene("https://unapproved.example/audio")])).rejects.toThrow("Unknown audio asset");
    expect(fetch).not.toHaveBeenCalled();
    clock.dispose();
  });

  it("anchors playback, pause, seek, restart, and muted output to one audio clock", async () => {
    const { clock, context, gain, sources } = setup();
    clock.setMuted(true);
    await clock.prepare([scene("voice")]);
    expect(gain.gain.value).toBe(0);
    context.currentTime = 20;
    expect(await clock.start("voice", 1.5)).toBe(true);
    expect(sources[0].start).toHaveBeenCalledWith(0, 1.5);
    context.currentTime = 21;
    expect(clock.time).toBe(2.5);
    expect(clock.stop()).toBe(2.5);
    expect(sources[0].stop).toHaveBeenCalledOnce();
    context.currentTime = 30;
    expect(clock.time).toBe(2.5);
    await clock.start("voice", 0);
    expect(sources[1].start).toHaveBeenCalledWith(0, 0);
    context.currentTime = 31;
    expect(clock.time).toBe(1);
    clock.setMuted(false);
    expect(gain.gain.value).toBe(1);
    clock.dispose();
    expect(sources[1].stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("continues the scene clock after the track ends without starting an invalid offset", async () => {
    const { clock, context, sources } = setup();
    await clock.prepare([scene("voice", 10)]);
    await clock.start("voice", 6);
    expect(sources).toHaveLength(0);
    context.currentTime = 2;
    expect(clock.time).toBe(8);
    clock.dispose();
  });

  it("cancels pending browser audio resume when paused", async () => {
    const { clock, context } = setup();
    await clock.prepare([scene("voice")]);
    let resume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = () => { context.state = "running"; resolve(); }; }));
    const starting = clock.start("voice", 0);
    clock.stop();
    resume();
    expect(await starting).toBe(false);
    expect(context.createBufferSource).not.toHaveBeenCalled();
    clock.dispose();
  });

  it("reports blocked audio and can retry from a later user gesture", async () => {
    const { clock, context } = setup();
    await clock.prepare([scene("voice")]);
    context.resume.mockImplementationOnce(async () => {});
    await expect(clock.start("voice", 1)).rejects.toThrow("blocked");
    expect(await clock.start("voice", 1)).toBe(true);
    clock.dispose();
  });

  it('preserves the cause of a recoverable browser permission rejection', async () => {
    const { clock, context } = setup();
    const cause = new DOMException('User gesture required', 'NotAllowedError');
    await clock.prepare([scene('voice')]);
    context.resume.mockRejectedValueOnce(cause);
    const error = await clock.start('voice', 1).catch(error => error);
    expect(error).toBeInstanceOf(AudioPlaybackError);
    expect(error.cause).toBe(cause);
    expect(await clock.start('voice', 1)).toBe(true);
    clock.dispose();
  });

  it('does not offer gesture recovery for a closed audio context or an unprepared track', async () => {
    const { clock, context } = setup();
    const missing = await clock.start('missing', 0).catch(error => error);
    expect(missing).toBeInstanceOf(Error);
    expect(missing).not.toBeInstanceOf(AudioPlaybackError);
    await clock.prepare([scene('voice')]);
    context.state = 'closed';
    context.resume.mockImplementationOnce(async () => {});
    const closed = await clock.start('voice', 0).catch(error => error);
    expect(closed).toBeInstanceOf(Error);
    expect(closed).not.toBeInstanceOf(AudioPlaybackError);
    clock.dispose();
  });
});
