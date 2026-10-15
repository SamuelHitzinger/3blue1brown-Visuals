import type { LectureConcept, LectureNotes, LectureSession } from '../../../shared/lecture'
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
