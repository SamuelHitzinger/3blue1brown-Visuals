import type { LectureSession } from './lecture.js';

/** Short-lived, read-only capability. The secret is returned only on issuance. */
export interface LectureViewLink { url: string; expiresAt: string }
export interface LectureViewLinkStatus { active: boolean; expiresAt?: string }

/** Deliberately excludes raw sources, ownership and capture credentials. */
export type LectureLiveSnapshot = Pick<LectureSession,
  'id' | 'title' | 'revision' | 'updatedAt' | 'sourceRevision' | 'synthesizedRevision' |
  'status' | 'notes' | 'noteEdits' | 'personalNotes' | 'visualizations' | 'error'>;
