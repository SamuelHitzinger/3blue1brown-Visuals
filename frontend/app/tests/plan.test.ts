import test from 'node:test'
import assert from 'node:assert/strict'
import { createStudyPlan, exampleDocument } from '../src/plan.ts'

test('a course outline becomes ordered chapters with individual video topics', () => {
  const plan = createStudyPlan(exampleDocument)
  assert.equal(plan.title, 'Linear algebra')
  assert.equal(plan.chapters.length, 4)
  assert.equal(plan.chapters.flatMap(chapter => chapter.segments).length, 9)
  assert.deepEqual(plan.chapters[1].segments.map(segment => segment.title), ['Reading a matrix', 'Matrix multiplication', 'Inverses and determinants'])
  assert.match(plan.chapters[1].segments[1].text, /dot product/)
})

test('numbered script chapters retain their source page references', () => {
  const text = 'A vector has coordinates that identify a point in a space. Scalar multiplication changes its length and can reverse its direction.'
  const plan = createStudyPlan({ name: 'Course.pdf', pages: 8, lines: [
    { text: '1 Vectors', page: 2 }, { text: '1.1 Coordinates', page: 2 }, { text, page: 3 },
    { text: '2 Matrices', page: 5 }, { text: '2.1 Matrix multiplication', page: 5 }, { text, page: 6 },
  ] })
  assert.deepEqual(plan.chapters.map(chapter => chapter.title), ['Vectors', 'Matrices'])
  assert.equal(plan.chapters[1].segments[0].title, 'Matrix multiplication')
  assert.equal(plan.chapters[1].segments[0].pageStart, 6)
  assert.equal(plan.sourcePages, 8)
})

test('local outlines preserve a topic without splitting it to fit a runtime', () => {
  const paragraph = 'The value 0.5 scales a vector by one half. Matrix A maps each point to its new coordinates, and A² applies the same mapping twice.'
  const text = Array(60).fill(paragraph).join(' ')
  const plan = createStudyPlan({ name: 'Matrices', lines: [{ text: '# Matrices' }, { text: '## Matrix multiplication' }, { text }] })
  const segments = plan.chapters.flatMap(chapter => chapter.segments)
  assert.equal(segments.length, 1)
  assert.equal(segments.map(segment => segment.text).join(' '), text)
  assert.ok(segments.every(segment => segment.minutes === undefined))
})

test('unstructured material remains usable and preserves all source text', () => {
  const text = Array(3000).fill('coordinate').join(' ')
  const plan = createStudyPlan({ name: 'Notes.txt', lines: [{ text }] })
  assert.equal(plan.chapters.length, 1)
  assert.equal(plan.chapters.flatMap(chapter => chapter.segments).map(segment => segment.text).join(' '), text)
})

test('heading-only chapter outlines are retained as topics', () => {
  const plan = createStudyPlan({ name: 'Course', lines: [
    { text: '# Introduction to vectors and coordinate systems' },
    { text: '# Matrix operations and their geometric interpretations' },
    { text: '# Solving linear systems with Gaussian elimination' },
    { text: '# Eigenvalues eigenvectors and diagonalization of matrices' },
  ] })
  assert.equal(plan.chapters.length, 4)
  assert.equal(plan.chapters[0].segments.length, 1)
  assert.equal(plan.chapters[0].segments[0].title, plan.chapters[0].title)
})

test('empty or unreadable documents give an actionable error', () => {
  assert.throws(() => createStudyPlan({ name: 'Empty.pdf', lines: [] }), /Add more material/)
  assert.throws(() => createStudyPlan({ name: 'Empty.pdf', lines: [{ text: '1' }, { text: '2' }] }), /Add more material/)
})

test('a single numbered chapter keeps its subtopics together', () => {
  const plan = createStudyPlan({ name: 'Lecture notes', lines: [
    { text: '1 Matrices' }, { text: '1.1 Matrix multiplication' },
    { text: 'Rows and columns are combined using dot products. Multiply compatible matrices by following one row and one column at a time.' },
    { text: '1.2 Matrix inverses' }, { text: 'An inverse reverses a matrix transformation.' },
  ] })
  assert.equal(plan.chapters.length, 1)
  assert.equal(plan.chapters[0].title, 'Matrices')
  assert.equal(plan.chapters[0].segments.length, 2)
})
