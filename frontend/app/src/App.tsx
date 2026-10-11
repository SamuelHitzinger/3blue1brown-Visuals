import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowRight, ArrowUpRight, Atom, Bookmark, Check, ChevronDown, FileText, MenuGlyph, Search, SlidersHorizontal, X } from './Icons'
import ThumbnailArtwork from './ThumbnailArtwork'
import LessonPlayer from './LessonPlayer'
import NavigationDrawer from './NavigationDrawer'
import SettingsPage from './SettingsPage'
import CoursesPage from './CoursesPage'
import WorkspacePage from './WorkspacePage'
import type { SubjectColor } from './curriculum'
import { addCourse, coursesKey, courseForSubject, loadCourses, loadRecentPlayback, deleteCourse, overviewLessons, recentPlaybackKey, recordPlayback } from './courses'
import { addSubjectTopic, appendSubjectMaterials, deleteSubjectLesson, deleteSubjectTopic, loadSubjectPlans, removeGeneratedCourseLessons, subjectPlansKey } from './subjectPlans'
import type { CourseLessonRef, SubjectPlans, TopicParent, TopicVideoRequest } from './subjectPlans'
import type { StudyPlan } from './plan'
import { formatTime, artworkForTitle } from './data'
import type { Lesson } from './data'
import { archiveVideo, deleteVideo, listVideos, mergeVideoLessons } from './videos'
import { applyLocalLibrary, libraryViewLessons, loadLocalLibrary, localLibraryKey } from './libraryArchive'
import type { LibraryView, LocalLibraryState } from './libraryArchive'

// Five colours keep neighbours distinct in the one-, two-, and three-column grids.
const libraryColors = ['sage', 'lavender', 'butter', 'blue', 'peach'] as const

function readLocal<T,>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback } catch { return fallback }
}

function VideoThumbnail({ lesson, color, onOpen }: { lesson: Lesson, color: string, onOpen: () => void }) {
  const progress = Math.max(0, Math.min(lesson.progress ?? 0, 1))
  const barFill = progress === 0 ? 1 : progress
  return <button className={`video-thumbnail ${color}`} aria-label={`Play ${lesson.title}`} onClick={onOpen}>
      <span className="thumbnail-art"><ThumbnailArtwork drawing={lesson.thumbnail} fallback={lesson.artwork}/></span>
      <span className="thumbnail-bottom">
        <h4 className="thumbnail-title">{lesson.title}</h4>
        <span className="thumbnail-playback" aria-hidden="true"><span className="thumbnail-progress"><span style={{ width: `${barFill * 100}%` }}/></span><span className="thumbnail-time">{formatTime(lesson.duration)}</span></span>
      </span>
    </button>
}

function VideoCard({ lesson, color, saved, onOpen, onToggleSaved, onDelete, deleting, archived, index = 0 }: { lesson: Lesson, color: string, saved: boolean, onOpen: () => void, onToggleSaved: () => void, onDelete?: () => void, deleting?: boolean, archived?: boolean, index?: number }) {
  return <article className="video-card" style={{ animationDelay: `${index * 45}ms` }}>
    <VideoThumbnail lesson={lesson} color={color} onOpen={onOpen}/>
    {!archived && <button className={`bookmark-button ${saved ? 'saved' : ''}`} onClick={onToggleSaved} aria-label={`${saved ? 'Unsave' : 'Save'} ${lesson.title}`} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/></button>}
    {onDelete && <button className="delete-video-button" disabled={deleting} onClick={onDelete} aria-label={`${archived ? 'Permanently delete' : 'Delete'} ${lesson.title}`} title={archived ? 'Delete permanently' : 'Move to Archive'}><X size={14}/></button>}
    {lesson.generationStatus && <span className="video-generation-status">{lesson.generationStatus === 'complete' ? 'Ready' : lesson.generationStatus === 'failed' ? 'Generation failed' : lesson.generationStatus === 'queued' ? 'Queued' : 'Generating…'}</span>}
  </article>
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => readLocal('aha-theme', 'light'))
  const [path, setPath] = useState(window.location.pathname)
  const [menu, setMenu] = useState(false)
  const [filter, setFilter] = useState('All subjects')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [libraryView, setLibraryView] = useState<LibraryView>('all')
  const [localLibrary, setLocalLibrary] = useState(() => loadLocalLibrary(localStorage))
  const [bookmarks, setBookmarks] = useState<string[]>(() => readLocal('aha-bookmarks', []))
  const [customLessons, setCustomLessons] = useState<Lesson[]>(() => readLocal('aha-lessons', []))
  const [toast, setToast] = useState('')
  const [deleting, setDeleting] = useState<string[]>([])
  const deletedIds = useRef(new Set<string>())
  const busyIds = useRef(new Set<string>())
  const currentLessons = useRef(customLessons)
  currentLessons.current = customLessons
  const [topicRequest, setTopicRequest] = useState<TopicVideoRequest | null>(null)
  const [courses, setCourses] = useState(() => loadCourses(localStorage))
  const [playHistory, setPlayHistory] = useState(() => loadRecentPlayback(localStorage))
  const [subjectPlans, setSubjectPlans] = useState(() => loadSubjectPlans(localStorage, courses))
  const [planStorageNote, setPlanStorageNote] = useState('')
  const allLessons = useMemo(() => applyLocalLibrary(customLessons.map(lesson => ({ ...lesson, artwork: artworkForTitle(lesson.title, lesson.artwork) })), localLibrary), [customLessons, localLibrary])
  const activeLessons = allLessons.filter(lesson => !lesson.archivedAt)
  const pendingCourseLessons = customLessons.flatMap(lesson => lesson.courseLesson && (lesson.generationStatus === 'queued' || lesson.generationStatus === 'generating') ? [lesson.courseLesson] : [])
  const hasPendingCourseVideos = pendingCourseLessons.length > 0
  useEffect(() => {
    let active = true
    let refreshing = false
    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      const knownIds = new Set(currentLessons.current.map(lesson => lesson.id))
      try {
        const videos = await listVideos()
        if (active) setCustomLessons(old => mergeVideoLessons(videos.filter(video => !deletedIds.current.has(video.id)), old,
          old.filter(lesson => !knownIds.has(lesson.id)).map(lesson => lesson.id)))
      } catch { if (active) setToast('Could not refresh your saved videos.') }
      finally { refreshing = false }
    }
    void refresh()
    const interval = path === '/library' || hasPendingCourseVideos ? setInterval(() => { void refresh() }, 3000) : undefined
    window.addEventListener('focus', refresh)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [path, hasPendingCourseVideos])
  const selected = path.startsWith('/watch/') ? allLessons.find(l => l.id === decodeURIComponent(path.split('/')[2] || '')) : undefined
  const invalidLesson = path.startsWith('/watch/') && !selected
  const settings = path === '/settings'
  const planning = path === '/courses' || path.startsWith('/courses/') || path === '/plan' || path.startsWith('/plan/')
  const libraryPage = path === '/library'

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('aha-theme', JSON.stringify(theme))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f4f8' : '#000000')
  }, [theme])
  useEffect(() => { const listener = () => { setPath(window.location.pathname); setMenu(false) }; window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener) }, [])
  useEffect(() => { localStorage.setItem('aha-bookmarks', JSON.stringify(bookmarks)) }, [bookmarks])
  useEffect(() => { localStorage.setItem('aha-lessons', JSON.stringify(customLessons)) }, [customLessons])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === localLibraryKey || event.key === null) setLocalLibrary(loadLocalLibrary(localStorage)) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => { document.title = selected ? `${selected.title} — Aha!` : settings ? 'Settings — Aha!' : planning ? 'Courses — Aha!' : libraryPage ? 'Library — Aha!' : 'Aha! — Make it click.' }, [selected, settings, planning, libraryPage])

  const navigate = (url: string, scroll = true) => { window.history.pushState({}, '', url); setPath(url); setMenu(false); if (scroll) window.scrollTo({ top: 0, behavior: 'instant' }) }
  const openLesson = (lesson: Lesson) => navigate(`/watch/${encodeURIComponent(lesson.id)}`)
  const onPlayed = useCallback((id: string) => setPlayHistory(old => recordPlayback(old, id)), [])
  useEffect(() => {
    try { localStorage.setItem(recentPlaybackKey, JSON.stringify(playHistory)) }
    catch { /* Playback history still works for this session. */ }
  }, [playHistory])
  const createCourse = (name: string, color: SubjectColor) => {
    const next = addCourse(courses, name, color)
    setCourses(next)
    try { localStorage.setItem(coursesKey, JSON.stringify({ version: 2, ...next })); setPlanStorageNote('') }
    catch { setPlanStorageNote('Your new course is available for this session, but the browser could not save it. Keep this page open to retain it.') }
    navigate(`/courses/${next.subjects[next.subjects.length - 1].id}`, false)
  }
  const removeCourse = (id: string) => {
    const course = courses.subjects.find(course => course.id === id)
    if (!course) return
    const next = deleteCourse(courses, id)
    const remainingPlans = { ...subjectPlans.subjects }
    delete remainingPlans[id]
    const nextPlans = { ...subjectPlans, subjects: remainingPlans }
    setCourses(next)
    setSubjectPlans(nextPlans)
    setFilter('All subjects')
    try {
      localStorage.setItem(coursesKey, JSON.stringify({ version: 2, ...next }))
      localStorage.setItem(subjectPlansKey, JSON.stringify(nextPlans))
      setPlanStorageNote('')
    } catch { setPlanStorageNote('The course was removed for this session, but the browser could not save all changes.') }
    navigate('/courses')
    setToast(`${course.title} deleted. Your videos are still in Library.`)
  }
  const toggleSaved = (id: string) => setBookmarks(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id])
  const saveLocalLibrary = (update: (stored: LocalLibraryState) => LocalLibraryState) => {
    const next = update(loadLocalLibrary(localStorage))
    // Commit before hiding the card so a storage failure cannot silently lose it.
    localStorage.setItem(localLibraryKey, JSON.stringify(next))
    setLocalLibrary(next)
  }
  const removeLesson = async (lesson: Lesson) => {
    if (busyIds.current.has(lesson.id)) return
    busyIds.current.add(lesson.id)
    setDeleting(old => [...old, lesson.id])
    const permanent = libraryView === 'archive' && !!lesson.archivedAt
    try {
      if (!permanent) {
        if (lesson.videoId) {
          const archived = await archiveVideo(lesson.videoId)
          setCustomLessons(old => old.map(item => item.id === lesson.id ? { ...item, archivedAt: archived.archivedAt } : item))
        } else {
          saveLocalLibrary(stored => ({ ...stored, archived: { ...stored.archived, [lesson.id]: new Date().toISOString() } }))
        }
        setToast('Video moved to Archive.')
      } else {
        if (lesson.videoId) await deleteVideo(lesson.videoId)
        else {
          saveLocalLibrary(stored => {
            const archived = { ...stored.archived }
            delete archived[lesson.id]
            return { archived, deleted: [...new Set([...stored.deleted, lesson.id])] }
          })
        }
        deletedIds.current.add(lesson.id)
        setCustomLessons(old => old.filter(item => item.id !== lesson.id))
        setBookmarks(old => old.filter(id => id !== lesson.id))
        setPlayHistory(old => old.filter(id => id !== lesson.id))
        setToast('Video permanently deleted.')
      }
    } catch (error) { setToast(error instanceof Error ? error.message : permanent ? 'Could not delete the video.' : 'Could not archive the video.') }
    finally { busyIds.current.delete(lesson.id); setDeleting(old => old.filter(id => id !== lesson.id)) }
  }
  const changeLibraryView = (view: LibraryView) => {
    setLibraryView(current => current === view ? 'all' : view)
    setFilter('All subjects')
    setQuery('')
  }
  const goLibrary = () => navigate('/library')

  const saveSubjectPlans = useCallback((next: SubjectPlans) => {
    setSubjectPlans(next)
    try { localStorage.setItem(subjectPlansKey, JSON.stringify(next)); setPlanStorageNote('') }
    catch { setPlanStorageNote('Your course material is available for this session, but the browser could not save it. Keep this page open to retain your material.') }
  }, [])
  const addPlanMaterial = (subjectId: string, plans: StudyPlan[]) => saveSubjectPlans(appendSubjectMaterials(subjectPlans, subjectId, plans))
  const createTopic = (subjectId: string, name: string, parent?: TopicParent) => saveSubjectPlans(addSubjectTopic(subjectPlans, subjectId, name, parent))
  const removeTopic = (subjectId: string, materialId: string, chapterId: string) => saveSubjectPlans(deleteSubjectTopic(subjectPlans, subjectId, materialId, chapterId))
  const createPlanLesson = (subjectId: string, parent: TopicParent, title: string) => saveSubjectPlans(addSubjectTopic(subjectPlans, subjectId, title, parent))
  const removePlanLesson = (reference: CourseLessonRef) => saveSubjectPlans(deleteSubjectLesson(subjectPlans, reference))
  useEffect(() => {
    const next = removeGeneratedCourseLessons(subjectPlans, customLessons)
    if (next !== subjectPlans) saveSubjectPlans(next)
  }, [customLessons, subjectPlans, saveSubjectPlans])
  const makeTopicVideo = (request: TopicVideoRequest) => { setTopicRequest(request); navigate('/') }
  const goWorkspace = () => { setTopicRequest(null); navigate('/') }
  const createLesson = (lesson: Lesson) => {
    setCustomLessons(old => [lesson, ...old])
    setTopicRequest(null)
    setFilter('All subjects')
    setLibraryView('all')
    setQuery('')
    openLesson(lesson)
    setToast('Your video is being prepared. Saved to your library.')
  }
  const menuContent = <NavigationDrawer
    open={menu}
    theme={theme}
    onTheme={setTheme}
    current={settings ? 'settings' : planning ? 'courses' : selected ? 'lesson' : libraryPage ? 'library' : 'workspace'}
    onClose={() => setMenu(false)}
    onWorkspace={goWorkspace}
    onLibrary={goLibrary}
    onCourses={() => navigate('/courses')}
    onCreate={() => { goWorkspace(); requestAnimationFrame(() => document.getElementById('video-topic')?.focus()) }}
  />

  const subjectTitle = (lesson: Lesson) => courseForSubject(courses, lesson.subject)?.title ?? lesson.subject
  const scopedLessons = libraryViewLessons(allLessons, libraryView, bookmarks)
  const visible = scopedLessons.filter(l => (filter === 'All subjects' || subjectTitle(l) === filter) && `${l.title} ${l.subject} ${subjectTitle(l)}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'az' ? a.title.localeCompare(b.title) : sort === 'duration' ? a.duration - b.duration : 0)
  const availableSubjects = [...new Set(scopedLessons.map(subjectTitle))]
  const groups = availableSubjects.map(subject => ({ subject, lessons: visible.filter(l => subjectTitle(l) === subject) })).filter(group => group.lessons.length)
  // Follow the rendered order across subject groups, after filtering and sorting.
  const thumbnailColors = new Map(groups.flatMap(group => group.lessons).map((lesson, index) => [lesson.id, libraryColors[index % libraryColors.length]]))

  return <>
    {selected ? <LessonPlayer key={selected.id} lesson={selected} onPlayed={onPlayed} overlayOpen={false} menuOpen={menu} onMenu={() => setMenu(!menu)} menuContent={menuContent} onHome={goLibrary}/>
    : <div className={`app-shell ${settings ? 'settings-shell' : !planning && !libraryPage ? 'workspace-shell' : ''}`}>
      <header className="header">
        <div className="header-start"><div className="menu-anchor"><button className={`icon-button menu-toggle ${menu ? 'is-open' : ''}`} aria-label="Open navigation" aria-expanded={menu} aria-controls="navigation-drawer" onClick={() => setMenu(!menu)}><MenuGlyph/></button>{menuContent}</div><button className="wordmark" onClick={goWorkspace}>Aha!</button></div>
        {!settings && !planning && !libraryPage && <button className="workspace-library-link" onClick={goLibrary}>Your library <ArrowUpRight size={15}/></button>}
      </header>
      {settings ? <SettingsPage theme={theme} onTheme={setTheme}/> : planning ? <CoursesPage curriculum={courses} selectedId={path.split('/')[2]} onSelect={id => navigate(id ? `/courses/${id}` : '/courses', false)} plans={subjectPlans} onAddMaterial={addPlanMaterial} onAddTopic={createTopic} onDeleteTopic={removeTopic} onAddLesson={createPlanLesson} onDeleteLesson={removePlanLesson} pendingLessons={pendingCourseLessons} onMakeVideo={makeTopicVideo} onAddCourse={createCourse} onDeleteCourse={removeCourse} onNewVideo={goWorkspace} recent={overviewLessons(playHistory, activeLessons, courses)} renderVideo={lesson => <VideoThumbnail lesson={lesson} color={lesson.color} onOpen={() => openLesson(lesson)}/>} storageNote={planStorageNote}/> : libraryPage ? <main className="library-page">
        <section className="library-section" id="library">
          <div className="section-heading">
            <h1>Library</h1>
            <div className="library-actions">
              <button className={`saved-button ${libraryView === 'saved' ? 'active' : ''}`} onClick={() => changeLibraryView('saved')} aria-label="Saved videos" aria-pressed={libraryView === 'saved'}><Bookmark size={16} fill={libraryView === 'saved' ? 'currentColor' : 'none'}/><span>Saved</span></button>
              <button className={`saved-button ${libraryView === 'archive' ? 'active' : ''}`} onClick={() => changeLibraryView('archive')} aria-label="Archived videos" aria-pressed={libraryView === 'archive'}><Archive size={16}/><span>Archive</span></button>
              <label className="sort-select"><SlidersHorizontal size={16}/><select aria-label="Sort videos" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently added</option><option value="az">Title A–Z</option><option value="duration">Shortest first</option></select><ChevronDown size={13}/></label>
            </div>
          </div>
          <div className="library-toolbar">
            <div className="filter-tabs" role="group" aria-label="Filter by subject">{['All subjects', ...availableSubjects].map(subject => <button key={subject} className={filter === subject ? 'active' : ''} aria-pressed={filter === subject} onClick={() => setFilter(subject)}>{subject}</button>)}</div>
            <label className="search-box"><Search size={17}/><input placeholder="Search videos" aria-label="Search your library" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14}/></button>}</label>
          </div>
          {libraryView === 'archive' && <p className="archive-note">Deleted videos stay here. Deleting a video from Archive removes it permanently.</p>}
          {groups.map(({ subject, lessons: groupLessons }) => <div className="subject-group" key={subject}>
            <div className="subject-heading"><span className="subject-symbol">{subject === 'Organic chemistry' ? <Atom size={20}/> : (subject === 'Linear algebra' || subject === 'Lineare Algebra') ? <ArrowUpRight size={19}/> : <FileText size={18}/>}</span><h3>{subject}</h3></div>
            <div className="video-grid">{groupLessons.map((lesson, index) => <VideoCard key={lesson.id} lesson={lesson} color={thumbnailColors.get(lesson.id)!} saved={bookmarks.includes(lesson.id)} onOpen={() => openLesson(lesson)} onToggleSaved={() => toggleSaved(lesson.id)} onDelete={() => { void removeLesson(lesson) }} archived={libraryView === 'archive'} deleting={deleting.includes(lesson.id)} index={index}/>)}</div>
          </div>)}
          {!visible.length && <div className="empty-library"><h3>{query || filter !== 'All subjects' ? 'No videos found' : libraryView === 'archive' ? 'No archived videos' : libraryView === 'saved' ? 'No saved videos' : 'No videos found'}</h3>{(query || filter !== 'All subjects') && <button className="secondary-button" onClick={() => { setQuery(''); setFilter('All subjects') }}>Clear filters</button>}</div>}
        </section>
      </main> : <>
        {invalidLesson && <div className="not-found"><p>This explanation isn’t in your library yet.</p><button onClick={goLibrary}>Open your library <ArrowRight size={16}/></button></div>}
        <WorkspacePage key={topicRequest ? `${topicRequest.sourceName}:${topicRequest.chapter}:${topicRequest.title}` : 'workspace'} initialTopic={topicRequest} onCreate={createLesson}/>
      </>}
      <footer><span className="footer-logo">Aha!</span></footer>
    </div>}
    {toast && <div className="toast" role="status"><span><Check size={16}/></span>{toast}</div>}
  </>
}
