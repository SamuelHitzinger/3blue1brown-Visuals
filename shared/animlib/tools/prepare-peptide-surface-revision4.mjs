/** Original finer surface of the frozen endpoint; old asset packages stay intact. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createMolecularEnvelopeParts } from '../dist/molecular-envelope.js';
import { createAssetRegistry } from '../dist/asset-registry.js';
import { writeAssetPackages } from './write-asset-packages.mjs';

const root = resolve('shared/animlib/fixtures/biological');
const bytes = await readFile(join(root, 'illustrative-peptide/endpoint.json'));
const endpoint = JSON.parse(bytes), sourceHash = createHash('sha256').update(bytes).digest('hex');
const output = join(root, 'peptide-surface-revision4');
await mkdir(output, { recursive: true });
const parameters = { sigma: 1.2, isoLevel: 1.05, resolution: 56, smoothingIterations: 6,
  trianglesPerPart: 12000, maxTotalTriangles: 120000 };
const geometries = createMolecularEnvelopeParts({ positions: endpoint.atoms.flatMap(a => a.position),
  origin: endpoint.center, ...parameters });
const palette = JSON.parse(await readFile(join(root, 'peptide-polished/palette.json'), 'utf8'));
const colors = ['PURE_BLUE', 'BLUE', 'TEAL', 'GREEN', 'YELLOW', 'ORANGE', 'RED'].map(key => palette.colors[key]);
const fieldSigma = .8;
const provenance = {
  source: 'Original idealized peptide endpoint derived from pinned wwPDB CCD components', sourceHash,
  creator: 'animlib original explanatory assets', license: 'CC0-1.0', preparedAt: '2026-10-11',
  converter: { name: 'prepare-peptide-surface-revision4', version: '1', options: { ...parameters, fieldSigma, colors } },
  selection: 'All 414 heavy atoms of unchanged original 72-residue compact endpoint',
  modifications: ['Finer schematic Gaussian envelope with common normals before bounded partitioning',
    'Analytic density-gradient display normals evaluated at the final smoothed vertices',
    'Continuous Gaussian-weighted sequence coordinate; no nearest-atom ownership discontinuities'],
  fidelity: 'Display envelope of an illustrative idealized peptide; not a physical fold or solvent-excluded surface',
};
const pixels = new Uint8Array(512 * 4), rgb = colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
for (let i = 0; i < 512; i++) {
  const x = i / 511 * 6, j = Math.min(5, Math.floor(x));
  for (let k = 0; k < 3; k++) pixels[i * 4 + k] = Math.round(rgb[j][k] + (rgb[j + 1][k] - rgb[j][k]) * (x - j));
  pixels[i * 4 + 3] = 255;
}
const image = { id: 'peptide-r4-sequence-colors', kind: 'image', version: 1, width: 512, height: 1,
  storage: 'rgba8', encoding: 'srgb', origin: 'top-left', alpha: 'straight', colorPolicy: 'source', pixels, provenance };
const registry = await createAssetRegistry([image], { colorPolicy: 'source' });
const imageTexture = { image: { id: image.id, hash: registry.catalog[0].hash }, alphaMode: 'opaque', filter: 'linear', wrap: 'clamp' };
const sites = endpoint.atoms.map(a => ({ position: a.position.map((v, k) => v - endpoint.center[k]), value: a.value }));
const fields = new Map();
function fieldsAt(point) {
  const key = point.join(','), cached = fields.get(key);
  if (cached !== undefined) return cached;
  const distances = sites.map(a => a.position.reduce((sum, x, k) => sum + (x - point[k]) ** 2, 0));
  const nearest = Math.min(...distances);
  let weighted = 0, mass = 0;
  for (let i = 0; i < sites.length; i++) {
    const weight = Math.exp(-(distances[i] - nearest) / (2 * fieldSigma ** 2));
    weighted += sites[i].value * weight; mass += weight;
  }
  const value = weighted / mass, normal = [0, 0, 0];
  for (let i = 0; i < sites.length; i++) {
    if (distances[i] >= (4 * parameters.sigma) ** 2) continue;
    const weight = Math.exp(-distances[i] / (2 * parameters.sigma ** 2));
    for (let k = 0; k < 3; k++) normal[k] += (point[k] - sites[i].position[k]) * weight;
  }
  const length = Math.hypot(...normal);
  if (!Number.isFinite(value) || value < 0 || value > 1 || length < 1e-12) throw Error('Invalid surface field');
  const result = { value, normal: normal.map(x => x / length) };
  fields.set(key, result);
  return result;
}
const parts = geometries.map((geometry, i) => ({ id: 'surface-' + i, vertices: geometry.vertices,
  normals: geometry.vertices.map(p => fieldsAt(p).normal), triangles: geometry.triangles, imageTexture,
  uv0: geometry.vertices.map(p => [(fieldsAt(p).value * 511 + .5) / 512, .5]) }));
await writeFile(join(output, 'palette.json'), JSON.stringify(palette, null, 2) + '\n');
const report = await writeAssetPackages({ images: [image], model: { id: 'peptide-r4-surface', kind: 'model', version: 1,
  units: 'angstrom', provenance, parts }, report: { endpointHash: sourceHash, parameters, fieldSigma,
    sharedVertices: fields.size, outputVertices: parts.reduce((n, p) => n + p.vertices.length, 0),
    triangles: parts.reduce((n, p) => n + p.triangles.length, 0), parts: parts.length,
    sequenceCoordinates: 'Continuous Gaussian-weighted local sequence field, computed identically at shared vertices' } }, output);
console.log(JSON.stringify({ ...report.stats, sharedVertices: fields.size, parts: parts.length,
  triangles: parts.reduce((n, p) => n + p.triangles.length, 0) }));
