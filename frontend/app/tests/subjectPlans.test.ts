import test from 'node:test'
import assert from 'node:assert/strict'
import { exampleCurriculum } from '../src/curriculum.ts'
import { createStudyPlan, exampleDocument } from '../src/plan.ts'
import { addSubjectTopic, appendSubjectMaterials, deleteSubjectLesson, deleteSubjectTopic, isStudyPlan, loadSubjectPlans, removeGeneratedCourseLessons, subjectPlansKey } from '../src/subjectPlans.ts'
import type { SubjectPlans } from '../src/subjectPlans.ts'

const empty = (): SubjectPlans => ({ version: 1, subjects: {} })
const store = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] || null })
const script = () => createStudyPlan(exampleDocument)

test('material belongs only to its selected subject and additional scripts preserve previous chapters', () => {
  const initial = empty()
  const first = appendSubjectMaterials(initial, 'analysis', [script()])
  const next = appendSubjectMaterials(first, 'analysis', [{ ...script(), sourceName: 'Second script.pdf' }])
  const other = appendSubjectMaterials(next, 'informatik', [{ ...script(), sourceName: 'Programming.pdf' }])
  assert.deepEqual(initial.subjects, {})
  assert.equal(first.subjects.analysis.length, 1)
  assert.equal(other.subjects.analysis.length, 2)
  assert.equal(other.subjects.informatik.length, 1)
  assert.equal(other.subjects.analysis[0].id, first.subjects.analysis[0].id)
  assert.equal(new Set(other.subjects.analysis.map(m => m.id)).size, 2)
  assert.equal(other.subjects.analysis.flatMap(m => m.plan.chapters).length, 8)
})

test('duplicate files do not partially add a batch or overwrite existing source material', () => {
  const current = appendSubjectMaterials(empty(), 'analysis', [script()])
  assert.throws(() => appendSubjectMaterials(current, 'analysis', [{ ...script(), sourceName: 'New.pdf' }, script()]), /already in this subject/)
  assert.equal(current.subjects.analysis.length, 1)
  assert.throws(() => appendSubjectMaterials(empty(), 'analysis', [script(), script()]), /already in this subject/)
})

test('saved plans restore source text, ordered chapters, and separate subject ownership', () => {
  const current = appendSubjectMaterials(appendSubjectMaterials(empty(), 'analysis', [script()]), 'physik', [{ ...script(), sourceName: 'Physics.pdf' }])
  const json = JSON.stringify(current)
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: json }), exampleCurriculum)
  assert.deepEqual(restored, JSON.parse(json))
  assert.match(restored.subjects.analysis[0].plan.chapters[1].segments[1].text, /dot product/)
  assert.equal(restored.subjects.physik[0].plan.sourceName, 'Physics.pdf')
})

test('corrupt material is skipped while valid subject plans remain readable', () => {
  const current = appendSubjectMaterials(empty(), 'analysis', [script()])
  const data = { version: 1, subjects: { ...current.subjects, physik: [null, { id: 'bad', plan: { chapters: [null] } }] } }
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(data) }), exampleCurriculum)
  assert.equal(restored.subjects.analysis.length, 1)
  assert.deepEqual(restored.subjects.physik, [])
  assert.equal(isStudyPlan({ version: 1, chapters: [null] }), false)
  assert.deepEqual(loadSubjectPlans(store({ [subjectPlansKey]: '{' }), exampleCurriculum), empty())
  assert.deepEqual(loadSubjectPlans({ getItem: () => { throw new Error('Storage unavailable') } }, exampleCurriculum), empty())
})

test('older saved scripts migrate into the matching curriculum subject', () => {
  const restored = loadSubjectPlans(store({ 'aha-study-plan': JSON.stringify(script()) }), exampleCurriculum)
  assert.equal(restored.subjects['lineare-algebra'][0].plan.title, 'Linear algebra')
  assert.equal(restored.subjects.analysis, undefined)
})

test('manual topics can start empty and persist with their nested subtopics', () => {
  const initial = empty()
  const first = addSubjectTopic(initial, 'analysis', '  Limits   and continuity  ')
  const material = first.subjects.analysis[0]
  const chapter = material.plan.chapters[0]
  assert.equal(chapter.title, 'Limits and continuity')
  assert.deepEqual(chapter.segments, [])
  assert.equal(isStudyPlan(material.plan), true)
  assert.deepEqual(loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(first) }), { subjects: [exampleCurriculum.subjects[0]] }), first)
  const next = addSubjectTopic(first, 'analysis', 'One-sided limits', { materialId: material.id, chapterId: chapter.id })
  assert.equal(next.subjects.analysis[0].plan.chapters[0].segments[0].title, 'One-sided limits')
  assert.equal(next.subjects.analysis[0].plan.chapters[0].segments[0].text, '')
  assert.deepEqual(chapter.segments, [])
  assert.deepEqual(initial, empty())
  assert.deepEqual(loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(next) }), { subjects: [exampleCurriculum.subjects[0]] }), next)
})

test('adding a subtopic preserves uploaded sources, existing lessons, and other courses', () => {
  const initial = appendSubjectMaterials(appendSubjectMaterials(empty(), 'analysis', [script()]), 'physik', [script()])
  const material = initial.subjects.analysis[0]
  const chapter = material.plan.chapters[0]
  const next = addSubjectTopic(initial, 'analysis', 'New idea', { materialId: material.id, chapterId: chapter.id })
  assert.equal(next.subjects.physik, initial.subjects.physik)
  assert.equal(next.subjects.analysis[0].id, material.id)
  assert.equal(next.subjects.analysis[0].plan.sourceName, material.plan.sourceName)
  assert.deepEqual(next.subjects.analysis[0].plan.chapters[0].segments.slice(0, -1), chapter.segments)
  assert.deepEqual(next.subjects.analysis[0].plan.chapters.slice(1), material.plan.chapters.slice(1))
})

test('topic names are validated within their own parent and stale parents cannot add data', () => {
  const first = addSubjectTopic(empty(), 'analysis', 'Limits')
  const material = first.subjects.analysis[0]
  const parent = { materialId: material.id, chapterId: material.plan.chapters[0].id }
  assert.throws(() => addSubjectTopic(first, 'analysis', ' limits '), /already exists/)
  assert.throws(() => addSubjectTopic(first, 'analysis', '  '), /Enter a name/)
  assert.throws(() => addSubjectTopic(first, 'analysis', 'a'.repeat(81)), /Enter a name/)
  assert.throws(() => addSubjectTopic(first, 'physik', 'Limits', parent), /no longer available/)
  const next = addSubjectTopic(first, 'analysis', 'Continuity', parent)
  assert.throws(() => addSubjectTopic(next, 'analysis', ' continuity ', parent), /already exists/)
  assert.doesNotThrow(() => addSubjectTopic(next, 'physik', 'Limits'))
  assert.doesNotThrow(() => addSubjectTopic(next, 'analysis', 'Continuity'))
})

test('deleting a topic removes only that chapter and its lessons, preserving other sources and courses', () => {
  const current = appendSubjectMaterials(appendSubjectMaterials(empty(), 'analysis', [script(), { ...script(), sourceName: 'Second.pdf' }]), 'physik', [script()])
  const material = current.subjects.analysis[0]
  const removed = material.plan.chapters[0]
  const next = deleteSubjectTopic(current, 'analysis', material.id, removed.id)
  assert.deepEqual(next.subjects.analysis[0].plan.chapters, material.plan.chapters.slice(1))
  assert.equal(next.subjects.analysis[0].plan.sourceName, material.plan.sourceName)
  assert.equal(next.subjects.analysis[1], current.subjects.analysis[1])
  assert.equal(next.subjects.physik, current.subjects.physik)
  assert.equal(material.plan.chapters[0], removed)
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(next) }), exampleCurriculum)
  assert.deepEqual(restored.subjects.analysis, JSON.parse(JSON.stringify(next.subjects.analysis)))
})

test('deleting the last topic restores an empty course that can accept new topics after reload', () => {
  const current = addSubjectTopic(empty(), 'analysis', 'Limits')
  const material = current.subjects.analysis[0]
  const next = deleteSubjectTopic(current, 'analysis', material.id, material.plan.chapters[0].id)
  assert.deepEqual(next.subjects.analysis, [])
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(next) }), exampleCurriculum)
  assert.deepEqual(restored.subjects.analysis, [])
  assert.equal(addSubjectTopic(restored, 'analysis', 'Limits').subjects.analysis[0].plan.title, 'Limits')
})

test('deleting a stale topic or a topic in the wrong course changes nothing', () => {
  const current = addSubjectTopic(empty(), 'analysis', 'Limits')
  const material = current.subjects.analysis[0]
  const chapterId = material.plan.chapters[0].id
  assert.equal(deleteSubjectTopic(current, 'physik', material.id, chapterId), current)
  assert.equal(deleteSubjectTopic(current, 'analysis', 'missing-material', chapterId), current)
  assert.equal(deleteSubjectTopic(current, 'analysis', material.id, 'missing-topic'), current)
  const next = deleteSubjectTopic(current, 'analysis', material.id, chapterId)
  assert.equal(deleteSubjectTopic(next, 'analysis', material.id, chapterId), next)
})

test('deleting a lesson preserves its topic, remaining lessons, and uploaded source', () => {
  const current = appendSubjectMaterials(appendSubjectMaterials(empty(), 'analysis', [script()]), 'physik', [script()])
  const material = current.subjects.analysis[0]
  const chapter = material.plan.chapters[0]
  const reference = { subjectId: 'analysis', materialId: material.id, chapterId: chapter.id, lessonId: chapter.segments[0].id }
  const next = deleteSubjectLesson(current, reference)
  assert.deepEqual(next.subjects.analysis[0].plan.chapters[0].segments, chapter.segments.slice(1))
  assert.equal(next.subjects.analysis[0].plan.sourceName, material.plan.sourceName)
  assert.equal(next.subjects.physik, current.subjects.physik)
  assert.equal(current.subjects.analysis[0].plan.chapters[0].segments.length, chapter.segments.length)
  assert.equal(deleteSubjectLesson(next, reference), next)
  assert.equal(deleteSubjectLesson(current, { ...reference, subjectId: 'physik' }), current)
  assert.equal(deleteSubjectLesson(current, { ...reference, chapterId: 'missing' }), current)
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(next) }), exampleCurriculum)
  assert.deepEqual(restored.subjects.analysis, JSON.parse(JSON.stringify(next.subjects.analysis)))
})

test('deleting the last lesson keeps an empty topic and permits another title-first lesson', () => {
  const initial = addSubjectTopic(empty(), 'analysis', 'Derivatives')
  const material = initial.subjects.analysis[0]
  const parent = { materialId: material.id, chapterId: material.plan.chapters[0].id }
  const current = addSubjectTopic(initial, 'analysis', 'The chain rule', parent)
  const lesson = current.subjects.analysis[0].plan.chapters[0].segments[0]
  const next = deleteSubjectLesson(current, { subjectId: 'analysis', ...parent, lessonId: lesson.id })
  const restored = loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(next) }), exampleCurriculum)
  assert.equal(restored.subjects.analysis[0].plan.chapters[0].title, 'Derivatives')
  assert.deepEqual(restored.subjects.analysis[0].plan.chapters[0].segments, [])
  assert.equal(addSubjectTopic(restored, 'analysis', 'The chain rule', parent).subjects.analysis[0].plan.chapters[0].segments.length, 1)
})

test('only completed videos with exact course lesson references remove their source lesson', () => {
  const current = appendSubjectMaterials(empty(), 'analysis', [script(), { ...script(), sourceName: 'Second.pdf' }])
  const material = current.subjects.analysis[0]
  const chapter = material.plan.chapters[0]
  const reference = { subjectId: 'analysis', materialId: material.id, chapterId: chapter.id, lessonId: chapter.segments[0].id }
  for (const generationStatus of ['queued', 'generating', 'failed'] as const) {
    assert.equal(removeGeneratedCourseLessons(current, [{ videoId: 'video-1', generationStatus, courseLesson: reference }]), current)
  }
  assert.equal(removeGeneratedCourseLessons(current, [{ videoId: 'video-1', generationStatus: 'complete' }]), current)
  assert.equal(removeGeneratedCourseLessons(current, [{ generationStatus: 'complete', courseLesson: reference }]), current)
  const videos = [{ videoId: 'video-1', generationStatus: 'complete' as const, courseLesson: reference }]
  const next = removeGeneratedCourseLessons(current, videos)
  assert.deepEqual(next.subjects.analysis[0].plan.chapters[0].segments, chapter.segments.slice(1))
  assert.equal(next.subjects.analysis[1], current.subjects.analysis[1])
  assert.equal(videos.length, 1)
  assert.equal(removeGeneratedCourseLessons(next, videos), next)
})

test('plans without premature runtime estimates and legacy estimates both survive storage', () => {
  const plan = script();
  for (const chapter of plan.chapters) for (const segment of chapter.segments) delete (segment as { minutes?: number }).minutes;
  assert.equal(isStudyPlan(plan), true);
  const saved = appendSubjectMaterials(empty(), 'analysis', [plan]);
  assert.deepEqual(loadSubjectPlans(store({ [subjectPlansKey]: JSON.stringify(saved) }), exampleCurriculum), JSON.parse(JSON.stringify(saved)));
  plan.chapters[0].segments[0].minutes = 12;
  assert.equal(isStudyPlan(plan), true);
  plan.chapters[0].segments[0].minutes = -1;
  assert.equal(isStudyPlan(plan), false);
});
