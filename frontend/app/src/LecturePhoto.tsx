import { useState } from 'react'
import type { LecturePhotoReference, LectureSession } from '../../../shared/lecture'

/** Source identifiers only: image URLs are always constructed on this origin. */
export default function LecturePhoto({ photo, session }: { photo: LecturePhotoReference; session: LectureSession }) {
  const [failed, setFailed] = useState(false)
  const source = session.sources.find(source => source.id === photo.sourceId)
  if (failed || source?.capture?.kind !== 'photo' || !source.capture.photoSnippet) return null
  return <figure className="notebook-photo">
    <img src={`/api/lectures/${encodeURIComponent(session.id)}/sources/${encodeURIComponent(source.id)}/photo-snippet`} alt={source.capture.photoSnippet.description} loading="lazy" decoding="async" onError={() => setFailed(true)}/>
    <figcaption>{photo.caption}</figcaption>
  </figure>
}
