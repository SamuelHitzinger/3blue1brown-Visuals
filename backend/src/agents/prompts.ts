import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export type PromptName = 'guidance' | 'scene-request-guidance' | 'animation-quality' | 'scene-verify' | 'scene-repair' | 'viewing-mode' | 'scene-craft' | 'story-review' | 'scene-review' | 'topics-system' | 'topics-format' | 'thumbnail';

/** Version of the host-enforced lesson policy; saved jobs retain their original contract. */
export const INSTRUCTION_VERSION = 2;

export function loadPrompt(name: PromptName): Promise<string> {
  return readFile(new URL(`../../prompts/${name}.md`, import.meta.url), 'utf8');
}

/** Fingerprint the saved stage system prompt, including contracts and API sections.
 * Runtime completion/tool protocols are separate from this stage snapshot. */
export function instructionSnapshot(systemPrompt: string) {
  return { version: INSTRUCTION_VERSION, sha256: createHash('sha256').update(systemPrompt).digest('hex') };
}
