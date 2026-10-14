import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot, pluginRoot } from './runtime.mjs';

/** Bundle the unchanged player/library; only asset delivery is adapted for MCP. */
export async function buildUI(output = join(pluginRoot, 'dist/player.html')) {
  const require = createRequire(join(runtimeRoot, 'package.json'));
  const { build } = require('esbuild');
  const wasm = { name: 'embedded-wasm', setup(build) {
    build.onLoad({ filter: /emscripten-module\.browser\.mjs$/ }, async ({ path }) => {
      let contents = await readFile(path, 'utf8');
      const bytes = await readFile(join(dirname(path), 'emscripten-module.wasm'));
      const match = /export default (\w+);/.exec(contents);
      if (!match) throw new Error('Unrecognized original QuickJS module');
      contents = contents.replace(match[0], () => `export default options => ${match[1]}({...options, wasmBinary: Uint8Array.from(atob('${bytes.toString('base64')}'), c => c.charCodeAt(0)), locateFile: () => 'embedded.wasm'});`);
      return { contents, loader: 'js' };
    });
  } };
  const common = { bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', target: 'es2022',
    conditions: ['browser'], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' };
  const worker = await build({ ...common, entryPoints: [join(runtimeRoot, 'shared/animlib/dist/compiler-worker.js')], plugins: [wasm] });
  const workerText = worker.outputFiles[0].text;
  const sources = { name: 'original-player', setup(build) {
    // Match Vite's browser-only exclusion of NodeIO's optional node builtins.
    build.onResolve({ filter: /^node:(fs|path)$/ }, ({ path }) => ({ path, namespace: 'browser-node-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'browser-node-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
    build.onResolve({ filter: /^aha-original\// }, ({ path }) => ({ path: join(runtimeRoot, 'frontend/app/src', path.slice(13) + (path.endsWith('.css') ? '' : '.tsx')) }));
    build.onLoad({ filter: /compiler-client\.js$/ }, async ({ path }) => {
      let contents = await readFile(path, 'utf8');
      const original = 'new URL("./compiler-worker.js", import.meta.url)';
      if (!contents.includes(original)) throw new Error('Original worker URL changed; review bundle adapter');
      contents = contents.replace(original, () => `URL.createObjectURL(new Blob([${JSON.stringify(workerText)}], {type:'text/javascript'}))`);
      return { contents, loader: 'js' };
    });
  } };
  const result = await build({ ...common, entryPoints: [join(pluginRoot, 'ui/player.tsx')], outfile: 'player.js',
    nodePaths: [join(runtimeRoot, 'frontend/app/node_modules')], jsx: 'automatic',
    loader: { '.woff': 'dataurl', '.woff2': 'dataurl' }, plugins: [wasm, sources] });
  const script = result.outputFiles.find(file => file.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
  const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aha interactive video</title><style>${css}
html,body,#root{margin:0;background:#000;color:#fff;min-height:560px}body{overflow:hidden}.player-page{height: min(90vh,760px);min-height:560px}.aha-menu{position:absolute;top:48px;left:0;background:#151515;color:#fff;padding:20px;width:240px;z-index:100}#status{padding:24px;font:14px system-ui}</style></head><body><p id="status" role="status">Connecting to Aha…</p><div id="root"></div><script>${script}</script></body></html>`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html);
  return { output, bytes: Buffer.byteLength(html) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildUI(process.argv[2]));
