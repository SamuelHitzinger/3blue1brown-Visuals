import test from 'node:test'
import assert from 'node:assert/strict'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey } from '../src/lectureDocument.ts'
import type { LectureConcept, LectureNotes } from '../../../shared/lecture.ts'
const concept = (id: string, sourceIds: string[], sectionId?: string): LectureConcept => ({ id, title: id, explanation: '', sourceIds, sectionId, visualizationPrompt: '', catalogIds: [] })
const notes = (concepts: LectureConcept[]): LectureNotes => ({ summary: '', questions: [], concepts, sections: [{ id: 'first', title: 'First', points: [{ text: 'A', sourceIds: ['a','b'] }] }, { id: 'second', title: 'Second', points: [{ text: 'B', sourceIds: ['b','c'] }] }] })
test('concept placement prefers explicit section, then unique source overlap, then first tie', () => {
  const placed = assignLectureConcepts(notes([concept('explicit',['a'],'second'),concept('overlap',['b','c']),concept('tie',['b']),concept('none',['unknown']),concept('invalid',['c'],'missing')]))
  assert.deepEqual(placed.map(section => section.concepts.map(item => item.id)), [['tie','none'],['explicit','overlap','invalid']])
  assert.equal(placed.flatMap(section => section.concepts).length,5)
})
test('a document without sections still renders every concept once', () => {
  const value = notes([concept('one',[]),concept('two',[])])
  value.sections = []
  assert.deepEqual(assignLectureConcepts(value).map(section => section.concepts.map(item => item.id)), [['one','two']])
  assert.deepEqual(assignLectureConcepts({...value,concepts:[]}),[])
})
test('displayed edits survive AI text changes and empty edits remain intentional', () => {
  assert.equal(lectureNoteText({noteEdits:{summary:'My explanation'}},'summary','Updated AI text'),'My explanation')
  assert.equal(lectureNoteText({noteEdits:{'section:first':''}},'section:first','AI text'),'')
  assert.equal(lectureNoteText({},'summary','AI text'),'AI text')
})
test('generated section identifiers cannot collide with fixed notebook roles', () => {
  const fixed = new Set(['role-summary','role-questions','role-personal'])
  const keys = ['summary','questions','personal','role-summary'].map(notebookSectionKey)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(keys.every(key => !fixed.has(key)))
})

