import type { Matrix } from '../realtime-complexity-view.js';
type Arm = { load(scenes: { id: string; source: string; sourceSha256: string }[]): Promise<{ durations: number[]; backend: string }>;
  draw(index: number, time: number): Promise<void> };
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const play = byId<HTMLButtonElement>('play'), restart = byId<HTMLButtonElement>('restart'), seek = byId<HTMLInputElement>('seek');
const viewports = ['viewport-a', 'viewport-b'].map(id => byId(id));
const seconds = (value: number | null) => value === null ? 'Unavailable' : `${(value / 1000).toFixed(3)} s`;
let arms: Arm[] = [], frames: HTMLIFrameElement[] = [], duration = 0, position = 0, startedAt = 0;
let playing = false, busy = false, generation = 0, controller = new AbortController();
const current = () => playing ? Math.min(duration, position + (performance.now() - startedAt) / 1000) : position;
function pause() { position = current(); playing = false; play.textContent = 'Play both'; }
function disable() { play.disabled = restart.disabled = seek.disabled = true; }
function fail(error: unknown) {
  pause(); disable(); arms = [];
  byId('status').textContent = 'Pair playback unavailable.';
  byId('error').textContent = error instanceof Error ? error.message : String(error);
}
const resize = () => frames.forEach(frame => { frame.style.transform = `scale(${frame.parentElement!.clientWidth / 1280})`; });
const observer = new ResizeObserver(resize); viewports.forEach(viewport => observer.observe(viewport));

function nativeArm(frame: HTMLIFrameElement, signal: AbortSignal): Promise<Arm> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error, arm?: Arm) => {
      clearTimeout(timer); window.removeEventListener('message', listener); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(arm!);
    };
    const abort = () => finish(new Error('Case selection changed.'));
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'comparison-arm-error') finish(new Error(event.data.message));
      if (event.data?.type === 'comparison-arm-ready') {
        const arm = (frame.contentWindow as Window & { comparisonArm?: Arm })?.comparisonArm;
        finish(arm ? undefined : new Error('Native renderer API missing.'), arm);
      }
    };
    const timer = setTimeout(() => finish(new Error('Native renderer readiness timed out.')), 30000);
    window.addEventListener('message', listener); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

async function select(item: Matrix['cases'][number]) {
  const ticket = ++generation;
  controller.abort(); controller = new AbortController(); pause(); disable(); arms = []; busy = false;
  frames.forEach(frame => frame.remove()); frames = [];
  // A fresh iframe prevents retained frame state from a previous case being shown as this case.
  viewports.forEach(viewport => { viewport.textContent = ''; });
  position = duration = 0; seek.value = '0'; byId('time').textContent = '0.00 s';
  for (const id of ['metrics', 'error', 'identity', 'provenance', 'status-a', 'status-b']) byId(id).textContent = '';
  document.querySelectorAll<HTMLButtonElement>('#cases button').forEach(button => button.setAttribute('aria-current', String(button.dataset.id === item.id)));
  byId('title').textContent = `${item.id}${item.dimension ? ` · ${item.dimension}D · ${item.detail} detail` : ''}`;
  byId('instruction').textContent = item.instruction || (item.formula ? `${item.subject} · ${item.formula}` : item.subject ?? 'Unverified case');
  byId('status').textContent = 'Validating native playback…';
  const pair = item.pair;
  if (!pair) { fail(item.error ?? 'Verified pair evidence unavailable.'); return; }
  byId('identity').textContent = `${pair.match.model} · thinking ${pair.match.thinking} · requested tier ${pair.match.serviceTierRequested} · actual tier ${pair.match.serviceTierActual ?? 'unavailable'}. Shared user prompt and model settings verified; system guidance differs.`;
  const rows = [
    ['Accepted tool call', ...pair.arms.map(arm => seconds(arm.toolCallCompleteMs))],
    ['Provider terminal response', ...pair.arms.map(arm => seconds(arm.providerTerminalMs))],
    ['Output tokens', ...pair.arms.map(arm => String(arm.outputTokens ?? 'Unavailable'))],
    ['Model source bytes', ...pair.arms.map(arm => String(arm.sourceBytes))],
    ['Compiled duration', ...pair.arms.map(arm => arm.duration === null ? 'Compile failed' : `${arm.duration.toFixed(3)} s`)],
  ];
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of row) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    byId('metrics').append(tr);
  }
  byId('provenance').textContent = JSON.stringify({ userPromptSha256: pair.match.userPromptSha256,
    systemPromptHashes: pair.match.systemPromptHashes, declaredHostData: pair.declaredData,
    arms: pair.arms.map(arm => ({ role: arm.role, rawModelSourceSha256: arm.sourceSha256,
      executionSourceSha256: arm.executionSourceSha256, probeResultSha256: arm.probeResultSha256 })),
    engine: pair.engine, limitation: pair.limitation }, null, 2);
  pair.arms.forEach((arm, index) => { byId(index ? 'status-b' : 'status-a').textContent = arm.compileError ? `Compile failed: ${arm.compileError}` : `Compiled · ${arm.duration?.toFixed(3)} s`; });
  if (!pair.playable || pair.duration === null) {
    viewports.forEach((viewport, index) => {
      const message = document.createElement('div'); message.className = 'placeholder';
      message.textContent = pair.arms[index].compileError ? `This exact source failed to compile.\n${pair.arms[index].compileError}` : 'Source compiled. Pair playback disabled because both arms must compile with equal duration.';
      viewport.append(message);
    });
    fail(pair.pairError ?? 'Pair unsupported.'); return;
  }
  duration = pair.duration;
  try {
    frames = viewports.map((viewport, index) => {
      const frame = document.createElement('iframe'); frame.title = index ? 'Candidate exact source' : 'Baseline exact source';
      // Install listeners before navigation; every selection uses a new browsing context.
      viewport.append(frame); return frame;
    });
    const readiness = frames.map(frame => nativeArm(frame, controller.signal));
    frames.forEach((frame, index) => { frame.src = `/arm.html?variant=${index ? 'improved' : 'baseline'}&selection=${ticket}`; }); resize();
    const selectedArms = await Promise.all(readiness); if (ticket !== generation) return;
    const loaded = await Promise.all(selectedArms.map(async (arm, index) => {
      try { return await arm.load([{ id: item.id, source: pair.arms[index].executionSource, sourceSha256: pair.arms[index].executionSourceSha256 }]); }
      catch (error) { throw new Error(`${index ? 'B' : 'A'} renderer preparation failed: ${error instanceof Error ? error.message : String(error)}`); }
    }));
    if (ticket !== generation) return;
    if (loaded.some(result => result.durations.length !== 1 || Math.abs(result.durations[0] - duration) > .002)) throw new Error('Browser duration differs from verified source.');
    await Promise.all(selectedArms.map(arm => arm.draw(0, 0))); if (ticket !== generation) return;
    arms = selectedArms; seek.max = String(duration); play.disabled = restart.disabled = seek.disabled = false;
    byId('status').textContent = `Ready · ${duration.toFixed(2)} s · shared silent clock · ${loaded.map(result => result.backend).join(' / ')}`;
  } catch (error) { if (ticket === generation) fail(error); }
}

async function tick() {
  if (arms.length === 2 && !busy) {
    busy = true; const ticket = generation, time = current();
    try {
      await Promise.all(arms.map(async (arm, index) => {
        try { await arm.draw(0, time); }
        catch (error) { throw new Error(`${index ? 'B' : 'A'} playback failed: ${error instanceof Error ? error.message : String(error)}`); }
      }));
      if (ticket === generation) {
        seek.value = String(time); byId('time').textContent = `${time.toFixed(2)} / ${duration.toFixed(2)} s`;
        if (playing && time >= duration) pause();
      }
    } catch (error) { if (ticket === generation) fail(error); }
    finally { if (ticket === generation) busy = false; }
  }
  requestAnimationFrame(tick);
}
play.onclick = () => { if (playing) pause(); else { if (position >= duration) position = 0; startedAt = performance.now(); playing = true; play.textContent = 'Pause both'; } };
restart.onclick = () => { position = 0; startedAt = performance.now(); };
seek.oninput = () => { position = Math.max(0, Math.min(duration, Number(seek.value))); startedAt = performance.now(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
try {
  const response = await fetch('/matrix.json'); if (!response.ok) throw new Error('Matrix evidence unavailable.');
  const matrix: Matrix = await response.json(); byId('limits').textContent = matrix.limitation;
  for (const item of matrix.cases) {
    const button = document.createElement('button'); button.dataset.id = item.id;
    const name = document.createElement('span'); name.textContent = item.id;
    const detail = document.createElement('small'); detail.textContent = item.pair?.playable ? `${item.dimension}D · ${item.detail} detail` : 'Pair unavailable · see evidence';
    button.append(name, detail); button.onclick = () => { void select(item); }; byId('cases').append(button);
  }
  if (!matrix.cases.length) throw new Error('No cases supplied.');
  await select(matrix.cases[0]); requestAnimationFrame(tick);
} catch (error) { fail(error); }
