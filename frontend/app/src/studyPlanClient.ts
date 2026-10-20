import type { PlanDocument, StudyPlan, VideoSegment } from './plan'
import { isStudyPlan } from './subjectPlans.ts'

type Progress = (message: string) => void
const progressMessage = (stage: unknown) => stage === 'planning' ? 'Creating your topics and lessons… Larger uploads can take a few minutes.' : 'Reading your files and screenshots…'
const detail = (value: unknown): string | undefined => value && typeof value === 'object' && 'detail' in value && typeof value.detail === 'string' ? value.detail : undefined

function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

/** Only the upload is a POST. Slow AI work is retrieved through short, retryable GETs. */
export async function waitForStudyPlan(response: Response, signal: AbortSignal, onProgress: Progress = () => {}, pollIntervalMs = 1500): Promise<StudyPlan> {
  let data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(detail(data) ?? 'The upload connection was interrupted. Your material is still here. Please try again.')
  if (response.status !== 202) {
    if (!isStudyPlan(data)) throw new Error('The server returned an incomplete plan. Your material is still here. Please try again.')
    return data
  }
  const id = data && typeof data === 'object' && 'id' in data ? data.id : undefined
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('The server could not start planning. Your material is still here. Please try again.')
  const path = `/api/study-plans/${id}`
  const polling = AbortSignal.any([signal, AbortSignal.timeout(12 * 60_000)])
  const cancel = () => { void fetch(path, { method: 'DELETE', keepalive: true }).catch(() => {}) }
  polling.addEventListener('abort', cancel, { once: true })
  let failures = 0
  try {
    if (polling.aborted) { cancel(); polling.throwIfAborted() }
    while (true) {
      onProgress(progressMessage(data && typeof data === 'object' && 'stage' in data ? data.stage : undefined))
      await pause(pollIntervalMs, polling)
      try {
        response = await fetch(path, { signal: AbortSignal.any([polling, AbortSignal.timeout(20_000)]), cache: 'no-store' })
      } catch (error) {
        polling.throwIfAborted()
        if (++failures <= 5) continue
        cancel()
        throw new Error('The connection was lost while planning. Your material is still here. Please try again.', { cause: error })
      }
      data = await response.json().catch(() => null)
      // Gateways can briefly return an HTML error. Retry the same job, never resubmit material.
      if (([502, 503, 504].includes(response.status) && !detail(data)) || (response.ok && !data)) {
        if (++failures <= 5) continue
        cancel()
        throw new Error('The server connection was interrupted. Your material is still here. Please try again.')
      }
      failures = 0
      if (!response.ok) throw new Error(detail(data) ?? 'Could not retrieve the plan. Your material is still here. Please try again.')
      if (response.status === 202) continue
      if (!isStudyPlan(data)) throw new Error('The server returned an incomplete plan. Your material is still here. Please try again.')
      return data
    }
  } finally { polling.removeEventListener('abort', cancel) }
}

export async function requestStudyPlan(document: PlanDocument, signal: AbortSignal): Promise<StudyPlan> {
  const response = await fetch('/api/study-plans', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'respond-async' }, body: JSON.stringify(document), signal })
  return waitForStudyPlan(response, signal)
}

/** Submit files and notes together so AI can group overlapping material. */
export async function requestMaterialPlan(material: { name: string; files: File[]; text: string }, signal: AbortSignal, onProgress?: Progress): Promise<StudyPlan> {
  const body = new FormData()
  body.set('name', material.name)
  body.set('text', material.text)
  for (const file of material.files) body.append('files', file)
  const response = await fetch('/api/study-plans', { method: 'POST', headers: { Prefer: 'respond-async' }, body, signal })
  return waitForStudyPlan(response, signal, onProgress)
}

/** Carry source content and explicit learner assumptions without claiming prior mastery. */
export function topicLessonText(topic: VideoSegment, plan: StudyPlan, outlineContext = ''): string {
  const learner = [plan.audience ? `Audience: ${plan.audience}` : '', plan.assumed?.length ? `Prerequisite assumptions (not verified understanding): ${plan.assumed.join(', ')}` : ''].filter(Boolean)
  if (!topic.summary) return [...learner, topic.text.trim() ? topic.text : outlineContext].filter(Boolean).join('\n\n')
  const all = plan.chapters.flatMap(chapter => chapter.segments)
  const earlier = (topic.requires ?? []).flatMap(id => {
    const found = all.find(t => t.id === id)
    return found ? [found.title] : []
  })
  const parts = [
    ...learner,
    `From: ${plan.title} (${topic.sourceReference ?? ''})`,
    `Summary: ${topic.summary}`,
    `What makes it visual: ${topic.whyVisual ?? ''}`,
    'Key ideas, in order:\n' + (topic.keyIdeas ?? []).map(k => `- ${k}`).join('\n'),
    'Source notes:\n' + topic.text,
  ]
  if (earlier.length) parts.push('Earlier planned topics (coverage is not proof of understanding; reactivate needed ideas): ' + earlier.join(', '))
  return parts.join('\n\n')
}
