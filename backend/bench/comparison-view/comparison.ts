const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const play = byId<HTMLButtonElement>('play'), seek = byId<HTMLInputElement>('seek');
const status = byId('status'), clockLabel = byId('time');
const frames = ['baseline', 'candidate'].map(id => byId<HTMLIFrameElement>(id));
const ready = new Map<string, Promise<any>>(frames.map(frame => [frame.id, new Promise((resolve, reject) => {
  if ((frame.contentWindow as any)?.comparisonError) { reject(new Error((frame.contentWindow as any).comparisonError)); return; }
  if ((frame.contentWindow as any)?.comparisonArm) { resolve((frame.contentWindow as any).comparisonArm); return; }
  const listener = (event: MessageEvent) => {
    if (event.origin === location.origin && event.source === frame.contentWindow && ['comparison-arm-ready', 'comparison-arm-error'].includes(event.data?.type)) {
      window.removeEventListener('message', listener);
      if (event.data.type === 'comparison-arm-error') reject(new Error(event.data.message));
      else resolve((frame.contentWindow as any).comparisonArm);
    }
  }; window.addEventListener('message', listener);
})]));
// Readiness can fail before audio decoding completes; attach handlers immediately.
for (const promise of ready.values()) void promise.catch(() => {});
const resize = () => frames.forEach(frame => { frame.style.transform = `scale(${frame.parentElement!.clientWidth / 1280})`; });
new ResizeObserver(resize).observe(document.querySelector('.panes')!);
resize();
let arms: any[], durations: number[], total = 0, audioContext: AudioContext, audioBuffer: AudioBuffer;
let sound: AudioBufferSourceNode | undefined, playing = false, position = 0, startedAt = 0, rate = 1, busy = false;
let requestedPlaying = false, transportVersion = 0;
const time = () => playing ? Math.min(total, position + (audioContext.currentTime - startedAt) * rate) : position;
const format = (n: number) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;
const fail = (error: unknown) => { if (requestedPlaying) pause(); status.textContent = `Playback error: ${error instanceof Error ? error.message : String(error)}`; };
async function draw(t: number) {
  const index = t >= durations[0] ? 1 : 0, local = index ? t - durations[0] : t;
  await Promise.all(arms.map(arm => arm.draw(index, Math.min(durations[index], local))));
  seek.value = String(t); clockLabel.textContent = `${format(t)} / ${format(total)}`;
}
function pause() {
  transportVersion++; requestedPlaying = false;
  position = time(); playing = false; sound?.stop(); sound = undefined; play.textContent = 'Play both';
}
async function start() {
  const version = ++transportVersion; requestedPlaying = true; play.textContent = 'Pause both';
  await audioContext.resume();
  if (version !== transportVersion || !requestedPlaying) return;
  if (position >= total) position = 0;
  sound?.stop();
  sound = audioContext.createBufferSource(); sound.buffer = audioBuffer; sound.playbackRate.value = rate;
  sound.connect(audioContext.destination); startedAt = audioContext.currentTime; playing = true;
  sound.start(0, position); play.textContent = 'Pause both';
}
async function jump(t: number) {
  const resume = requestedPlaying; pause(); position = Math.max(0, Math.min(total, t));
  if (resume) await start();
}
async function tick() {
  if (arms && !busy) { busy = true; try { await draw(time()); if (playing && time() >= total) pause(); } catch (error) { fail(error); } finally { busy = false; } }
  requestAnimationFrame(tick);
}
play.onclick = () => { if (requestedPlaying) pause(); else void start().catch(fail); };
byId('restart').onclick = () => { void jump(0).catch(fail); };
byId('scene').onclick = () => { void jump(durations[0]).catch(fail); };
seek.oninput = () => { void jump(Number(seek.value)).catch(fail); };
byId<HTMLSelectElement>('speed').onchange = event => { const resume = requestedPlaying; pause(); rate = Number((event.target as HTMLSelectElement).value); if (resume) void start().catch(fail); };
byId<HTMLSelectElement>('focus').onchange = event => { (document.querySelector('.panes') as HTMLElement).dataset.focus = (event.target as HTMLSelectElement).value; resize(); };
byId('full').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void byId('comparison').requestFullscreen().catch(fail); };
document.addEventListener('visibilitychange', () => { if (document.hidden && requestedPlaying) pause(); });
try {
  const response = await fetch('/comparison.json'); if (!response.ok) throw new Error('Comparison data unavailable');
  const payload = await response.json(); durations = payload.durations; total = durations.reduce((a: number, b: number) => a + b, 0);
  audioContext = new AudioContext();
  const buffers = await Promise.all([0, 1].map(async index => {
    const response = await fetch(`/audio/${index}.wav`); if (!response.ok) throw new Error('Narration unavailable');
    return audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  if (buffers.some((buffer, index) => Math.abs(buffer.duration - durations[index]) > .002)) throw new Error('Narration duration mismatch');
  audioBuffer = audioContext.createBuffer(buffers[0].numberOfChannels, buffers.reduce((n, b) => n + b.length, 0), audioContext.sampleRate);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    let offset = 0; for (const buffer of buffers) { audioBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset); offset += buffer.length; }
  }
  arms = await Promise.all(frames.map(frame => ready.get(frame.id)!));
  const loaded = await Promise.all(arms.map((arm, index) => arm.load(payload.arms[index].scenes)));
  if (loaded.some(result => result.durations.some((duration: number, index: number) => Math.abs(duration - durations[index]) > .002))) throw new Error('Scene duration mismatch');
  seek.max = String(total); [play, seek, byId<HTMLButtonElement>('restart'), byId<HTMLButtonElement>('scene')].forEach(control => control.disabled = false);
  status.textContent = 'Ready · One shared narration clock · Drag time to compare any moment';
  await draw(0); requestAnimationFrame(tick);
} catch (error) { fail(error); }
