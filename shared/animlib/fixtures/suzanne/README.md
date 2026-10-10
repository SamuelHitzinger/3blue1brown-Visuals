# Suzanne static geometry fixture

Source: [Khronos glTF Sample Assets, Suzanne](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Suzanne).
The source README records **CC0-1.0**, UX3D / Norbert Nopper (2017).
The source geometry and attribution are retained in `source/`; SHA-256 digests
are pinned by `tools/prepare-suzanne-geometry.mjs`.

This is an explicitly geometry-only derivative for the immutable model registry
test. All 11,808 vertex tuples, normals and 3,936 triangles survive unchanged;
16-bit indices are widened to 32-bit. It omits UV/tangents, base-color texture,
and metallic-roughness texture/material. Tests author a palette fill and stylized
lighting. This fixture does **not** establish original appearance fidelity.

Reproduce from `shared/animlib` after `npm run build`:

```
node tools/prepare-suzanne-geometry.mjs fixtures/suzanne
```

Native format uses explicit metre units (glTF convention), identity axes,
unchanged scale/origin, source selection, hashes and fidelity notes in asset.json.
The preparation script only accepts the exact pinned source; it is not a general
glTF converter. Images, PBR, vertex colors, skins and animation remain unsupported
by this model package version and may not be silently added to its schema.

## Textured companion

The newer `textured/` companion retains UV0 and the original base-color PNG through the general bounded static importer. It is a separately named, explicitly base-color-only derivative with PBR omissions documented in `textured/README.md`. The geometry-only fixture above remains unchanged. See `../../docs/assets-import.md` for the now-supported native image/package API and importer subset.
