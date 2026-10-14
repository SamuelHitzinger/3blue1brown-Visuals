import test from 'node:test'
import assert from 'node:assert/strict'
import { nextLectureTitle } from '../../../shared/lectureTitles.ts'

test('suggestions continue highest numbered lecture and preserve its naming convention', () => {
  assert.equal(nextLectureTitle([]), 'Lecture 1')
  assert.equal(nextLectureTitle([{ title: 'Lecture 10: Matter' }, { title: 'Lecture 3: Light' }]), 'Lecture 11')
  assert.equal(nextLectureTitle([{ title: 'Introduction' }, { title: 'Atoms' }]), 'Lecture 3')
  assert.equal(nextLectureTitle([{ title: 'Vorlesung 09: Atome' }]), 'Vorlesung 10')
  assert.equal(nextLectureTitle([{ title: 'Lecture 99999999999999999999999999' }]), 'Lecture 2')
})
