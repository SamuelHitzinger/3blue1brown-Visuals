import { exampleCurriculum } from './curriculum.ts'
import type { CourseSubject, Curriculum, SubjectColor } from './curriculum'
import type { Lesson } from './data'

export const coursesKey = 'aha-courses-v1'
export const recentPlaybackKey = 'aha-recent-playback-v1'
export const courseColors: SubjectColor[] = ['butter', 'lavender', 'blue', 'sage', 'peach']
const normalize = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
// Existing example videos use the English name of this listed course.
const subjectKey = (title: string) => normalize(title) === 'linear algebra' ? 'lineare algebra' : normalize(title)

export function courseForSubject(courses: Curriculum, title: string): CourseSubject | undefined {
  return courses.subjects.find(course => subjectKey(course.title) === subjectKey(title))
}

export function addCourse(courses: Curriculum, name: string, color: SubjectColor): Curriculum {
  const title = name.trim().replace(/\s+/g, ' ')
  if (!title || title.length > 80) throw new Error('Enter a course name of up to 80 characters.')
  if (normalize(title) === 'all subjects' || courseForSubject(courses, title)) throw new Error('A course with this name already exists. Choose another name.')
  return { subjects: [...courses.subjects, { id: `course-${crypto.randomUUID()}`, title, color, sessions: [] }] }
}

export function loadCourses(storage: Pick<Storage, 'getItem'>): Curriculum {
  let subjects = [...exampleCurriculum.subjects]
  try {
    const saved = JSON.parse(storage.getItem(coursesKey) || 'null')
    if (![1, 2].includes(saved?.version) || !Array.isArray(saved.subjects)) return { subjects }
    // Version 1 added custom courses to the defaults. Version 2 stores the active list, including deletions.
    if (saved.version === 2) subjects = []
    for (const course of saved.subjects) {
      if (!course || typeof course.id !== 'string' || (!/^course-[\w-]+$/.test(course.id) && !exampleCurriculum.subjects.some(item => item.id === course.id))
        || typeof course.title !== 'string' || !course.title.trim() || course.title.length > 80
        || normalize(course.title) === 'all subjects' || !courseColors.includes(course.color)
        || subjects.some(item => item.id === course.id) || courseForSubject({ subjects }, course.title)) continue
      subjects.push({ id: course.id, title: course.title.trim().replace(/\s+/g, ' '), color: course.color, sessions: exampleCurriculum.subjects.find(item => item.id === course.id)?.sessions ?? [] })
    }
  } catch { /* Keep the listed courses when browser storage is unavailable or damaged. */ }
  return { subjects }
}

export function deleteCourse(courses: Curriculum, id: string): Curriculum {
  return { subjects: courses.subjects.filter(course => course.id !== id) }
}

export function loadRecentPlayback(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(recentPlaybackKey) || 'null')
    return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === 'string' && !!id))].slice(0, 50) : []
  } catch { return [] }
}

export function recordPlayback(history: string[], id: string): string[] {
  return [id, ...history.filter(previous => previous !== id)].slice(0, 50)
}

export function recentLessons(history: string[], lessons: Lesson[], courses: Curriculum): Lesson[] {
  const byId = new Map(lessons.map(lesson => [lesson.id, lesson]))
  return [...new Set(history)].flatMap(id => {
    const lesson = byId.get(id)
    if (!lesson) return []
    const course = courseForSubject(courses, lesson.subject)
    return [{ ...lesson, subject: course?.title ?? lesson.subject, color: course?.color ?? lesson.color }]
  }).slice(0, 3)
}

// Only videos with actual playback appear in the course overview.
export function overviewLessons(history: string[], lessons: Lesson[], courses: Curriculum): Lesson[] {
  return recentLessons(history, lessons, courses)
}
