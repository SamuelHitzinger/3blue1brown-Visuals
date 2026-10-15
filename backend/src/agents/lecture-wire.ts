import type { LectureNotes, LectureSource } from '../../../shared/lecture.js';

/** Compact model transport only. Durable notes always keep their original source IDs. */
export function createLectureWire(sources: LectureSource[], previous: LectureNotes | null, incremental: boolean) {
  const occupied = new Set(sources.map(source => source.id));
  const encode = new Map<string, string>(), decode = new Map<string, string>();
  for (const source of sources) {
    if (source.id.length <= 16) continue;
    let alias = `s${source.sequence}`;
    while (occupied.has(alias)) alias += '_';
    occupied.add(alias); encode.set(source.id, alias); decode.set(alias, source.id);
  }
  const id = (value: string) => encode.get(value) ?? value;
  // Map citation fields only; equations, quoted questions and literal text are untouched.
  function references(value: unknown, aliases: Map<string, string>): unknown {
    if (Array.isArray(value)) return value.map(item => references(item, aliases));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'sourceIds' && Array.isArray(item) ? item.map(ref => typeof ref === 'string' ? aliases.get(ref) ?? ref : ref)
        : key === 'sourceId' && typeof item === 'string' ? aliases.get(item) ?? item : references(item, aliases)]));
  }
  return {
    id,
    notes: (notes: LectureNotes | null) => references(notes, encode),
    source: ({ id: sourceId, sequence, text, capture }: LectureSource) => ({ id: id(sourceId), sequence, text,
      ...(capture ? { capture: { kind: capture.kind, sequence: capture.sequence, capturedAt: capture.capturedAt,
        ...(capture.durationMs === undefined ? {} : { durationMs: capture.durationMs }),
        ...(capture.visualEvidence ? { visualEvidence: capture.visualEvidence } : {}),
        ...(capture.photoSnippet ? { photoSnippet: { description: capture.photoSnippet.description } } : {}) } } : {}) }),
    decode(output: string): unknown {
      if (output.length > 160_000) throw new Error('Notes are too long. Keep the synthesis concise.');
      const raw = JSON.parse(output);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected a notes object.');
      for (const field of ['sections', 'concepts'] as const) {
        if (!Array.isArray(raw[field])) continue; // Authoritative notes parser reports schema errors.
        raw[field] = raw[field].map((item: unknown) => {
          if (!item || typeof item !== 'object' || !('reuseId' in item)) return item;
          if (!incremental || Object.keys(item).length !== 1 || typeof item.reuseId !== 'string') throw new Error('reuseId is only allowed alone for an unchanged item in incremental mode.');
          const existing = previous?.[field].find(entry => entry.id === item.reuseId);
          if (!existing) throw new Error(`Unknown reuseId in ${field}. Use an existing ID or provide the complete item.`);
          return structuredClone(existing);
        });
      }
      return references(raw, decode);
    },
  };
}
