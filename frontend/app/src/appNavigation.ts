/** Preserve old bookmarks while keeping the app centered on Home, Notes and Library. */
export function appPath(path: string): string {
  if (path === '/catalog') return '/library'
  if (path === '/courses' || path === '/plan') return '/lectures'
  if (path.startsWith('/courses/') || path.startsWith('/plan/')) return `/lectures/course/${path.split('/')[2]}`
  if (path === '/library' || path === '/lectures' || path.startsWith('/lectures/') || path.startsWith('/watch/')) return path
  return '/'
}
