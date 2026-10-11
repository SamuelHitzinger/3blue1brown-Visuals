import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import SubjectPlan from './SubjectPlan'
import CourseOutline, { OutlineDisclosure } from './CourseOutline'
import { Atom, BookOpen, Check, ChevronDown, Layers3, Library, ListTree, Play, Plus, Trash, X } from './Icons'
import { courseColors } from './courses'
import type { Curriculum, SubjectColor } from './curriculum'
import type { Lesson } from './data'
import type { StudyPlan } from './plan'
import type { CourseLessonRef, SubjectPlans, TopicParent, TopicVideoRequest } from './subjectPlans'

type CoursesPageProps = {
  curriculum: Curriculum
  selectedId?: string
  onSelect: (id?: string) => void
  plans: SubjectPlans
  onAddMaterial: (subjectId: string, plans: StudyPlan[]) => void
  onAddTopic: (subjectId: string, name: string) => void
  onDeleteTopic: (subjectId: string, materialId: string, chapterId: string) => void
  onAddLesson: (subjectId: string, parent: TopicParent, title: string) => void
  onDeleteLesson: (reference: CourseLessonRef) => void
  pendingLessons: CourseLessonRef[]
  onMakeVideo: (request: TopicVideoRequest) => void
  onAddCourse: (name: string, color: SubjectColor) => void
  onDeleteCourse: (id: string) => void
  onNewVideo: () => void
  recent: Lesson[]
  renderVideo: (lesson: Lesson) => ReactNode
  storageNote: string
}

export default function CoursesPage({ curriculum, selectedId, onSelect, plans, onAddMaterial, onAddTopic, onDeleteTopic, onAddLesson, onDeleteLesson, pendingLessons, onMakeVideo, onAddCourse, onDeleteCourse, onNewVideo, recent, renderVideo, storageNote }: CoursesPageProps) {
  const selectedSubject = curriculum.subjects.find(subject => subject.id === selectedId)
  const [adding, setAdding] = useState(false)
  const [uploadRequest, setUploadRequest] = useState<{ subjectId: string; sequence: number }>()
  const addButton = useRef<HTMLButtonElement>(null)
  const icons = [BookOpen, ListTree, Layers3, Atom, Library]
  const selectSubject = (id: string) => { setUploadRequest(undefined); onSelect(id === selectedId ? undefined : id) }
  const openUpload = (id: string) => {
    setUploadRequest(current => ({ subjectId: id, sequence: (current?.sequence || 0) + 1 }))
    requestAnimationFrame(() => document.getElementById('subject-plan')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }))
  }
  const openTopic = (materialId: string, chapterId: string) => {
    const heading = document.getElementById(`chapter-${materialId}-${chapterId}`)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  return <main className="plan-page courses-page" aria-label="Courses">
    <h1>Courses</h1>
    <div className="courses-layout">
      <section className="courses-overview" aria-labelledby="your-courses-title">
        <h2 id="your-courses-title">Your courses</h2>
        <ul className="plan-subject-list" aria-label="Courses">
          {curriculum.subjects.map((subject, index) => {
            const Icon = icons[index % icons.length]
            return <li key={subject.id} className={`subject-${subject.color}`}>
              <button className={`plan-subject-row ${selectedId === subject.id ? 'selected' : ''}`} aria-label={`${selectedId === subject.id ? 'Close' : 'Open'} ${subject.title} course`} aria-expanded={selectedId === subject.id} aria-controls={`course-outline-${subject.id}`} onClick={() => selectSubject(subject.id)}>
                <span className="plan-subject-icon"><Icon size={25}/></span>
                <span className="plan-subject-name">{subject.title}</span>
                <ChevronDown className="plan-subject-arrow course-outline-chevron" size={17}/>
              </button>
              <OutlineDisclosure id={`course-outline-${subject.id}`} expanded={selectedId === subject.id}>
                <CourseOutline subject={subject} materials={plans.subjects[subject.id] || []} onAdd={name => onAddTopic(subject.id, name)} onDelete={(materialId, chapterId) => onDeleteTopic(subject.id, materialId, chapterId)} onOpenTopic={openTopic} onUpload={() => openUpload(subject.id)}/>
              </OutlineDisclosure>
            </li>
          })}
        </ul>
        {adding ? <NewCourseForm defaultColor={courseColors[curriculum.subjects.length % courseColors.length]} onAdd={(name, color) => { onAddCourse(name, color); setAdding(false) }} onCancel={() => { setAdding(false); requestAnimationFrame(() => addButton.current?.focus()) }}/>
          : <button className="add-course-button" ref={addButton} onClick={() => setAdding(true)}><span><Plus size={23}/></span>Add course</button>}
      </section>
      <section className="recent-videos" aria-labelledby="recent-videos-title">
        <h2 id="recent-videos-title">Videos</h2>
        <div className="recent-video-grid">
          {Array.from({ length: 3 }, (_, index) => recent[index]
            ? <div className={`recent-video subject-${recent[index].color}`} key={recent[index].id}>{renderVideo(recent[index])}<p>{recent[index].subject}</p></div>
            : <div className="recent-video-placeholder" key={`empty-${index}`}><Play size={22}/><span>{index === 0 ? 'Your last played videos will appear here' : 'More learning ahead'}</span></div>)}
          <button className="new-video-tile" onClick={onNewVideo}><Plus size={32}/><span>New video</span></button>
        </div>
      </section>
    </div>
    {selectedSubject && <SubjectPlan key={`material-${selectedSubject.id}`} uploadRequest={uploadRequest?.subjectId === selectedSubject.id ? uploadRequest.sequence : 0} subject={selectedSubject} materials={plans.subjects[selectedSubject.id] || []} onAdd={material => onAddMaterial(selectedSubject.id, material)} onAddLesson={(parent, title) => onAddLesson(selectedSubject.id, parent, title)} onDeleteLesson={onDeleteLesson} pendingLessons={pendingLessons} onMakeVideo={onMakeVideo}/>}
    {storageNote && <p className="subject-plan-error" role="status">{storageNote}</p>}
    {selectedSubject && <DeleteCourse key={`delete-${selectedSubject.id}`} title={selectedSubject.title} onDelete={() => onDeleteCourse(selectedSubject.id)}/>}
  </main>
}

function NewCourseForm({ defaultColor, onAdd, onCancel }: { defaultColor: SubjectColor; onAdd: (name: string, color: SubjectColor) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [error, setError] = useState('')
  return <form className="new-course-form" aria-label="New course" onKeyDown={event => { if (event.key === 'Escape') onCancel() }} onSubmit={event => {
    event.preventDefault()
    try { onAdd(name, color) } catch (error) { setError(error instanceof Error ? error.message : 'Could not add this course.') }
  }}>
    <div className="new-course-heading"><h3>New course</h3><button type="button" className="icon-button" aria-label="Cancel new course" onClick={onCancel}><X size={18}/></button></div>
    <label htmlFor="course-name">Course name</label>
    <input id="course-name" autoFocus required maxLength={80} placeholder="e.g. Organic chemistry" value={name} aria-invalid={!!error} aria-describedby={error ? 'course-name-error' : undefined} onChange={event => { setName(event.target.value); setError('') }}/>
    <div className="course-color-options" role="group" aria-label="Course color">{courseColors.map(option => <button type="button" key={option} className={`course-color-option subject-${option}`} aria-label={`${option} color`} aria-pressed={color === option} onClick={() => setColor(option)}>{color === option && <Check size={18}/>}</button>)}</div>
    {error && <p id="course-name-error" className="subject-plan-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={!name.trim()} type="submit"><Plus size={16}/>Create course</button>
  </form>
}

function DeleteCourse({ title, onDelete }: { title: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const cancel = () => { setConfirming(false); requestAnimationFrame(() => deleteButton.current?.focus()) }
  return <div className="course-delete" onKeyDown={event => { if (event.key === 'Escape') cancel() }}>
    {confirming ? <div className="course-delete-confirm" role="group" aria-labelledby="delete-course-title">
      <h3 id="delete-course-title">Delete {title}?</h3>
      <p>This removes the course and its uploaded material. Your videos stay in Library.</p>
      <div className="course-delete-actions">
        <button className="delete-course-button" onClick={onDelete}><Trash size={20}/>Delete {title}</button>
        <button className="secondary-button" autoFocus onClick={cancel}>Cancel</button>
      </div>
    </div> : <button ref={deleteButton} className="delete-course-button" onClick={() => setConfirming(true)}><Trash size={20}/>Delete course</button>}
  </div>
}
