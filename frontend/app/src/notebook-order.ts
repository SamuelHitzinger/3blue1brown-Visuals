import { orderLectureSummaries } from '../../../shared/lecture.ts'
import type { LectureSummary } from '../../../shared/lecture'

export const orderedLectures = (lectures: LectureSummary[]): LectureSummary[] => orderLectureSummaries(lectures)

export function moveLecture(lectures: LectureSummary[], id: string, target: number): LectureSummary[] {
  const next = [...lectures]
  const index = next.findIndex(lecture => lecture.id === id)
  if (index < 0 || target < 0 || target >= next.length) return next
  const [lecture] = next.splice(index, 1)
  next.splice(target, 0, lecture)
  return next
}
