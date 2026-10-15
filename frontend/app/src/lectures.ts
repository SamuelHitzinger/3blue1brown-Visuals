import { assignLectureConcepts, lectureNoteText } from './lectureDocument.ts'
import type { LectureSession, LectureSummary, LectureVisualization } from '../../../shared/lecture'

async function responseJSON<T>(response: Response): Promise<T> {
  let body: unknown
  try { body = await response.json() } catch { throw new Error('The lecture service could not respond. Please try again.') }
  if (!response.ok) throw new Error(typeof (body as { detail?: unknown })?.detail === 'string' ? (body as { detail: string }).detail : 'Could not save your lecture. Please try again.')
  return body as T
}
const path = (id: string) => `/api/lectures/${encodeURIComponent(id)}`
const mutate = (url: string, method: string, body?: unknown, key?: string) => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(responseJSON<LectureSession>)
export const listLectures = (signal?: AbortSignal) => fetch('/api/lectures', { signal, cache: 'no-store' }).then(responseJSON<LectureSummary[]>)
export const getNoteInstructions = (signal?: AbortSignal) => fetch('/api/lectures/preferences', { signal, cache: 'no-store' }).then(responseJSON<{ instructions: string }>)
export const saveNoteInstructions = (instructions: string) => fetch('/api/lectures/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instructions }) }).then(responseJSON<{ instructions: string }>)
export const reorderLectures = (courseId: string | undefined, lectureIds: string[]): Promise<LectureSummary[]> => fetch('/api/lectures/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(courseId === undefined ? {} : { courseId }), lectureIds }) }).then(responseJSON<LectureSummary[]>)
export const getLecture = (id: string, signal?: AbortSignal) => fetch(path(id), { signal, cache: 'no-store' }).then(responseJSON<LectureSession>)
/** Idle visible lectures must discover material submitted by a paired phone. */
export function watchLectureSnapshots(id: string, accept: (session: LectureSession) => void, reportError: (message: string) => void, loaded: () => void = () => {}) {
  const controller = new AbortController()
  let refreshing = false
  const refresh = async (force = false) => {
    if (controller.signal.aborted || refreshing || (!force && document.visibilityState !== 'visible')) return
    refreshing = true
    try {
      const next = await getLecture(id, AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
      if (!controller.signal.aborted) { accept(next); reportError('') }
    } catch (error) { if (!controller.signal.aborted) reportError(error instanceof Error ? error.message : 'Could not load your lecture.') }
    finally { refreshing = false; if (!controller.signal.aborted) loaded() }
  }
  const visible = () => { if (document.visibilityState === 'visible') void refresh(true) }
  void refresh(true)
  const interval = setInterval(() => { void refresh() }, 3000)
  window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
  return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
}
export const createLecture = (input: { title?: string; courseId?: string }, key: string) => mutate('/api/lectures', 'POST', input, key)
export const detachCourseLectures = (courseId: string): Promise<LectureSummary[]> => fetch('/api/lectures/detach-course', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId }) }).then(responseJSON<LectureSummary[]>)
export const finishLecture = (id: string) => mutate(`${path(id)}/finish`, 'POST')
export const appendLectureSource = (id: string, text: string, key: string) => mutate(`${path(id)}/sources`, 'POST', { text, kind: 'text' }, key)
export const patchLecture = (id: string, fields: { title?: string; personalNotes?: string; noteEdits?: Record<string, string | null> }) => mutate(path(id), 'PATCH', fields)
export const synthesizeLecture = (id: string) => mutate(`${path(id)}/synthesize`, 'POST')
export const visualizeConcept = (id: string, conceptId: string) => mutate(`${path(id)}/concepts/${encodeURIComponent(conceptId)}/visualize`, 'POST')
export async function deleteLecture(id: string) {
  const response = await fetch(path(id), { method: 'DELETE' })
  if (!response.ok && response.status !== 404) await responseJSON(response)
}
/** A poll started before a mutation may finish after it. Identity and revision both matter. */
export function mergeLectureSnapshot(current: LectureSession | null, incoming: LectureSession): LectureSession {
  return current && (current.id !== incoming.id || current.revision >= incoming.revision) ? current : incoming
}
export const lecturePending = (session: LectureSession) => session.status === 'queued' || session.status === 'processing' || session.visualizations.some(visual => visual.status === 'queued' || visual.status === 'processing')
export const hasLectureVisual = (visual: LectureVisualization | undefined): visual is LectureVisualization & { source: string } => Boolean(visual?.source)
export function sourceRequestKey(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string, text: string): string {
  const storageKey = `aha-lecture-request-${id}`
  try { const previous = JSON.parse(storage.getItem(storageKey) || 'null'); if (previous?.text === text && typeof previous.key === 'string' && previous.key) return previous.key } catch { /* Start a new request if the saved record is damaged. */ }
  const key = crypto.randomUUID()
  try { storage.setItem(storageKey, JSON.stringify({ text, key })) } catch { /* In-memory retries still retain their request key. */ }
  return key
}
export const lectureStatus = (session: LectureSummary) => session.status === 'failed' ? 'Needs attention' : session.status === 'processing' || session.status === 'queued' ? 'Updating notes' : session.finishedAt ? 'Finished' : session.sourceRevision === 0 ? 'Ready for your notes' : 'Notes saved'
export function lectureMarkdown(session: LectureSession): string {
  const labels = new Map(session.sources.map(source => [source.id, `source-${source.sequence}`]))
  const citations = (ids: string[]) => [...new Set(ids)].flatMap(id => labels.has(id) ? [`[^${labels.get(id)}]`] : []).join(' ')
  const parts = [`# ${session.title}`, lectureNoteText(session, 'summary', session.notes?.summary || '')]
  for (const section of session.notes ? assignLectureConcepts(session.notes) : []) {
    const aiText = section.points.map(point => `- ${point.text} ${citations(point.sourceIds)}`.trimEnd()).join('\n')
    parts.push(`## ${section.title}`, lectureNoteText(session, `section:${section.id}`, aiText))
    for (const concept of section.concepts) {
      parts.push(`### ${concept.title}`, `${concept.explanation} ${citations(concept.sourceIds)}`.trimEnd())
      for (const visual of session.visualizations.filter(visual => visual.conceptId === concept.id)) parts.push(`Visual explanation: ${visual.title} (${visual.status}${visual.sourceRevision < session.synthesizedRevision ? ', earlier notes' : ''})`)
    }
  }
  if (session.notes?.questions.length) parts.push('## Open questions', session.notes.questions.map(question => `- ${question.text} ${citations(question.sourceIds)}`.trimEnd()).join('\n'))
  parts.push('## My notes', session.personalNotes || '_No personal notes yet._', '## Sources')
  for (const source of session.sources) parts.push(`[^${labels.get(source.id)}]: ${source.text.replace(/\n/g, '\n    ')}`)
  return parts.filter(Boolean).join('\n\n') + '\n'
}
export function downloadLecture(session: LectureSession) {
  const url = URL.createObjectURL(new Blob([lectureMarkdown(session)], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${session.title.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().slice(0, 80) || 'lecture-notes'}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
