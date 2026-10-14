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
