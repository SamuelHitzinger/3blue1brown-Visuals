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
export const getLecture = (id: string, signal?: AbortSignal) => fetch(path(id), { signal, cache: 'no-store' }).then(responseJSON<LectureSession>)
export const createLecture = (input: { title: string; courseId?: string }, key: string) => mutate('/api/lectures', 'POST', input, key)
export const appendLectureSource = (id: string, text: string, key: string) => mutate(`${path(id)}/sources`, 'POST', { text, kind: 'text' }, key)
export const patchLecture = (id: string, fields: { title?: string; personalNotes?: string }) => mutate(path(id), 'PATCH', fields)
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
export const lectureStatus = (session: LectureSummary) => session.status === 'failed' ? 'Needs attention' : session.status === 'processing' || session.status === 'queued' ? 'Updating notes' : session.sourceRevision === 0 ? 'Ready for your notes' : 'Notes saved'
export function lectureMarkdown(session: LectureSession): string {
  const labels = new Map(session.sources.map(source => [source.id, `source-${source.sequence}`]))
  const citations = (ids: string[]) => [...new Set(ids)].flatMap(id => labels.has(id) ? [`[^${labels.get(id)}]`] : []).join(' ')
  const parts = [`# ${session.title}`, session.notes?.summary || '']
  for (const section of session.notes?.sections ?? []) parts.push(`## ${section.title}`, section.points.map(point => `- ${point.text} ${citations(point.sourceIds)}`.trimEnd()).join('\n'))
  if (session.notes?.concepts.length) parts.push('## Concepts', session.notes.concepts.map(concept => `### ${concept.title}\n\n${concept.explanation} ${citations(concept.sourceIds)}`.trimEnd()).join('\n\n'))
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
