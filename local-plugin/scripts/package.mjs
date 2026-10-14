import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = fileURLToPath(new URL('../..', import.meta.url));

export function includeRuntimeFile(path) {
  if (path.includes('\\') || isAbsolute(path) || path.split('/').some(part => part === '..')) return false;
  if (path.split('/').some(part => ['node_modules', '.narration', '.git', 'dist', 'out'].includes(part))) return false;
  if (/^(?:backend\/)?data\//.test(path)) return false;
  if (/(^|\/)(?:auth\.json|\.env(?:\..*)?|[^/]+\.(?:pem|key|sqlite(?:-wal|-shm)?))$/.test(path) && !path.endsWith('/.env.example')) return false;
  return /^(?:backend|shared|frontend\/app|frontend\/site|scenegen)\//.test(path)
    || ['package.json', 'package-lock.json', 'README.md', 'docs/agents.md', 'docs/instruction-architecture.md', 'docs/narration.md', 'docs/video-delivery.md'].includes(path);
}

export async function writeIntegrity(root, files, revision, generated = []) {
  const records = [];
  for (const path of files) records.push({ path, sha256: sha(await readFile(join(root, path))) });
  const artifacts = [];
  for (const path of generated) artifacts.push({ path, sha256: sha(await readFile(join(root, path))) });
  await writeFile(join(root, 'source-integrity.json'), `${JSON.stringify({ version: 1, revision, files: records, generated: artifacts }, null, 2)}\n`);
  return { sourceFiles: records.length, generatedFiles: artifacts.length };
}

export async function verifyIntegrity(root) {
  const manifest = JSON.parse(await readFile(join(root, 'source-integrity.json'), 'utf8'));
  const failures = [];
  for (const entry of [...manifest.files, ...(manifest.generated ?? [])]) {
    const path = resolve(root, entry.path), suffix = relative(root, path);
    if (isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) throw new Error('Integrity entry escapes runtime root.');
    try {
      if (sha(await readFile(path)) !== entry.sha256) failures.push({ path: entry.path, reason: 'changed' });
    } catch (error) { if (error.code === 'ENOENT') failures.push({ path: entry.path, reason: 'missing' }); else throw error; }
  }
  return { ok: failures.length === 0, revision: manifest.revision, sourceFiles: manifest.files.length,
    generatedFiles: manifest.generated?.length ?? 0, failures };
}

export async function verifyDistribution(plugin) {
  const runtime = await verifyIntegrity(join(plugin, 'runtime'));
  const adapter = await verifyIntegrity(plugin);
  return { ...runtime, adapter, ok: runtime.ok && adapter.ok };
}

async function filesUnder(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(root, path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

export async function packagePlugin(output) {
  const { run, npmCli } = await import('./runtime.mjs');
  output = resolve(output);
  if (existsSync(output)) throw new Error('Package destination already exists. Choose a new directory; existing packages are never overwritten.');
  const plugin = join(output, 'plugins/aha-video'), runtime = join(plugin, 'runtime');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: sourceRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = tracked.filter(includeRuntimeFile).filter(path => !path.startsWith('frontend/site/'));
  await mkdir(runtime, { recursive: true });
  for (const path of files) {
    if (!(await lstat(join(sourceRoot, path))).isFile()) throw new Error(`Only regular source files can be packaged: ${path}`);
    await mkdir(dirname(join(runtime, path)), { recursive: true });
    await copyFile(join(sourceRoot, path), join(runtime, path));
  }
  // Package the complete adapter and skill, including tests; no external checkout paths.
  for (const entry of ['.codex-plugin', '.mcp.json', 'scripts', 'skills', 'tests', 'ui', 'README.md']) {
    await cp(join(sourceRoot, 'local-plugin', entry), join(plugin, entry), { recursive: true });
  }
  // Compile the existing player unchanged, directing output into the package.
  await run(process.execPath, [npmCli(), '--prefix', 'frontend/app', 'run', 'build', '--', '--outDir', join(runtime, 'frontend/site')], { cwd: sourceRoot, echo: true });
  const { buildUI } = await import('./build-ui.mjs');
  await buildUI(join(plugin, 'dist/player.html'));
  const generated = (await filesUnder(join(runtime, 'frontend/site'))).map(path => `frontend/site/${path}`);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
  const counts = await writeIntegrity(runtime, files, revision, generated);
  const adapterFiles = [];
  for (const entry of ['.codex-plugin', 'scripts', 'skills', 'tests', 'ui']) {
    adapterFiles.push(...(await filesUnder(join(plugin, entry))).map(path => `${entry}/${path}`));
  }
  adapterFiles.push('.mcp.json', 'README.md');
  await writeIntegrity(plugin, adapterFiles, revision, ['dist/player.html']);
  await mkdir(join(output, '.agents/plugins'), { recursive: true });
  await writeFile(join(output, '.agents/plugins/marketplace.json'), JSON.stringify({
    name: 'aha-local', interface: { displayName: 'Aha Local Videos' }, plugins: [{ name: 'aha-video',
      source: { source: 'local', path: './plugins/aha-video' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }],
  }, null, 2));
  return { marketplace: output, plugin, runtime, revision, ...counts, integrity: await verifyDistribution(plugin) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ?? join(sourceRoot, 'dist/aha-video-local');
  packagePlugin(output).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
