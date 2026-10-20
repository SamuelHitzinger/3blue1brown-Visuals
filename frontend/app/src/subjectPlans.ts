import type { Curriculum, SubjectColor } from './curriculum'
import type { StudyPlan } from './plan'
import type { Lesson } from './data'

export interface SavedMaterial { id: string; plan: StudyPlan }
export interface SubjectPlans { version: 1; subjects: Record<string, SavedMaterial[]> }
export interface TopicParent { materialId: string; chapterId: string }
export interface CourseLessonRef extends TopicParent { subjectId: string; lessonId: string }
export interface TopicVideoRequest {
  courseLesson?: CourseLessonRef
  title: string
  text: string
  subject: string
  color: SubjectColor
  chapter: string
  sourceName: string
}
export const subjectPlansKey = 'aha-subject-plans-v1'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function isStudyPlan(value: unknown): value is StudyPlan {
  return record(value) && value.version === 1 && typeof value.title === 'string' && typeof value.sourceName === 'string'
    && (value.sourceNames === undefined || (Array.isArray(value.sourceNames) && value.sourceNames.every(name => typeof name === 'string')))
    && Array.isArray(value.chapters) && value.chapters.length > 0 && value.chapters.every(chapter => record(chapter) && typeof chapter.id === 'string' && typeof chapter.title === 'string' && Array.isArray(chapter.segments) && chapter.segments.every(segment => record(segment) && typeof segment.id === 'string' && typeof segment.title === 'string' && typeof segment.text === 'string' && (segment.minutes === undefined || (typeof segment.minutes === 'number' && Number.isFinite(segment.minutes) && segment.minutes > 0))))
}

export function loadSubjectPlans(storage: Pick<Storage, 'getItem'>, curriculum: Curriculum): SubjectPlans {
  const result: SubjectPlans = { version: 1, subjects: {} }
  try {
    const saved: unknown = JSON.parse(storage.getItem(subjectPlansKey) || 'null')
    if (record(saved) && saved.version === 1 && record(saved.subjects)) {
      for (const subject of curriculum.subjects) {
        const materials = saved.subjects[subject.id]
        if (Array.isArray(materials)) result.subjects[subject.id] = materials.filter((item): item is SavedMaterial => record(item) && typeof item.id === 'string' && isStudyPlan(item.plan))
      }
      return result
    }
    // Keep scripts saved by earlier versions of the Plan page.
    const previous: unknown = JSON.parse(storage.getItem('aha-curriculum-v1') || 'null')
    if (record(previous) && Array.isArray(previous.subjects)) {
      for (const old of previous.subjects) {
        if (!record(old) || !isStudyPlan(old.plan)) continue
        const subject = curriculum.subjects.find(subject => subject.id === old.id || subject.title === old.title)
        if (subject) result.subjects[subject.id] = [{ id: `migrated-${subject.id}`, plan: old.plan }]
      }
    }
    const legacy: unknown = JSON.parse(storage.getItem('aha-study-plan') || 'null')
    if (isStudyPlan(legacy)) {
      const subject = curriculum.subjects.find(subject => subject.title.toLowerCase() === legacy.title.toLowerCase() || (subject.id === 'lineare-algebra' && /linear algebra/i.test(legacy.title)))
      if (subject && !result.subjects[subject.id]?.length) result.subjects[subject.id] = [{ id: `legacy-${subject.id}`, plan: legacy }]
    }
  } catch { /* Unavailable or damaged browser storage starts with empty subject plans. */ }
  return result
}

export function appendSubjectMaterials(current: SubjectPlans, subjectId: string, plans: StudyPlan[]): SubjectPlans {
  const existing = current.subjects[subjectId] || []
  const names = new Set(existing.map(material => material.plan.sourceName))
  for (const plan of plans) {
    if (names.has(plan.sourceName)) throw new Error(`${plan.sourceName} is already in this subject. Choose a different script.`)
    names.add(plan.sourceName)
  }
  return { version: 1, subjects: { ...current.subjects, [subjectId]: [...existing, ...plans.map(plan => ({ id: crypto.randomUUID(), plan }))] } }
}

/** Add an outline entry without changing uploaded material or inventing source text. */
export function addSubjectTopic(current: SubjectPlans, subjectId: string, name: string, parent?: TopicParent): SubjectPlans {
  const title = name.trim().replace(/\s+/g, ' ')
  if (!title || title.length > 80) throw new Error('Enter a name of up to 80 characters.')
  const existing = current.subjects[subjectId] || []
  const chapter = parent && existing.find(material => material.id === parent.materialId)?.plan.chapters.find(item => item.id === parent.chapterId)
  if (parent && !chapter) throw new Error('This topic is no longer available. Reopen the course and try again.')
  const siblings = chapter ? chapter.segments : existing.flatMap(material => material.plan.chapters)
  if (siblings.some(item => item.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === title.toLocaleLowerCase())) {
    throw new Error('This name already exists here. Choose another name.')
  }
  const updated = parent ? existing.map(material => material.id !== parent.materialId ? material : {
    ...material,
    plan: { ...material.plan, chapters: material.plan.chapters.map(item => item.id !== parent.chapterId ? item : {
      ...item, segments: [...item.segments, { id: crypto.randomUUID(), title, text: '' }],
    }) },
  }) : [...existing, {
    id: crypto.randomUUID(),
    plan: { version: 1 as const, title, sourceName: title, chapters: [{ id: crypto.randomUUID(), title, segments: [] }] },
  }]
  return { ...current, subjects: { ...current.subjects, [subjectId]: updated } }
}

export function deleteSubjectTopic(current: SubjectPlans, subjectId: string, materialId: string, chapterId: string): SubjectPlans {
  const existing = current.subjects[subjectId]
  const material = existing?.find(item => item.id === materialId)
  if (!material?.plan.chapters.some(chapter => chapter.id === chapterId)) return current
  const chapters = material.plan.chapters.filter(chapter => chapter.id !== chapterId)
  const updated = existing.flatMap(item => item.id !== materialId ? [item]
    : chapters.length ? [{ ...item, plan: { ...item.plan, chapters } }] : [])
  return { ...current, subjects: { ...current.subjects, [subjectId]: updated } }
}

/** Keep the topic and source material even when its last lesson is removed. */
export function deleteSubjectLesson(current: SubjectPlans, reference: CourseLessonRef): SubjectPlans {
  const { subjectId, materialId, chapterId, lessonId } = reference
  const materials = current.subjects[subjectId]
  const chapter = materials?.find(material => material.id === materialId)?.plan.chapters.find(item => item.id === chapterId)
  if (!chapter?.segments.some(lesson => lesson.id === lessonId)) return current
  return { ...current, subjects: { ...current.subjects, [subjectId]: materials.map(material => material.id !== materialId ? material : {
    ...material, plan: { ...material.plan, chapters: material.plan.chapters.map(item => item.id !== chapterId ? item : {
      ...item, segments: item.segments.filter(lesson => lesson.id !== lessonId),
    }) },
  }) } }
}

/** A queued or failed video must never consume its source lesson. */
export function removeGeneratedCourseLessons(current: SubjectPlans, videos: Pick<Lesson, 'videoId' | 'generationStatus' | 'courseLesson'>[]): SubjectPlans {
  return videos.reduce((plans, video) => video.videoId && video.generationStatus === 'complete' && video.courseLesson
    ? deleteSubjectLesson(plans, video.courseLesson) : plans, current)
}
