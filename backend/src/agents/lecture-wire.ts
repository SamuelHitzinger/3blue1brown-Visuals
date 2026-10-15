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
  const point = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    if (value.length < 2 || value.length > 6) throw new Error('Compact points contain text, sourceIds, and optional kind/group/label/math.');
    const [text, sourceIds, kind, group, label, math] = value;
    return { text, sourceIds, ...(kind ? { kind } : {}), ...(group ? { group } : {}), ...(label ? { label } : {}), ...(math ? { math } : {}) };
  };
  const element = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    const [type, a, b, c, d, color, arrow] = value;
    if (type === 'line' && value.length >= 5 && value.length <= 7) return { type, x1: a, y1: b, x2: c, y2: d, ...(color ? { color } : {}), ...(arrow === undefined ? {} : { arrow }) };
    if (type === 'rect' && value.length >= 5 && value.length <= 6) return { type, x: a, y: b, width: c, height: d, ...(color ? { color } : {}) };
    if (type === 'circle' && value.length >= 4 && value.length <= 5) return { type, cx: a, cy: b, r: c, ...(d ? { color: d } : {}) };
    if (type === 'text' && value.length >= 4 && value.length <= 5) return { type, x: a, y: b, text: c, ...(d ? { color: d } : {}) };
    throw new Error('Invalid compact diagram element.');
  };
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
      let raw = JSON.parse(output);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected a notes object.');
      if ('patch' in raw) {
        const patch = raw.patch;
        if (!incremental || !previous || Object.keys(raw).length !== 1 || !patch || typeof patch !== 'object' || Array.isArray(patch)
          || Object.keys(patch).some(key => !['summary', 'subtitle', 'sections', 'concepts', 'sketches', 'questions', 'removeSectionIds', 'removeConceptIds'].includes(key))) {
          throw new Error('Use a patch object only for incremental updates; omit unchanged fields.');
        }
        raw = structuredClone(previous);
        if (patch.sketches !== undefined) {
          if (!Array.isArray(patch.sketches) || (patch.concepts !== undefined && !Array.isArray(patch.concepts))) throw new Error('Sketches must be a list.');
          patch.concepts = [...(patch.concepts ?? []), ...patch.sketches.map((sketch: unknown) => {
            if (!Array.isArray(sketch) || sketch.length < 5 || sketch.length > 7) throw new Error('Sketch: [id, sectionId, caption, sourceIds, elements, optional terms, optional group].');
            const [id, sectionId, caption, sourceIds, elements, terms, group] = sketch;
            return { id, sectionId, title: caption, explanation: caption, sourceIds, visualKind: 'static', catalogIds: [], visualizationPrompt: '', diagram: { alt: caption, elements }, ...(terms === undefined ? {} : { terms }), ...(group === undefined ? {} : { group }) };
          })];
        }
        for (const field of ['summary', 'subtitle', 'questions'] as const) if (patch[field] !== undefined) raw[field] = patch[field];
        for (const field of ['sections', 'concepts'] as const) {
          const removalKey = field === 'sections' ? 'removeSectionIds' : 'removeConceptIds';
          const removals = patch[removalKey] ?? [], updates = patch[field] ?? [];
          if (!Array.isArray(removals) || !Array.isArray(updates) || new Set(removals).size !== removals.length
            || removals.some(id => typeof id !== 'string' || !previous[field].some(item => item.id === id))) throw new Error('Patch removals must name existing unique IDs.');
          raw[field] = raw[field].filter((item: { id: string }) => !removals.includes(item.id));
          const seen = new Set<string>();
          for (const item of updates) {
            const id = item && typeof item === 'object' && !Array.isArray(item) ? item.updateId ?? item.id : undefined;
            if (typeof id !== 'string' || seen.has(id) || removals.includes(id)) throw new Error('Each patch item needs one unique id or updateId; do not also remove it.');
            seen.add(id);
            const index = raw[field].findIndex((existing: { id: string }) => existing.id === id);
            if (index === -1) raw[field].push(item); else raw[field][index] = item;
          }
        }
      }
      for (const field of ['sections', 'concepts'] as const) {
        if (!Array.isArray(raw[field])) continue; // Authoritative notes parser reports schema errors.
        raw[field] = raw[field].map((item: unknown) => {
          if (field === 'sections' && item && typeof item === 'object' && 'updateId' in item) {
            const patch = item as Record<string, unknown>;
            const existing = previous?.sections.find(section => section.id === patch.updateId);
            if (!incremental || !existing || Object.keys(patch).some(key => !['updateId', 'points', 'appendPoints', 'title', 'photo'].includes(key))
              || (patch.points !== undefined && patch.appendPoints !== undefined)) throw new Error('Invalid incremental section update. Use updateId and either points or appendPoints.');
            const result = structuredClone(existing);
            if (patch.title !== undefined) result.title = patch.title as string;
            if (patch.photo !== undefined) { if (patch.photo === null) delete result.photo; else result.photo = patch.photo as typeof result.photo; }
            const expand = (value: unknown) => {
              if (!value || typeof value !== 'object' || !('reusePoint' in value)) return value;
              const index = value.reusePoint;
              if (Object.keys(value).length !== 1 || !Number.isInteger(index) || typeof index !== 'number' || index < 0 || index >= existing.points.length) throw new Error('reusePoint must be a valid zero-based index in that existing section.');
              return structuredClone(existing.points[index]);
            };
            if (patch.points !== undefined) {
              if (!Array.isArray(patch.points)) throw new Error('points must be a list.');
              result.points = patch.points.map(expand) as typeof result.points;
            }
            if (patch.appendPoints !== undefined) {
              if (!Array.isArray(patch.appendPoints)) throw new Error('appendPoints must be a list.');
              result.points.push(...patch.appendPoints);
            }
              result.points = result.points.map(point) as typeof result.points;
              return result;
          }
          if (!item || typeof item !== 'object' || !('reuseId' in item)) return item;
          if (!incremental || Object.keys(item).length !== 1 || typeof item.reuseId !== 'string') throw new Error('reuseId is only allowed alone for an unchanged item in incremental mode.');
          const existing = previous?.[field].find(entry => entry.id === item.reuseId);
          if (!existing) throw new Error(`Unknown reuseId in ${field}. Use an existing ID or provide the complete item.`);
          return structuredClone(existing);
        });
      }
      if (Array.isArray(raw.sections)) for (const section of raw.sections) if (Array.isArray(section?.points)) section.points = section.points.map(point);
      if (Array.isArray(raw.concepts)) for (const concept of raw.concepts) if (Array.isArray(concept?.diagram?.elements)) concept.diagram.elements = concept.diagram.elements.map(element);
      return references(raw, decode);
    },
  };
}
