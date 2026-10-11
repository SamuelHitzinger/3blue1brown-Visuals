/** Derive only the surface asset/material revision from the frozen staging proof. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const original = resolve('data/animlib-expansion/biological-motion-revision3');
const directory = resolve('data/animlib-expansion/biological-motion-revision4');
await mkdir(directory, { recursive: true });
const root = resolve('shared/animlib/fixtures/biological');
const manifest = JSON.parse(await readFile(join(original, 'peptide-manifest.json'), 'utf8'));
const before = await readFile(join(original, 'peptide.js'), 'utf8');
if (!before.includes("s.modelInfo('peptide-polished-surface')")) throw Error('Frozen revision-3 proof is missing');
const cacheMarker = 'const sample=t=>{if(previous===t)return cached;previous=t;';
if (before.split(cacheMarker).length !== 2) throw Error('Expected one known peptide pose cache');
// The authored pose is constant after 6.6s. Clamp only its geometry cache key;
// the caller's material, visibility and camera clocks continue normally.
const source = before.replace("s.modelInfo('peptide-polished-surface')", "s.modelInfo('peptide-r4-surface')")
  .replace(cacheMarker, 'const sample=t=>{t=Math.min(t,7);if(previous===t)return cached;previous=t;')
  .replace('material:{roughness:.4,specular:.8}', 'material:{roughness:.46,specular:.65}');
const modelAssets = ['peptide-r4-sequence-colors.json', 'peptide-r4-surface.json']
  .map(file => join(root, 'peptide-surface-revision4', file));
modelAssets.push(join(root, 'peptide-polished/bead/peptide-unit-bead.json'));
await writeFile(join(directory, 'peptide.js'), source);
await writeFile(join(directory, 'peptide-manifest.json'), JSON.stringify({ ...manifest, modelAssets }, null, 2));
const frames = JSON.parse(await readFile(join(original, 'peptide-frames.json'), 'utf8'));
await writeFile(join(directory, 'peptide-frames.json'), JSON.stringify({ ...frames, source, modelAssets, directory: join(directory, 'peptide-frames') }));
await writeFile(join(directory, 'peptide-preview.json'), JSON.stringify({ ...frames, source, modelAssets,
  times: [7.8, 8.4, 9.5], directory: join(directory, 'preview') }));
console.log(JSON.stringify({ directory, sourceCharacters: source.length }));
