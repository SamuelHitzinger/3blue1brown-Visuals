import test from 'node:test'
import assert from 'node:assert/strict'
import { generationEstimate } from '../src/generationProgressState.ts'
import type { VideoManifest } from '../../../shared/video/contract.ts'

const video = (overrides: Partial<VideoManifest> = {}): VideoManifest => ({
  schemaVersion: 1, id: 'video', title: 'Counting dots', revision: 1,
  status: 'generating', provider: 'pi', createdAt: '2026-10-11T00:00:00Z', scenes: [], ...overrides,
})

test('queued and legacy jobs show honest progress without inventing a scene total', () => {
  assert.deepEqual(generationEstimate(video({ status: 'queued' })), { percent: 0, label: 'Waiting to start', scenes: undefined })
  assert.deepEqual(generationEstimate(video()), { percent: undefined, label: 'Preparing your video', scenes: undefined })
  assert.equal(generationEstimate(video(), 'scene').label, 'Preparing your scene')
})

test('scene work names the active scene and shows verified completion separately', () => {
  const estimate = generationEstimate(video({ progress: { stage: 'scene', percent: 46, completedScenes: 1, totalScenes: 4, sceneIndex: 1 } }))
  assert.deepEqual(estimate, { percent: 46, label: 'Animating scene 2 of 4', scenes: '1 of 4 scenes ready' })
  assert.deepEqual(generationEstimate(video({ progress: { stage: 'validating', percent: 90, completedScenes: 0, totalScenes: 1, sceneIndex: 0 } }), 'scene'),
    { percent: 90, label: 'Checking your scene', scenes: '0 of 1 scene ready' })
})

test('only a completed job may show 100 percent, and failures stop visibly', () => {
  const progress = { stage: 'finalizing' as const, percent: 100, completedScenes: 1, totalScenes: 1 }
  assert.equal(generationEstimate(video({ progress })).percent, 99)
  assert.deepEqual(generationEstimate(video({ status: 'complete', progress })), { percent: 100, label: 'Video ready', scenes: '1 of 1 scene ready' })
  assert.equal(generationEstimate(video({ status: 'failed', progress: { ...progress, percent: 63 } })).label, 'Generation stopped')
  assert.equal(generationEstimate(video({ status: 'failed', progress: { ...progress, percent: 63 } })).percent, 63)
})

test('progress is clamped, and invalid estimates remain indeterminate', () => {
  const progress = { stage: 'script' as const, percent: -20, completedScenes: 0 }
  assert.equal(generationEstimate(video({ progress })).percent, 0)
  assert.equal(generationEstimate(video({ progress: { ...progress, percent: NaN } })).percent, undefined)
  assert.equal(generationEstimate(video({ progress: { ...progress, totalScenes: 0 } })).scenes, undefined)
})

test('speech and subtitle jobs describe their own timing stage', () => {
  const progress = { stage: 'narration' as const, percent: 20, completedScenes: 0, totalScenes: 1, sceneIndex: 0 }
  assert.equal(generationEstimate(video({ progress })).label, 'Preparing narration for scene 1 of 1')
  assert.equal(generationEstimate(video({ progress, narrationMode: 'subtitles' }), 'scene').label, 'Timing your scene captions')
})
