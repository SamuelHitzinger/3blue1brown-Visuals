import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import { STYLE_FAMILIES, parseVisualReferenceCatalog, prepareStylePacket, routeVisualReferences,
  selectVisualReferences, styleAudit, styleImages, styleInstructions, type VisualReferenceCatalog } from '../src/agents/visual-references.js';
import { PiAgentRunner, type AgentTask } from '../src/agents/runtime.js';
import { reviewGeneratedScene } from '../src/agents/visual-gate.js';
import { sourceHash } from '../src/agents/visual-edits.js';
import { authorReviewedLesson } from '../src/agents/editorial.js';
import { createPiGenerator } from '../src/agents/generator.js';
import { NarrationService } from '../src/narration/service.js';
import { buildAuthoringReference } from '../src/agents/authoring-reference.js';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
function catalog(): VisualReferenceCatalog {
  return { schemaVersion: 1, version: 'test-v1', families: STYLE_FAMILIES.map((id, f) => ({
    id, label: id, summary: `metadata-${id}`, routingTerms: [['algebra'], ['projection'], ['algorithm'], ['population'], ['molecular']][f],
    instructions: `PRIVATE-INSTRUCTIONS-${id}`,
    references: Array.from({ length: 5 }, (_, i) => ({ id: `${id}-${i}`, file: `${id}-${i}.png`, mimeType: 'image/png' as const,
      topics: [i === 0 ? 'rotation' : i === 1 ? 'quaternion' : i === 2 ? 'projection' : i === 3 ? 'basis' : 'surface'],
      operation: `operation-${i}`, dimension: (id === 'spatial-geometry' ? i === 1 ? '4d-projection' : '3d' : '2d') as '2d'|'3d'|'4d-projection',
      sourceURL: 'https://example.com/reference', timestampSec: i, sourceType: 'video-frame' as const, purpose: `purpose-${id}-${i}`, limitations: ['Still image only'] })),
  })) };
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'visual-style-test-')); roots.push(directory);
  const c = catalog(), path = join(directory, 'catalog.json');
  await writeFile(path, JSON.stringify(c));
  for (const f of c.families) for (const ref of f.references) await writeFile(join(directory, ref.file), png);
  return { directory, path, catalog: c };
}

test('catalog requires five families and five distinct images per family', () => {
  expect(parseVisualReferenceCatalog(catalog()).families).toHaveLength(5);
  const incomplete = catalog(); incomplete.families[0].references.pop();
  expect(() => parseVisualReferenceCatalog(incomplete)).toThrow('at least five');
  const duplicate = catalog(); duplicate.families[1].references[0].file = duplicate.families[0].references[0].file;
  expect(() => parseVisualReferenceCatalog(duplicate)).toThrow('duplicate');
  const official = catalog(); Object.assign(official.families[0].references[0], { sourceType: 'official-lesson-image', timestampSec: null });
  expect(parseVisualReferenceCatalog(official)).toBe(official);
});

test('metadata scoring respects dimensions, unknown topics and bounded mixed packets', () => {
  const c = catalog();
  expect(selectVisualReferences(c, 'Unrelated medieval poetry')).toEqual([]);
  const four = selectVisualReferences(c, 'quaternion 4D projection');
  expect(four[0].family.id).toBe('spatial-geometry');
  expect(four[0].references[0].dimension).toBe('4d-projection');
  expect(selectVisualReferences(c, '3D rotation')[0].references[0].dimension).toBe('3d');
  const mixed = selectVisualReferences(c, 'molecular 3D surface and algorithm and population');
  expect(mixed).toHaveLength(2);
  expect(mixed.flatMap(f => f.references)).toHaveLength(5);
  expect(mixed.every(f => f.references.length <= 3)).toBe(true);
});

test('semantic router sees metadata only, then only chosen family examples; handles negative intent', async () => {
  const tasks: AgentTask[] = [], c = catalog();
  const route = async (task: AgentTask) => {
    tasks.push(task);
    expect(task.images).toBeUndefined();
    expect(task.prompt).not.toContain('PRIVATE-INSTRUCTIONS');
    if (tasks.length === 1) {
      expect(task.prompt).not.toContain('purpose-');
      expect(task.systemPrompt).toContain('Negated requests and metaphors');
      return '{"familyIds":["spatial-geometry"]}';
    }
    expect(task.prompt).toContain('purpose-spatial-geometry');
    expect(task.prompt).not.toContain('purpose-molecular-mechanisms');
    return '{"referenceIds":["spatial-geometry-1","spatial-geometry-0"]}';
  };
  const chosen = await routeVisualReferences(c, 'Explain rotations of a hypersphere. Do not use molecular imagery; a neural network is only an analogy.', route);
  expect(chosen.map(x => x.family.id)).toEqual(['spatial-geometry']);
  expect(chosen[0].references[0].dimension).toBe('4d-projection');
  expect(tasks).toHaveLength(2);
  expect(await routeVisualReferences(c, 'Unknown task', async () => '{"familyIds":[]}')).toEqual([]);
});

test('production Pi routing uses the real runner entrypoint and enforces chosen-family limits', async () => {
  let calls = 0;
  const delegated = { async run(task: AgentTask) { calls++; expect(task.logContext?.stage).toBe('style-route'); return calls === 1
    ? '{"familyIds":["spatial-geometry"]}' : '{"referenceIds":["spatial-geometry-1"]}'; } };
  const route = (task: AgentTask) => PiAgentRunner.prototype.routeStyles.call(delegated as PiAgentRunner, task);
  const selected = await routeVisualReferences(catalog(), 'Explain a quaternion using a labeled 4D projection', route);
  expect(selected[0].references[0].dimension).toBe('4d-projection'); expect(calls).toBe(2);
  let index = 0;
  await expect(routeVisualReferences(catalog(), '3D', async () => ++index === 1
    ? '{"familyIds":["spatial-geometry"]}' : '{"referenceIds":["molecular-mechanisms-0"]}')).rejects.toThrow('selected-family');
});

test('packet persists exact context, selected bytes/instructions and version across catalog replacement', async () => {
  const f = await fixture(), saved = join(f.directory, 'scene.styles.json');
  const packet = await prepareStylePacket('3D rotation', saved, f.path);
  expect(styleInstructions(packet)).toContain('PRIVATE-INSTRUCTIONS-spatial-geometry');
  expect(styleInstructions(packet)).not.toContain('PRIVATE-INSTRUCTIONS-molecular-mechanisms');
  const original = JSON.stringify(packet);
  await writeFile(f.path, '{"invalid":"replacement"}');
  await writeFile(join(f.directory, packet.references[0].id + '.png'), 'replaced');
  expect(JSON.stringify(await prepareStylePacket('3D rotation', saved, f.path))).toBe(original);
  await writeFile(f.path, JSON.stringify(f.catalog));
  const changed = await prepareStylePacket('algebra', saved, f.path);
  expect(changed.contextSha256).not.toBe(packet.contextSha256);
  expect(changed.families.map(f => f.id)).toEqual(['analytical-canvas']);
  expect(JSON.parse(await readFile(saved, 'utf8'))).toEqual(changed);
  expect(JSON.stringify(styleAudit(packet))).not.toContain('data');
  const attached = styleImages(packet, [{ type: 'image', mimeType: 'image/png', data: 'SOURCE' }],
    [{ type: 'image', mimeType: 'image/png', data: 'EVIDENCE' }]);
  expect(attached.images[0].data).toBe('SOURCE'); expect(attached.images.at(-1)!.data).toBe('EVIDENCE');
  expect(attached.roleMap).toContain('"image":1,"role":"source-problem"');
  expect(attached.roleMap).toContain('"image":5,"role":"rendered-evidence"');
});

test('scoped authoring reference removes unrelated domain recipes while retaining core APIs', async () => {
  const raw = await readFile(new URL('../../shared/animlib/docs/reference.md', import.meta.url), 'utf8');
  const ref = buildAuthoringReference(raw, { familyIds: ['spatial-geometry'] });
  expect(ref).toContain('### Shaded meshes');
  expect(ref).toContain('#### Surfaces, fields, and informative views');
  expect(ref).not.toContain('#### Graph traversal and compact frontiers');
  expect(ref).not.toContain('### Molecular and biological animation recipes');
  expect(ref).not.toContain('### Molecular display beads');
});

test('review and repair retain selected styles, source roles and actual evidence after restart', async () => {
  const f = await fixture(), packet = await prepareStylePacket('3D rotation', join(f.directory, 'styles.json'), f.path);
  const source = "export default scene({},s=>{s.text('label',{text:'point',position:[5,0]});s.wait(4);});";
  const repaired = source.replace('[5,0]', '[0,0]');
  const frame = join(f.directory, 'evidence.png'); await writeFile(frame, png);
  const sourceImages = [{ type: 'image' as const, mimeType: 'image/png', data: 'SOURCE' }];
  const common = { directory: f.directory, index: 0, videoId: crypto.randomUUID(), signal: new AbortController().signal,
    source, stylePacket: packet, sourceImages,
    input: { audioAssetId: '', endMode: 'hold' as const, scene: { id: 'beat-1', durationSec: 4 }, planning: {}, visualReferences: styleAudit(packet) },
    task: { systemPrompt: styleInstructions(packet), prompt: 'Authoritative explanation' },
    validate: async (s: string) => { await compileSource(s); },
    renderFrames: async () => ({ backend: 'test', frames: [], sheets: [{ path: frame, width: 100, height: 100, times: [0], columns: 1 }] }),
  };
  const rejection = '{"approved":false,"findings":[{"timeSec":0,"objectIds":["label"],"problem":"Clipped","fix":"Move inside"}]}';
  await expect(reviewGeneratedScene({ ...common, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') throw new Error('interrupted');
    expect(task.images).toHaveLength(5); expect(task.prompt).toContain('"image":5,"role":"rendered-evidence"');
    return rejection;
  } } })).rejects.toThrow('interrupted');
  const stages: string[] = [];
  const result = await reviewGeneratedScene({ ...common, runner: { async run(task) {
    stages.push(task.logContext!.stage!);
    expect(task.images).toHaveLength(5);
    expect(task.images![0].data).toBe('SOURCE');
    expect(task.images!.at(-1)!.data).toBe(png.toString('base64'));
    expect(task.prompt).toContain('"role":"style-reference"');
    expect(task.systemPrompt).not.toContain('PRIVATE-INSTRUCTIONS-molecular');
    return task.logContext?.stage === 'repair'
      ? JSON.stringify({ sourceSha256: sourceHash(source), edits: [{ finding: 0, before: '[5,0]', after: '[0,0]' }] })
      : '{"approved":true,"findings":[]}';
  } } });
  expect(result).toBe(repaired); expect(stages).toEqual(['repair', 'review']);
});

function lesson() {
  return { schemaVersion: 1, markdown: '# Algebra\n\n## Beat 1\n\nContent needed: Algebra representation.\n\nNarration: Consider one point.',
    plan: { audience: 'Novice', prerequisites: [], learningGoal: 'Understand one point', centralQuestion: 'Where is it?',
      keyInsight: 'Keep its identity', runningExample: 'One point', misconceptions: [], entities: [],
      scenes: [{ id: 'beat-1', purpose: 'algebra', whyNow: 'Begin with one point', keyPoints: ['algebra'],
        visualDescription: 'algebra representation', view: { mode: '2d', rationale: 'Planar point' },
        endsWith: 'One point', carry: [], cleanup: [], sourceRefs: [], interactions: [] }] } };
}
const pass = { schemaVersion: 1, verdict: 'pass', summary: 'Sound lesson', issues: [], checks: ['One point remains identifiable.'] };

test('lesson draft, editorial and repair share selected instructions and source image identity', async () => {
  const f = await fixture(), tasks: AgentTask[] = [];
  const outputs = [lesson(), { ...pass, verdict: 'revise', issues: [{ severity: 'error', sceneId: 'beat-1', detail: 'Explain why the point persists.' }] }, lesson(), pass];
  const source = { type: 'image' as const, mimeType: 'image/png', data: 'SOURCE' };
  const result = await authorReviewedLesson({ async run(task) { tasks.push(task); return JSON.stringify(outputs.shift()); } },
    { title: 'Algebra', topic: 'algebra', documents: [] }, f.directory, new AbortController().signal, [source], undefined, { styleCatalogPath: f.path });
  expect(tasks).toHaveLength(4);
  for (const task of tasks) {
    expect(task.images).toHaveLength(4); expect(task.images![0]).toEqual(source);
    expect(task.systemPrompt).toContain('PRIVATE-INSTRUCTIONS-analytical-canvas');
    expect(task.systemPrompt).not.toContain('PRIVATE-INSTRUCTIONS-molecular');
    expect(task.systemPrompt).not.toContain('# Molecular planning');
  }
  expect(result.visualReferences?.familyIds).toEqual(['analytical-canvas']);
});

test('scene author selects local operation instead of copying molecular lesson style; restart reuses it', async () => {
  const f = await fixture(), id = crypto.randomUUID(), tasks: AgentTask[] = [];
  const narration = new NarrationService({ root: join(f.directory, 'narration') });
  const generate = createPiGenerator({ async run(task) {
    tasks.push(task);
    if (task.prompt.startsWith('Write')) return JSON.stringify(lesson());
    if (task.prompt.startsWith('Review')) return JSON.stringify(pass);
    const input = JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1));
    expect(input.visualReferences.familyIds).toEqual(['analytical-canvas']);
    expect(task.systemPrompt).not.toContain('# Molecular scene craft');
    expect(task.systemPrompt).not.toContain('### Molecular and biological animation recipes');
    expect(task.images![0].data).toBe('SOURCE');
    return `export default scene({audio:${JSON.stringify(input.audioAssetId)},end:${JSON.stringify(input.endMode)}},s=>{s.circle('point');s.wait(${input.scene.durationSec});});`;
  } }, narration, f.directory, { styleCatalogPath: f.path, visualGate: async options => {
    expect(options.stylePacket!.families.map(f => f.id)).toEqual(['analytical-canvas']);
    expect(options.sourceImages![0].data).toBe('SOURCE'); return options.source;
  } });
  const request = { title: 'Molecular example', topic: 'molecular', documents: [], narrationMode: 'subtitles' as const };
  const context = { owner: 'demo', videoId: id, signal: new AbortController().signal,
    images: [{ type: 'image' as const, mimeType: 'image/png', data: 'SOURCE' }] };
  const first = await generate(request, 0, context);
  expect(tasks[0].systemPrompt).toContain('PRIVATE-INSTRUCTIONS-molecular-mechanisms');
  expect(first).not.toBeNull();
  const count = tasks.length;
  expect((await generate(request, 0, context))?.scene.source).toBe(first?.scene.source);
  expect(tasks).toHaveLength(count);
});
