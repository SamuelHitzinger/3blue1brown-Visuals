import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { ArrowRight, Camera, FileImage, FileText, Plus, Upload, X } from './Icons'
import PhotoCapture from './PhotoCapture'
import { artworkForTitle } from './data'
import type { Lesson } from './data'
import { requestVideo, videoLesson } from './videos'

const acceptedFiles = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp'
const imageFile = /\.(png|jpe?g|webp)$/i
const supportedFile = /\.(pdf|docx|txt|md|png|jpe?g|webp)$/i

export default function WorkspacePage({ onCreate }: { onCreate: (lesson: Lesson) => void }) {
  const [topic, setTopic] = useState('')
  const [files, setFiles] = useState<File[]>([])
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
  const ready = Boolean(topic.trim() || files.length)

  const addFiles = (incoming: File[]) => {
    if (submitted.current) return
    const next = [...files]
    const errors = new Set<string>()
    for (const file of incoming) {
      if (!supportedFile.test(file.name)) { errors.add('Choose a PDF, DOCX, text file, or image.'); continue }
      if (next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue
      next.push(file)
    }
    setFiles(next)
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
    const text = topic.trim()
    const title = text.split('\n')[0].slice(0, 100) || files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
    try {
      if (!mounted.current) return
      const body = { title, topic: text, documents: [], videoMode: 'interactive' as const }
      const serialized = JSON.stringify({ ...body, files: files.map(file => ({ name: file.name, size: file.size, lastModified: file.lastModified })) })
      if (serialized !== requestBody.current) { requestBody.current = serialized; requestKey.current = crypto.randomUUID() }
      const lesson = videoLesson(await requestVideo(body, requestKey.current, files))
      if (mounted.current) onCreate({ ...lesson, videoMode: body.videoMode, artwork: artworkForTitle(title, 'idea') })
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Could not create your video.')
    } finally {
      submitted.current = false
      if (mounted.current) setCreating(false)
    }
  }

  return <main className="workspace-page home-page">
    <div className="workspace-heading">
      <h1>What would you like<br/>to understand?</h1>
      <p>Start with a question, or add your material.</p>
    </div>
    <form className="home-composer" aria-label="Create a video" onSubmit={createVideo} aria-busy={creating}>
      <div className={`video-composer ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current += 1; setDragging(true) } }}
        onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
        onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }}
        onDrop={dropFiles}>
        <label className="home-topic-label" htmlFor="video-topic">Topic or question</label>
        <textarea id="video-topic" disabled={creating} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Why does light bend when it enters water?"/>
        {cameraOpen && <PhotoCapture onCapture={file => { addFiles([file]); setCameraOpen(false) }} onClose={() => setCameraOpen(false)}/>}
        {files.length > 0 && <ul className="composer-files" aria-label="Source files">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${file.size}`}>
          {imageFile.test(file.name) ? <FileImage size={17}/> : <FileText size={17}/>}
          <span title={file.name}>{file.name}</span>
          <button type="button" disabled={creating} aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={14}/></button>
        </li>)}</ul>}
        {error && <p className="composer-error" role="alert">{error}</p>}
        <input ref={picker} type="file" accept={acceptedFiles} multiple onChange={selectFiles} hidden aria-label="Choose source files"/>
        <div className="composer-actions">
          <div className="home-attachments"><button type="button" className="attach-source" disabled={creating} onClick={() => picker.current?.click()}><Plus size={17}/> Add files</button><button type="button" className="attach-source" disabled={creating || cameraOpen} onClick={() => setCameraOpen(true)}><Camera size={17}/> Camera</button></div>
          <button className="primary-button create-video-button" type="submit" disabled={!ready || cameraOpen || creating}>{creating ? 'Preparing your video…' : 'Create video'} <ArrowRight size={17}/></button>
        </div>
        {dragging && <div className="composer-drop-overlay"><Upload size={32}/><span>Drop your files here</span></div>}
      </div>
    </form>
    <p className="home-file-hint">You can also drop documents or photos into the box.</p>
  </main>
}
