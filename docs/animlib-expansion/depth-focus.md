# Optical depth of field

`CameraState.focus` is opt-in on the main camera and each regional camera:

```js
s.play(s.camera.to3D({
  distance: 24, target: [0, 0, 0], height: 8,
  focus: {distance: 18, aperture: 0.35, samples: 32}
}), {duration: 0});
s.wait(1);
s.play(s.camera.animate({
  focus: {distance: 24, aperture: 0.35, samples: 32}
}), {duration: 3});
```

`distance` is optical depth along the camera forward axis, in world units,
between 0.01 and 1,000,000. It is not distance from the target. For a subject at
the camera target, set focus distance equal to camera distance. `aperture` is
the lens radius in world units, between 0 and 1000. These bounds prevent invalid
inputs; visually useful apertures are much smaller and depend on camera height
and subject depth. `samples` is 8, 16, or 32; its default is 16. Both distance
and aperture animate continuously. Supply the complete focus object for each
camera animation. Quality changes require a zero-duration camera change.
Introducing focus animates from zero aperture at the requested focal distance.
Omitting focus or setting aperture to zero uses the existing exact rendering
path, with no focus targets, passes, or extension requirement.

The implementation uses deterministic antipodal stratified disk samples. Each
sample shifts camera-space geometry by
`lensXY * (worldCameraDepth / focusDistance - 1)` before the existing projection.
World depth comes from the transformed vertex and camera rotation, not painter
order, object center, or layer bias. The focal plane has zero shift. The shader
also adjusts the viewing direction used for material highlights. Orthographic,
perspective, and intermediate camera projections use the same sampled rays.

Each aperture sample runs the existing depth-tested MSAA4 rasterization, retained
geometry, images, and isolated-group compositor. Foreground silhouettes therefore
reveal background only on rays that miss the foreground; a color-only blur cannot
produce this visibility. Sample colors are resolved and accumulated with equal
weights into RGBA16F, then composited once as premultiplied color. Geometry is
evaluated and uploaded once per frame; sample draws reuse the prepared geometry.
No depth-texture reconstruction, opacity substitution, or blurred source image
is involved.

Main screen annotations retain their final sharp pass. Regional screen vertices
bypass lens displacement inside their existing batch; their unchanged coverage
stays sharp through averaging, preserving group order and opacity. Regional
scissors apply to every sample and composite. Existing compilation already
forbids an isolated group spanning world and screen coordinate spaces.

## Limits and costs

Focus surfaces are pooled across views and samples. The pool uses 44 bytes per
full-canvas pixel: MSAA color/depth, resolved RGBA8, and the RGBA16F accumulator.
At 1280×720 it uses 40,550,400 bytes (38.67 MiB), independent of sample count.
Resizing replaces the pool; disposal and backend recovery release its textures.
The renderer rejects focus before GPU allocation/upload/submission when it would
exceed any of these fixed budgets:

- 256 MiB of focus surfaces.
- 64 million full-canvas sample-pixels per frame, summed over focused views.
- 32 million submitted scene vertices, including instances and group depth passes.
- 64,000 scene draw submissions, including group/depth passes.

The sample-pixel estimate deliberately uses the full canvas for each view,
because sample target clears/resolves cover that allocation. A 1920×1080 view
at 32 samples exceeds the pixel limit; 16 samples fits. A 3840×2160 canvas exceeds
the focus surface limit at every quality. Reduce dimensions, quality, focused
view count, or geometry rather than silently weakening limits. Rejection keeps
the last submitted frame and permits a smaller or unfocused retry.

WebGL2 requires `EXT_color_buffer_float` for the RGBA16F accumulator. An unavailable
extension produces an explicit recoverable focus capability error; it does not
silently discard focus or substitute low-precision repeated RGBA8 averaging.
No extension is requested for unfocused rendering. Device/context recovery
recreates all focus handles through the replacement backend.

The six-second diagnostic at 1280×720 measured these native CPU-render-plus-GPU-
queue-completion times on an NVIDIA Blackwell/D3D12 adapter. Scene evaluation
is excluded; these are seven warm samples per setting, not GPU timestamp queries
or a hardware-independent frame-rate promise.

| Samples | Warm median | Scene/fullscreen draws | Submitted vertices | Upload bytes |
|---|---:|---:|---:|---:|
| Off | 1.55 ms | 48 | 189,042 | 6,432 |
| 8 | 3.90 ms | 281 | 1,485,357 | 41,920 |
| 16 | 6.31 ms | 545 | 2,966,853 | 82,368 |
| 32 | 11.31 ms | 1,073 | 5,929,845 | 163,264 |

Finite lens sampling can show discrete bokeh or ghost lobes for very large blur
radii, especially at 8 samples. This is bounded optical sampling, not a claim of
converged cinematic lens integration. Prefer moderate apertures and inspect native
frames at final resolution. Transparency retains the renderer's existing ordering
semantics; focus does not add order-independent transparency.

## Evidence and verification

Source evidence was directly viewed: Nucleus `LCIkd-WwC7o` complete source frames
119 and 124, ordered growth-playback sheet 05; `_Zyb8bpGMR0` opening frame 104.
Nucleus 124 demonstrates a sharp triplet and bracket against soft contextual
chains. The separate transcription source demonstrates a blurred nearer incoming
body. These sources motivated depth-dependent optics and unchanged annotation
coverage. They do not certify the diagnostic's simplified molecular anatomy.

The diagnostic source is `shared/animlib/demo/expansion/depth-focus-proof.mjs`.
Generated evidence lives in `data/animlib-expansion/depth-focus-proof/`: 20 full
native frames, both six-second H.264/yuv420p films at 30 fps, six ordered 8 fps
MP4-derived sheets, and `profile.json`. All six sheets (96 sampled encoded frames)
and full native frames 0s/4s at 16:9 and 4s at 4:3 were personally viewed. The
near body softens while the persistent triplet sharpens; bracket and label remain
sharp. Geometry, opacity, lighting, camera pose, and framing remain fixed.
Both complete decodes succeeded. Independent visual review remains a separate gate.

Film SHA-256:

- `focus-16x9.mp4`: `f02d19451715445485290c9461d82d01c0fdff3fe4a030fda63736d272dd05fc`
- `focus-4x3.mp4`: `8dd9c88e24375caea73a2f83bda24f1bc877a5916c42ede808a3f1b66b335afb`

Portable tests cover focal-plane invariance, opposite near/far shifts, deterministic
centered samples, bounded settings, animated rack focus and seeking, per-view
settings, quality-change rejection, capability and workload budgets. The real
native GPU regression was first observed failing because near/far edges stayed
sharp; it passes after the optical path. It now also checks exact zero aperture,
sharp HUD, true occlusion at a blurred silhouette, source-image alpha/RGB, regional
isolation and screen-group opacity, no GPU work on rejection, resize release and
idempotent disposal. Run with `npx vitest run --config vitest.focus.config.ts`.

`http://localhost:5178/focus-test.html` and the `?webgpu` variant were run in real
browser WebGL2 and WebGPU. Their optical and group tests passed. WebGL context
loss/restoration and actual WebGPU device destruction followed by WebGL2 fallback
both successfully rebuilt focused rendering.

The full native regression run passed 146/148 checks; only the two previously
known exact-MSAA parity assertions failed (reactive material/texture parameters,
and the arrow3D morph at opacity 0.45 near its endpoint). Assertions were unchanged.
The restricted portable run passed 921/923; the other two failed at Windows
`realpath` with EPERM in existing glTF/asset filesystem tests. Those are separate
from the new focus checks and require the established unrestricted test run.
