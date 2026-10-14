import test from 'node:test'
import assert from 'node:assert/strict'
import { orderedLectures, moveLecture } from '../src/notebook-order.ts'
import type { LectureSummary } from '../../../shared/lecture.ts'
const lecture=(id:string,createdAt:string,position?:number)=>({id,createdAt,position} as LectureSummary)
test('ordering honors persisted positions and uses chronological legacy indices',()=>{
 const items=[lecture('old','2025-01-01'),lecture('b','2026-01-02',1),lecture('a','2026-01-03',0),lecture('older','2024-01-01')]
 assert.deepEqual(orderedLectures(items).map(item=>item.id),['older','a','old','b'])
 assert.equal(items[0].id,'old')
})
test('moving a lecture preserves every identity and leaves input unchanged',()=>{
 const items=[lecture('a','2026-01-01'),lecture('b','2026-01-02'),lecture('c','2026-01-03')]
 assert.deepEqual(moveLecture(items,'c',0).map(item=>item.id),['c','a','b'])
 assert.deepEqual(moveLecture(items,'a',2).map(item=>item.id),['b','c','a'])
 assert.deepEqual(moveLecture(items,'missing',0),items)
 assert.deepEqual(moveLecture(items,'a',-1),items)
 assert.deepEqual(items.map(item=>item.id),['a','b','c'])
})

test('new positioned lectures follow older unpositioned records', () => {
 const items = [lecture('new', '2026-01-03', 2), lecture('old-b', '2026-01-02'), lecture('old-a', '2026-01-01')]
 assert.deepEqual(orderedLectures(items).map(item => item.id), ['old-a', 'old-b', 'new'])
})
test('legacy fallback indices are scoped to each course and stable on timestamp ties', () => {
 const items = [{ ...lecture('z', '2026-01-01'), courseId: 'math' }, { ...lecture('a', '2026-01-01'), courseId: 'math' }, { ...lecture('new', '2026-01-02', 2), courseId: 'math' }, lecture('unassigned', '2025-01-01')]
 assert.deepEqual(orderedLectures(items).filter(item => item.courseId === 'math').map(item => item.id), ['a', 'z', 'new'])
})
