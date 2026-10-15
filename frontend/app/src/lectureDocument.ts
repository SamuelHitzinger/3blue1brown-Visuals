import type { LectureConcept, LectureNotes, LectureSession, LecturePoint } from '../../../shared/lecture'
export function assignLectureConcepts(notes: LectureNotes) {
  const sections = notes.sections.map(section => ({ ...section, concepts: [] as LectureConcept[] }))
  if (!sections.length && notes.concepts.length) sections.push({ id: 'concepts', title: 'Ideas in this lecture', points: [], concepts: [] })
  for (const concept of notes.concepts) {
    let target = sections.find(section => section.id === concept.sectionId)
    if (!target) {
      let best = -1
      for (const section of sections) {
        const sources = new Set(section.points.flatMap(point => point.sourceIds))
        const overlap = new Set(concept.sourceIds.filter(id => sources.has(id))).size
        if (overlap > best) { best = overlap; target = section }
      }
    }
    target?.concepts.push(concept)
  }
  return sections
}
export function lectureNoteText(session: Pick<LectureSession, 'noteEdits'>, key: string, aiText: string) {
  return session.noteEdits?.[key] ?? aiText
}

/** AI IDs occupy their own namespace, separate from overview/questions/personal roles. */
export function notebookSectionKey(id: string) { return `section-${id}` }

export function groupNotebookPoints(points: LecturePoint[]) {
  const groups: { title?: string; points: LecturePoint[] }[] = []
  for (const point of points) {
    let group = groups.at(-1)
    if (!group || group.title !== point.group) { group = { title: point.group, points: [] }; groups.push(group) }
    group.points.push(point)
  }
  return groups
}

/** Preserve all visible conditions/headings when a structured section becomes a personal edit. */
export function notebookEditText(points: LecturePoint[]) {
  return groupNotebookPoints(points).map(group => [group.title, ...group.points.map(point => point.label ? `${point.label}: ${point.text}` : point.text)].filter(Boolean).join('\n')).join('\n\n')
}

export function noteLineKind(point: LecturePoint): NonNullable<LecturePoint['kind']> {
  if (point.kind) return point.kind
  if (/[→↔⇒↑↓]/u.test(point.text)) return 'relation'
  if (/[=≡]/u.test(point.text)) return 'equation'
  return 'note'
}

/** Plain-text legacy equations: render scripts as text nodes, never interpret markup. */
export function splitNoteScripts(text: string) {
  const parts: { text: string; script?: 'sub' | 'sup' }[] = []
  let cursor = 0
  for (const match of text.matchAll(/([_^])(?:\{([^{}]+)\}|([+-]?\d+|[\p{L}\p{N}]+))/gu)) {
    if (match.index! > cursor) parts.push({ text: text.slice(cursor, match.index) })
    parts.push({ text: match[2] ?? match[3], script: match[1] === '_' ? 'sub' : 'sup' })
    cursor = match.index! + match[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}

/** Match complete terms; a symbol such as v must not color every v inside prose. */
export function findNoteTerm(text: string, term: string, from: number): number {
  if (!term) return -1
  const word = /[\p{L}\p{N}_]/u
  let index = text.indexOf(term, from)
  while (index !== -1) {
    const before = [...text.slice(0, index)].at(-1) ?? ''
    const after = [...text.slice(index + term.length)][0] ?? ''
    if (!(word.test(term[0]) && word.test(before)) && !(word.test(term.at(-1)!) && word.test(after))) return index
    index = text.indexOf(term, index + term.length)
  }
  return -1
}
