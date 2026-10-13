import type { AuthoringReferenceSection } from './authoring-reference.js';

export interface ReferenceReadInput { id: string; offset?: number; limit?: number }
export interface ReferencePage {
  id: string; title: string; content: string; totalChars: number; offset: number; nextOffset?: number;
}
export interface ReferenceTools { read(input: ReferenceReadInput, signal: AbortSignal): Promise<ReferencePage> }

/** A bounded immutable snapshot: no filesystem paths, network requests, or hidden truncation. */
export function createReferenceTools(sections: AuthoringReferenceSection[]): ReferenceTools {
  const entries = new Map<string, Readonly<AuthoringReferenceSection>>();
  for (const section of sections) {
    if (entries.has(section.id)) throw new Error(`Duplicate reference section: ${section.id}`);
    entries.set(section.id, Object.freeze({ ...section }));
  }
  return {
    async read({ id, offset = 0, limit = 12_000 }, signal) {
      signal.throwIfAborted();
      const section = entries.get(id);
      if (!section) throw new Error('Unknown animlib reference ID. Choose an exact ID from the worked recipe index.');
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > section.content.length
        || !Number.isSafeInteger(limit) || limit < 1000 || limit > 16_000) {
        throw new Error('Reference window requires offset within the section and an integer limit from 1000 to 16000.');
      }
      const end = Math.min(section.content.length, offset + limit);
      return { id, title: section.title, content: section.content.slice(offset, end), totalChars: section.content.length,
        offset, ...(end < section.content.length ? { nextOffset: end } : {}) };
    },
  };
}
