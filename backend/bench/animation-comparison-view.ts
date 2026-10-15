/** Replay exact approved derivative benchmark sources; no generation or source edits. */
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const repo = resolve(import.meta.dir, '../..');
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const fixtureDir = join(repo, 'data/scene-speed/fixtures/derivative');
const narration = await readJson(join(fixtureDir, 'narration.json'));
const runs = await Promise.all([
  readJson(join(repo, 'data/animation-efficiency/live/trial2/derivative/baseline/result.json')),
  readJson(join(repo, 'data/animation-efficiency/live/trial3/derivative/candidate/result.json')),
]);
for (const key of ['fixtureHash', 'packageHash', 'planSha256', 'model', 'thinking']) {
  if (runs[0][key] !== runs[1][key]) throw new Error(`Unmatched ${key}`);
}
const audio = await Promise.all(narration.scenes.map(async (scene: any) => {
  const bytes = await readFile(join(fixtureDir, `${scene.id}.wav`));
  if (runs.some(run => run.audioHashes[scene.id] !== sha(bytes))) throw new Error('Audio hash mismatch');
  return bytes;
}));
const arms = await Promise.all(runs.map(async run => {
  if (run.status !== 'complete' || run.scenes.length !== 2) throw new Error('Incomplete comparison run');
  for (const [i, scene] of run.scenes.entries()) {
    const receipt = await readJson(join(run.directory, `scene-${i}.visual-review.json`));
    const source = await readFile(join(run.directory, `scene-${i}.js`), 'utf8');
    if (sha(source) !== scene.sourceSha256 || sha(scene.source) !== scene.sourceSha256
      || !receipt.approved || receipt.sourceSha256 !== scene.sourceSha256) throw new Error('Approved source mismatch');
  }
  return { variant: run.variant, trial: run.trial, elapsedSeconds: run.elapsedMs / 1000,
    scenes: run.scenes.map((scene: any, index: number) => ({ id: `scene-${index}`, source: scene.source, sourceSha256: scene.sourceSha256 })) };
}));
const payload = JSON.stringify({ arms, durations: narration.scenes.map((scene: any) => scene.durationSec),
  captions: narration.scenes.map((scene: any) => scene.utterances?.map((u: any) => u.spokenText).join(' ') ?? '') });
const port = Number(process.env.COMPARISON_PORT ?? 5361);
const server = await createServer({
  configFile: false, root: join(import.meta.dir, 'comparison-view'),
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [repo] } },
  resolve: { alias: {
    '@baseline': join(repo, '.tmp/animation-efficiency/baseline/shared/animlib/dist'),
    '@improved': join(repo, 'shared/animlib/dist'),
  } },
  optimizeDeps: { exclude: ['quickjs-emscripten', 'quickjs-emscripten-core', '@jitl/quickjs-wasmfile-debug-sync',
    '@jitl/quickjs-wasmfile-debug-asyncify', '@jitl/quickjs-wasmfile-release-sync', '@jitl/quickjs-wasmfile-release-asyncify'] },
  plugins: [{ name: 'fixed-comparison-inputs', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0];
      if (path === '/comparison.json') { res.setHeader('Content-Type', 'application/json'); res.end(payload); return; }
      const match = /^\/audio\/(0|1)\.wav$/.exec(path ?? '');
      if (match) { res.setHeader('Content-Type', 'audio/wav'); res.end(audio[Number(match[1])]); return; }
      next();
    });
  } }],
});
await server.listen();
console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, durationSeconds: narration.durationSec,
  sources: arms.map(arm => ({ variant: arm.variant, trial: arm.trial, hashes: arm.scenes.map((scene: any) => scene.sourceSha256) })) }));
