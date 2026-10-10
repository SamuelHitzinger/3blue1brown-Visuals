/** Offline static subset; injectable bounded I/O and image services, no network. */
import { createHash } from 'node:crypto';
import { identity, multiply, nodeMatrix, geometryTransform } from './gltf-transform.mjs';
export const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
export const check = (ok, message) => { if (!ok)
    throw Error(`glTF: ${message}`); };
export const integer = (n, max = MAX_SOURCE_BYTES) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function localAssetURI(uri) { check(typeof uri === 'string' && uri.length <= 256 && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(uri) && uri.split('/').every(p => p !== '.' && p !== '..'), 'unsupported or escaping URI/path'); return uri; }
export function parseGLB(bytes) {
    check(bytes instanceof Uint8Array && bytes.length >= 20 && bytes.length <= MAX_SOURCE_BYTES, 'invalid GLB length');
    const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    check(b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2, 'unsupported GLB magic/version');
    check(b.readUInt32LE(8) === b.length, 'GLB declared length mismatch');
    let at = 12, json, binary;
    while (at < b.length) {
        check(at + 8 <= b.length, 'truncated GLB chunk');
        const length = b.readUInt32LE(at), type = b.readUInt32LE(at + 4);
        at += 8;
        check(length % 4 === 0 && length > 0 && at + length <= b.length, 'invalid GLB chunk length');
        if (type === 0x4e4f534a) {
            check(json === undefined && at === 20 && length <= 4 * 1024 * 1024, 'GLB JSON must be first and unique');
            json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(at, at + length)));
        }
        else if (type === 0x004e4942) {
            check(json !== undefined && !binary, 'GLB BIN must follow JSON and be unique');
            binary = new Uint8Array(b.subarray(at, at + length));
        }
        else
            throw Error('glTF: unsupported GLB chunk');
        at += length;
    }
    check(json, 'missing GLB JSON');
    return { json, binary };
}
export async function importStaticGLTF(input, options) {
    check(input?.asset?.version === '2.0' && (!input.asset.minVersion || input.asset.minVersion === '2.0'), 'only glTF 2.0 supported');
    check(JSON.stringify(input).length <= 4 * 1024 * 1024, 'JSON size limit exceeded');
    const doc = structuredClone(input), p = structuredClone(options.provenance);
    check(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(options.id), 'invalid asset ID');
    check(p && ['source', 'creator', 'license', 'preparedAt', 'selection', 'fidelity'].every(k => typeof p[k] === 'string' && p[k].trim()) && p.license.toLowerCase() !== 'unknown' && /^[a-f0-9]{64}$/.test(p.sourceHash), 'explicit provenance/license required');
    check(!doc.animations?.length && !doc.skins?.length, 'animations and skins unsupported');
    check(['strict', 'base-color-only'].includes(options.materialPolicy ?? 'strict'), 'invalid material policy');
    const derivative = options.materialPolicy === 'base-color-only', omitted = new Set(), transforms = [], dependencies = [];
    for (const key of ['extensionsUsed', 'extensionsRequired'])
        check(doc[key] === undefined || Array.isArray(doc[key]) && doc[key].every(k => k === 'KHR_materials_unlit'), `unsupported ${key}`);
    const extensions = (value, path = 'root') => { if (!value || typeof value !== 'object')
        return; for (const [k, v] of Object.entries(value)) {
        if (k === 'extras')
            continue;
        if (k === 'extensions')
            check(v && Object.keys(v).every(name => name === 'KHR_materials_unlit' && /^root\.materials\.\d+$/.test(path)), 'unsupported extension semantics');
        else
            extensions(v, path + '.' + k);
    } };
    extensions(doc);
    for (const key of ['buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes', 'images', 'textures', 'materials', 'samplers'])
        check(doc[key] === undefined || Array.isArray(doc[key]) && doc[key].length <= 1024, `${key} count limit exceeded`);
    const buffers = [];
    let sourceBytes = 0;
    for (const [index, b] of (doc.buffers ?? []).entries()) {
        check(integer(b.byteLength) && b.byteLength > 0, 'invalid buffer byteLength');
        sourceBytes += b.byteLength;
        check(sourceBytes <= MAX_SOURCE_BYTES, 'aggregate source limit exceeded');
        let bytes;
        if (b.uri === undefined) {
            check(index === 0 && options.binary, 'unresolved embedded buffer');
            bytes = options.binary;
            check(bytes.length >= b.byteLength && bytes.length - b.byteLength <= 3 && bytes.subarray(b.byteLength).every(v => v === 0), 'GLB BIN padding/length mismatch');
            bytes = bytes.subarray(0, b.byteLength);
        }
        else {
            localAssetURI(b.uri);
            bytes = await options.read(b.uri, b.byteLength);
        }
        check(bytes instanceof Uint8Array && bytes.length === b.byteLength, 'buffer exact length mismatch');
        const owned = Buffer.from(bytes);
        buffers.push(owned);
        dependencies.push({ uri: b.uri ?? 'GLB:BIN', hash: sha(owned), bytes: owned.length });
    }
    const view = index => { check(integer(index, 1023) && doc.bufferViews?.[index], 'invalid bufferView index'); const v = doc.bufferViews[index], offset = v.byteOffset ?? 0; check(integer(v.buffer, 1023) && buffers[v.buffer] && integer(offset) && integer(v.byteLength) && v.byteLength > 0 && offset + v.byteLength <= buffers[v.buffer].length, 'bufferView range exceeds buffer'); return { v, bytes: buffers[v.buffer].subarray(offset, offset + v.byteLength), offset }; };
    const accessor = (index, type, role) => {
        check(integer(index, 1023) && doc.accessors?.[index], 'invalid accessor index');
        const a = doc.accessors[index];
        check(!a.sparse, 'sparse accessors unsupported');
        check(a.type === type, 'accessor type mismatch');
        const count = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : 3, max = role === 'indices' ? 60000 : 20000;
        check(integer(a.count, max) && a.count > 0, 'accessor count limit exceeded');
        const component = a.componentType, size = component === 5126 || component === 5125 ? 4 : component === 5123 ? 2 : component === 5121 ? 1 : 0;
        check(size && (role === 'indices' ? [5121, 5123, 5125].includes(component) : role === 'uv' ? [5126, 5121, 5123].includes(component) : component === 5126), 'unsupported accessor component');
        check(role === 'uv' && component !== 5126 ? a.normalized === true : !a.normalized, 'unsupported normalization');
        const { v, bytes, offset: base } = view(a.bufferView), offset = a.byteOffset ?? 0, stride = v.byteStride ?? count * size;
        check(integer(offset) && offset % size === 0 && (base + offset) % size === 0 && integer(stride, 252) && stride >= count * size && stride % size === 0, 'invalid accessor offset/stride');
        check(v.byteStride === undefined || role !== 'indices' && stride >= 4 && stride % 4 === 0, 'invalid stride');
        check(offset + (a.count - 1) * stride + count * size <= bytes.length, 'accessor range exceeds bufferView');
        const values = [];
        for (let i = 0; i < a.count; i++) {
            const tuple = [];
            for (let j = 0; j < count; j++) {
                const at = offset + i * stride + j * size;
                let value = component === 5126 ? bytes.readFloatLE(at) : component === 5125 ? bytes.readUInt32LE(at) : component === 5123 ? bytes.readUInt16LE(at) : bytes[at];
                if (a.normalized)
                    value /= component === 5123 ? 65535 : 255;
                check(Number.isFinite(value) && Math.abs(value) <= 1e6, 'nonfinite/out-of-range coordinate');
                tuple.push(value);
            }
            values.push(tuple);
        }
        return values;
    };
    const images = [], imageMap = new Map();
    let decodedImageBytes = 0;
    const imageFor = async (index) => {
        if (imageMap.has(index))
            return imageMap.get(index);
        const image = doc.images?.[index];
        check(integer(index, 1023) && image, 'invalid image index');
        check(options.decodeImage && options.imageIdentity, 'image decoder and identity service required');
        let bytes;
        if (image.uri !== undefined) {
            check(image.bufferView === undefined, 'uri and bufferView cannot coexist');
            localAssetURI(image.uri);
            bytes = await options.read(image.uri, MAX_SOURCE_BYTES);
        }
        else {
            check(image.mimeType === 'image/png', 'embedded image requires PNG mime type');
            bytes = view(image.bufferView).bytes;
        }
        check(!image.mimeType || image.mimeType === 'image/png', 'only PNG images supported');
        check(bytes instanceof Uint8Array && bytes.length <= MAX_SOURCE_BYTES, 'image source size limit');
        sourceBytes += bytes.length;
        check(sourceBytes <= MAX_SOURCE_BYTES, 'aggregate source limit exceeded');
        dependencies.push({ uri: image.uri ?? `bufferView:${image.bufferView}`, hash: sha(bytes), bytes: bytes.length });
        const decoded = await options.decodeImage(bytes);
        check(integer(decoded.width, 4096) && decoded.width > 0 && integer(decoded.height, 4096) && decoded.height > 0 && decoded.pixels instanceof Uint8Array && decoded.pixels.length === decoded.width * decoded.height * 4, 'invalid RGBA8 dimensions/length');
        decodedImageBytes += decoded.pixels.length;
        check(decodedImageBytes <= 128 * 1024 * 1024, 'aggregate decoded image limit exceeded');
        const prepared = { id: `${options.id}-image-${index}`, kind: 'image', version: 1, width: decoded.width, height: decoded.height, storage: 'rgba8', encoding: 'srgb', origin: 'top-left', alpha: 'straight', colorPolicy: 'source', pixels: new Uint8Array(decoded.pixels), provenance: { ...structuredClone(p), source: p.source + '#' + (image.uri ?? `image-${index}`), sourceHash: sha(bytes), selection: `image ${index}`, modifications: [...(p.modifications ?? []), 'Decoded unchanged RGB to RGBA8 top-left rows; no palette quantization.'], fidelity: 'Original base-color samples; no PBR equivalence.' } };
        const hash = await options.imageIdentity(prepared);
        check(/^[a-f0-9]{64}$/.test(hash), 'invalid image identity');
        images.push(prepared);
        const ref = { id: prepared.id, hash };
        imageMap.set(index, ref);
        return ref;
    };
    const appearance = async (index) => {
        if (index === undefined)
            return;
        check(integer(index, 1023) && doc.materials?.[index], 'invalid material index');
        const m = doc.materials[index], pbr = m.pbrMetallicRoughness ?? {};
        check(m.doubleSided === undefined || typeof m.doubleSided === 'boolean', 'invalid doubleSided');
        if (m.doubleSided !== true) {
            check(derivative, 'single-sided material requires explicit derivative policy');
            omitted.add('back-face culling');
        }
        check(m.alphaMode === undefined || ['OPAQUE', 'BLEND'].includes(m.alphaMode), 'MASK alpha unsupported');
        for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture'])
            if (m[key] !== undefined) {
                check(derivative, `unsupported material channel ${key}`);
                omitted.add(key);
            }
        if (m.emissiveFactor?.some(v => v !== 0)) {
            check(derivative, 'emissive factor unsupported');
            omitted.add('emissiveFactor');
        }
        if (pbr.metallicRoughnessTexture !== undefined || !m.extensions?.KHR_materials_unlit) {
            check(derivative, 'PBR requires explicit base-color-only derivative policy');
            omitted.add('metallic-roughness and PBR lighting');
        }
        check(pbr.baseColorFactor === undefined || Array.isArray(pbr.baseColorFactor) && pbr.baseColorFactor.length === 4 && pbr.baseColorFactor.every(v => v === 1), 'non-white baseColorFactor requires explicit bake');
        const ti = pbr.baseColorTexture;
        if (!ti)
            return;
        check((ti.texCoord ?? 0) === 0, 'only TEXCOORD_0 supported');
        check(integer(ti.index, 1023), 'invalid texture index');
        const texture = doc.textures?.[ti.index];
        check(texture, 'invalid texture');
        const s = texture.sampler === undefined ? {} : doc.samplers?.[texture.sampler];
        check(s, 'invalid sampler');
        check(s.minFilter === undefined || [9728, 9729].includes(s.minFilter), 'mipmap sampler unsupported');
        check(s.magFilter === undefined || [9728, 9729].includes(s.magFilter), 'unsupported magFilter');
        const min = s.minFilter ?? s.magFilter ?? 9729, mag = s.magFilter ?? min;
        check(min === mag, 'unequal min/mag filters unsupported');
        const ws = s.wrapS ?? 10497, wt = s.wrapT ?? 10497;
        check([33071, 10497].includes(ws) && ws === wt, 'unsupported/unequal wrap modes');
        return { image: await imageFor(texture.source), alphaMode: m.alphaMode === 'BLEND' ? 'blend' : 'opaque', filter: min === 9728 ? 'nearest' : 'linear', wrap: ws === 33071 ? 'clamp' : 'repeat' };
    };
    const selected = options.scene ?? doc.scene;
    check(integer(selected, 1023) && doc.scenes?.[selected], 'explicit/default scene selection required');
    const parts = [], visited = new Set();
    let geometryBytes = 0;
    const visit = async (index, parent, path) => {
        check(integer(index, 1023) && doc.nodes?.[index], 'invalid node index');
        check(!path.has(index) && !visited.has(index), 'node cycle or multiple parents');
        visited.add(index);
        const node = doc.nodes[index];
        check(node.skin === undefined && node.weights === undefined, 'skinning/morph weights unsupported');
        check(node.camera === undefined, 'camera nodes unsupported');
        const world = multiply(parent, nodeMatrix(node)), tx = geometryTransform(world);
        transforms.push({ node: index, matrix: world, reflected: tx.reflected });
        if (node.mesh !== undefined) {
            const mesh = doc.meshes?.[node.mesh];
            check(integer(node.mesh, 1023) && mesh && Array.isArray(mesh.primitives) && mesh.primitives.length <= 128, 'invalid mesh');
            check(mesh.weights === undefined, 'mesh morph weights unsupported');
            for (const [pi, primitive] of mesh.primitives.entries()) {
                check(parts.length < 128, 'part limit exceeded');
                check((primitive.mode ?? 4) === 4 && !primitive.targets, 'only static triangle primitives supported');
                const attrs = primitive.attributes;
                check(attrs && Object.keys(attrs).every(k => ['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(k) || derivative && k === 'TANGENT'), 'unsupported vertex attribute');
                if (attrs.TANGENT !== undefined)
                    omitted.add('TANGENT');
                const vertices = accessor(attrs.POSITION, 'VEC3', 'position').map(v => tx.point(v).map(Math.fround)), normals = attrs.NORMAL === undefined ? undefined : accessor(attrs.NORMAL, 'VEC3', 'normal').map(v => tx.normal(v).map(Math.fround)), uv0 = attrs.TEXCOORD_0 === undefined ? undefined : accessor(attrs.TEXCOORD_0, 'VEC2', 'uv').map(v => v.map(Math.fround));
                check(vertices.every(p => p.every(v => Number.isFinite(v) && Math.abs(v) <= 1e6)), 'transformed coordinates exceed limits');
                check(!normals || normals.length === vertices.length && normals.every(n => Math.hypot(...n) > 0), 'invalid/mismatched normals');
                check(!uv0 || uv0.length === vertices.length, 'UV count mismatch');
                const indices = primitive.indices === undefined ? vertices.map((_, i) => i) : accessor(primitive.indices, 'SCALAR', 'indices').map(v => v[0]);
                check(indices.length % 3 === 0 && indices.length / 3 <= 20000 && indices.every(i => i < vertices.length), 'invalid triangle indices');
                const triangles = [];
                for (let i = 0; i < indices.length; i += 3)
                    triangles.push(tx.reflected ? [indices[i], indices[i + 2], indices[i + 1]] : indices.slice(i, i + 3));
                const imageTexture = await appearance(primitive.material);
                check(!imageTexture || uv0, 'textured primitive missing UV0');
                geometryBytes += (vertices.length + triangles.length + (normals?.length ?? 0) + (uv0?.length ?? 0)) * 128;
                check(geometryBytes <= 32 * 1024 * 1024, 'decoded model memory limit exceeded');
                parts.push({ id: `node-${index}-primitive-${pi}`, vertices, triangles, ...(normals ? { normals } : {}), ...(uv0 ? { uv0 } : {}), ...(imageTexture ? { imageTexture } : {}) });
            }
        }
        check(node.children === undefined || Array.isArray(node.children) && node.children.length <= 1024, 'invalid children');
        for (const child of node.children ?? [])
            await visit(child, world, new Set(path).add(index));
    };
    check(Array.isArray(doc.scenes[selected].nodes) && doc.scenes[selected].nodes.length > 0, 'empty selected scene');
    for (const node of doc.scenes[selected].nodes)
        await visit(node, identity(), new Set());
    check(parts.length > 0, 'selected scene has no meshes');
    const modifications = [...(p.modifications ?? []), 'Baked node transforms; inverse-transpose normals; reflected winding; native Float32 geometry serialization.', ...(omitted.size ? [`Explicit base-color-only derivative omits: ${[...omitted].join(', ')}.`] : [])];
    const model = { id: options.id, kind: 'model', version: 1, units: 'metre (glTF 2.0 coordinate convention)', parts, provenance: { ...structuredClone(p), converter: { name: 'animlib static-gltf', version: '1', options: { scene: selected, materialPolicy: options.materialPolicy ?? 'strict', dependencies, transforms } }, selection: `scene ${selected}`, modifications, fidelity: omitted.size ? 'Geometry/base-color samples retained; omitted channels and stylized lighting prevent PBR equivalence.' : 'Static geometry and supported base-color samples retained.' } };
    return { images, model, report: { parts: parts.length, images: images.length, geometryBytes, decodedImageBytes, dependencies, transforms, omitted: [...omitted] } };
}
