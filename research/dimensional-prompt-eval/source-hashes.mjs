import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, '../..');
const destination = join(root, 'baseline/production-source-hashes.json');
const sha = data => createHash('sha256').update(data).digest('hex');
const files = {};
async function collect(directory, include) {
  for (const entry of (await readdir(join(repo, directory), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = join(directory, entry.name);
    if (entry.isDirectory()) await collect(name, include);
    else if (include(name)) files[name.replaceAll('\\','/')] = sha(await readFile(join(repo, name)));
  }
}
await collect('backend/src', name => /\.(ts|js|mjs|cjs)$/.test(name));
await collect('shared/animlib/dist', name => /\.(js|mjs|json)$/.test(name));
await collect('shared/video', name => /\.(ts|js)$/.test(name));
for (const name of ['package.json', 'package-lock.json', 'backend/package.json', 'shared/animlib/package.json', 'backend/prompts/visual-style-reference.jpg']) {
  files[name] = sha(await readFile(join(repo, name)));
}
const sorted = Object.fromEntries(Object.entries(files).sort(([a],[b]) => a.localeCompare(b)));
if (process.argv.includes('--capture')) {
  await writeFile(destination, JSON.stringify({ capturedAt: new Date().toISOString(),
    captureBoundary: process.argv.includes('--isolated') ? 'Formal isolated-worktree runtime snapshot captured after dependency install/build and before all nine fresh full-pipeline trials. Original-checkout evidence is preserved separately under history/original-checkout.' : 'Supplementary source/runtime snapshot captured after the first two baseline tasks started; not retroactive proof of their earlier state. Check stability throughout remaining evaluation.',
    files: sorted }, null, 2)+'\n', { flag: 'wx' });
  console.log(JSON.stringify({ captured: relative(repo, destination), count: Object.keys(sorted).length }));
} else {
  const baseline = JSON.parse(await readFile(destination, 'utf8'));
  const names = new Set([...Object.keys(baseline.files), ...Object.keys(sorted)]);
  const changed = [...names].filter(name => baseline.files[name] !== sorted[name]);
  console.log(JSON.stringify({ checked: Object.keys(sorted).length, unchanged: !changed.length, changed }));
  if (changed.length) process.exitCode = 1;
}
