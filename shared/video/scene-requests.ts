import type { VideoManifest } from './contract'

export interface SceneRequestContext {
  lessonId: string
  lessonTitle: string
  subject: string
  time: number
  label: string
  elementId?: string
  point: { x: number; y: number }
  normalizedPoint: { x: number; y: number }
  surface: { width: number; height: number }
  scene?: { id: string | null; time: number; frame?: unknown; camera?: unknown; controls?: unknown }
}

export interface SceneRequestInput {
  question: string
  context: SceneRequestContext
  /** Source for browser-local sample lessons only; server scenes are looked up by ID. */
  localScene?: { id: string; source: string; duration: number }
}

export interface SceneRequest {
  id: string
  afterSceneId: string
  question: string
  video: VideoManifest
}

export const insertedSceneId = (requestId: string, sceneId: string) => `${requestId}:${sceneId}`
