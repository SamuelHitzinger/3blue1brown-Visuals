import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { ArrowRight, Camera, FileImage, FileText, Plus, Upload, X } from './Icons'
import PhotoCapture from './PhotoCapture'
import { artworkForTitle } from './data'
import type { Lesson } from './data'
import type { TopicVideoRequest } from './subjectPlans'
import { requestVideo, videoLesson } from './videos'

const modes = [
  { id: 'drop', label: 'Drag & drop', icon: Upload },
  { id: 'text', label: 'Text & file', icon: FileText },
  { id: 'photos', label: 'Photos', icon: FileImage },
] as const
type InputMode = typeof modes[number]['id']
const acceptedFiles = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp'
const imageFile = /\.(png|jpe?g|webp)$/i
const supportedFile = /\.(pdf|docx|txt|md|png|jpe?g|webp)$/i

function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url ? <img src={url} alt={file.name}/> : null
}

export default function WorkspacePage({ onCreate, initialTopic }: { onCreate: (lesson: Lesson) => void; initialTopic?: TopicVideoRequest | null }) {
  const [mode, setMode] = useState<InputMode>('text')
  const [topic, setTopic] = useState(initialTopic ? `${initialTopic.title}\n\n${initialTopic.text}` : '')
  const [modeFiles, setModeFiles] = useState<Record<InputMode, File[]>>({ drop: [], text: [], photos: [] })
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const submitted = useRef(false)
  const requestKey = useRef(crypto.randomUUID())
  const requestBody = useRef('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const files = modeFiles[mode]
  const ready = Boolean((mode === 'text' && topic.trim()) || files.length)
  const activeIndex = modes.findIndex(item => item.id === mode)

  const switchMode = (next: InputMode) => {
    if (submitted.current) return
    setMode(next)
    setError('')
    setCameraOpen(false)
    setDragging(false)
    dragDepth.current = 0
    requestAnimationFrame(() => document.getElementById(next === 'text' ? 'video-topic' : `input-${next}-heading`)?.focus({ preventScroll: true }))
  }
  const addFiles = (incoming: File[]) => {
    if (submitted.current) return
    const next = [...files]
    const errors = new Set<string>()
    for (const file of incoming) {
      if (!(mode === 'photos' ? imageFile : supportedFile).test(file.name)) { errors.add(mode === 'photos' ? 'Choose an image for Photos.' : 'Choose a PDF, DOCX, text file, or image.'); continue }
      if (next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue
      next.push(file)
    }
    setModeFiles(current => ({ ...current, [mode]: next }))
    setError([...errors].join(' '))
  }
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []))
    event.target.value = ''
  }
  const dropFiles = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }
  const createVideo = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || submitted.current || cameraOpen) return
    submitted.current = true
    setCreating(true)
    setError('')
    const text = mode === 'text' ? topic.trim() : ''
    const title = text.split('\n')[0].slice(0, 100) || files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
    try {
      const documents = []
      if (!mounted.current) return
      const context = mode === 'text' ? initialTopic : null
      if (context) documents.unshift({ name: context.sourceName, text })
      const body = { title, topic: text, documents, videoMode: 'interactive' as const }
      const serialized = JSON.stringify({ ...body, files: files.map(file => ({ name: file.name, size: file.size, lastModified: file.lastModified })) })
      if (serialized !== requestBody.current) { requestBody.current = serialized; requestKey.current = crypto.randomUUID() }
      const lesson = videoLesson(await requestVideo(body, requestKey.current, files))
      if (mounted.current) onCreate({ ...lesson, videoMode: body.videoMode, subtitle: context?.chapter || lesson.subtitle, subject: context?.subject || lesson.subject, artwork: artworkForTitle(title, 'idea'), color: context?.color || lesson.color, source: context ? { text, chapter: context.chapter, name: context.sourceName } : undefined, courseLesson: context?.courseLesson })
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Could not create your video.')
    } finally {
      submitted.current = false
      if (mounted.current) setCreating(false)
    }
  }

  return <main className="workspace-page">
    <div className="workspace-heading">
      <span className="workspace-label">Workspace</span>
      <h1>What would you like<br/>to understand?</h1>
      <p>Any topic. One clear video. Start with a question or an idea.</p>
    </div>

    <form className="input-deck" aria-label="Create an explanation" onSubmit={createVideo} aria-busy={creating}>
      {modes.map((item, index) => {
        const active = item.id === mode
        const side = index === (activeIndex + modes.length - 1) % modes.length ? 'left' : 'right'
        const Icon = item.icon
        return <section key={item.id} className={`input-card mode-${item.id} ${active ? 'is-active' : `is-${side}`}`} aria-label={`${item.label} input`}>
          {!active ? <button type="button" className="mode-switch" aria-label={`Switch to ${item.label}`} onClick={() => switchMode(item.id)}>
            <span className="mode-peek"><Icon size={22}/><span>{item.label}</span></span>
          </button> : <div className={`video-composer ${dragging ? 'is-dragging' : ''}`}
            onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current += 1; setDragging(true) } }}
            onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
            onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }}
            onDrop={dropFiles}>
            <div className="composer-heading">
              <span className="composer-icon"><Icon size={20}/></span><h2 id={`input-${mode}-heading`} tabIndex={-1}>{item.label}</h2>
            </div>

            {mode === 'text' ? <textarea id="video-topic" aria-label="What would you like explained?" disabled={creating} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Explain something I’ve always wondered about…"/>
            : mode === 'drop' ? <button className="composer-upload-area" type="button" onClick={() => picker.current?.click()}>
              <Upload size={38}/><strong>Drop your material here</strong><span>Documents, notes, or images</span><span className="upload-browse">Choose files <Plus size={14}/></span>
            </button>
            : cameraOpen ? <PhotoCapture onCapture={file => { addFiles([file]); setCameraOpen(false) }} onClose={() => setCameraOpen(false)}/>
            : <div className="composer-photo-area">
              {files.length ? <div className="photo-previews">{files.map(file => <PhotoPreview key={`${file.name}-${file.lastModified}`} file={file}/>)}</div> : <><FileImage size={38}/><strong>A picture worth explaining.</strong></>}
              <div className="photo-input-actions"><button type="button" onClick={() => picker.current?.click()}><Plus size={16}/> Choose photos</button><button type="button" onClick={() => setCameraOpen(true)}><Camera size={17}/> Take a photo</button></div>
            </div>}

            {initialTopic && mode === 'text' && <div className="topic-composer-source"><span>{initialTopic.subject} · {initialTopic.chapter}</span><small><FileText size={13}/>{initialTopic.sourceName}</small></div>}
            {files.length > 0 && <ul className="composer-files" aria-label="Source files">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${file.size}`}>
              {imageFile.test(file.name) ? <FileImage size={17}/> : <FileText size={17}/>}
              <span title={file.name}>{file.name}</span>
              <button type="button" disabled={creating} aria-label={`Remove ${file.name}`} onClick={() => setModeFiles(current => ({ ...current, [mode]: current[mode].filter((_, i) => i !== index) }))}><X size={14}/></button>
            </li>)}</ul>}
            {error && <p className="composer-error" role="alert">{error}</p>}
            <input ref={picker} type="file" accept={mode === 'photos' ? '.png,.jpg,.jpeg,.webp' : acceptedFiles} multiple onChange={selectFiles} hidden aria-label={mode === 'photos' ? 'Choose photos' : 'Choose source files'}/>
            <div className="composer-actions">
              {mode === 'text' && <button type="button" className="attach-source" onClick={() => picker.current?.click()}><Plus size={17}/> Add a file</button>}
              <button className="primary-button create-video-button" type="submit" disabled={!ready || cameraOpen || creating}>{creating ? 'Preparing your video…' : 'Create video'} <ArrowRight size={17}/></button>
            </div>
            {dragging && <div className="composer-drop-overlay"><Upload size={32}/><span>{mode === 'photos' ? 'Drop your photos here' : 'Drop your files here'}</span></div>}
          </div>}
        </section>
      })}
    </form>
  </main>
}
