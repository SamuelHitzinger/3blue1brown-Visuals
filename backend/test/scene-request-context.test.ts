import { expect, test } from 'bun:test'
import { compactVideoRequestContext, contextualVideoRequest } from '../src/scene-requests'
import type { SceneRequestInput } from '../../shared/video/scene-requests'
import type { VideoRequest } from '../../shared/video/contract'

const camera = { yaw: 0, pitch: 0, target: [0, 0, 0], height: 8, distance: 18, perspective: 0 }
const vertices = Array.from({ length: 1024 }, (_, i) => [i % 32 / 10, Math.floor(i / 32) / 10, 0])
const triangles = Array.from({ length: 31 * 31 }, (_, i) => {
  const start = Math.floor(i / 31) * 32 + i % 31
  return [[start, start + 1, start + 32], [start + 1, start + 33, start + 32]]
}).flat()
const element = (id: string, geometry: object) => ({ id, geometry, position: [1, 0, 0], rotation: [0, 0, 0],
  scale: 1, opacity: 1, fill: 'BLUE', stroke: 'none', strokeWidth: .04, space: 'world', persistent: true })
const mesh = () => ({ kind: 'mesh', vertices, triangles, normals: vertices.map(() => [0, 0, 1]),
  uv0: vertices.map(([x, y]) => [x / 3.1, y / 3.1]), shading: 'smooth',
  material: { roughness: .6, metalness: .1 }, clipPlanes: [{ normal: [0, 0, 1], offset: 1 }] })
const selected = { source: 'export default scene({}, s => { /* authoritative scientific construction */ });',
  duration: 4, narration: 'DNA strands are antiparallel.', visualDescription: 'Two labeled strands.',
  captions: [{ start: 0, end: 4, text: 'DNA strands are antiparallel.' }] }
const next = { narration: 'RNA synthesis follows.', visualDescription: 'Polymerase follows the template.' }
const original: VideoRequest = { title: 'DNA', topic: 'Explain transcription', documents: [
  { name: 'Scientific source', text: 'Coordinates and experimental limitations: retain these verbatim.' },
] }
function input(): SceneRequestInput {
  return { question: 'Explain this shape', context: { lessonId: 'lesson', lessonTitle: 'DNA', subject: 'Biology',
    time: 1.25, label: 'Template strand', elementId: 'backbone', point: { x: 200, y: 100 },
    normalizedPoint: { x: .5, y: .5 }, surface: { width: 400, height: 200 }, scene: { id: 'scene-0', time: 1.25,
      camera, controls: [{ id: 'stretch', type: 'slider', value: 2, min: 0, max: 3 }],
      frame: { elements: [element('backbone', mesh()), element('label', { kind: 'text', text: "3′ template", fontSize: .3 }),
        element('triangle', { kind: 'mesh', vertices: [[0, 0], [1, 0], [0, 1]], triangles: [[0, 1, 2]] }),
        element('strand', { kind: 'group', children: ['backbone', 'label'] })], camera, cameraAnimated: false,
        views: [{ id: 'detail', rect: [.5, 0, .5, 1], camera, orbit: true, cameraAnimated: false }] },
    } } }
}
function moment(request: VideoRequest) {
  return JSON.parse(request.documents.find(document => document.name === 'Selected video moment')!.text)
}

test('dense captured meshes use bounds and counts while all selection evidence remains intact', () => {
  const captured = input(), before = JSON.stringify(captured)
  const request = contextualVideoRequest(captured, selected, original, next)
  const result = moment(request), frame = result.scene.frame, geometry = frame.elements[0].geometry
  expect(geometry.vertices).toBeUndefined()
  expect(geometry.triangles).toBeUndefined()
  expect(geometry.normals).toBeUndefined()
  expect(geometry.uv0).toBeUndefined()
  expect(geometry.meshSummary).toEqual({ vertexCount: 1024, triangleCount: 1922, normalCount: 1024, uvCount: 1024,
    localBounds: { min: [0, 0, 0], max: [3.1, 3.1, 0] } })
  expect(frame.elements[0].screenBounds).toMatchObject({ left: expect.any(Number), top: expect.any(Number),
    right: expect.any(Number), bottom: expect.any(Number) })
  expect(frame.meshBufferNote).toContain('bounds do not identify an exact surface hit')
  expect(geometry).toMatchObject({ kind: 'mesh', shading: 'smooth', material: mesh().material, clipPlanes: mesh().clipPlanes })
  expect(frame.elements[0]).toMatchObject({ id: 'backbone', position: [1, 0, 0], rotation: [0, 0, 0], scale: 1,
    opacity: 1, fill: 'BLUE', stroke: 'none', strokeWidth: .04, space: 'world', persistent: true })
  const originalFrame = captured.context.scene!.frame as any
  expect(frame.elements.slice(1)).toEqual(originalFrame.elements.slice(1))
  expect(frame.views).toEqual(originalFrame.views)
  expect(result.scene.camera).toEqual(camera)
  expect(result.scene.controls).toEqual(captured.context.scene!.controls)
  expect(result.elementId).toBe('backbone')
  expect(result.point).toEqual(captured.context.point)
  expect(result.normalizedPoint).toEqual(captured.context.normalizedPoint)
  expect(result.scene.time).toBe(1.25)
  expect(result.selectedScene).toEqual(selected)
  expect(result.nextScene).toEqual(next)
  expect(request.documents[0]).toEqual(original.documents[0])
  expect(JSON.stringify(captured)).toBe(before)
  expect(JSON.stringify(request).length).toBeLessThan(before.length / 4)
})

test('morph endpoints compact independently and retain progress, mappings, and scientific scalar values', () => {
  const captured = input(), frame = captured.context.scene!.frame as any
  frame.elements[0].geometry.scalarColors = { domain: [0, 1023], colors: ['BLUE', 'RED'], values: vertices.map((_, i) => i) }
  frame.elements[0].morph = { from: mesh(), to: { ...mesh(), vertices: vertices.map(([x, y, z]) => [x, y, z + 1]) },
    progress: .4, map: { backbone: 'elongated' } }
  const result = moment(contextualVideoRequest(captured, selected))
  const condensed = result.scene.frame.elements[0]
  expect(condensed.morph.from.vertices).toBeUndefined()
  expect(condensed.morph.to.vertices).toBeUndefined()
  expect(condensed.morph.to.meshSummary.localBounds).toEqual({ min: [0, 0, 1], max: [3.1, 3.1, 1] })
  expect(condensed.morph.progress).toBe(.4)
  expect(condensed.morph.map).toEqual({ backbone: 'elongated' })
  expect(condensed.geometry.scalarColors).toEqual(frame.elements[0].geometry.scalarColors)
})

test('small meshes, prepared model references, unknown frame metadata and non-frame evidence remain verbatim', () => {
  const captured = input(), frame = captured.context.scene!.frame as any
  frame.elements = [frame.elements[2], element('model', { kind: 'mesh', asset: { model: 'protein', part: 'chain-A' },
    material: { roughness: .4 } })]
  frame.scientificContext = { accession: '4YLN', representation: 'experimental structure' }
  const result = moment(contextualVideoRequest(captured, selected))
  expect(result.scene.frame).toEqual(frame)
})

test('existing stored requests compact for prompts without mutating fingerprints or malformed documents', () => {
  const captured = input()
  const raw: VideoRequest = { ...original, sceneRequest: true, documents: [...original.documents,
    { name: 'Selected video moment', text: JSON.stringify({ ...captured.context, selectedScene: selected, nextScene: next }) },
    { name: 'Selected video moment', text: '{ invalid JSON' },
    { name: 'Selected video moment', text: JSON.stringify({ scene: 'invalid scene', evidence: 'retain' }) },
    { name: 'Other source', text: JSON.stringify(captured.context) },
  ] }
  const before = JSON.stringify(raw), compact = compactVideoRequestContext(raw)
  expect(moment(compact).scene.frame.elements[0].geometry.vertices).toBeUndefined()
  expect(JSON.stringify(raw)).toBe(before)
  expect(compact.documents[0]).toEqual(raw.documents[0])
  expect(compact.documents.slice(2)).toEqual(raw.documents.slice(2))
  expect(compactVideoRequestContext(compact)).toEqual(compact)
  expect(compactVideoRequestContext(original)).toBe(original)
})

test('malformed optional frame data cannot break otherwise valid scene requests', () => {
  for (const frame of [null, 'not a frame', { elements: null }, { elements: [null, { geometry: null }] }]) {
    const captured = input()
    captured.context.scene!.frame = frame
    const result = moment(contextualVideoRequest(captured, selected))
    expect(result.scene.frame).toEqual(frame)
  }
})
