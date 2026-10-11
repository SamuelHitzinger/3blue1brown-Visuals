import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildAuthoringReference } from '../src/agents/authoring-reference.js';

const reference = readFileSync(new URL('../../shared/animlib/docs/reference.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
function between(start: string, end?: string): string {
  return reference.slice(reference.indexOf(start), end ? reference.indexOf(end) : undefined).trim();
}

test('retains every authoring section verbatim while excluding host and development sections', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toBe([
    '# animlib scene-authoring reference',
    between('### Color palettes', '### Player API'),
    between('## 3. Writing a scene', '## 7. Live source submissions'),
    between('### Execution environment', '## 8. One audio track per scene'),
    between('## 8. One audio track per scene', '## 9. Engine structure and verification'),
    between('## 10. Current boundaries and next steps', '### Registering and delivering models'),
    between('### Scene-agent publication'),
  ].join('\n\n') + '\n');
  for (const heading of ['### Player API', '### TypeScript surface', '## 7. Live source submissions', '## 9. Engine structure and verification']) {
    expect(output).not.toContain(heading);
  }
  expect(output.length).toBeLessThan(reference.length);
  expect(output).toContain(between('### Procedural textures and materials', '### Function and parametric surfaces'));
  expect(output).toContain('### Retained reactive bindings');
  for (const heading of ['### Shaded meshes', '### Function and parametric surfaces',
    '### Basic solids and swept tubes', '### Curved paths and organic shapes']) expect(output).toContain(heading);
  expect(output).toContain('Do not simplify a planned explanation to fit the fast path.');
  expect(output).toContain(between('## Object bounds', '## Overlap inspection'));
});

test('retains the complete texture/material contract including reactive controls and limits', () => {
  const output = buildAuthoringReference(reference);
  for (const term of ['bumpStrength', 'metalness', 'roughness', 'emissiveIntensity',
    'localPosition * scale + offset', 'whole-object', 'Procedural materials do not provide environment maps, video textures']) {
    expect(output).toContain(term);
  }
});

test('normalizes line endings deterministically without changing authoring prose', () => {
  expect(buildAuthoringReference(reference.replaceAll('\n', '\r\n'))).toBe(buildAuthoringReference(reference));
});

test.each([
  ['unknown heading', reference.replace('### Local timing', '### New timing API')],
  ['new nested heading', reference.replace('### Local timing', '#### New API\n\n### Local timing')],
  ['new lighting subsection', reference.replace('### Scene lighting and planar shadows', '### Scene lighting and planar shadows\n\n#### New light API')],
  ['missing heading', reference.replace('### Local timing\n', '')],
  ['duplicate heading', reference.replace('### Local timing', '### Local timing\n\n### Local timing')],
  ['reordered headings', reference.replace('### Source format', '### TEMP').replace('### Local timing', '### Source format').replace('### TEMP', '### Local timing')],
  ['missing title', reference.replace('# animlib reference\n', '')],
])('rejects %s instead of silently dropping changed reference content', (_name, input) => {
  expect(() => buildAuthoringReference(input)).toThrow('reference structure');
});

test('rejects a retained section whose content has disappeared', () => {
  const input = reference.replace(between('### Color palettes', '### Player API'), '### Color palettes');
  expect(() => buildAuthoringReference(input)).toThrow('empty');
});

test('ignores heading-looking lines inside fenced examples but rejects unclosed fences', () => {
  const input = reference.replace('```js\nexport default scene(', '```js\n# example heading\nexport default scene(');
  expect(buildAuthoringReference(input)).toContain('## 3. Writing a scene');
  expect(() => buildAuthoringReference(reference + '\n```js\n')).toThrow('fence');
});

test('retains curved-path authoring rules and the Bézier example', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('### Curved paths and organic shapes', '### Choosing how objects relate and move'));
  expect(output).toContain("d: 'M0 0 C0.5 0.6 1.3 0.7 2 0 C1.3 -0.5 0.5 -0.4 0 0 Z'");
});

test('retains the complete lighting API, example, casting policy and limits verbatim', () => {
  const output = buildAuthoringReference(reference);
  const lighting = between('### Scene lighting and planar shadows', '### Procedural textures and materials');
  expect(lighting).toStartWith('### Scene lighting and planar shadows');
  expect(output).toContain(lighting);
  for (const prose of [
    "direction: [-0.7, 1, 0.5], space: 'world', intensity: 1",
    "lighting: 'studio'",
    "space: 'camera'",
    "`castShadow: false`",
    'translucent fills/textures and members of translucent isolated groups do not cast',
    'no self-shadowing',
    'arbitrary mesh receivers',
    'Use medium quality and modest caster counts for interactive scenes.',
  ]) expect(lighting).toContain(prose);
});

test('retains deformation topology, sandbox, and snapshot authoring rules verbatim', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('### Fixed-topology deformation and scene time', '### Control appearance'));
  expect(output).toContain('s.deform(wave, [s.time, amplitude]');
  expect(output).toContain('triangle indices, order, and winding never change');
  expect(output).toContain('Callbacks remain synchronous and sandboxed');
  expect(output).toContain('await sequence.evaluate(index, time)');
});
test('retains explanatory geometry APIs, topology limits, palette ramps and label semantics', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('## Sections, feature edges, scalar fields, and label depth', '## Imported static 3D models'));
  for (const text of ['dot(normal, localPosition) <= offset', 'nested holes', 'creaseAngle',
    'scalarColors', 'uniformly spaced palette', "'hide'", "'fade'", 'same view']) {
    expect(output).toContain(text);
  }
});

test('retains model authoring and agent publication while excluding host loading APIs', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('## Imported static 3D models', '### Registering and delivering models'));
  expect(output).toContain(between('### Scene-agent publication'));
  expect(output).not.toContain('### Registering and delivering models');
  expect(output).toContain("assembly.part('Panel')");
  expect(output).toContain('publish_model');
});

test('includes callable molecular authoring guidance without relying on a linked document', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('### Molecular display beads', '### Curved paths and organic shapes'));
  for (const text of ["s.molecule('protein'", 'positions:', 'radius:', 'origin:',
    'detail:', '10,000 sites', '${id}/batch-N', 'Neither helper is available inside scene code.']) {
    expect(output).toContain(text);
  }
});

test('retains domain helpers, prepared asset authoring and host ownership limits', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('### Domain helpers and prepared assets', '## 7. Live source submissions'));
  for (const text of ['s.sampledState', 's.molecularBackbone', 's.peptidePose', 's.nucleicDuplex',
    's.modelInfo', 's.image', 'descriptor-only', "colorPolicy:'source'", 'sampler.sample(time)']) {
    expect(output).toContain(text);
  }
});
