import { existsSync, openSync, closeSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export const pluginRoot = fileURLToPath(new URL('..', import.meta.url));
export const runtimeRoot = existsSync(join(pluginRoot, 'runtime/package.json')) ? join(pluginRoot, 'runtime') : resolve(pluginRoot, '..');
export const stateRoot = resolve(process.env.AHA_VIDEO_HOME ?? join(homedir(), '.aha', 'video-plugin'));

export async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function saveJSON(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export async function configuration() {
  const saved = await readJSON(join(stateRoot, 'config.json'), {});
  const port = saved.port ?? 47831;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Plugin port must be an integer from 1024 to 65535.');
  if (saved.envFile && !existsSync(saved.envFile)) throw new Error('Configured environment file is missing. Run configure with its current absolute path.');
  // Bun normally reads these files from backend/. Keep that precedence for source use.
  let values = {};
  for (const path of [join(runtimeRoot, 'backend/.env'), join(runtimeRoot, 'backend/.env.development'), join(runtimeRoot, 'backend/.env.local'), saved.envFile].filter(Boolean)) {
    if (existsSync(path)) values = { ...values, ...parseEnv(await readFile(path, 'utf8')) };
  }
  const env = { ...values, ...process.env };
  if (saved.chromium) env.SCENE_PREVIEW_CHROMIUM = saved.chromium;
  const chromium = env.SCENE_PREVIEW_CHROMIUM ?? findChromium();
  if (chromium) env.SCENE_PREVIEW_CHROMIUM = chromium;
  // Only transport/storage locations change. Model, prompts, timing and speech settings are retained.
  Object.assign(env, {
    NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), NARRATION_ALLOW_LOCAL: '1',
    NARRATION_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`, FRONTEND_DIR: join(runtimeRoot, 'frontend/site'),
    VIDEO_DB_PATH: join(stateRoot, 'videos.sqlite'), AGENT_DATA_DIR: join(stateRoot, 'agents'),
    NARRATION_DATA_DIR: join(stateRoot, 'narration'), MODEL_ASSET_DIR: join(stateRoot, 'models'),
    MOLECULAR_MODEL_CACHE_DIR: join(stateRoot, 'molecular-model-cache'),
  });
  return { saved, env, port, origin: `http://127.0.0.1:${port}`, chromium };
}

export function findChromium() {
  const candidates = process.platform === 'win32' ? [
    join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'Google/Chrome/Application/chrome.exe'),
  ] : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const installed = candidates.find(existsSync);
  if (installed) return installed;
  const cache = join(homedir(), '.cache/puppeteer/chrome');
  if (process.platform === 'win32' && existsSync(cache)) {
    for (const version of readdirSync(cache).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const path = join(cache, version, 'chrome-win64/chrome.exe');
      if (existsSync(path)) return path;
    }
  }
  return undefined;
}

export function bunPath() {
  const path = join(runtimeRoot, 'node_modules/bun/bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
  if (!existsSync(path)) throw new Error('Pinned Bun runtime missing. Run setup first.');
  return path;
}

export function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '', stderr = '';
    child.stdout?.on('data', data => { if (options.echo) process.stderr.write(data); else stdout += data; });
    child.stderr?.on('data', data => { if (options.echo) process.stderr.write(data); else stderr += data; });
    child.on('error', fail);
    child.on('close', code => code === 0 ? done(stdout) : fail(new Error(`Command failed (${code}): ${command}\n${stderr.slice(-4000)}`)));
  });
}

export function npmCli() {
  const candidates = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  const path = candidates.find(existsSync);
  if (!path) throw new Error('npm CLI not found beside Node. Run this command with npm exec -- node, or install Node with npm.');
  return path;
}

export async function setup({ offline = false } = {}) {
  if (!existsSync(join(runtimeRoot, 'node_modules/bun/bin', process.platform === 'win32' ? 'bun.exe' : 'bun'))) {
    await run(process.execPath, [npmCli(), 'ci', '--no-audit', '--no-fund', ...(offline ? ['--offline'] : [])], { cwd: runtimeRoot, echo: true });
  }
  await run(process.execPath, [npmCli(), 'run', 'build'], { cwd: runtimeRoot, echo: true });
  if (!existsSync(join(runtimeRoot, 'frontend/site/index.html'))) throw new Error('Packaged player is missing. Rebuild the plugin package.');
  return { ready: true, runtimeRoot, stateRoot };
}

export async function doctor() {
  const config = await configuration();
  const checks = {
    bun: existsSync(join(runtimeRoot, 'node_modules/bun/bin', process.platform === 'win32' ? 'bun.exe' : 'bun')),
    animationLibrary: existsSync(join(runtimeRoot, 'shared/animlib/dist/index.js')),
    previewBundle: existsSync(join(runtimeRoot, 'backend/dist/scene-preview.js')),
    interactivePlayer: existsSync(join(runtimeRoot, 'frontend/site/index.html')),
    embeddedPlayer: existsSync(join(pluginRoot, 'dist/player.html')),
    chromium: Boolean(config.chromium && existsSync(config.chromium)),
    previewsEnabled: config.env.SCENE_PREVIEW !== '0',
    productionGenerator: (config.env.VIDEO_GENERATOR ?? 'pi') === 'pi',
    narrationConfigured: Boolean(config.env.ELEVENLABS_API_KEY?.trim() && config.env.ELEVENLABS_VOICE_ID?.trim()),
  };
  let auth = { configured: false };
  if (checks.bun) {
    try { auth = JSON.parse(await run(bunPath(), ['src/agents/cli.ts', 'status'], { cwd: join(runtimeRoot, 'backend'), env: config.env })); }
    catch { auth = { configured: false, note: 'Could not read backend authentication status. Use the original agents:status command.' }; }
  }
  checks.modelConfigured = auth.configured === true;
  return { ready: Object.values(checks).every(Boolean), checks, auth,
    runtimeRoot, stateRoot, envFile: config.saved.envFile ?? null, chromium: config.chromium ?? null,
    note: 'Configuration check only. No model or speech request was made.' };
}

async function health(origin) {
  try {
    const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1500), redirect: 'error' });
    return response.ok ? await response.json() : undefined;
  } catch { return undefined; }
}

export async function running() {
  const saved = await readJSON(join(stateRoot, 'server.json'), null);
  if (!saved) return undefined;
  // Do not contact URLs from state outside this loopback-only transport.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(saved.origin) || !Number.isSafeInteger(saved.pid) || saved.pid <= 0) throw new Error('Invalid plugin server state.');
  const info = await health(saved.origin);
  return info?.revision === saved.identity ? saved : undefined;
}

export function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function lifecycle(operation) {
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  // Serialize start and stop through the entire process lifetime transition.
  const lock = join(stateRoot, 'start.lock');
  let fd;
  try { fd = openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Another start/stop is in progress. If it was interrupted, inspect and remove ${lock} before retrying.`);
  }
  try { return await operation(); }
  finally { closeSync(fd); await unlink(lock); }
}

export async function start({ smoke = false } = {}) {
  return lifecycle(async () => {
    const existing = await running();
    if (existing) {
      if (existing.runtimeRoot !== runtimeRoot || existing.smoke !== smoke) throw new Error('Another plugin runtime or mode owns this state directory. Stop it before switching.');
      return existing;
    }
    const previous = await readJSON(join(stateRoot, 'server.json'), null);
    if (previous && processAlive(previous.pid)) throw new Error('Previous plugin process is still alive but not healthy. Wait for shutdown or inspect its local log before restarting.');
    const config = await configuration();
    if (!smoke) {
      const report = await doctor();
      const required = ['bun', 'animationLibrary', 'previewBundle', 'interactivePlayer', 'embeddedPlayer', 'chromium', 'previewsEnabled', 'productionGenerator', 'modelConfigured'];
      const missing = required.filter(key => !report.checks[key]);
      if (missing.length) throw new Error(`Plugin setup incomplete: ${missing.join(', ')}. Run doctor; preserve the existing pipeline settings.`);
    }
    if (await health(config.origin)) throw new Error(`Port ${config.port} already has an unrelated service. Configure another port.`);
    const identity = `aha-plugin-${randomUUID()}`;
    const logFile = join(stateRoot, 'backend.log');
    const log = openSync(logFile, 'a', 0o600);
    let child;
    try {
      child = spawn(bunPath(), ['src/index.ts'], {
        cwd: join(runtimeRoot, 'backend'), windowsHide: true, detached: true,
        stdio: ['ignore', log, log], env: { ...config.env, APP_REVISION: identity, ...(smoke ? { VIDEO_GENERATOR: 'simulated' } : {}) },
      });
      await new Promise((done, fail) => { child.once('spawn', done); child.once('error', fail); });
    } finally { closeSync(log); }
    const state = { pid: child.pid, identity, origin: config.origin, runtimeRoot, smoke, logFile };
    child.unref();
    await saveJSON(join(stateRoot, 'server.json'), state);
    for (let attempt = 0; attempt < 120; attempt++) {
      if ((await health(config.origin))?.revision === identity) return state;
      if (child.exitCode !== null) break;
      await delay(250);
    }
    // This is the child we just created, not a PID loaded from an old file.
    try { child.kill(); } catch { /* already exited */ }
    throw new Error(`Backend did not become healthy. Inspect local log: ${logFile}`);
  });
}

export async function stop() {
  return lifecycle(async () => {
    const state = await running();
    if (!state) return { stopped: false, note: 'No verified plugin backend is running. No process was stopped.' };
    process.kill(state.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 120; attempt++) {
      if (!processAlive(state.pid)) { await unlink(join(stateRoot, 'server.json')).catch(() => {}); return { stopped: true }; }
      await delay(250);
    }
    throw new Error('Backend process is still shutting down. State retained; do not restart until it exits.');
  });
}
