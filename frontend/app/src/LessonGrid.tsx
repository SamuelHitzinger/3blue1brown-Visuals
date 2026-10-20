import { useId, useRef, useState } from 'react'
import { ArrowRight, LoaderCircle, Plus, Trash, X } from './Icons'
import type { CourseSubject } from './curriculum'
import type { PlanChapter, VideoSegment } from './plan'
import type { CourseLessonRef, SavedMaterial, TopicVideoRequest } from './subjectPlans'
import { topicLessonText } from './studyPlanClient'

type LessonGridProps = {
  subject: CourseSubject
  material: SavedMaterial
  chapter: PlanChapter
  chapterIndex: number
  pendingLessons: CourseLessonRef[]
  onAdd: (title: string) => void
  onDelete: (reference: CourseLessonRef) => void
  onMakeVideo: (request: TopicVideoRequest) => void
}

export default function LessonGrid({ subject, material, chapter, chapterIndex, pendingLessons, onAdd, onDelete, onMakeVideo }: LessonGridProps) {
  const grid = useRef<HTMLOListElement>(null)
  const reference = (lessonId: string): CourseLessonRef => ({ subjectId: subject.id, materialId: material.id, chapterId: chapter.id, lessonId })
  const remove = (lessonId: string) => {
    onDelete(reference(lessonId))
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>('.lesson-add-tile, .lesson-create-form input')?.focus())
  }
  return <ol ref={grid} className="topic-widget-grid" aria-label={`Lessons in ${chapter.title}`}>
    {chapter.segments.map((lesson, index) => <LessonCard key={lesson.id} lesson={lesson} number={`${chapterIndex + 1}.${index + 1}`}
      generating={pendingLessons.some(item => item.subjectId === subject.id && item.materialId === material.id && item.chapterId === chapter.id && item.lessonId === lesson.id)}
      onDelete={() => remove(lesson.id)} onMakeVideo={() => onMakeVideo({
        courseLesson: reference(lesson.id), title: lesson.title,
        text: topicLessonText(lesson, material.plan, `Explain the topic “${lesson.title}” from the chapter “${chapter.title}” in ${subject.title}. Only a chapter outline was provided.`),
        subject: subject.title, color: subject.color, chapter: chapter.title, sourceName: material.plan.sourceName,
      })}
    />)}
    <li><NewLessonTile topic={chapter.title} onAdd={onAdd}/></li>
  </ol>
}

function LessonCard({ lesson, number, generating, onMakeVideo, onDelete }: { lesson: VideoSegment; number: string; generating: boolean; onMakeVideo: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const cancel = () => { setConfirming(false); requestAnimationFrame(() => deleteButton.current?.focus()) }
  return <li className="lesson-card" onKeyDown={event => { if (confirming && event.key === 'Escape') { event.preventDefault(); cancel() } }}>
    <button type="button" className="topic-video-widget" disabled={generating} aria-label={`${generating ? 'Generating video' : 'Make me a video'}: ${lesson.title}`} onClick={onMakeVideo} inert={confirming} aria-hidden={confirming}>
      <span className="topic-widget-number">{number}</span>
      <span className="topic-widget-title">{lesson.title}</span>
      {generating ? <span className="lesson-generating" role="status"><LoaderCircle size={13} className="material-spinner"/>Generating…</span>
        : <><span className="topic-widget-duration">Length follows explanation</span><span className="topic-widget-cta" aria-hidden="true"><span>Make me a video <ArrowRight size={15}/></span></span></>}
    </button>
    {!confirming && <button type="button" ref={deleteButton} className="lesson-delete-button" aria-label={`Delete ${lesson.title} lesson`} title="Delete lesson" onClick={() => setConfirming(true)}><Trash size={15}/></button>}
    {confirming && <div className="lesson-delete-confirm" role="group" aria-label={`Delete ${lesson.title} lesson?`}>
      <strong>Delete lesson?</strong><span>{lesson.title}</span>
      <div><button type="button" className="lesson-confirm-delete" aria-label={`Confirm delete ${lesson.title} lesson`} onClick={onDelete}>Delete</button><button type="button" autoFocus aria-label={`Cancel deleting ${lesson.title} lesson`} onClick={cancel}>Cancel</button></div>
    </div>}
  </li>
}

function NewLessonTile({ topic, onAdd }: { topic: string; onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = () => {
    setAdding(false); setTitle(''); setError('')
    requestAnimationFrame(() => button.current?.focus())
  }
  if (!adding) return <button type="button" ref={button} className="new-video-tile lesson-add-tile" aria-label={`New video lesson in ${topic}`} onClick={() => setAdding(true)}><Plus size={29}/><span>New video</span></button>
  return <form className="lesson-create-form" aria-label={`New lesson in ${topic}`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close() } }} onSubmit={event => {
    event.preventDefault()
    try { onAdd(title); close() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add this lesson.') }
  }}>
    <label htmlFor={id}>Lesson title</label>
    <input id={id} autoFocus required maxLength={80} value={title} placeholder="e.g. The chain rule" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setTitle(event.target.value); setError('') }}/>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
    <div><button className="lesson-create-submit" type="submit" disabled={!title.trim()}><Plus size={14}/>Add lesson</button><button type="button" className="icon-button" aria-label="Cancel new lesson" onClick={close}><X size={16}/></button></div>
  </form>
}
