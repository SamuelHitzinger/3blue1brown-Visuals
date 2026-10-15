import type { LessonPlan, ScenePlan } from './planning.js';
import type { ResolvedSpeechCue } from './timing-prelude.js';

/** One host-derived acceptance brief shared by the author and rendered reviewer.
 * This describes intent; previousFrame remains the actual incoming state.
 */
export function buildSceneBrief(input: {
  lesson?: Pick<LessonPlan, 'entities'>;
  scene?: ScenePlan;
  context?: string;
  durationSec: number;
  cues: Record<string, ResolvedSpeechCue>;
}) {
  const plan = input.scene;
  return structuredClone({
    sceneId: plan?.id,
    claim: plan?.purpose,
    visibleEvidence: plan?.keyPoints ?? [],
    operation: plan?.visualDescription ?? input.context,
    objects: input.lesson?.entities ?? [],
    view: plan?.view,
    speechCues: input.cues,
    durationSec: input.durationSec,
    endState: { picture: plan?.endsWith, carry: plan?.carry ?? [], cleanup: plan?.cleanup ?? [] },
    interactions: plan?.interactions ?? [],
    sourceRefs: plan?.sourceRefs ?? [],
    stateAuthority: 'Use evaluated previousFrame for the incoming state. This brief describes the approved intent, not replacement geometry. Preserve object meanings and color roles across operations.',
  });
}
