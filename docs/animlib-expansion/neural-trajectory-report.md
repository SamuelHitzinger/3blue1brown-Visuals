# Neural trace → projected spatial trajectory

2026-10-11, branch `amilibsam`. Original native geometry only. No Git mutation.
Root owns integration and the independent visual gate.

**Current release is revision2**, recorded at the end of this report. The
original candidate below was rejected for reference composition/motion. Its
metrics, dataset, orbit and hash remain historical evidence; they do not describe
the final candidate. Revision2 changes only the neural scene, manifest, runner,
proof test and these reports. The public sampled-state helper is unchanged.

## Reference inspected

Read neuroscience reference, both visual-evaluation rounds, organization and
performance report, explanation skill/baseline/gate; viewed all three baseline
images. Viewed all 41 ordered full browser frames at nominal 260–300s of
`https://www.youtube.com/watch?v=QHj9uVmwA_0`, plus all 178 ordered full browser
captures from uninterrupted playback 264.025364–290.096063s. The latter are
irregular approximately 6.8fps captures, paused=false, readyState4, 2195×1235;
they are not every encoded source frame. The source shows synchronized growth
of five left traces and the right spatial path, with a gentle viewpoint change.
At approximately291s it returns to the presenter. Inspectable ordered sheets
are in `data/animlib-expansion/neural-trajectory-complete/` and its
`growth-playback/` subdirectory. Source pixels are review evidence only.

## Implementation

`s.sampledState` is a small pure factory under `diagrams/`, installed through the
existing compiler/runtime and exported from core. It validates and copies
strictly increasing finite times, equal-dimensional vectors and an explicit
3×N projection. Bounds:1–64 components,20,000 samples and20,000 component slots.
Null samples split trajectories. Exact timestamps preserve samples; interpolation
never crosses a null interval; out-of-domain queries return null. Prefixes clamp
per run, repeat the current endpoint for future vertices and preserve fixed
topology. Singleton runs are degenerate two-point paths. Fresh output arrays
prevent consumer mutation and seek direction from altering captured data.

The new9.5s proof continues the accepted Artem trace/vector language with the
same original synthetic Gaussian-event rates and five stable colors. All five
traces and the selected vector compress left0.5–1.6s; native3D axes and colored
coordinate guides appear1.6–2.4s. A shared sample time advances0.30→3.70 seconds
during2.4–8.5s. The trace markers, numeric vector, three guides, white point and
accumulated path share this sample. The final result holds8.5–9.5s.

The explicit labeled projection is p=(f1,f2,f5)/5, an illustrative coordinate
selection, not a recovered biological manifold. The same precomputed161×5
rate samples drive the linear trace segments and spatial path. Numeric LaTeX
uses existing `countTo` tracks at these same data knots; numeric reactive writes
are not supported and were not added. Main and independent3D view share the
existing timeline, with coordinated actions. The actual camera changes gently
by0.25rad yaw/0.10rad pitch through growth. No alternate projection renderer,
mesh pipeline, limit increase or global state was introduced.

## Verification and costs

Reproduce after the ordinary build:

```sh
npm test --workspace animlib -- test/sampled-state.test.ts test/neural-trajectory-proof.test.ts test/science-proofs.test.ts --maxWorkers 1
node shared/animlib/demo/expansion/neural-trajectory-proof.mjs
```

Use an existing unique writable TEMP/TMP directory on this Windows sandbox.
Final focused run:8/8 tests pass, including the earlier two science proofs.
New tests cover hand-derived interpolation/projection, invalid matrices, sparse
times, copying, missing intervals, singleton runs, exact endpoints, budgets and
the compiled proof's whole correspondence. Sparse-time rejection was added
failure-first after root caught `.map` skipping holes; `Array.from` fixes it.
Actual scene numeric values agree within1e-11 with displayed trace ordinates and
projected coordinates; the tolerance covers independently scheduled floating
point arithmetic in `countTo`. Point/path endpoints and coordinate-guide joins
are exact. Arbitrary forward/reverse/direct samples return identical frame JSON.
Ordinary animlib build passes. Root owns the integrated suite during parallel
edits. An initial shared-TEMP Vite cache ENOENT disappeared with unique TEMP.

Native frames at1280×720 and960×720 cover0,.9,1.6,2.4,3.4,5.45,7.3,8.5,9.49,3.4s.
Return to3.4s after the endpoint yields exact PNG equality at both sizes.
Author viewed native sheets and full-size960×720 interior/final frames; all five
rows, brackets, local labels, point and trajectory fit. Bracket margins were
widened after the first render. Author inspected all57 decoded ordered6fps
samples across the complete film (five3×4 sheets, trailing cells padded black).
The growing trajectory stays attached to the point; no reset or discontinuity
was observed. This is dense sampled motion inspection, not real-time playback.

Final native film: `data/animlib-expansion/neural-proof/film.mp4`,1280×720,
30fps,285frames,9.5s,H.264/yuv420p,silent. Full FFmpeg decode passes.
SHA-256 `00e3e2893d80dbaa390cabddcc029c13b8192e4aa00668f5c510542f52081e96`.
Exact source/metrics/native checks are reproducible with the tracked runner.

| Measured item | Value |
| --- | ---: |
| Source / compiled / sampled frame bytes | 5,334 /616,458 /86,778 |
| Objects / bindings / timeline tracks | 59 /34 /979 |
| Compile + sampler lease median /p95,5 samples | 96.04 /99.35ms |
| CPU evaluation median /p95,40 samples | 7.35 /9.86ms |

Node24.15.0, same Windows machine as organization-performance-report. One warmup
compile, five measured compiles; five warmup frames then40 frame evaluations.
These are CPU wall times, not GPU FPS; small samples and parallel activity limit
inference. Existing32MiB VM,200ms default execution and all source/object/point
and compiled/reactive payload limits remain unchanged. Known separate native
4×MSAA exact-pixel failures are not resolved by these successful sampled seeks.

## Released files

- `shared/animlib/src/diagrams/sampled-state.ts`
- `shared/animlib/src/diagrams/sampled-state-types.ts`
- Additive factory wiring in `shared/animlib/src/{core,types,runtime,compiler}.ts`
- `shared/animlib/test/sampled-state.test.ts`
- `shared/animlib/test/neural-trajectory-proof.test.ts`
- `shared/animlib/demo/expansion/neural-trajectory.js`
- `shared/animlib/demo/expansion/neural-trajectory-manifest.json`
- `shared/animlib/demo/expansion/neural-trajectory-proof.mjs`
- `shared/animlib/docs/sampled-state.md`
- `docs/animlib-expansion/neural-trajectory-style-contract.md`
- `docs/animlib-expansion/neural-trajectory-report.md`

Palette is the existing Artem palette, unchanged. No broad creator parity,
biological inference, or independent pass is claimed here. Root's independent
evaluator must separately judge reasoning, readability, reference style and
technical delivery from this exact candidate.

## Revision2 — final visual repair release

Independent reviewer found that the original full-height traces/vector dominated
the frame, the spatial trajectory was small and monochrome, the camera change
weak, and rate detail uniformly smooth. Revision2 compresses both horizontal and
vertical trace/vector coordinates coherently into the upper-left. Rate strokes
are thinner. The native3D view now covers most of the right/lower canvas; axes,
labels, local fixed-projection formula and time-color key fit both native sizes.
The original event/rate proof remains untouched.

The final synthetic rates retain the same primary timestamps and palette, but
are **not numerically the same rates** as the original proof. Each primary event
uses a normalized85% Gaussian sigma0.13 +15% Gaussian sigma0.035 mixture. Each
row adds39 deterministic weak Gaussian events with sigma0.04; event times are
0.10+0.10j+0.023sin(j(1.3+0.1r)+r), with weights
0.045+0.035((7j+3r) mod5)/4. These explicit positive components add fine-scale
irregularity without random hidden state. They are original illustrative rates,
not measured firing data or a recovered biological manifold. The fixed projection
p=(f1,f2,f5)/5 remains literal and labeled.

321 shared sample knots at0.0125s drive the displayed traces, numeric `countTo`
tracks, coordinate guides, point and trajectory. Eight chronological path bands
cover contiguous0.5s intervals with41 points each; neighboring bands share the
exact endpoint sample. Every future band is hidden, and its fixed topology is
retained. Purple→cyan time colors are distinct from the muted third-row purple;
a small local color key marks increasing time. Existing round stroke profiles
keep the trajectory visible while the3D camera turns; no new renderer property
was introduced. The camera changes by0.60rad yaw and0.18rad pitch with smooth
progress, avoiding an edge-on final axis. The held result remains8.5–9.5s.

Final native movie and all matching frames/sheets:
`data/animlib-expansion/neural-proof-r2/film.mp4`.
SHA-256 `89b32212ef7108b56085f6d792e45919697901077e3323af54723c5716153ba2`.
1280×720,30fps,285frames,9.5s,H.264/yuv420p,silent; complete FFmpeg decode passes.
Native times remain0,.9,1.6,2.4,3.4,5.45,7.3,8.5,9.49,3.4s at both1280×720
and960×720, with exact reverse3.4s PNG equality. All frames and five motion
sheets were regenerated from this final kernel and sample count. Author inspected
all57 ordered6fps samples over the full movie, full-size1280interior/960endpoint,
and the native keyframe sheets. No disconnect, row swap, clipping or temporal
color reset was observed. Independent reviewer has this exact hash for its gate.

Final focused tests preserve numeric correspondence within1e-11, exact point and
active-band endpoint equality, exact neighboring-band joins, invisibility of all
future bands, and exact frame JSON after direct/reverse seeks. Public helper
and earlier science proof tests still pass. The final focused run is8/8 tests;
ordinary build passes. The tracked reproduction runner now writes the r2 folder,
preserving the rejected first candidate's evidence.

| Final measured item | Value |
| --- | ---: |
| Source / compiled / sampled frame bytes | 6,712 /1,218,569 /159,075 |
| Objects / bindings / tracks | 84 /42 /1,949 |
| Compile + sampler lease median /p95,5 runs | 214.56 /312.64ms |
| CPU evaluation median /p95,40 samples | 12.82 /14.82ms |

The compile+lease measurement includes host compilation/geometry work and is not
the VM execution timeout itself. All runs used the unchanged default200ms VM
execution cap and32MiB VM memory. Doubling data knots increases numeric tracks
and evaluation costs; this is a measured tradeoff for the finer synthetic detail,
not a claimed speed improvement. No GPU FPS claim. Existing source/object/point,
compiled/reactive payload and mesh limits remain unchanged. The separate4×MSAA
exact-pixel issue is unchanged. No shared runtime/compiler/helper edits were
made in this visual revision.

Final label-only recheck: independent reviewer found the f2/5 label touching the
vector bracket at2.4s in4:3. Added0.38 world-unit camera-facing horizontal
offset to that label only. Native2.4s/3.4s now show clear bracket separation; all
media above were regenerated. This final hash supersedes intermediate r2 hashes.
