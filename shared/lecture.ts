/** Durable lecture contracts. Future capture adapters normalize their output into sources. */
export interface LectureSource {
  id: string;
  sequence: number;
  kind: 'text';
  text: string;
  createdAt: string;
}

export interface LecturePoint { text: string; sourceIds: string[] }
export interface LectureConcept {
  id: string;
  title: string;
  explanation: string;
  sourceIds: string[];
  visualizationPrompt: string;
  catalogIds: string[];
}
export interface LectureNotes {
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
  courseId?: string;
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
export type LectureSummary = Pick<LectureSession, 'schemaVersion' | 'id' | 'title' | 'courseId' | 'createdAt' | 'updatedAt' | 'revision' | 'sourceRevision' | 'synthesizedRevision' | 'status'>;
export interface LectureSynthesisInput {
  title: string;
  sources: LectureSource[];
  previousNotes: LectureNotes | null;
}
export interface LectureVisualInput {
  title: string;
  concept: LectureConcept;
  sources: LectureSource[];
}
export interface LectureVisualResult { source: string; duration: number; catalogIds: string[]; assets?: Record<string, import('./animlib/src/model-types').ModelAsset> }
export type LectureSynthesizer = (input: LectureSynthesisInput, signal: AbortSignal) => Promise<LectureNotes>;
export type LectureVisualGenerator = (input: LectureVisualInput, signal: AbortSignal) => Promise<LectureVisualResult>;
