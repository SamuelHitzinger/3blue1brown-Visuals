import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createAssetRegistry } from '../dist/asset-registry.js';
import { hashAssetContent, hashAssetBytes } from '../dist/asset-validation.js';
/** Validate the complete dependency graph before writing native manifests. */
export async function writeAssetPackages(result, output) {
    const registry = await createAssetRegistry([...result.images, result.model], { colorPolicy: 'source' }), root = resolve(output);
    await mkdir(join(root, 'blobs'), { recursive: true });
    const blob = async (bytes) => { const hash = await hashAssetBytes(bytes), path = `blobs/${hash}.bin`; await writeFile(join(root, path), bytes); return { path, hash, byteLength: bytes.length }; };
    const packed = (tuples, integer = false) => { const bytes = new Uint8Array(tuples.reduce((n, t) => n + t.length, 0) * 4), view = new DataView(bytes.buffer); let at = 0; for (const tuple of tuples)
        for (const n of tuple) {
            if (integer)
                view.setUint32(at, n, true);
            else
                view.setFloat32(at, n, true);
            at += 4;
        } return bytes; };
    const manifests = [];
    const save = async (name, content) => { const manifest = { ...content, hash: await hashAssetContent(content) }; await writeFile(join(root, name), JSON.stringify(manifest, null, 2) + '\n'); manifests.push(name); };
    for (const image of result.images) {
        const { pixels, ...metadata } = image;
        await save(`${image.id}.json`, { ...metadata, pixels: await blob(pixels) });
    }
    const { parts, ...metadata } = result.model, nativeParts = [];
    for (const part of parts)
        nativeParts.push({ id: part.id, vertexCount: part.vertices.length, triangleCount: part.triangles.length, positions: await blob(packed(part.vertices)), indices: await blob(packed(part.triangles, true)), ...(part.normals ? { normals: await blob(packed(part.normals)) } : {}), ...(part.uv0 ? { uv0: await blob(packed(part.uv0)) } : {}), ...(part.imageTexture ? { imageTexture: part.imageTexture } : {}) });
    await save(`${result.model.id}.json`, { ...metadata, parts: nativeParts });
    const report = { ...result.report, packages: manifests, catalog: registry.catalog, stats: registry.stats() };
    await writeFile(join(root, 'conversion-report.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
}
