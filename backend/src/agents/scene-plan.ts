import type { CameraState, CompiledScene, Frame } from 'animlib/core';
import type { ScenePlan } from './planning.js';

/** Check input mechanisms, not camera animation or ordinary playback controls. */
export function validateViewingMode(compiled: CompiledScene, mode: 'classic' | 'interactive') {
  const inputBehaviors = compiled.behaviors?.some(({ behavior }) => behavior.type === 'drag' || behavior.type === 'custom');
  if (mode === 'classic' && (inputBehaviors || compiled.controls.length || compiled.options.orbit || compiled.views?.some(view => view.orbit))) {
    throw new Error('Classic scenes cannot contain lesson controls, input behaviors, or camera orbit. Remove interactive behaviors and controls and set orbit: false on the scene and every subview. Authored camera animation is allowed.');
  }
}

/** Enforce declarations we can observe. Visual quality and teaching remain review questions. */
export function validateScenePlan(compiled: CompiledScene, finalFrame: Frame, plan: ScenePlan) {
  const errors: string[] = [];
  // Observe configured projection/orientation, including camera transitions and
  // subviews. This is a contract check, not evidence of meaningful visual depth.
  const spatial = (camera: CameraState) => camera.perspective > 0 || camera.yaw !== 0 || camera.pitch !== 0;
  const cameras = [compiled.camera, ...(compiled.views ?? []).map(view => view.camera)];
  for (const track of compiled.tracks) {
    if (track.action.type === 'camera' && track.cameraFrom) {
      cameras.push(track.cameraFrom, { ...track.cameraFrom, ...track.action.properties });
    }
  }
  if (plan.view?.mode === '3d' && !cameras.some(spatial)) {
    errors.push('The planned 3d view requires a camera with perspective or spatial orientation, in the main scene or a subview. Configure it with mode: "3d", s.camera.to3D(), or a spatial s.view camera.');
  }
  const elements = new Map(finalFrame.elements.map(element => [element.id, element]));
  for (const id of plan.carry) {
    if (!elements.get(id)?.persistent) errors.push(`Carry entity "${id}" must exist at the end and be passed to s.keep().`);
  }
  function opacity(id: string, visited = new Set<string>()): number {
    const element = elements.get(id);
    if (!element || visited.has(id)) return 0;
    visited.add(id);
    const parent = finalFrame.elements.find(candidate => candidate.geometry.children?.includes(id));
    return element.opacity * (parent ? opacity(parent.id, visited) : 1);
  }
  for (const id of plan.cleanup) {
    if (opacity(id) > 0.01 || elements.get(id)?.persistent) errors.push(`Cleanup entity "${id}" must be removed or faded out by the end, and must not be kept.`);
  }
  // Planned interactions are requirements, not a ceiling on the author's choices.
  // Behavioral IDs refer to target elements/groups, rather than widget IDs.
  const actual = new Set([
    ...compiled.controls.map(control => `${control.id}:${control.kind}`),
    ...(compiled.behaviors ?? []).map(({ target, behavior }) => `${target}:${behavior.type}`),
  ]);
  const missing = plan.interactions.map(interaction => `${interaction.id}:${interaction.type}`).filter(key => !actual.has(key));
  if (missing.length) errors.push(`Implement the planned interactions (${missing.join(', ')}). Direct behaviors must target their planned element/group IDs; additional useful interactions are allowed.`);
  if (errors.length) throw new Error(`${plan.id} plan validation:\n${errors.join('\n')}\nKeep the inherited state, example values, narration, and measured duration while repairing.`);
}
