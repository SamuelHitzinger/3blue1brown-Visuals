import test from 'node:test'
import assert from 'node:assert/strict'
import { captureHealth } from '../src/captureHealth.ts'
import type { CaptureStatus } from '../../../shared/lecture-capture.ts'

const now = Date.parse('2026-10-14T10:02:00Z')
const status = { pending: 0, failed: 0, notes: { status: 'idle', sourceRevision: 2, synthesizedRevision: 2, pendingSources: 0 } } as CaptureStatus
test('health never claims notes are caught up while uploads or extraction remain', () => {
  assert.match(captureHealth(status, 1, now, now).detail, /upload/)
  assert.match(captureHealth({ ...status, pending: 2 }, 0, now, now).detail, /processing/)
  assert.match(captureHealth(status, 0, now, now).detail, /caught up/)
})
test('failed notes and stale status remain visible even with empty upload queue', () => {
  assert.equal(captureHealth({ ...status, notes: { ...status.notes!, status: 'failed' } }, 0, now, now).tone, 'error')
  assert.match(captureHealth(status, 0, now - 20_000, now).detail, /reconnect/i)
  assert.equal(captureHealth({ ...status, failed: 1 }, 0, now, now).tone, 'error')
})
test('notes lag uses oldest unsynthesized source, not age of last successful note', () => {
  const result = captureHealth({ ...status, notes: { ...status.notes!, status: 'processing', pendingSources: 3, pendingSince: '2026-10-14T10:00:30Z' } }, 0, now, now)
  assert.match(result.detail, /3/); assert.match(result.detail, /90s/)
  assert.equal(result.tone, 'waiting')
})

test('newly acknowledged uploads invalidate an older server status snapshot', () => {
  const result = captureHealth(status, 0, now - 1000, now, now - 500)
  assert.equal(result.tone, 'waiting'); assert.match(result.detail, /latest uploads/)
  assert.equal(captureHealth(status, 0, now, now, now - 500).tone, 'ok')
})
