/** Explicit CC0 Suzanne base-color-only derivative through the general static subset importer. */
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha } from './gltf-import.mjs';
import { convertGLTFFile } from './convert-gltf.mjs';
const base = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/suzanne'), input = join(base, 'source/Suzanne.gltf'), output = resolve(process.argv[2] ?? join(base, 'textured'));
const expected = { 'Suzanne.gltf': '7e8ae013010aff530162ef2795cec74c2646019e224af17bcfb691664f0f0aec', 'Suzanne.bin': 'b85c2727aa41318e00673d8892f5879d46fb6e476e280f28ee1febd07602b6b8', 'Suzanne_BaseColor.png': '1c009f45e53b260ceecd383f2c356ed08b08e05acd4633bcc713213319b2092b' };
for (const [file, hash] of Object.entries(expected))
    if (sha(await readFile(join(base, 'source', file))) !== hash)
        throw Error(`Pinned source hash mismatch: ${file}`);
const metadata = { source: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Suzanne', sourceHash: expected['Suzanne.gltf'], creator: 'UX3D / Norbert Nopper (2017)', license: 'CC0-1.0', preparedAt: '2026-10-11', converter: { name: 'animlib static-gltf + pngjs', version: '1 / pngjs 7.0.0', options: { sourceHashes: expected } }, selection: 'scene 0', modifications: [], fidelity: 'Explicit base-color-only derivative preserves original geometry, UV tuples and RGB pixel samples; metallic-roughness/PBR omitted.' };
console.log(JSON.stringify(await convertGLTFFile({ input, output, id: 'suzanne-textured', metadata, materialPolicy: 'base-color-only' }), null, 2));
