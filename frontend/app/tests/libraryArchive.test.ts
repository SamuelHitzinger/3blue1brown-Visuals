import test from 'node:test'
import assert from 'node:assert/strict'
import { applyLocalLibrary, libraryViewLessons, loadLocalLibrary } from '../src/libraryArchive.ts'
import type { Lesson } from '../src/data.ts'

const local: Lesson = { id: 'example', title: 'Example', subtitle: '', subject: 'Math', duration: 10, artwork: 'vectors', color: 'sage' }
const archivedAt = '2026-10-11T10:00:00.000Z'

test('archived bookmarks are only visible in Archive, not All or Saved', () => {
  const lessons = [local, { ...local, id: 'archived', archivedAt }, { ...local, id: 'unsaved' }]
  const bookmarks = ['example', 'archived']
  assert.deepEqual(libraryViewLessons(lessons, 'all', bookmarks).map(l => l.id), ['example', 'unsaved'])
  assert.deepEqual(libraryViewLessons(lessons, 'saved', bookmarks).map(l => l.id), ['example'])
  assert.deepEqual(libraryViewLessons(lessons, 'archive', bookmarks).map(l => l.id), ['archived'])
})

test('local archive and permanent deletion survive reloading older previews', () => {
  const archive = loadLocalLibrary({ getItem: () => JSON.stringify({ archived: { example: archivedAt }, deleted: [] }) })
  assert.equal(applyLocalLibrary([local], archive)[0].archivedAt, archivedAt)
  const deleted = loadLocalLibrary({ getItem: () => JSON.stringify({ archived: {}, deleted: ['example'] }) })
  assert.deepEqual(applyLocalLibrary([local], deleted), [])
})

test('local metadata cannot override server archive or deletion state', () => {
  const server = { ...local, videoId: 'example', archivedAt }
  assert.deepEqual(applyLocalLibrary([server], { archived: {}, deleted: ['example'] }), [server])
})

test('invalid or unavailable local storage starts with an empty archive', () => {
  assert.deepEqual(loadLocalLibrary({ getItem: () => '{broken' }), { archived: {}, deleted: [] })
  assert.deepEqual(loadLocalLibrary({ getItem: () => '{"archived":[],"deleted":false}' }), { archived: {}, deleted: [] })
  assert.deepEqual(loadLocalLibrary({ getItem: () => { throw new Error('Unavailable') } }), { archived: {}, deleted: [] })
})
