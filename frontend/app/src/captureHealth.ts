import type { CaptureStatus } from '../../../shared/lecture-capture'

export function captureHealth(status: CaptureStatus, localPending: number, lastStatusAt: number, now: number, lastUploadedAt = 0): { tone: 'ok' | 'waiting' | 'error'; title: string; detail: string } {
  if (now - lastStatusAt > 15_000) return { tone: 'waiting', title: 'Connection interrupted', detail: 'Reconnecting to check processing. Keep this page open; unsent captures remain on this device.' }
  if (status.failed) return { tone: 'error', title: 'Some recordings need attention', detail: `${status.failed} captures could not be processed. Their recordings are saved; see the errors below.` }
  if (status.notes?.status === 'failed') return { tone: 'error', title: 'Notes update failed', detail: 'Captured material is saved. Open the lecture on your computer to retry updating notes.' }
  const notes = status.notes
  const waiting = [localPending ? `${localPending} waiting to upload` : '', status.pending ? `${status.pending} processing` : '', notes?.pendingSources ? `${notes.pendingSources} sources waiting for notes` : ''].filter(Boolean)
  if (waiting.length) {
    const age = notes?.pendingSince ? Math.max(0, Math.floor((now - Date.parse(notes.pendingSince)) / 1000)) : 0
    return { tone: 'waiting', title: 'Updating live notes', detail: `${waiting.join(' · ')}.${Number.isFinite(age) && age > 0 ? ` Oldest note update waiting ${age}s.` : ''}` }
  }
  if (lastUploadedAt && lastUploadedAt >= lastStatusAt) return { tone: 'waiting', title: 'Checking latest uploads', detail: 'Waiting for processing status for the latest uploads.' }
  if (!notes || !notes.sourceRevision) return { tone: 'waiting', title: 'Waiting for lecture material', detail: 'Audio is saved in 15-second clips. Notes appear after speech or a readable photo is processed.' }
  if (notes.status !== 'idle') return { tone: 'waiting', title: 'Updating live notes', detail: 'An update is in progress. Previous notes remain available.' }
  return { tone: 'ok', title: 'Live notes caught up', detail: 'Notes are caught up with all processed captures.' }
}
