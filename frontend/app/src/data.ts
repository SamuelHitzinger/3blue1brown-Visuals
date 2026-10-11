import type { VideoMode } from '../../../shared/video/contract'
import type { CourseLessonRef } from './subjectPlans'
export type { VideoMode } from '../../../shared/video/contract'

export type Subject = string
export type Artwork = 'molecule' | 'orbitals' | 'reaction' | 'vectors' | 'matrix' | 'eigen' | 'idea'
export interface Lesson {
  courseLesson?: CourseLessonRef
  generationStatus?: 'queued' | 'generating' | 'complete' | 'failed'
  id: string
  title: string
  subtitle: string
  subject: Subject
  duration: number
  artwork: Artwork
  thumbnail?: import('../../../shared/video/thumbnail').ThumbnailArtwork
  color: string
  progress?: number
  demo?: boolean
  videoMode?: VideoMode
  source?: { text: string; chapter: string; name: string }
  videoId?: string
}

export function artworkForTitle(title: string, fallback: Artwork): Artwork {
  const topics: [RegExp, Artwork][] = [
    [/\beigen(?:vectors?|values?)?\b/i, 'eigen'],
    [/\b(?:matrix|matrices|transformations?)\b/i, 'matrix'],
    [/\bvectors?\b/i, 'vectors'],
    [/\borbitals?\b/i, 'orbitals'],
    [/\b(?:reactions?|electrons?)\b/i, 'reaction'],
    [/\b(?:carbon|molecules?|bonds?)\b/i, 'molecule'],
  ]
  return topics.find(([pattern]) => pattern.test(title))?.[1] ?? fallback
}

export const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
