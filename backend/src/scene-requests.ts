import { getScreenBounds } from 'animlib/core'
import type { CameraState, Frame } from 'animlib/core'
import type { SceneRequestInput } from '../../shared/video/scene-requests'
import type { VideoRequest, VideoScene } from '../../shared/video/contract'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function compactGeometry(value: unknown): unknown {
  if (!record(value) || value.kind !== 'mesh'
    || !['vertices', 'triangles', 'normals', 'uv0'].some(key => Array.isArray(value[key]) && value[key].length > 128)) return value
  const { vertices, triangles, normals, uv0, ...geometry } = value
  let localBounds: { min: number[]; max: number[] } | undefined
  if (Array.isArray(vertices)) for (const vertex of vertices) {
    if (!Array.isArray(vertex) || vertex.length < 2 || vertex.length > 3 || !vertex.every(n => typeof n === 'number' && Number.isFinite(n))) continue
    const point = [vertex[0], vertex[1], vertex[2] ?? 0]
    if (!localBounds) localBounds = { min: [...point], max: [...point] }
    else for (let axis = 0; axis < 3; axis++) {
      localBounds.min[axis] = Math.min(localBounds.min[axis], point[axis])
      localBounds.max[axis] = Math.max(localBounds.max[axis], point[axis])
    }
  }
  return { ...geometry, meshSummary: {
    ...(Array.isArray(vertices) ? { vertexCount: vertices.length } : {}),
    ...(Array.isArray(triangles) ? { triangleCount: triangles.length } : {}),
    ...(Array.isArray(normals) ? { normalCount: normals.length } : {}),
    ...(Array.isArray(uv0) ? { uvCount: uv0.length } : {}),
    ...(localBounds ? { localBounds } : {}),
  } }
}

function compactSelectedMoment(value: unknown): unknown {
  if (!record(value) || !record(value.scene) || !record(value.scene.frame) || !Array.isArray(value.scene.frame.elements)) return value
  const scene = value.scene, frame = scene.frame as Record<string, unknown>
  let changed = false
  const elements = (frame.elements as unknown[]).map(element => {
    if (!record(element)) return element
    const geometry = compactGeometry(element.geometry)
    const morph = record(element.morph) ? { ...element.morph,
      from: compactGeometry(element.morph.from), to: compactGeometry(element.morph.to) } : element.morph
    if (geometry === element.geometry && (!record(morph) || !record(element.morph)
      || (morph.from === element.morph.from && morph.to === element.morph.to))) return element
    changed = true
    let screenBounds
    if (typeof element.id === 'string' && record(value.surface)
      && typeof value.surface.width === 'number' && typeof value.surface.height === 'number') {
      try {
        screenBounds = getScreenBounds(frame as unknown as Frame, element.id, {
          width: value.surface.width, height: value.surface.height,
          ...(element.view === undefined && record(scene.camera) ? { camera: scene.camera as unknown as CameraState } : {}),
        })
      } catch { /* Captured optional frame data may be incomplete; local bounds still describe the mesh. */ }
    }
    return { ...element, geometry, ...(morph ? { morph } : {}), ...(screenBounds ? { screenBounds } : {}) }
  })
  if (!changed) return value
  return { ...value, scene: { ...scene, frame: { ...frame, elements,
    meshBufferNote: 'Dense generated mesh buffers are summarized by counts and local bounds; screenBounds use drawing-surface pixels when available. These bounds do not identify an exact surface hit. Use the retained scene source, labels, camera and controls for shape and scientific meaning.',
  } } }
}

/** Keep persisted request evidence and digests intact; only remove repeated renderer buffers from model context. */
export function compactVideoRequestContext(request: VideoRequest): VideoRequest {
  let changed = false
  const documents = request.documents.map(document => {
    if (document.name !== 'Selected video moment') return document
    try {
      const parsed: unknown = JSON.parse(document.text), compact = compactSelectedMoment(parsed)
      if (compact === parsed) return document
      changed = true
      return { ...document, text: JSON.stringify(compact) }
    } catch { return document }
  })
  return changed ? { ...request, documents } : request
}

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
      { name: 'Selected video moment', text: JSON.stringify(compactSelectedMoment({ ...input.context, selectedScene: selected, nextScene: next })) },
    ],
    sceneRequest: true,
  }
}
