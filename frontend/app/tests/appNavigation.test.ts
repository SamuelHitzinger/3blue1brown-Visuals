import test from 'node:test'
import assert from 'node:assert/strict'
import { appPath } from '../src/appNavigation.ts'

test('old creation and dashboard links open one of the three remaining areas', () => {
  for (const [input, expected] of [
    ['/', '/'], ['/videos/new', '/'], ['/settings', '/'], ['/catalog', '/library'],
    ['/courses', '/lectures'], ['/plan', '/lectures'],
    ['/courses/course-123', '/lectures/course/course-123'], ['/plan/course-123', '/lectures/course/course-123'],
  ]) assert.equal(appPath(input), expected)
})

test('notes, course folders and saved video deep links keep their destinations', () => {
  for (const path of ['/library', '/lectures', '/lectures/lecture-123', '/lectures/course/course-123', '/watch/video-123']) {
    assert.equal(appPath(path), path)
  }
  assert.equal(appPath('/unknown'), '/')
})
