import { VERTEX_FLOATS } from '../src/texture-shader.js';
import { INSTANCE_FLOATS } from '../src/retained-geometry.js';

/** CPU inspection of submitted draw buffers, not evidence of rendered pixels. */
export function captureDraws(output: Float32Array[], draws: number[] = []) {
  type Buffer = { data: Float32Array | Uint32Array; destroy(): void };
  type Group = { entries: { resource: { buffer: Buffer } }[] };
  let vertices: Buffer, indices: Buffer, objects: Buffer;
  const append = (data: Float32Array) => {
    const combined = new Float32Array((output[0]?.length ?? 0) + data.length);
    if (output[0]) combined.set(output[0]);
    combined.set(data, combined.length-data.length); output[0] = combined;
  };
  return {
    createBuffer: (): Buffer => ({ data: new Float32Array(0), destroy() {} }),
    createBindGroup: (group: Group) => group,
    queue: { writeTexture() {}, writeBuffer: (buffer: Buffer, _offset: number, data: Float32Array | Uint32Array) => { buffer.data = data.slice(); }, submit() {} },
    pass: {
      setPipeline() {}, setViewport() {}, setScissorRect() {}, end() {},
      setBindGroup(index: number, group: Group) { if (index === 1) objects = group.entries[0].resource.buffer; },
      setVertexBuffer(_index: number, buffer: Buffer) { vertices = buffer; },
      setIndexBuffer(buffer: Buffer) { indices = buffer; },
      draw(count: number, _instances: number, first: number) { draws.push(count); append(vertices.data.slice(first*VERTEX_FLOATS,(first+count)*VERTEX_FLOATS) as Float32Array); },
      drawIndexed(count: number, instances: number) {
        draws.push(count*instances);
        const data = new Float32Array(count*instances*VERTEX_FLOATS);
        for (let instance = 0; instance < instances; instance++) for (let i = 0; i < count; i++) {
          const source = vertices.data.subarray(indices.data[i]*VERTEX_FLOATS,(indices.data[i]+1)*VERTEX_FLOATS);
          const at = (instance*count+i)*VERTEX_FLOATS, m = objects.data.subarray(instance*INSTANCE_FLOATS,(instance+1)*INSTANCE_FLOATS);
          data.set(source,at);
          for (let axis = 0; axis < 3; axis++) {
            data[at+axis] = m[12+axis]+source[0]*m[axis]+source[1]*m[4+axis]+source[2]*m[8+axis];
            data[at+8+axis] = (source[8]*m[axis]+source[9]*m[4+axis]+source[10]*m[8+axis])/m[17];
          }
          data[at+12] += m[16]; data[at+13] += m[18]; data[at+14] += m[19]; data[at+30] *= m[17];
        }
        append(data);
      },
    },
  };
}
