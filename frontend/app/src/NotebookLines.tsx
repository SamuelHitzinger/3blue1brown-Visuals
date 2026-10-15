import type { LecturePoint, LectureConcept } from '../../../shared/lecture'
import { ConceptText } from './LectureDiagram'
import { groupNotebookPoints, noteLineKind, splitNoteScripts } from './lectureDocument'
import { noteMathImage } from './noteMath'

export default function NotebookLines({ points, terms = [], showGroupTitles = true }: { points: LecturePoint[]; terms?: LectureConcept['terms']; showGroupTitles?: boolean }) {
  return <div className="notebook-lines">{groupNotebookPoints(points).map((group, index) => <div className="notebook-line-group" key={index}>
    {showGroupTitles && group.title && <h4 className="notebook-group-title">{group.title}</h4>}
    {group.points.map((point, line) => {
      const kind = noteLineKind(point)
      const math = point.math ? noteMathImage(point.math) : null
      const relation = kind === 'relation' && /[→⇒↔]/u.test(point.text) ? point.text.split(/([→⇒↔])/u) : null
      return <div className={`notebook-line notebook-line-${kind}`} key={line}>
        {point.label && <span className="notebook-line-label">{point.label}</span>}
        <div className="notebook-line-content">{math ? <div className="notebook-equation-scroll"><img className="notebook-equation" src={math.src} width={math.width} height={math.height} alt={point.text}/></div>
          : relation ? <span className="notebook-relation-flow">{relation.map((part, i) => <span key={i} className={/^[→⇒↔]$/u.test(part) ? 'notebook-relation-arrow' : 'notebook-relation-node'}><ConceptText text={part.trim()} terms={terms}/></span>)}</span>
          : <span>{splitNoteScripts(point.text).map((part, i) => part.script === 'sub' ? <sub key={i}>{part.text}</sub> : part.script === 'sup' ? <sup key={i}>{part.text}</sup> : <ConceptText key={i} text={part.text} terms={terms}/>)}</span>}</div>
      </div>
    })}
  </div>)}</div>
}
