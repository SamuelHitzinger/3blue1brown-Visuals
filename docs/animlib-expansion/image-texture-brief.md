# Faithful image textures and prepared model appearance

Read asset architecture/implementation/report and registry code before changing
interfaces. User requires reusable textures/models, including biological visuals;
geometry-only Suzanne is a prerequisite, not final appearance fidelity. Stay on
amilibsam; root commits. All delegated agents Astra/high.

## Ownership and integration

Take renderer/shader/packed geometry/image-resource ownership only after
assets_builder releases shared files. Coordinate with any GPU diagnosis worker;
avoid competing edits. Implement one real appearance path shared by WebGPU,
WebGL2 and native exporters. Own focused new modules/tests/fixtures/docs. Do not
rewrite the renderer or add a second playback engine.

## Pinned intent

Prepared image v1: bounded RGBA8, sRGB encoding, top-left origin, straight alpha,
explicit provenance/hash. Host must opt into source colors; scenes cannot grant
themselves that policy. Source colors remain faithful, with no implicit palette
quantization. Palette-indexed image storage deferred. Existing palette tokens and
procedural textures retain behavior. Keep imageTexture separate from procedural
texture to avoid ambiguous interpretation.

Add UV0 to mesh data and packed vertices, actual texture samplers/resources to
both shaders/backends, texture-aware draw batching and bounded per-device/context
lifetime. Support untinted image by default, explicit tint only on request.
Support declared opaque/blend alpha and nearest/linear filter, clamp/repeat wrap;
reject unimplemented sampler/material behavior. Preserve correct UV seams and
triangle ordering under transparency. Fix image orientation once in preparation.
Account for sRGB conversion consistently across backends. New source vertex-color
support may share the same appearance slice where coherent. Do not claim PBR,
normal maps, lighting parity to a DCC renderer, or physically accurate materials.

Provide ordinary `s.image` planar mesh convenience and textured `s.model` parts,
with aspect ratio from validated descriptors. Descriptors cross into VM; pixels
and source buffers stay host-owned. Missing images/UVs, mismatched attributes,
unauthorized source color, oversized images, stale refs, decoder errors and
unsupported combinations fail before playback, not as blank textures. Existing
leases/disposal/transactional source replacement must cover image dependencies.
Context/device loss reuploads from immutable host data, never stale GPU handles.

## Proof and tests

Inspect current Suzanne source/base color image and its verified CC0 license;
reuse the real texture/model pairing for faithful-appearance proof where format
subset permits. Do not use reference-video frames as textures. Synthetic corner
color and alpha fixtures are useful regression cases but not the sole reuse proof.
If PNG decoding is needed, prefer a bounded established offline decoder with
explicit package/version and minimal runtime footprint. No unnecessary scene VM
dependencies or implicit remote fetching.

Failure-first tests: UV orientation/seams, exact source color policies and known
pixels, tint, transparent layering, independent images, repeated-instance reuse,
filter/wrap behavior, missing/stale deps, count/byte overflow, replacement and
disposal, context loss, native export. Real WebGPU and browser WebGL pixel tests
must verify new appearance. Existing material equality failures in
gpu-diagnosis-brief.md remain separately tracked; don't mask new image failures.

Render original 5–8 second model+image proof and actual source model comparison;
record fidelity report including unsupported source channels. Measure decoded
bytes/upload bytes/draw changes and payload-size independence. Typecheck/build
and focused tests first, integrated suite after ownership settles. Write
image-texture-design.md early, image-texture-report.md on handoff. Independent
technical and visual evaluation follows.
