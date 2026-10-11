import { captureDraws } from './gpu-capture.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { initialSources } from "../demo/scenes.js";
import { project, rotate, sphereTriangles } from "../src/geometry.js";
import { layoutLatexGeometry } from "../src/latex.js";
import { CanvasRenderer } from "../src/renderer.js";
import { SceneSequence } from "../src/sequence.js";
import type { CameraState, ElementState, Frame, Geometry, Vec3 } from "../src/types.js";

function ancestors(frame: Frame, element: ElementState): ElementState[] {
  const parents = new Map<string, ElementState>();
  for (const parent of frame.elements) {
    for (const child of parent.geometry.children ?? []) parents.set(child, parent);
  }
  const chain: ElementState[] = [];
  let state: ElementState | undefined = element;
  while (state) {
    expect(chain.some(parent => parent.id === state!.id), "Group cycle").toBe(false);
    chain.push(state);
    state = parents.get(state.id);
  }
  return chain;
}

function worldPoint(frame: Frame, element: ElementState, point: Vec3): Vec3 {
  let result = point;
  for (const state of ancestors(frame, element)) {
    result = rotate(result.map(value => value * state.scale) as Vec3, state.rotation)
      .map((value, axis) => value + state.position[axis]) as Vec3;
  }
  return result;
}

function effectiveCamera(frame: Frame, orbit: { yaw: number; pitch: number }): CameraState {
  return { ...frame.camera, yaw: frame.camera.yaw + orbit.yaw * frame.camera.perspective,
    pitch: frame.camera.pitch + orbit.pitch * frame.camera.perspective };
}

function viewportPoint(frame: Frame, element: ElementState, point: Vec3, camera: CameraState, width: number, height: number) {
  const projected = project(worldPoint(frame, element, point), camera, width, height);
  const chain = ancestors(frame, element);
  // Normalize the world projection first. Offsets translate clip coordinates after
  // perspective division; positive viewport Y points upward, like world Y.
  const x = projected.x / width + chain.reduce((sum, state) => sum + (state.viewportOffset?.[0] ?? 0), 0);
  const y = projected.y / height - chain.reduce((sum, state) => sum + (state.viewportOffset?.[1] ?? 0), 0);
  return { ...projected, x: x * width, y: y * height };
}

// Inspect the production WebGPU vertex submission for billboard camera-plane tests.
// This adapter captures buffer data only; it does not provide a rendering fallback.
async function captureRenderer() {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("GPUBufferUsage", { UNIFORM: 1, COPY_DST: 2, VERTEX: 4 });
  vi.stubGlobal("GPUTextureUsage", { RENDER_ATTACHMENT: 1 });
  vi.stubGlobal("devicePixelRatio", 1);
  const writes: Float32Array[] = [];
  const capture = captureDraws(writes);
  let stride = 0;
  const device = {
    limits: { maxTextureDimension2D: 8192 }, lost: new Promise(() => {}), addEventListener() {}, destroy() {},
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createRenderPipelineAsync: async (descriptor: { vertex: { buffers: { arrayStride: number }[] } }) => {
      stride = descriptor.vertex.buffers[0].arrayStride / 4;
      return { getBindGroupLayout: () => ({}) };
    },
    createSampler: () => ({}), createBuffer: capture.createBuffer, createBindGroup: capture.createBindGroup,
    createTexture: ({ size }: { size: number[] }) => ({ width: size[0], height: size[1], createView: () => ({}), destroy() {} }),
    queue: capture.queue,
    createCommandEncoder: () => ({ beginRenderPass: () => capture.pass, finish: () => ({}) }),
  };
  vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({ requestDevice: async () => device }), getPreferredCanvasFormat: () => "bgra8unorm" } });
  const canvas = { width: 1280, height: 720, style: {}, getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    getContext: () => ({ configure() {}, unconfigure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) }),
    addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas);
  await renderer.prepare([]);
  return { renderer, vertices(frame: Frame, orbit: { yaw: number; pitch: number }) {
    writes.length = 0;
    renderer.setOrbit(orbit);
    renderer.render(frame, { mode: "3d", end: "hold", orbit: true, background: "BLACK" });
    const data = writes[0];
    expect(data?.length).toBeGreaterThan(12);
    return Array.from({ length: data.length / stride }, (_, index) => Array.from(data.subarray(index * stride, index * stride + 3)) as Vec3);
  } };
}

describe("continuity review of the authored demos", () => {
  const sequence = new SceneSequence();
  beforeAll(async () => {
    const result = await sequence.submit({ type: "load", scenes: initialSources });
    expect(result, JSON.stringify(result.diagnostics)).toMatchObject({ ok: true });
  });
  afterAll(() => sequence.dispose());
  afterEach(() => vi.unstubAllGlobals());

  function beforeRemoval(index: number): Frame {
    const removal = sequence.compiled[index].lifecycle.find(event =>
      event.type === "remove" && event.ids.includes("@exiting"));
    expect(removal).toBeDefined();
    return sequence.frame(index, removal!.time - 1e-6);
  }

  const views = [
    { name: "16:9", width: 1280, height: 720, orbit: { yaw: 0, pitch: 0 } },
    { name: "32:9", width: 2560, height: 720, orbit: { yaw: 0, pitch: 0 } },
    { name: "16:9 with retained +90 degree yaw and pitch", width: 1280, height: 720, orbit: { yaw: Math.PI / 2, pitch: 0.3 } },
    { name: "32:9 with retained +90 degree yaw and pitch", width: 2560, height: 720, orbit: { yaw: Math.PI / 2, pitch: 0.3 } },
  ];

  it.each(views)("clears the algebra right edge at $name before removal", ({ width, height, orbit }) => {
    const frame = beforeRemoval(1);
    const grid = frame.elements.find(element => element.id === "@exit:grid-h-0")!;
    const outgoing = frame.elements.find(element => element.id === "@exiting")!;
    expect(outgoing.position).toEqual([0, 0, 0]);
    expect(outgoing.viewportOffset?.[0]).toBeCloseTo(-1.5, 8);
    const camera = effectiveCamera(frame, orbit);
    expect(viewportPoint(frame, grid, [5, 0, 0], camera, width, height).x).toBeLessThan(0);
  });

  it.each(views)("clears the full carbon silhouette at $name before removal", ({ width, height, orbit }) => {
    const frame = beforeRemoval(2);
    const carbon = frame.elements.find(element => element.id === "@exit:carbon")!;
    const camera = effectiveCamera(frame, orbit);
    const surface = sphereTriangles(carbon.geometry.radius!).points
      .map(point => viewportPoint(frame, carbon, point, camera, width, height));
    expect(surface.every(point => point.visible)).toBe(true);
    expect(Math.max(...surface.map(point => point.x))).toBeLessThan(0);
    expect(frame.camera).toEqual(sequence.frame(1, sequence.compiled[1].duration).camera);
  });

  it("removes outgoing identities before introducing each unrelated scene without fading", () => {
    for (const index of [1, 2]) {
      const compiled = sequence.compiled[index];
      const removal = compiled.lifecycle.find(event => event.type === "remove" && event.ids.includes("@exiting"))!;
      const incoming = compiled.lifecycle.find(event => event.type === "add" && event.ids.some(id => !id.startsWith("@")))!;
      expect(removal.time).toBeLessThan(incoming.time);
      const entry = sequence.frame(index, 0);
      for (const time of [0, removal.time / 2, removal.time - 1e-6]) {
        const frame = sequence.frame(index, time);
        expect(frame.elements.length).toBeGreaterThan(0);
        expect(frame.elements.every(element => element.id.startsWith("@"))).toBe(true);
        for (const element of frame.elements) {
          expect(element.opacity).toBe(entry.elements.find(original => original.id === element.id)!.opacity);
          expect(element.morph).toBeUndefined();
        }
      }
      expect(sequence.frame(index, (removal.time + incoming.time) / 2).elements).toEqual([]);
      for (const time of [incoming.time, (incoming.time + compiled.duration) / 2, compiled.duration]) {
        expect(sequence.frame(index, time).elements.every(element => !element.id.startsWith("@"))).toBe(true);
      }
      expect(compiled.tracks.some(track => track.action.type === "morph")).toBe(false);
    }
  });

  it("keeps named v and equals stationary as A appears and the numeric component counts", () => {
    const equation = (time: number) => sequence.frame(0, time).elements.find(element => element.id === "equation")!;
    const stationary = (geometry: Geometry) => layoutLatexGeometry(geometry).paths
      .filter(path => path.part === "v" || path.part === "equals")
      .map(path => ({ part: path.part, contours: path.contours.map(contour => contour.map(point => point.map(value => Number(value.toFixed(12))))) }));
    const original = equation(1.39);
    const prefixMiddle = equation(1.575);
    expect(prefixMiddle.morph?.map).toEqual({ v: "v", equals: "equals", rhs: "rhs" });
    expect(stationary(prefixMiddle.morph!.from)).toEqual(stationary(original.geometry));
    expect(stationary(prefixMiddle.morph!.to)).toEqual(stationary(original.geometry));
    for (const [time, value] of [[1.75, 1.5], [2.75, 1.875], [3.75, 2.25]]) {
      const current = equation(time);
      const layout = layoutLatexGeometry(current.geometry);
      const prefix = layout.paths.filter(path => path.part === "A").flatMap(path => path.contours.flat());
      const vector = layout.paths.filter(path => path.part === "v").flatMap(path => path.contours.flat());
      expect(prefix.length, `Missing A at ${time}`).toBeGreaterThan(0);
      expect(Math.max(...prefix.map(point => point[0]))).toBeLessThan(Math.min(...vector.map(point => point[0])));
      expect(current.position).toEqual(original.position);
      expect(current.geometry.anchor).toBe("v");
      expect(current.geometry.numbers?.x).toBeCloseTo(value, 12);
      expect(stationary(current.geometry)).toEqual(stationary(original.geometry));
      expect(current.morph).toBeUndefined();
    }
  });

  it("places methane labels in the effective camera plane, ahead of their own atom surfaces", async () => {
    const capture = await captureRenderer();
    try {
      for (const time of [1.95, 2.95, sequence.compiled[1].duration]) {
        const frame = sequence.frame(1, time);
        const labels = frame.elements.filter(element => element.billboard);
        expect(labels).toHaveLength(5);
        for (const orbit of [{ yaw: 0, pitch: 0 }, { yaw: Math.PI / 2, pitch: -0.3 }]) {
          const camera = effectiveCamera(frame, orbit);
          for (const label of labels) {
            const atomId = label.id === "carbon-label" ? "carbon" : label.id.replace("hydrogen-label-", "hydrogen-");
            const atom = frame.elements.find(element => element.id === atomId)!;
            expect(label.position).toEqual(atom.position);
            const center = worldPoint(frame, atom, [0, 0, 0]);
            const points = capture.vertices({ ...frame, elements: [label] }, orbit)
              .map(point => rotate(rotate(point.map((value, axis) => value - center[axis]) as Vec3, [0, -camera.yaw, 0]), [-camera.pitch, 0, 0]));
            expect(points.every(point => Math.abs(point[2] - label.billboardOffset![2]) < 1e-6)).toBe(true);
            expect(label.billboardOffset![2]).toBeGreaterThan(atom.geometry.radius!);
            if (atomId === "carbon") {
              for (const axis of [0, 1]) {
                const values = points.map(point => point[axis]);
                expect((Math.min(...values) + Math.max(...values)) / 2).toBeCloseTo(0, 6);
              }
            } else expect(Math.min(...points.map(point => point[1]))).toBeGreaterThan(atom.geometry.radius!);
          }
        }
      }
    } finally { capture.renderer.dispose(); }
  });
});
