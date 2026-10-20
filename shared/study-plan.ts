export interface DocumentLine { text: string; heading?: number; page?: number }
export interface PlanDocument { name: string; lines: DocumentLine[]; pages?: number }
export interface TopicSource { startLine: number; endLine: number }
export interface VideoSegment {
  id: string; title: string; text: string; minutes?: number; pageStart?: number; pageEnd?: number
  sourceKind?: 'notes'; sourceReference?: string
  summary?: string; whyVisual?: string; keyIdeas?: string[]; requires?: string[]; sourceRefs?: TopicSource[]
}
export interface PlanChapter { id: string; title: string; segments: VideoSegment[] }
export interface StudyPlan {
  version: 1; title: string; sourceName: string; sourcePages?: number; chapters: PlanChapter[]; example?: boolean
  audience?: string; assumed?: string[]; originalText?: string; sourceNames?: string[]
}
