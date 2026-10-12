import type { SceneRequestInput } from '../../shared/video/scene-requests'
import type { VideoRequest, VideoScene } from '../../shared/video/contract'

export function validateSceneRequest(value: unknown, lessonId: string): SceneRequestInput {
  const input = value as SceneRequestInput
  const c = input?.context
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  if (!input || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 2000
    || !c || c.lessonId !== lessonId || typeof c.lessonTitle !== 'string' || !c.lessonTitle.trim() || c.lessonTitle.length > 200
    || typeof c.subject !== 'string' || c.subject.length > 200 || typeof c.label !== 'string' || c.label.length > 500
    || !finite(c.time) || c.time < 0 || !c.scene || typeof c.scene.id !== 'string' || !c.scene.id || c.scene.id.length > 256
    || !finite(c.scene.time) || c.scene.time < 0
    || !finite(c.surface?.width) || c.surface.width <= 0 || !finite(c.surface?.height) || c.surface.height <= 0
    || !finite(c.point?.x) || c.point.x < 0 || c.point.x > c.surface.width
    || !finite(c.point?.y) || c.point.y < 0 || c.point.y > c.surface.height
    || !finite(c.normalizedPoint?.x) || c.normalizedPoint.x < 0 || c.normalizedPoint.x > 1
    || !finite(c.normalizedPoint?.y) || c.normalizedPoint.y < 0 || c.normalizedPoint.y > 1) {
    throw new Error('Provide a request and a valid selected scene, time, and position.')
  }
  // Derive fractions from the captured drawing surface, never from the popup anchor.
  return { question: input.question.trim(), context: { ...c,
    normalizedPoint: { x: c.point.x / c.surface.width, y: c.point.y / c.surface.height },
  }, ...(input.localScene ? { localScene: input.localScene } : {}) }
}

export function contextualVideoRequest(input: SceneRequestInput, selected: Pick<VideoScene, 'source' | 'duration' | 'narration' | 'visualDescription' | 'captions'>,
  original?: VideoRequest, next?: Pick<VideoScene, 'narration' | 'visualDescription'>): VideoRequest {
  return {
    title: input.question.slice(0, 200),
    topic: `Create one follow-up scene to insert after the selected scene in “${input.context.lessonTitle}”.
Answer the viewer's request using the selected moment and position. Do not restart or repeat the whole lesson.
The point uses screen coordinates: x increases rightward, y downward, normalized to the drawing surface.
Use the displayed frame, effective camera, controls, scene source and narration to identify what is at that point. If the point is empty or ambiguous, explain the surrounding concept without inventing a precise object selection.
For a request for an interactive toy or exploration, include meaningful sliders, toggles or selects that actually change the model and teach the requested concept. For elaboration, focus on the missing reasoning or a worked example; controls are optional.
The inserted scene is independent and must create its own objects. The original lesson resumes afterward with its original handoff. Connect the explanation back to that lesson.
Viewer request: ${input.question}`,
    videoMode: 'interactive',
    ...(original?.narrationMode ? { narrationMode: original.narrationMode } : {}),
    documents: [
      ...(original?.documents ?? []),
      ...(original ? [{ name: 'Original lesson request', text: original.topic }] : []),
      { name: 'Selected video moment', text: JSON.stringify({ ...input.context, selectedScene: selected, nextScene: next }) },
    ],
    sceneRequest: true,
  }
}
