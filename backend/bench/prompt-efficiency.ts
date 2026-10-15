import { createHash } from 'node:crypto';
import { loadAuthoringContext, selectSceneAuthoringContext } from '../src/agents/authoring-reference.js';
import { createReferenceTools } from '../src/agents/reference-tools.js';

/** Byte reduction and complete retrieval are deterministic evidence, not a
 * claim about generation latency or the quality of an unseen animation. */
export async function runPromptEfficiencyBenchmark() {
  const full = await loadAuthoringContext();
  const fullBytes = Buffer.byteLength(full.reference);
  const cases = [];
  for (const mode of ['2d', '3d', 'unknown'] as const) {
    const selected = selectSceneAuthoringContext(full, mode === 'unknown' ? undefined : { mode, rationale: 'Fixed benchmark view.' });
    const reader = createReferenceTools(selected.sections);
    let restored = 0;
    for (const section of selected.sections.filter(entry => entry.id.startsWith('scene-api-'))) {
      let content = '';
      for (let offset: number | undefined = 0; offset !== undefined;) {
        const page = await reader.read({ id: section.id, offset }, new AbortController().signal);
        content += page.content; offset = page.nextOffset;
      }
      if (content !== section.content || !full.reference.includes(content)) throw new Error(`Incomplete reference: ${section.id}`);
      restored++;
    }
    const bytes = Buffer.byteLength(selected.reference);
    cases.push({ mode, fullBytes, selectedBytes: bytes, reduction: 1 - bytes / fullBytes,
      deferredSectionsRestored: restored, snapshotSha256: createHash('sha256').update(selected.reference).digest('hex') });
  }
  return { kind: 'deterministic-context-selection', cases,
    targetPassed: cases[0].reduction >= 0.25 && cases[1].selectedBytes === fullBytes && cases[2].selectedBytes === fullBytes,
    limits: 'Proves byte reduction and recoverability only. Paired generated scenes and rendered inspection are still required.' };
}

if (import.meta.main) console.log(JSON.stringify(await runPromptEfficiencyBenchmark(), null, 2));
