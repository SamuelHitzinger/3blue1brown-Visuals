import { expect, test } from 'bun:test';
import { buildSceneBrief } from '../src/agents/scene-brief.js';
import { fixtures } from '../bench/fixtures.js';
import { loadAuthoringContext, selectSceneAuthoringContext } from '../src/agents/authoring-reference.js';
import { createReferenceTools } from '../src/agents/reference-tools.js';

test('scene brief preserves the accepted claim, identities, evidence and end-state obligations', () => {
  const lesson = structuredClone(fixtures.derivative.plan), scene = lesson.scenes[1];
  const cue = { id: 'shrink', phrase: 'shrink h', utteranceId: 'beat-2.u1', wordIds: ['w1', 'w2'], startSec: 3, endSec: 4 };
  const brief = buildSceneBrief({ lesson, scene, durationSec: 12, cues: { shrink: cue } });
  expect(brief.claim).toBe(scene.purpose);
  expect(brief.operation).toBe(scene.visualDescription);
  expect(brief.objects).toEqual(lesson.entities);
  expect(brief.endState).toEqual({ picture: scene.endsWith, carry: scene.carry, cleanup: scene.cleanup });
  expect(brief.speechCues.shrink).toEqual(cue);
  expect(brief.sourceRefs).toEqual(scene.sourceRefs);
  expect(brief.stateAuthority).toContain('previousFrame');
  expect(brief.durationSec).toBe(12);
  expect(brief.interactions).toEqual(scene.interactions);
  brief.objects[0].color = 'RED';
  brief.speechCues.shrink.wordIds.push('changed');
  expect(lesson.entities[0].color).toBe('BLUE');
  expect(cue.wordIds).toEqual(['w1', 'w2']);
});

test('unplanned legacy scenes do not invent a claim, representation or cue', () => {
  expect(buildSceneBrief({ durationSec: 2, context: 'Legacy construction', cues: {} })).toMatchObject({
    operation: 'Legacy construction', objects: [], speechCues: {}, durationSec: 2,
  });
  expect(buildSceneBrief({ durationSec: 2, cues: {} }).claim).toBeUndefined();
});

test('2d context defers spatial APIs verbatim while preserving core and complete lookup', async () => {
  const full = await loadAuthoringContext();
  const focused = selectSceneAuthoringContext(full, { mode: '2d', rationale: 'A planar construction.' });
  expect(focused.reference.length).toBeLessThan(full.reference.length * 0.75);
  for (const name of ['### Local timing', '### Named formula parts', '### Controls are input values', '### Domain helpers and prepared assets']) {
    expect(focused.reference).toContain(name);
  }
  expect(focused.reference).toContain('scene-api-shaded-meshes');
  const tool = createReferenceTools(focused.sections);
  for (const section of focused.sections.filter(s => s.id.startsWith('scene-api-'))) {
    let restored = '';
    for (let offset: number | undefined = 0; offset !== undefined;) {
      const page = await tool.read({ id: section.id, offset }, new AbortController().signal);
      restored += page.content; offset = page.nextOffset;
    }
    expect(restored).toBe(section.content);
    expect(full.reference).toContain(section.content);
  }
  for (const entry of full.sections) expect(focused.sections.find(s => s.id === entry.id)).toEqual(entry);
});

test('unknown or spatial needs retain full API context and unchanged snapshots', async () => {
  const full = await loadAuthoringContext();
  expect(selectSceneAuthoringContext(full)).toEqual(full);
  expect(selectSceneAuthoringContext(full, { mode: '3d', rationale: 'Spatial mechanism.' })).toEqual(full);
});
