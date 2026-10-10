# Suzanne base-color derivative

Prepared from the actual CC0-1.0 Suzanne model by UX3D / Norbert Nopper (2017), hosted in [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Suzanne). Source attribution and files are retained one directory above in `source/`. This directory augments the earlier geometry-only fixture; it preserves every original POSITION/NORMAL/TEXCOORD_0 tuple without welding and all 3,936 triangles (11,808 tuples). Indices widen from Uint16 to Uint32.

The 1,024×1,024 source base-color PNG decodes to 4,194,304 unchanged RGBA8 bytes. Pixels keep their top-left row order; glTF UVs remain unchanged. Image `suzanne-textured-image-0` is shared by model `suzanne-textured` and may also be displayed with `s.image`. Load both JSON manifests with explicit source-color policy. The `blobs` names are SHA-256 digests of their bytes.

This is **base-color-only**, not full original PBR appearance. It explicitly omits TANGENT, back-face culling and metallic-roughness/PBR lighting. The source metallic-roughness PNG remains available for attribution/audit but is not loaded. Use unlit shading to inspect the retained source colors; smooth lighting is a deliberate stylized derivative. No source colors are quantized into the scene palette.

Reproduce from `shared/animlib`, after build:

```sh
node tools/prepare-suzanne-textured.mjs
```

Pinned source SHA-256:

- Suzanne.gltf: `7e8ae013010aff530162ef2795cec74c2646019e224af17bcfb691664f0f0aec`
- Suzanne.bin: `b85c2727aa41318e00673d8892f5879d46fb6e476e280f28ee1febd07602b6b8`
- Suzanne_BaseColor.png: `1c009f45e53b260ceecd383f2c356ed08b08e05acd4633bcc713213319b2092b`
- Suzanne_MetallicRoughness.png (retained, omitted): `89539cb3e7c7b6c17da3700569b1037e137da860958201f491621e2b9735c6f2`
- Decoded base-color RGBA: `b1aaf9bd7af54d30527bdad3b1f2d7bbe02ae34ccb160141f707f08587924e24` (identical with independent FFmpeg decode).

`conversion-report.json` records registry identities, dependencies, transforms, omissions and conservative memory accounting. General importer documentation: `../../../docs/assets-import.md`.
