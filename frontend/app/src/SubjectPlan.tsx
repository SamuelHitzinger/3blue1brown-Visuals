import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, LoaderCircle, Plus, Upload, X } from './Icons'
import LessonGrid from './LessonGrid'
import type { CourseSubject } from './curriculum'
import type { StudyPlan } from './plan'
import { requestMaterialPlan } from './studyPlanClient'
import type { CourseLessonRef, SavedMaterial, TopicParent, TopicVideoRequest } from './subjectPlans'

export default function SubjectPlan({ subject, materials, onAdd, onAddLesson, onDeleteLesson, pendingLessons, onMakeVideo, uploadRequest = 0 }: { subject: CourseSubject; materials: SavedMaterial[]; onAdd: (plans: StudyPlan[]) => void; onAddLesson: (parent: TopicParent, title: string) => void; onDeleteLesson: (reference: CourseLessonRef) => void; pendingLessons: CourseLessonRef[]; onMakeVideo: (request: TopicVideoRequest) => void; uploadRequest?: number }) {
  const [adding, setAdding] = useState(false)
  useEffect(() => { if (uploadRequest) setAdding(true) }, [uploadRequest])
  const chapters = materials.flatMap(material => material.plan.chapters.map(chapter => ({ ...chapter, material })))
  const hasLessons = chapters.some(chapter => chapter.segments.length > 0)
  const showUpload = !hasLessons || adding
  return <section id="subject-plan" className={`subject-plan subject-${subject.color}`} aria-labelledby="subject-plan-title">
    <div className="subject-plan-heading"><h2 id="subject-plan-title">{subject.title}</h2>{!showUpload && <button className="subject-add-material" onClick={() => setAdding(true)}><Plus size={16}/> Add material</button>}</div>
    {showUpload && <MaterialUpload subject={subject} nextNote={materials.length + 1} onCancel={hasLessons ? () => setAdding(false) : undefined} onAdd={plans => { onAdd(plans); setAdding(false) }}/>}
    {chapters.length > 0 && <div className="subject-chapters">{chapters.map((chapter, index) => <section className="subject-chapter" key={`${chapter.material.id}-${chapter.id}`} aria-labelledby={`chapter-${chapter.material.id}-${chapter.id}`}>
      <div className="subject-chapter-heading"><span className="chapter-number">{String(index + 1).padStart(2, '0')}</span><div><span className="subject-plan-kicker">Topic {index + 1}</span><h3 tabIndex={-1} id={`chapter-${chapter.material.id}-${chapter.id}`}>{chapter.title}</h3></div></div>
      <LessonGrid subject={subject} material={chapter.material} chapter={chapter} chapterIndex={index} pendingLessons={pendingLessons} onAdd={title => onAddLesson({ materialId: chapter.material.id, chapterId: chapter.id }, title)} onDelete={onDeleteLesson} onMakeVideo={onMakeVideo}/>
    </section>)}</div>}
  </section>
}

function MaterialUpload({ subject, nextNote, onAdd, onCancel }: { subject: CourseSubject; nextNote: number; onAdd: (plans: StudyPlan[]) => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'files' | 'text'>('files')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const reader = useRef<AbortController | null>(null)
  useEffect(() => () => reader.current?.abort(), [])
  const busy = !!status

  const selectFiles = (selected: File[]) => {
    if (!selected.length || reader.current) return
    const next = [...files]
    for (const file of selected) {
      if (!next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file)
    }
    setFiles(next); setError('')
  }
  const addMaterial = async () => {
    if (reader.current || (!files.length && !text.trim())) return
    const controller = new AbortController(); reader.current = controller
    setError(''); setStatus('Uploading your material…')
    try {
      const plan = await requestMaterialPlan({ name: `${subject.title} material ${nextNote}`, files, text }, controller.signal, message => { if (!controller.signal.aborted) setStatus(message) })
      if (!controller.signal.aborted) { onAdd([plan]); setFiles([]); setText('') }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not organize your material. Your files are still here — try again.')
    } finally {
      if (reader.current === controller) { reader.current = null; setStatus('') }
    }
  }
  const cancel = () => { reader.current?.abort(); reader.current = null; setStatus('') }
  return <div className="subject-upload" aria-label={`Course material for ${subject.title}`} aria-busy={busy} onPaste={event => {
    const pasted = Array.from(event.clipboardData.files)
    if (!pasted.length) return
    event.preventDefault()
    if (busy) return
    selectFiles(pasted); setMode('files')
  }}>
    <div className="subject-upload-intro">
      <span className="subject-upload-symbol"><BookOpen size={24}/></span>
      <div className="subject-upload-copy"><h3>Add your course material</h3><p>AI groups your material into topics. Each lesson becomes one short video.</p></div>
      <div className="subject-upload-actions"><button type="button" className="primary-button subject-submit" disabled={busy || (!files.length && !text.trim())} onClick={() => { void addMaterial() }}>{busy ? <LoaderCircle className="material-spinner" size={16}/> : <Plus size={16}/>} {busy ? 'Adding…' : 'Add'}</button>{onCancel && <button type="button" className="icon-button" onClick={onCancel} aria-label="Close material upload"><X size={18}/></button>}</div>
    </div>
    <div className="subject-input-tabs" role="tablist" aria-label="Course material input">
      <button type="button" role="tab" id="material-files-tab" aria-controls="material-files-panel" aria-selected={mode === 'files'} className={mode === 'files' ? 'active' : ''} onClick={() => setMode('files')}><Upload size={15}/> Upload files{files.length > 0 && <span className="material-count">{files.length}</span>}</button>
      <button type="button" role="tab" id="material-text-tab" aria-controls="material-text-panel" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}><FileText size={15}/> Paste text{text.trim() && <span className="material-count">1</span>}</button>
    </div>
    <div id="material-files-panel" role="tabpanel" aria-labelledby="material-files-tab" hidden={mode !== 'files'}>
      <input hidden type="file" multiple ref={picker} disabled={busy} aria-label={`Upload course material for ${subject.title}`} onChange={event => { selectFiles(Array.from(event.target.files || [])); event.target.value = '' }}/>
      <div className={`subject-dropzone ${dragging ? 'dragging' : ''} ${files.length ? 'has-files' : ''}`} tabIndex={0} role="group" aria-label="Drop files or paste screenshots here" onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(Array.from(event.dataTransfer.files)) }}>
        {files.length ? <ul className="material-file-list" aria-label="Selected files">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}>
          <span className="material-file-icon"><FileText size={21}/></span><span className="material-file-info"><strong>{file.name}</strong><small>{file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</small></span><button type="button" className="icon-button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); setError('') }}><X size={16}/></button>
        </li>)}</ul> : <><Upload size={25}/><strong>Drop files or paste a screenshot</strong><span>PDFs, screenshots, photos, slides, spreadsheets, recordings, or notes</span></>}
        <button type="button" className="subject-upload-link" disabled={busy} onClick={() => picker.current?.click()}>{files.length ? 'Add more files' : 'Choose files'} <Plus size={14}/></button>
      </div>
    </div>
    <div id="material-text-panel" role="tabpanel" aria-labelledby="material-text-tab" hidden={mode !== 'text'}>
      <div className="subject-pasted-text"><textarea aria-label={`Course notes for ${subject.title}`} value={text} readOnly={busy} onChange={event => { setText(event.target.value); setError('') }} placeholder={'Paste your lecture notes, a course outline, or anything you want to learn.\n\nYou can combine notes with uploaded files.'}/></div>
    </div>
    {status && <div className="material-reading" role="status"><span>{status}</span><button type="button" onClick={cancel}>Cancel <X size={13}/></button></div>}
    {error && <p className="subject-plan-error" role="alert">{error}</p>}
  </div>
}
