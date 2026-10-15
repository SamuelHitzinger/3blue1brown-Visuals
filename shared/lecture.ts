/** A tight readable crop, in normalized coordinates of the captured JPEG. */
export interface LecturePhotoSnippet {
  crop: { x: number; y: number; width: number; height: number };
  description: string;
}
export interface LecturePhotoReference { sourceId: string; caption: string }
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
    photoSnippet?: LecturePhotoSnippet;
    visualEvidence?: string;
  };
}

export interface LecturePoint {
  text: string; sourceIds: string[];
  /** Optional presentation metadata; old notebooks remain readable. */
  kind?: 'note' | 'equation' | 'relation' | 'caveat';
  group?: string;
  label?: string;
  /** TeX for the same equation as text, without display delimiters. */
  math?: string;
}
export type LectureColor = 'blue' | 'teal' | 'amber' | 'ink';
/** Deliberately limited drawing vocabulary: no markup, scripts or external resources. */
export interface LectureDiagram {
  alt: string;
  elements: ( { type: 'text'; x: number; y: number; text: string; color?: LectureColor }
    | { type: 'line'; x1: number; y1: number; x2: number; y2: number; arrow?: boolean; color?: LectureColor }
    | { type: 'circle'; cx: number; cy: number; r: number; color?: LectureColor }
    | { type: 'rect'; x: number; y: number; width: number; height: number; color?: LectureColor }
    | { type: 'polyline' | 'polygon'; points: [number, number][]; color?: LectureColor } )[];
}
export interface LectureQuestion extends LecturePoint { diagram?: LectureDiagram }
export interface LectureConcept {
  visualKind?: 'static' | 'animation' | 'interactive';
  diagram?: LectureDiagram;
  /** Identical terms in notes and drawings carry identical colors. */
  terms?: { text: string; color: LectureColor }[];
  sectionId?: string;
  /** Anchor the figure beside points with this exact group in its section. */
  group?: string;
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
  sections: { id: string; title: string; points: LecturePoint[]; photo?: LecturePhotoReference }[];
  concepts: LectureConcept[];
  questions: LectureQuestion[];
}
export interface LectureVisualization {
  visualKind?: 'animation' | 'interactive';
  stale?: boolean;
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
  noteCanvas?: Record<string, import('./notebookCanvas').NotebookCanvasData>;
  createdAt: string;
  updatedAt: string;
  revision: number;
  sourceRevision: number;
  synthesizedRevision: number;
  /** Explicit refresh re-reads sources, while ordinary capture remains incremental. */
  notesRefreshRequested?: boolean;
  notesFormatVersion?: number;
  status: 'idle' | 'queued' | 'processing' | 'failed';
  sources: LectureSource[];
  notes: LectureNotes | null;
  personalNotes: string;
  visualizations: LectureVisualization[];
  error?: string;
}
export type LectureSummary = Pick<LectureSession, 'schemaVersion' | 'id' | 'title' | 'finishedAt' | 'courseId' | 'position' | 'createdAt' | 'updatedAt' | 'revision' | 'sourceRevision' | 'synthesizedRevision' | 'status'>;
export interface LectureSynthesisInput {
  /** Host identifier for timing diagnostics; not injected into the model prompt. */
  lectureId?: string;
  instructions?: string;
  title: string;
  sources: LectureSource[];
  previousNotes: LectureNotes | null;
  previousSourceRevision?: number;
  /** Existing note/canvas edit anchors that an editorial rewrite must retain. */
  preservedSectionIds?: string[];
  preservedConceptIds?: string[];
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
