import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capturePreset, capturePhotoIntervalMs } from '../src/captureMode.ts'
test('ChatGPT camera mode never requests microphone, including audio-only server', () => {
  assert.deepEqual(capturePreset('chatgpt', { audio: true, photo: true }), { audio: false, photo: true })
  assert.deepEqual(capturePreset('chatgpt', { audio: true, photo: false }), { audio: false, photo: false })
  assert.deepEqual(capturePreset('standard', { audio: true, photo: true }), { audio: true, photo: true })
})
test('ChatGPT photos use ten seconds regardless of the standard-mode interval', () => {
  for (const seconds of [15, 30, 60]) assert.equal(capturePhotoIntervalMs('chatgpt', seconds), 10_000)
  assert.equal(capturePhotoIntervalMs('standard', 30), 30_000)
})
