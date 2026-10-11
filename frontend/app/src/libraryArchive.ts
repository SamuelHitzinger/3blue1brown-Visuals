import type { Lesson } from './data'

export type LibraryView = 'all' | 'saved' | 'archive'
export interface LocalLibraryState { archived: Record<string, string>; deleted: string[] }
export const localLibraryKey = 'aha-library-archive-v1'

// Server videos carry archive state in the manifest. Legacy local previews
// keep archive metadata and deletion tombstones in browser storage.
export function loadLocalLibrary(storage: Pick<Storage, 'getItem'>): LocalLibraryState {
  try {
    const value = JSON.parse(storage.getItem(localLibraryKey) || 'null')
    return {
      archived: value?.archived && typeof value.archived === 'object' && !Array.isArray(value.archived)
        ? Object.fromEntries(Object.entries(value.archived).filter(([, date]) => typeof date === 'string' && date.length > 0)) as Record<string, string> : {},
      deleted: Array.isArray(value?.deleted) ? value.deleted.filter((id: unknown): id is string => typeof id === 'string') : [],
    }
  } catch { return { archived: {}, deleted: [] } }
}

export function applyLocalLibrary(lessons: Lesson[], state: LocalLibraryState): Lesson[] {
  return lessons.filter(lesson => lesson.videoId || !state.deleted.includes(lesson.id))
    .map(lesson => lesson.videoId ? lesson : { ...lesson, archivedAt: state.archived[lesson.id] })
}

export function libraryViewLessons(lessons: Lesson[], view: LibraryView, bookmarks: string[]): Lesson[] {
  return lessons.filter(lesson => view === 'archive' ? !!lesson.archivedAt : !lesson.archivedAt && (view !== 'saved' || bookmarks.includes(lesson.id)))
}
