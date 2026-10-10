/** Filesystem boundary for offline imports. URI grammar and real paths are checked before bounded reads. */
import { open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { check, localAssetURI, MAX_SOURCE_BYTES, parseGLB, sha } from './gltf-import.mjs';
export async function readBounded(path, max) {
    const handle = await open(path, 'r');
    try {
        const info = await handle.stat();
        check(info.isFile() && info.size <= max, 'file size limit exceeded');
        const bytes = Buffer.alloc(info.size);
        let at = 0;
        while (at < bytes.length) {
            const r = await handle.read(bytes, at, bytes.length - at, at);
            check(r.bytesRead > 0, 'short file read');
            at += r.bytesRead;
        }
        check(!(await handle.read(Buffer.alloc(1), 0, 1, at)).bytesRead, 'file grew during read');
        return bytes;
    }
    finally {
        await handle.close();
    }
}
export async function readGLTFFile(input) {
    const path = await realpath(resolve(input)), root = await realpath(dirname(path)), bytes = await readBounded(path, MAX_SOURCE_BYTES);
    const parsed = bytes.readUInt32LE(0) === 0x46546c67 ? parseGLB(bytes) : { json: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
    return { ...parsed, sourceHash: sha(bytes), read: async (uri, max) => { localAssetURI(uri); const target = await realpath(resolve(root, uri)), rel = relative(root, target); check(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), 'dependency real path escapes package root'); return readBounded(target, max); } };
}
