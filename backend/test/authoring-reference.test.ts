import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildAuthoringReference, buildAuthoringContext, loadAuthoringContext } from '../src/agents/authoring-reference.js';
import { createReferenceTools } from '../src/agents/reference-tools.js';
import { compileSource, evaluateScene } from 'animlib/core';

const reference = readFileSync(new URL('../../shared/animlib/docs/reference.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

test('compact context moves only complete recipes to an indexed verbatim reference', () => {
  const context = buildAuthoringContext(reference);
  const recipes = between('### General animation recipes', '## 7. Live source submissions');
  expect(context.sections.map(section => section.content).join('').trim()).toBe(recipes);
  expect(context.reference.includes(context.sections.find(section => section.id === 'coordinate-maps-basis-vectors-and-algebra')!.content)).toBe(false);
  expect(context.reference).toContain('read_animlib_reference');
  for (const section of context.sections) expect(context.reference).toContain(section.id);
  expect(context.sections.find(section => section.id === 'coordinate-maps-basis-vectors-and-algebra')?.content).toContain('```js scene');
  expect(context.reference).toContain(between('### Fixed-topology deformation and scene time', '### Control appearance'));
  expect(context.reference).toContain(between('### Domain helpers and prepared assets', '### General animation recipes'));
  expect(context.reference).toContain(between('## Bounded scientific state'));
  expect(context.reference.length).toBeLessThan(buildAuthoringReference(reference).length - 60_000);
});

test('compact extraction ignores headings in recipe fences and rejects new unreviewed sections', () => {
  const modified = reference.replace('```js scene\n', '```js scene\n#### This stays inside an example\n');
  const context = buildAuthoringContext(modified);
  expect(context.sections.map(section => section.content).join('')).toContain('#### This stays inside an example');
  expect(context.sections.some(section => section.id === 'this-stays-inside-an-example')).toBe(false);
  const earlierExample = reference.replace('### Color palettes\n', '### Color palettes\n\n```text\n### General animation recipes\n```\n');
  expect(buildAuthoringContext(earlierExample).sections.map(section => section.content).join('').trim())
    .toBe(between('### General animation recipes', '## 7. Live source submissions'));
  expect(() => buildAuthoringContext(reference.replace('### General animation recipes', '### General animation recipes\n#### New discipline'))).toThrow('reference structure');
});

test('compact prompt fingerprints recipe changes even when their size stays fixed', () => {
  const context = buildAuthoringContext(reference);
  const first = context.sections.find(section => section.content.includes('```js scene'))!;
  const changedRecipe = first.content.replace('```js scene', '```js other');
  const changed = reference.replace(first.content, changedRecipe);
  expect(changed.length).toBe(reference.length);
  expect(buildAuthoringContext(changed).reference === context.reference).toBe(false);
});

test('loaded context exposes exact canonical scientific recipes without eagerly injecting their code', async () => {
  const context = await loadAuthoringContext();
  const tools = createReferenceTools(context.sections);
  for (const name of ['modal-state', 'conservative-transport', 'complex-interference', 'event-rates', 'rigid-motion']) {
    const content = readFileSync(new URL(`../../shared/animlib/catalog/recipes/${name}.js`, import.meta.url), 'utf8');
    const section = context.sections.find(section => section.id === `scientific-${name}`);
    expect(section?.content).toBe(content);
    const page = await tools.read({id: `scientific-${name}`}, new AbortController().signal);
    expect(page.content).toBe(content); expect(page.nextOffset).toBeUndefined();
    expect(context.reference).toContain(`scientific-${name}`);
    expect(context.reference.includes(content)).toBe(false);
  }
  const guide = readFileSync(new URL('../../shared/animlib/docs/scientific-state.md', import.meta.url), 'utf8');
  expect(context.sections.find(section => section.id === 'scientific-state-guide')?.content).toBe(guide);
  expect(context.reference.includes(guide)).toBe(false);
  expect(context.reference).toContain('Scientific reference snapshot SHA-256');
});
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
  expect(output).toContain("pdbRepresentation: 'mixed' | 'backbone'");
  expect(output).toContain('scientific-rigid-motion-guide');
});

test('injected molecular example compiles and keeps the batched group at its final pose', async () => {
  const section = between('### Molecular display beads', '### Curved paths and organic shapes');
  const example = /```js\n([\s\S]*?)\n```/.exec(section)?.[1];
  expect(example).toBeDefined();
  expect(buildAuthoringReference(reference)).toContain(section);
  const compiled = await compileSource(`export default scene({ mode: '3d', orbit: false }, s => {\n${example}\n});`);
  const frame = evaluateScene(compiled, compiled.duration);
  expect(compiled.duration).toBe(2);
  expect(frame.elements.find(element => element.id === 'protein')?.rotation).toEqual([0, 0.8, 0]);
  expect(frame.elements.find(element => element.id === 'protein/batch-0')?.geometry.kind).toBe('mesh');
  expect(frame.elements.find(element => element.id === 'protein')?.persistent).toBe(true);
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

test('delivers both complete recipe collections and their execution boundaries to scene authors', () => {
  const output = buildAuthoringReference(reference);
  expect(output).toContain(between('### General animation recipes', '### Molecular and biological animation recipes'));
  expect(output).toContain(between('### Molecular and biological animation recipes', '## 7. Live source submissions'));
  for (const text of ['```js scene', '```ts host', 'importPDBStructure',
    'structureBackboneProps', 'createMolecularEnvelopeParts', 's.peptidePose',
    's.nucleicTranscriptionCycle', 's.nucleicSplice', 's.nucleicThread',
    's.nucleicTranslationCycle', 'withOfflineScene', 'HETATM']) {
    expect(output).toContain(text);
  }
  const scenes = (text: string) => [...text.matchAll(/^```js scene\n([\s\S]*?)^```\s*$/gm)].map(match => match[1]);
  expect(scenes(output)).toEqual(scenes(reference));
  expect(scenes(output).length).toBeGreaterThan(0);
});
