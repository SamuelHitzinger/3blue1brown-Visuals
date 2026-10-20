import { detectSceneOverlaps, evaluateScene, validateRenderableScene } from 'animlib/core';
import type { CompiledScene } from 'animlib/core';

/** Reuse the renderer's projected glyph geometry; repairs remain authored source. */
export function validateSceneQuality(compiled: CompiledScene, options: { legacyOrbit?: boolean } = {}): void {
  validateRenderableScene(compiled);
  // Saved pre-policy lessons retain their approved orbit contract.
  if (!options.legacyOrbit && compiled.options.orbit) throw new Error('Disable whole-scene orbit with orbit:false. Put the visual model in an orbitable s.view with orbitHitTest:"geometry"; text and empty canvas must not be rotation handles.');
  for (const view of compiled.views ?? []) {
    if (!options.legacyOrbit && view.orbit && view.orbitHitTest !== 'geometry') throw new Error(`Orbitable view ${JSON.stringify(view.id)} must use orbitHitTest:"geometry" so text and empty space cannot rotate the model.`);
  }
  validateTextReplacements(compiled);
  // Include short transition interiors as well as a regular grid. Endpoints alone
  // miss labels crossing during camera moves and otherwise clean relocations.
  const times = new Set([0, compiled.duration, ...compiled.lifecycle.map(event => event.time)]);
  for (let t = .5; t < compiled.duration; t += .5) times.add(t);
  for (const track of compiled.tracks) for (const fraction of [0, .25, .5, .75, 1]) {
    times.add(track.start + track.duration * fraction);
  }
  for (const width of [1280, 960]) {
    const samples = detectSceneOverlaps(compiled, { width, height: 720, times: [...times], includeAnimating: true });
    const pairs = new Map<string, string>();
    for (const sample of samples) {
      for (const overlap of sample.overlaps) {
        const key = JSON.stringify(overlap.elements);
        if (pairs.has(key)) continue;
        const { left, top, right, bottom } = overlap.bounds;
        pairs.set(key, `${overlap.elements.map(id => JSON.stringify(id)).join(' and ')} at ${sample.time.toFixed(3)} seconds; intersection pixels [${[left, top, right, bottom].map(n => n.toFixed(1)).join(', ')}]`);
        if (pairs.size === 8) break;
      }
      if (pairs.size === 8) break;
    }
    if (pairs.size) throw new Error(`Text overlap during scene playback (${width}x720):\n${[...pairs.values()].join('\n')}\nSeparate these labels, remove obsolete text, or use a single text/LaTeX element for one expression. Preserve semantic IDs, inherited state, narration and exact duration. Repair the source and call validate_output again. Checks include moving glyphs and transition interiors. Text-shape collisions and unsampled motion still require rendered visual review.`);
  }
}

/** Whole-expression fades paint two glyph layers under one ID, so pairwise
 * overlap detection cannot catch them. Meaningful named-part morphs stay valid. */
function validateTextReplacements(scene: CompiledScene): void {
  for (const track of scene.tracks) {
    if (track.action.type !== 'morph' || track.duration <= 0 || Object.keys(track.action.map ?? {}).length) continue;
    if (!['text', 'latex'].includes(track.action.geometry?.kind ?? '') &&
        !Object.values(track.from).some(element => ['text', 'latex'].includes(element.geometry.kind))) continue;
    for (const fraction of [.1, .25, .5, .75, .9]) {
      const time = track.start + track.duration * fraction, frame = evaluateScene(scene, time);
      const elements = new Map(frame.elements.map(element => [element.id, element]));
      const parents = new Map<string, string>();
      for (const element of frame.elements) for (const child of element.geometry.children ?? []) parents.set(child, element.id);
      for (const id of track.action.ids) {
        const element = elements.get(id);
        if (!element?.morph || !['text', 'latex'].includes(element.morph.from.kind) ||
            !['text', 'latex'].includes(element.morph.to.kind)) continue;
        let opacity = element.opacity, parent = parents.get(id);
        const seen = new Set([id]);
        while (parent && !seen.has(parent)) {
          seen.add(parent); opacity *= elements.get(parent)?.opacity ?? 1; parent = parents.get(parent);
        }
        if (opacity >= .01) throw new Error(`Visible whole-expression replacement on ${JSON.stringify(id)} at ${time.toFixed(3)} seconds. Fade out completely, change content at zero opacity, then reveal within the same narration cue. Use nonempty named-part mapping only for meaningful conserved terms.`);
      }
    }
  }
}
