export {};
type Arm = { load(scenes: { id: string; source: string; sourceSha256: string }[]): Promise<{ durations: number[]; backend: string }>;
  draw(index: number, time: number): Promise<void> };
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frames = ['baseline', 'candidate'].map(id => byId<HTMLIFrameElement>(id));
const play = byId<HTMLButtonElement>('play'), restart = byId<HTMLButtonElement>('restart'), seek = byId<HTMLInputElement>('seek');
const status = byId('status');
const readiness = frames.map(frame => new Promise<Arm>((resolve, reject) => {
  const child = () => frame.contentWindow as (Window & { comparisonArm?: Arm; comparisonError?: string }) | null;
  const timer = setTimeout(() => { window.removeEventListener('message', listener); reject(new Error('Native renderer readiness timed out.')); }, 30000);
  const listener = (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (!['comparison-arm-ready', 'comparison-arm-error'].includes(event.data?.type)) return;
    clearTimeout(timer); window.removeEventListener('message', listener);
    if (event.data.type === 'comparison-arm-error') reject(new Error(event.data.message));
    else if (child()?.comparisonArm) resolve(child()!.comparisonArm!);
    else reject(new Error('Native renderer API missing.'));
  };
  if (child()?.comparisonError) { clearTimeout(timer); reject(new Error(child()!.comparisonError)); }
  else if (child()?.comparisonArm) { clearTimeout(timer); resolve(child()!.comparisonArm!); }
  else window.addEventListener('message', listener);
}));
for (const ready of readiness) void ready.catch(() => {});
const resize = () => frames.forEach(frame => { frame.style.transform = `scale(${frame.parentElement!.clientWidth / 1280})`; });
const observer = new ResizeObserver(resize); frames.forEach(frame => observer.observe(frame.parentElement!)); resize();
let arms: Arm[] = [], duration = 0, position = 0, startedAt = 0, playing = false, busy = false, failed = false;
const current = () => playing ? Math.min(duration, position + (performance.now() - startedAt) / 1000) : position;
function pause() { position = current(); playing = false; play.textContent = 'Play both'; }
function start() { if (position >= duration) position = 0; startedAt = performance.now(); playing = true; play.textContent = 'Pause both'; }
function fail(error: unknown) { pause(); failed = true; play.disabled = restart.disabled = seek.disabled = true;
  status.textContent = 'Playback stopped.'; byId('error').textContent = error instanceof Error ? error.message : String(error); }
async function tick() {
  if (arms.length === 2 && !busy && !failed) {
    busy = true;
    try {
      const time = current(); await Promise.all(arms.map(arm => arm.draw(0, time)));
      seek.value = String(time); byId('time').textContent = `${time.toFixed(2)} / ${duration.toFixed(2)} s`;
      if (playing && time >= duration) pause();
    } catch (error) { fail(error); } finally { busy = false; }
  }
  requestAnimationFrame(tick);
}
play.onclick = () => playing ? pause() : start();
restart.onclick = () => { position = 0; startedAt = performance.now(); };
seek.oninput = () => { position = Math.max(0, Math.min(duration, Number(seek.value))); startedAt = performance.now(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
let revealed = false;
byId('reveal').onclick = () => { revealed = !revealed; byId('facts').hidden = !revealed;
  byId('label-a').textContent = revealed ? 'A · baseline' : 'A'; byId('label-b').textContent = revealed ? 'B · candidate' : 'B';
  byId('reveal').textContent = revealed ? 'Hide identities and timings' : 'Reveal identities and timings'; };
const seconds = (value: number | null) => value === null ? 'Unavailable' : `${(value / 1000).toFixed(3)} s`;
try {
  const response = await fetch('/pair.json'); if (!response.ok) throw new Error('Pair evidence unavailable.');
  const data = await response.json(); duration = data.duration;
  byId('limits').textContent = data.limitation;
  byId('identity').textContent = `${data.match.model} · thinking ${data.match.thinking} · requested tier ${data.match.serviceTierRequested} · actual tier ${data.match.serviceTierActual ?? 'unavailable'}. Matching user prompt, image and author settings verified; system guidance may differ.`;
  const rows = [
    ['Accepted tool call', ...data.arms.map((arm: any) => seconds(arm.toolCallCompleteMs))],
    ['Provider terminal response', ...data.arms.map((arm: any) => seconds(arm.providerTerminalMs))],
    ['Shared brief + author model stages', ...data.arms.map((arm: any) => seconds(arm.modelStageSumMs))],
    ['Output tokens', ...data.arms.map((arm: any) => String(arm.outputTokens ?? 'Unavailable'))],
    ['Source bytes', ...data.arms.map((arm: any) => String(arm.sourceBytes))],
  ];
  for (const row of rows) { const tr = document.createElement('tr'); for (const value of row) { const td = document.createElement('td'); td.textContent = value; tr.append(td); } byId('metrics').append(tr); }
  byId('brief').textContent = data.brief ? `Shared perception provider time: ${seconds(data.brief.providerTerminalMs)}. Its verified brief is present in both author prompts. This cost is included once per arm in the model-stage sum.` : 'No shared perception run supplied; author timings alone are shown.';
  arms = await Promise.all(readiness);
  const loaded = await Promise.all(arms.map((arm, index) => arm.load([{ id: 'scene', source: data.arms[index].source, sourceSha256: data.arms[index].sourceSha256 }])));
  if (loaded.some(result => result.durations.length !== 1 || Math.abs(result.durations[0] - duration) > .002)) throw new Error('Browser scene duration differs from the verified pair.');
  await Promise.all(arms.map(arm => arm.draw(0, 0)));
  seek.max = String(duration); play.disabled = restart.disabled = seek.disabled = false;
  status.textContent = `Ready · ${duration.toFixed(2)} seconds · shared silent clock · ${loaded.map(result => result.backend).join(' / ')}`;
  requestAnimationFrame(tick);
} catch (error) { fail(error); }
