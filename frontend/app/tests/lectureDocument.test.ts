import test from 'node:test'
import assert from 'node:assert/strict'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey, findNoteTerm, groupNotebookPoints, noteLineKind, splitNoteScripts, notebookEditText } from '../src/lectureDocument.ts'
import type { LectureConcept, LectureNotes } from '../../../shared/lecture.ts'
import * as documentHelpers from '../src/lectureDocument.ts'
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

test('group placement uses explicit group before overlap, preserves consecutive runs and places every figure once', () => {
  const points = [
    { text: 'First rule', group: 'Rule', sourceIds: ['a'] },
    { text: 'Example', group: 'Example', sourceIds: ['b', 'c'] },
    { text: 'Later rule', group: 'Rule', sourceIds: ['d'] },
  ]
  const concepts = [
    { ...concept('explicit', ['b']), group: 'Rule' },
    concept('overlap', ['b', 'b', 'c']),
    concept('later', ['d']),
    concept('tie', ['a', 'b']),
    { ...concept('unknown', []), group: 'Missing' },
  ]
  assert.equal(typeof documentHelpers.assignNotebookGroups, 'function', 'group association is available')
  const groups = documentHelpers.assignNotebookGroups(points, concepts)
  assert.deepEqual(groups.map(group => group.concepts.map(item => item.id)), [['explicit', 'tie', 'unknown'], ['overlap'], ['later']])
  assert.deepEqual(groups.flatMap(group => group.points), points)
  assert.deepEqual(documentHelpers.assignNotebookGroups([], [concept('orphan', [])]).map(group => group.concepts.map(item => item.id)), [['orphan']])
  assert.deepEqual(documentHelpers.assignNotebookGroups([], []), [])
})

test('figure captions show identical title and explanation once while preserving distinct user edits', () => {
  const figure = { ...concept('figure', []), title: 'Entropy balance', explanation: 'Entropy balance' }
  assert.equal(typeof documentHelpers.notebookFigureCaption, 'function', 'caption composition is available')
  assert.deepEqual(documentHelpers.notebookFigureCaption({}, figure), { title: 'Entropy balance', explanation: '' })
  assert.deepEqual(documentHelpers.notebookFigureCaption({ noteEdits: { 'concept:figure': 'The surroundings outweigh the system.' } }, figure), { title: 'Entropy balance', explanation: 'The surroundings outweigh the system.' })
  assert.deepEqual(documentHelpers.notebookFigureCaption({ noteEdits: { 'concept-title:figure': '', 'concept:figure': '' } }, figure), { title: '', explanation: '' })
})

test('unpaired text groups span a row without changing group or point order', () => {
  const points = ['A', 'B', 'C', 'Figure', 'D', 'Other figure', 'E', 'F'].map(group => ({ text: group, group, sourceIds: [group] }))
  const figures = ['Figure', 'Other figure'].map(group => ({ ...concept(group, [group]), group }))
  const groups = documentHelpers.assignNotebookGroups(points, figures)
  assert.deepEqual(groups.filter(group => group.fullWidthText).map(group => group.title), ['C', 'D'])
  assert.deepEqual(groups.flatMap(group => group.points), points)
})

test('wide text groups separate leading equations and definitions, never interleaved derivation steps', () => {
  const point = (text: string, kind: 'equation' | 'note' | 'caveat') => ({ text, kind, sourceIds: ['a'] })
  const equations = [point('A = B', 'equation'), point('B = C', 'equation')]
  const definitions = [point('A: reactants', 'note'), point('Constant pressure', 'caveat')]
  const grouped = documentHelpers.assignNotebookGroups([...equations, ...definitions], [])
  assert.equal(grouped[0].supportSplit, 2)
  assert.equal(documentHelpers.assignNotebookGroups([equations[0], definitions[0], equations[1]], [])[0].supportSplit, 0)
  assert.equal(documentHelpers.assignNotebookGroups(definitions, [])[0].supportSplit, 0)
})

test('wide equation blocks keep trailing explanations and relations together, but never move later math into support', () => {
  const equations = Array.from({ length: 5 }, (_, i) => ({ text: `Q${i} = ${i}`, kind: 'equation' as const, sourceIds: ['a'] }))
  const support = [
    { text: 'Q: heat transferred', kind: 'note' as const, sourceIds: ['a'] },
    { text: 'Measured heat → reaction enthalpy', kind: 'relation' as const, sourceIds: ['a'] },
  ]
  const points = [...equations, ...support]
  const group = documentHelpers.assignNotebookGroups(points, [])[0]
  assert.equal(group.supportSplit, 5)
  assert.deepEqual(group.points, points)
  assert.equal(documentHelpers.assignNotebookGroups([...points, equations[0]], [])[0].supportSplit, 0)
  assert.equal(documentHelpers.assignNotebookGroups([...points, { ...support[0], math: 'q=mc\\Delta T' }], [])[0].supportSplit, 0)
})

