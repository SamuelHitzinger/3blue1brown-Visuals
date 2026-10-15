import test from 'node:test'
import assert from 'node:assert/strict'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey, findNoteTerm, groupNotebookPoints, noteLineKind, splitNoteScripts, notebookEditText } from '../src/lectureDocument.ts'
import type { LectureConcept, LectureNotes } from '../../../shared/lecture.ts'
const concept = (id: string, sourceIds: string[], sectionId?: string): LectureConcept => ({ id, title: id, explanation: '', sourceIds, sectionId, visualizationPrompt: '', catalogIds: [] })
test('semantic colors match complete terms and symbols, never letters inside words', () => {
  assert.equal(findNoteTerm('vector v preserves direction', 'v', 0), 7)
  assert.equal(findNoteTerm('vector preserves direction', 'v', 0), -1)
  assert.equal(findNoteTerm('A = πr²', 'π', 0), -1)
  assert.equal(findNoteTerm('v = (3,4)', 'v', 0), 0)
  assert.equal(findNoteTerm('Components have components.', 'components', 0), 16)
})
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

test('notebook groups keep equations and their conditions together without losing original line order', () => {
  const points = [
    { text: 'ΔS = q/T', sourceIds: ['a'], group: 'Surroundings', kind: 'equation' as const },
    { text: 'Constant T', sourceIds: ['a'], group: 'Surroundings', kind: 'caveat' as const },
    { text: 'q < 0 → S ↓', sourceIds: ['b'], group: 'Interpretation', kind: 'relation' as const },
  ]
  const groups = groupNotebookPoints(points)
  assert.deepEqual(groups.map(group => group.title), ['Surroundings', 'Interpretation'])
  assert.deepEqual(groups.flatMap(group => group.points), points)
  assert.equal(noteLineKind(points[0]), 'equation')
  assert.equal(noteLineKind({text:'ΔH = q',sourceIds:[]}), 'equation')
  assert.equal(noteLineKind({text:'Heat → surroundings',sourceIds:[]}), 'relation')
  assert.deepEqual(splitNoteScripts('ΔS_{sys} + q_surr/T'), [{text:'ΔS'}, {text:'sys',script:'sub'}, {text:' + q'}, {text:'surr',script:'sub'}, {text:'/T'}])
  assert.deepEqual(splitNoteScripts('<script>'), [{text:'<script>'}])
  assert.deepEqual(splitNoteScripts('x^2+y'), [{text:'x'}, {text:'2',script:'sup'}, {text:'+y'}])
  assert.deepEqual(splitNoteScripts('q_A+q_B'), [{text:'q'}, {text:'A',script:'sub'}, {text:'+q'}, {text:'B',script:'sub'}])
  assert.equal(notebookEditText([{...points[0],label:'Constant temperature'},points[1]]), 'Surroundings\nConstant temperature: ΔS = q/T\nConstant T')
})

