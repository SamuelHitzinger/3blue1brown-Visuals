import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Follow emitted local imports, excluding type-only contracts and node_modules. */
async function dependencies(entry: string) {
  const visited = new Set<string>();
  async function visit(url: URL) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const source = await readFile(url, 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    for (const dependency of ts.preProcessFile(emitted).importedFiles) {
      if (!dependency.fileName.startsWith('.')) continue;
      const target = new URL(dependency.fileName.replace(/\.js$/, '.ts'), url);
      if (target.pathname.endsWith('.ts')) await visit(target);
    }
  }
  await visit(new URL(`../src/${entry}`, import.meta.url));
  return [...visited].map(url => fileURLToPath(url).replaceAll('\\', '/'));
}

test('notebook workflow cannot import full-video orchestration or narration implementation', async () => {
  const graph = await dependencies('lecture-workflow.ts');
  expect(graph.filter(path => /\/src\/(?:videos\.ts|video-workflow\.ts|agents\/(?:generator|editorial|thumbnail)\.ts|narration\/)/.test(path))).toEqual([]);
});

test('full-video workflow cannot import notebook orchestration or policy', async () => {
  const graph = await dependencies('video-workflow.ts');
  expect(graph.filter(path => /\/src\/(?:lectures\.ts|lecture-workflow\.ts|agents\/lecture[^/]*\.ts)/.test(path))).toEqual([]);
});
