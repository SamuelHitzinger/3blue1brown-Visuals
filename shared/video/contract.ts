export type VideoMode = 'classic' | 'interactive'

/** Versioned delivery contract; source remains available for interactive recompilation. */
export interface VideoRequest {
  title: string
  /** Host-owned contextual follow-up: at most one scene. */
  sceneRequest?: boolean
  topic: string
  documents: { name: string; text: string }[]
  /** Viewing preference supplied to the storyline planner; omitted means classic. */
  videoMode?: VideoMode
  /** Explicit subtitle-only delivery bypasses speech synthesis. */
  narrationMode?: 'speech' | 'subtitles'
  uploads?: { name: string; mimeType: string; size: number; sha256: string }[]
}

export interface VideoScene {
  assets?: Record<string, import("../animlib/src/model-types").ModelAsset>
  id: string
  index: number
  source: string
  duration: number
  audio: { id: string; url: string }
  captions: { start: number; end: number; text: string }[]
  narration?: string
  visualDescription?: string
  words?: { id: string; text: string; start: number; end: number }[]
}

/** Provider totals plus provisional output estimates, including silent reasoning. */
export interface VideoTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedOutputTokens: number
}

export interface VideoManifest {
  schemaVersion: 1
  id: string
  title: string
  revision: number
  status: 'queued' | 'generating' | 'complete' | 'failed'
  provider: 'simulated' | 'pi'
  narrationMode?: 'speech' | 'subtitles'
  createdAt: string
  scenes: VideoScene[]
  tokenUsage?: VideoTokenUsage
  thumbnail?: import('./thumbnail').ThumbnailArtwork
  thumbnailStatus?: 'generating' | 'complete' | 'failed'
  error?: string
  errorCode?: string
}
