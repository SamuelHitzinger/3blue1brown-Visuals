/** Durable lecture contracts. Future capture adapters normalize their output into sources. */
export interface LectureSource {
  id: string;
  sequence: number;
  kind: 'text';
  text: string;
  createdAt: string;
  capture?: {
    kind: 'photo' | 'audio';
    itemId: string;
    sequence: number;
    capturedAt: string;
    durationMs?: number;
  };
}

export interface LecturePoint { text: string; sourceIds: string[] }
export interface LectureConcept {
  sectionId?: string;
  id: string;
  title: string;
  explanation: string;
  sourceIds: string[];
  visualizationPrompt: string;
  catalogIds: string[];
}
export interface LectureNotes {
  /** Concise content-based subtitle, applied only after the lecture is finished. */
  subtitle?: string;
  summary: string;
  sections: { id: string; title: string; points: LecturePoint[] }[];
  concepts: LectureConcept[];
  questions: LecturePoint[];
}
export interface LectureVisualization {
  id: string;
  conceptId: string;
  title: string;
  sourceRevision: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  source?: string;
  duration?: number;
  assets?: Record<string, import('./animlib/src/model-types').ModelAsset>;
  catalogIds: string[];
  error?: string;
}
export interface LectureSession {
  schemaVersion: 1;
  id: string;
  title: string;
  /** Missing on legacy records: treat their titles as manually chosen. */
  titleMode?: 'automatic' | 'manual';
  titleBase?: string;
  finishedAt?: string;
  courseId?: string;
  position?: number;
  noteEdits?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  revision: number;
  sourceRevision: number;
  synthesizedRevision: number;
  status: 'idle' | 'queued' | 'processing' | 'failed';
  sources: LectureSource[];
  notes: LectureNotes | null;
  personalNotes: string;
  visualizations: LectureVisualization[];
  error?: string;
}
export type LectureSummary = Pick<LectureSession, 'schemaVersion' | 'id' | 'title' | 'finishedAt' | 'courseId' | 'position' | 'createdAt' | 'updatedAt' | 'revision' | 'sourceRevision' | 'synthesizedRevision' | 'status'>;
export interface LectureSynthesisInput {
  title: string;
  sources: LectureSource[];
  previousNotes: LectureNotes | null;
  previousSourceRevision?: number;
}
export interface LectureVisualInput {
  title: string;
  concept: LectureConcept;
  sources: LectureSource[];
}
export interface LectureVisualResult { source: string; duration: number; catalogIds: string[]; assets?: Record<string, import('./animlib/src/model-types').ModelAsset> }
export type LectureSynthesizer = (input: LectureSynthesisInput, signal: AbortSignal) => Promise<LectureNotes>;
export type LectureVisualGenerator = (input: LectureVisualInput, signal: AbortSignal) => Promise<LectureVisualResult>;

/** Legacy records occupy their chronological index within their own course. */
export function orderLectureSummaries<T extends Pick<LectureSummary, 'id' | 'courseId' | 'position' | 'createdAt'>>(lectures: readonly T[]): T[] {
  const chronology = (a: T, b: T) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  const courses = new Map<string | undefined, T[]>();
  for (const lecture of lectures) {
    const group = courses.get(lecture.courseId) ?? [];
    group.push(lecture); courses.set(lecture.courseId, group);
  }
  const fallback = new Map<string, number>();
  for (const group of courses.values()) group.sort(chronology).forEach((lecture, index) => fallback.set(lecture.id, index));
  return [...lectures].sort((a, b) => (a.courseId ?? '').localeCompare(b.courseId ?? '') ||
    (a.position ?? fallback.get(a.id)!) - (b.position ?? fallback.get(b.id)!) || chronology(a, b));
}
