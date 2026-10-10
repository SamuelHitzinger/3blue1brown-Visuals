/** CLI: node tools/convert-gltf.mjs --input model.gltf --output prepared --id model --metadata provenance.json [--material-policy base-color-only] [--scene 0] */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readBounded, readGLTFFile } from './gltf-files.mjs';
import { importStaticGLTF } from './gltf-import.mjs';
import { decodePNG } from './png-assets.mjs';
import { writeAssetPackages } from './write-asset-packages.mjs';
import { createAssetRegistry } from '../dist/asset-registry.js';
export async function convertGLTFFile({ input, output, id, metadata, materialPolicy = 'strict', scene }) {
    const source = await readGLTFFile(input), provenance = typeof metadata === 'string' ? JSON.parse((await readBounded(metadata, 65536)).toString('utf8')) : structuredClone(metadata);
    provenance.sourceHash = source.sourceHash;
    const result = await importStaticGLTF(source.json, { ...source, id, provenance, materialPolicy, scene, decodeImage: decodePNG, imageIdentity: async (image) => (await createAssetRegistry([image], { colorPolicy: 'source' })).catalog[0].hash });
    return writeAssetPackages(result, output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const args = {};
    for (let i = 2; i < process.argv.length; i += 2) {
        const key = process.argv[i];
        if (!['--input', '--output', '--id', '--metadata', '--material-policy', '--scene'].includes(key) || !process.argv[i + 1])
            throw Error(`Invalid argument ${key}`);
        args[key.slice(2)] = process.argv[i + 1];
    }
    if (!['input', 'output', 'id', 'metadata'].every(k => args[k]))
        throw Error('Required: --input --output --id --metadata');
    console.log(JSON.stringify(await convertGLTFFile({ ...args, materialPolicy: args['material-policy'], scene: args.scene === undefined ? undefined : Number(args.scene) }), null, 2));
}
