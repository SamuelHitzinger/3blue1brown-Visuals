import { useEffect, useRef, useState } from 'react';
import type { CourseSubject } from './curriculum';
import type { LectureSummary } from '../../../shared/lecture';
import { createLecture, deleteLecture, lectureStatus, listLectures, patchLecture, reorderLectures } from './lectures';
import { ArrowRight, BookOpen, Plus, Search } from './Icons';
import { moveLecture, orderedLectures } from './notebook-order';
import { nextLectureTitle } from '../../../shared/lectureTitles';
import './notes-dashboard.css';
import NoteInstructions from './NoteInstructions';
export const INDEPENDENT_COURSE_ID = '__independent__';
export const lectureDate = (date: string) => new Date(date).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric'
});
type Props = {
  courses: CourseSubject[];
  onOpen: (id: string) => void;
  selectedCourseId?: string;
  onSelectCourse: (id?: string) => void;
  onAddCourse?: (name: string) => void;
  onDeleteCourse?: (id: string) => Promise<void>;
};
export default function LecturesPage({
  courses,
  onOpen,
  selectedCourseId,
  onSelectCourse,
  onAddCourse,
  onDeleteCourse
}: Props) {
  const [lectures, setLectures] = useState<LectureSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [title, setTitle] = useState(''),
    [courseName, setCourseName] = useState(''),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string>(),
    [rename, setRename] = useState(''),
    [deleting, setDeleting] = useState<string>(),
    [dragged, setDragged] = useState<string>();
  const [confirmingCourse, setConfirmingCourse] = useState(false);
  const deleteCourseButton = useRef<HTMLButtonElement>(null);
  const mutation = useRef(false),
    mounted = useRef(true),
    request = useRef({
      body: '',
      key: crypto.randomUUID()
    });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listLectures(controller.signal).then(setLectures).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load lectures.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    setQuery('');
    setTitle('');
    setEditing(undefined);
    setDeleting(undefined);
  }, [selectedCourseId]);
  const selected = selectedCourseId !== undefined,
    courseId = selectedCourseId === INDEPENDENT_COURSE_ID ? undefined : selectedCourseId;
  const course = courses.find(item => item.id === courseId),
    courseTitle = course?.title ?? (courseId ? 'Other course' : 'Independent learning');
  const ordered = orderedLectures(lectures.filter(item => item.courseId === courseId)),
    visible = ordered.filter(item => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  const suggestedTitle = nextLectureTitle(ordered);
  const groups = [...courses.map(item => ({
    id: item.id,
    title: item.title,
    color: item.color
  })), ...Array.from(new Set(lectures.flatMap(item => item.courseId && !courses.some(course => course.id === item.courseId) ? [item.courseId] : []))).map(id => ({
    id,
    title: 'Other course',
    color: 'sage'
  })), {
    id: INDEPENDENT_COURSE_ID,
    title: 'Independent learning',
    color: 'sage'
  }];
  async function mutate(action: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : 'Could not save this change.');
        try {
          const next = await listLectures();
          if (mounted.current) setLectures(next);
        } catch {/* Retain previous list. */}
      }
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reorder(id: string, target: number) {
    if (query.trim() || busy || mutation.current) return;
    const next = moveLecture(ordered, id, target),
      previous = lectures;
    await mutate(async () => {
      setLectures([...lectures.filter(item => item.courseId !== courseId), ...next.map((item, position) => ({
        ...item,
        position
      }))]);
      try {
        const saved = await reorderLectures(courseId, next.map(item => item.id));
        if (mounted.current) setLectures(current => [...current.filter(item => item.courseId !== courseId), ...saved]);
      } catch (reason) {
        if (mounted.current) setLectures(previous);
        throw reason;
      }
    });
  }
  return <main className="learning-page notes-dashboard">
 {selected && <button className="notebook-back" onClick={() => onSelectCourse()}>← All courses</button>}
 <div className="learning-heading"><span className="learning-eyebrow">Your notebooks</span><h1>{selected ? courseTitle : 'A place for what you learn.'}</h1><p>{selected ? 'One lecture at a time. Your material, clear notes, and ideas worth keeping.' : 'Choose a course. Pick up where you left off, or start something new.'}</p></div>
 {selected && courseId && onDeleteCourse && <div className="notebook-course-delete" onKeyDown={event => { if (event.key === 'Escape' && !busy) { setConfirmingCourse(false); requestAnimationFrame(() => deleteCourseButton.current?.focus()); } }}>
   {confirmingCourse ? <div className="notebook-delete-confirm" role="group" aria-labelledby="delete-course-heading">
     <strong id="delete-course-heading">Delete {courseTitle}?</strong><p>All lectures and their notes will be kept under Independent learning. Your videos stay in Library.</p>
     <button disabled={busy} onClick={() => void mutate(async () => { await onDeleteCourse(courseId); })}>{busy ? 'Deleting…' : 'Confirm deletion'}</button>
     <button autoFocus disabled={busy} onClick={() => { setConfirmingCourse(false); requestAnimationFrame(() => deleteCourseButton.current?.focus()); }}>Cancel</button>
   </div> : <button className="learning-text-button" ref={deleteCourseButton} disabled={busy || loading} onClick={() => setConfirmingCourse(true)}>Delete course</button>}
 </div>}
 {error && <div className="notebook-error" role="alert">{error} <button className="secondary-button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
 {loading ? <div className="learning-empty" role="status">Opening your notebooks…</div> : !selected ? <>
 <div className="notebook-section-title"><h2>Your courses <span>{groups.length}</span></h2><span>{lectures.length} lectures saved</span></div>
 <div className="notebook-course-grid">{groups.map(group => {
          const items = lectures.filter(item => item.courseId === (group.id === INDEPENDENT_COURSE_ID ? undefined : group.id)),
            latest = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          return <button key={group.id} className={'notebook-course-card notebook-' + group.color} onClick={() => onSelectCourse(group.id)}><span className="notebook-course-icon"><BookOpen size={25} /></span><span className="notebook-course-name">{group.title}</span><span className="notebook-course-count">{items.length} {items.length === 1 ? 'lecture' : 'lectures'}</span><span className="notebook-course-footer"><span>{latest ? 'Updated ' + lectureDate(latest.updatedAt) : 'Ready for your first lecture'}</span><ArrowRight size={17} /></span></button>;
        })}</div>
 {onAddCourse && <form className="notebook-add-course" onSubmit={event => {
        event.preventDefault();
        if (courseName.trim()) {
          onAddCourse(courseName.trim());
          setCourseName('');
        }
      }}><label htmlFor="notebook-course-name">Make room for a new course</label><div><input id="notebook-course-name" maxLength={200} value={courseName} onChange={event => setCourseName(event.target.value)} placeholder="Course name" required /><button className="secondary-button" disabled={!courseName.trim()}><Plus size={16} /> Add course</button></div></form>}
 </> : <>
 <form className="notebook-add-lecture" onSubmit={event => {
        event.preventDefault();
        void mutate(async () => {
          const body = {
              ...(title.trim() ? { title: title.trim() } : {}),
              ...(courseId ? {
                courseId
              } : {})
            },
            serialized = JSON.stringify(body);
          if (request.current.body !== serialized) request.current = {
            body: serialized,
            key: crypto.randomUUID()
          };
          const created = await createLecture(body, request.current.key);
          request.current = {
            body: '',
            key: crypto.randomUUID()
          };
          if (mounted.current) {
            setTitle('');
            setLectures(current => [...current.filter(item => item.id !== created.id), created]);
            onOpen(created.id);
          }
        });
      }}><label htmlFor="notebook-lecture-title">Start a new lecture</label><div><input id="notebook-lecture-title" placeholder={suggestedTitle} aria-describedby="lecture-title-help" maxLength={200} disabled={busy} value={title} onChange={event => setTitle(event.target.value)} /><button className="primary-button" disabled={busy}><Plus size={17} /> {busy ? 'Saving…' : 'Add lecture'}</button></div><p id="lecture-title-help" className="lecture-title-help">Leave blank for {suggestedTitle}. A subtitle comes from your notes when you finish. Custom titles stay as you write them.</p></form>
 <div className="notebook-section-title"><h2>Lectures <span>{ordered.length}</span></h2><label className="learning-search"><Search size={17} /><input aria-label="Search lectures" placeholder="Find a lecture" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
 {ordered.length > 1 && <p className="notebook-order-help">{query.trim() ? 'Clear search to rearrange lectures.' : 'Drag to arrange, or use the up and down buttons.'}</p>}
 {visible.length ? <ol className="notebook-lecture-list">{visible.map(lecture => {
          const index = ordered.findIndex(item => item.id === lecture.id);
          return <li key={lecture.id} className={'notebook-lecture' + (dragged === lecture.id ? ' is-dragging' : '')} draggable={!busy && !query.trim() && !editing && !deleting} onDragStart={event => {
            event.dataTransfer.setData('text/plain', lecture.id);
            setDragged(lecture.id);
          }} onDragEnd={() => setDragged(undefined)} onDragOver={event => {
            if (dragged && !query.trim() && !busy) event.preventDefault();
          }} onDrop={event => {
            event.preventDefault();
            if (dragged) void reorder(dragged, index);
            setDragged(undefined);
          }}>
 <span className="notebook-lecture-number">{String(index + 1).padStart(2, '0')}</span><div className="notebook-lecture-content">
 {editing === lecture.id ? <form className="notebook-rename" onSubmit={event => {
                event.preventDefault();
                if (rename.trim()) void mutate(async () => {
                  const saved = await patchLecture(lecture.id, {
                    title: rename.trim()
                  });
                  if (mounted.current) {
                    setLectures(current => current.map(item => item.id === saved.id ? saved : item));
                    setEditing(undefined);
                  }
                });
              }}><input aria-label="Lecture title" autoFocus maxLength={200} required disabled={busy} value={rename} onChange={event => setRename(event.target.value)} /><button className="secondary-button" disabled={busy || !rename.trim()}>Save</button><button type="button" disabled={busy} onClick={() => setEditing(undefined)}>Cancel</button></form> : <button className="notebook-open-lecture" onClick={() => onOpen(lecture.id)}><strong>{lecture.title}</strong><span>{lectureStatus(lecture)} · {lectureDate(lecture.updatedAt)}</span></button>}
 {deleting === lecture.id && <div className="notebook-delete-confirm"><span>Delete this lecture and all its notes?</span><button disabled={busy} onClick={() => void mutate(async () => {
                  await deleteLecture(lecture.id);
                  if (mounted.current) {
                    setLectures(current => current.filter(item => item.id !== lecture.id));
                    setDeleting(undefined);
                  }
                })}>Delete lecture</button><button disabled={busy} onClick={() => setDeleting(undefined)}>Keep lecture</button></div>}</div>
 <div className="notebook-lecture-actions"><button title="Move up" aria-label={'Move ' + lecture.title + ' up'} disabled={busy || !!query.trim() || index === 0} onClick={() => void reorder(lecture.id, index - 1)}>↑</button><button title="Move down" aria-label={'Move ' + lecture.title + ' down'} disabled={busy || !!query.trim() || index === ordered.length - 1} onClick={() => void reorder(lecture.id, index + 1)}>↓</button><button disabled={busy} onClick={() => {
                setEditing(lecture.id);
                setRename(lecture.title);
                setDeleting(undefined);
              }}>Rename</button><button disabled={busy} onClick={() => {
                setDeleting(lecture.id);
                setEditing(undefined);
              }}>Delete</button></div></li>;
        })}</ol> : <div className="learning-empty"><BookOpen size={32} /><h3>{query ? 'No matching lectures' : 'Your notebook is ready.'}</h3><p>{query ? 'Try a different title.' : 'Add your first lecture above. Its notes and material will live here.'}</p></div>}
 </>}
 {!selected && <NoteInstructions/>}
 </main>;
}
