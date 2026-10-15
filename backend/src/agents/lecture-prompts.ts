import { readFile } from 'node:fs/promises';
import type { VisualReviewPolicy } from './visual-gate.js';

/** Notebook policy is owned independently of full-video style and narration. */
export function loadLecturePrompt(name: 'lecture-visual' | 'lecture-visual-verify' | 'lecture-visual-repair'): Promise<string> {
  return readFile(new URL(`../../prompts/${name}.md`, import.meta.url), 'utf8');
}

export async function lectureVisualReviewPolicy(): Promise<VisualReviewPolicy> {
  const [guidance, repairGuidance] = await Promise.all([
    loadLecturePrompt('lecture-visual-verify'), loadLecturePrompt('lecture-visual-repair'),
  ]);
  return { id: 'lecture-visual', guidance, repairGuidance };
}
