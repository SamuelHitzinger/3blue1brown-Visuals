/** Local exact-source complexity screen; no generation, source repair or quality verdict. */
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPair } from './realtime-pair-view.js';

export async function loadMatrix(directory: string) {
  const root = resolve(directory), manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.cases) || !manifest.cases.length
    || manifest.cases.some((id: unknown) => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))
    || new Set(manifest.cases).size !== manifest.cases.length) throw new Error('Invalid matrix case inventory.');
  const cases = [];
  for (const id of manifest.cases as string[]) {
    try {
      const fixture = JSON.parse(await readFile(join(root, id, 'case.json'), 'utf8'));
      if (fixture.id !== id) throw new Error('Case identity differs from manifest.');
      if (!!fixture.dataFile !== !!fixture.dataSha256) throw new Error('Incomplete declared host data provenance.');
      const pair = await loadPair(join(root, id, 'baseline'), join(root, id, 'candidate'), undefined, {
        reportCompilationFailures: true,
        ...(fixture.dataFile ? { declaredData: { path: fixture.dataFile, sha256: fixture.dataSha256 } } : {}),
      });
      cases.push({ id, subject: fixture.subject, detail: fixture.detail, dimension: fixture.dimension,
        instruction: fixture.instruction ?? '', formula: fixture.formula ?? null, pair, error: null });
    } catch (error) {
      // Invalid provenance must never fall back to another case or unverified timing metadata.
      cases.push({ id, subject: null, detail: null, dimension: null, instruction: '', formula: null,
        pair: null, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { cases, limitation: 'Controlled mathematical and molecular instruction screen. These are model-authored submissions, not measured live lecture responses. One attempt per arm; no visual quality approval. Model timings exclude compilation, rendering and presentation.' };
}
export type Matrix = Awaited<ReturnType<typeof loadMatrix>>;

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1) throw new Error('Use [MATRIX_DIRECTORY].');
  const matrix = await loadMatrix(args[0] ?? 'data/realtime-workshop/complexity-matrix/screen-01');
  const repo = resolve(import.meta.dir, '../..'), dist = join(repo, 'shared/animlib/dist'), payload = JSON.stringify(matrix);
  const server = await createServer({ configFile: false, root: join(import.meta.dir, 'realtime-complexity-view'),
    server: { host: '127.0.0.1', port: 5365, strictPort: true, fs: { allow: [repo] } },
    resolve: { alias: { '@baseline': dist, '@improved': dist } },
    optimizeDeps: { exclude: ['quickjs-emscripten', 'quickjs-emscripten-core', '@jitl/quickjs-wasmfile-debug-sync',
      '@jitl/quickjs-wasmfile-debug-asyncify', '@jitl/quickjs-wasmfile-release-sync', '@jitl/quickjs-wasmfile-release-asyncify'] },
    plugins: [{ name: 'verified-complexity-matrix', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/matrix.json') return next();
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(payload);
      });
    } }],
  });
  await server.listen();
  console.log(JSON.stringify({ url: 'http://127.0.0.1:5365/', cases: matrix.cases.map(item => ({
    id: item.id, playable: item.pair?.playable ?? false, durations: item.pair?.arms.map(arm => arm.duration),
    error: item.error ?? item.pair?.pairError,
  })) }));
  return server;
}
if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
