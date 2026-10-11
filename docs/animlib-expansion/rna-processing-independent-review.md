# Independent RNA processing review

Reviewed 2026-10-11 on `amilibsam`. This review independently inspected the frozen films and actual Nucleus source captures. The reviewer subsequently repaired one discovered clearance defect at root's request; that repair is self-tested and still requires root's independent code review. It does not alter the visual verdict.

| Gate | Verdict | Scope |
|---|---|---|
| Reasoning | ready | Bounded schematic cut/remove/rejoin and passage through one aperture. This does not establish loop formation or biochemical mechanism. |
| Visual readability | ready | Both aspects preserve the main objects and local labels; initial 4:3 pore tail has only a few pixels of margin. |
| Reference style | revise | The visible loop-formation operation and source cellular art direction remain absent. Full expansion is not approved as a source match. |
| Technical delivery | ready | Four valid silent films and deterministic sampled helpers after the clearance repair. Repair awaits separate root review. |

## Evidence actually inspected

Viewed all twelve `source-frames/nucleus-chronology/splicing-playback/sheet-01.png` through `sheet-12.png`: 179 ordered captures, source time 130.419031–157.994288 seconds. Viewed source full frames 034, 095, 113, 147, 153 and 158. The image tool resized these from 2195×1235 to 2048×1152. The last sheet contains three actual samples and black padding. The captures include brief player overlays and extend into the start of translation; neither is output style evidence.

Viewed every sheet 01–04 for each of `splice-16x9`, `splice-4x3`, `pore-16x9`, `pore-4x3` under the frozen proof's `motion` directory: 64 samples per film at 8 fps, 256 samples overall, ordered 0–7.875 seconds. This is dense sampled motion inspection, not real-time playback or inspection of every encoded frame. Also viewed full native proof images: splice 1280×720 indices 2/3/5 (1.39/1.41/3 seconds), splice 960×720 indices 5/8 (3/4.91 seconds), pore 1280×720 indices 5/6 (3/4 seconds), and pore 960×720 indices 0/5/10 (0/3/7 seconds). Images use the exact `*-frames/frames.json` times. The three bundled explanation-style baseline images were also viewed; the supplied Nucleus source takes precedence over that mathematical baseline.

Independently recomputed all four film SHA-256 hashes and matched `film-hashes.json`. Independently decoded every film to the FFmpeg null sink: 240 frames each, 8.00 seconds, 30 fps, H.264 High/yuv420p, 1280×720 or 960×720, no audio stream. Full decode logs and `audit-results.json` live in `data/animlib-expansion/rna-processing-review/`. The films remain frozen and unmodified.

## What the motion proves

The splice proof retains its green backbone, separately colored bases, yellow removed interval and cyan machinery. At 1.4 seconds both boundary edges are removed; the two white cut-end markers and departing interval remain visible during closure. At 4.9 seconds the replacement connection appears, followed by a stable result through the last sampled frame. At 3 seconds both aspects show the same open ends; around the join the machinery overlaps the connection, but its later departure exposes the uninterrupted strand. No caption is needed to reconstruct removal and reunion. The local Intron and Joined labels identify nearby geometry; Exons labels the upper retained section. A small scene identifier is not a title/chart/footer template.

The pore proof preserves one green chain and yellow identity marker. At roughly 3–5 seconds the moving camera reveals portions on opposite sides; at 4 seconds the membrane edge occludes the crossing. At 7 seconds the same marked chain has emerged and holds. The aperture is a real visible hole, not merely an orange ring drawn on a solid plane. The initial 4:3 tail nearly touches the right edge but remains inside the inspected image. Stable color roles and object identity make the schematic operation readable.

## Required style revisions

1. **Splice 0–4.9 seconds: show formation, not only departure.** The proof starts with a sharply bent yellow interval and removes that same rigid shape. Source sheet 06, around 141.7–143.7 seconds, visibly bends the initially diagonal strand into a loop; source 095 at 143.702134 seconds shows the developing curved interval, and source 113 at 146.112422 seconds shows the loop around the merged machinery. Add a separate, identity-preserving pre-cut deformation with visible endpoints and a hold before removal. Recheck the complete approach → bend → cut → departure interval at both aspects. This is a missing source operation, not a demand for molecular dynamics or exact lariat chemistry.
2. **Both films 0–8 seconds: build the source's spatial setting.** The proof has a uniform grey empty field, small separated rounded enzyme lobes and an isolated finite purple disc. Source 034 at 135.436451 seconds contains organic cavities, a populated depth field and soft differentiated foreground/background; source 147 at 151.145246 seconds and 153 at 154.307130 seconds place a lobed opening in a broad softly lit purple membrane with distant pores. Use original broad membrane geometry, motivated close framing, more organic machinery and layered cellular context. Keep the opening and chain readable. Extra glow or a palette adjustment will not fix the current staging.
3. **Pore 0–8 seconds: make strand flexibility an evident part of the action.** The source's green strand changes from a curled approach to a long rising arc (around 152–155 seconds). The candidate remains nearly straight in projection while the view changes sides. Author more visibly changing curvature along the valid transport path and stage the approach/emergence around it, retaining the marker and real occlusion. Recheck the moving interior frames, not just the start and end.

These differences are avoidable authoring choices for the requested source family. The declared rigid-fragment and polyline limits are honest library bounds, but they do not turn source-style failures into passes. The present films are useful capability evidence, not near-identical source replacements.

## Code review and clearance repair

Read the processing implementation, public types, focused tests, integration tests, API documentation, style contract, report and proof authoring source. The topology is explicit: original boundary bonds are removed at the cut, the exon edge appears only on closure, removed identities remain present, and each rigid fragment preserves its internal geometry. Dense identity checks, phase order, ranges, coordinate budgets, sparse inputs and frame degeneracy are preflighted. The existing host/public QuickJS and retained reverse tests passed.

**Original P1 finding:** clipping only the centerline to the membrane slab did not protect a finite chain radius as it approached a face. The accepted path `[[-8,1.2,0],[-.6,1.2,0],[-.5,.6,0],[.5,.6,0],[.6,1.2,0],[8,1.2,0]]`, normal `[1,0,0]`, radius 1, half-thickness .5 and chain radius .3 puts a leading site at `[-.6,1.2,0]` around progress .45422545. Its radius intersects solid membrane at `[-.4,1.2,0]`, despite the clipped centerline fitting the aperture. `clearance-repro.mjs` preserves this original reproducer; it now throws as expected.

Root authorized a narrow repair after the independent finding. Added a failing regression covering that case, a crossing segment with no nearby path vertex, and oblique versions. Observed the expected failure before implementation. Expanded the clipping slab by chainRadius on each face, then retained radial clearance at both analytically clipped endpoints. Outside the expanded slab, normal separation alone protects the swept ball. Inside it, radial clearance protects the ball, and convexity of radial norm bounds the entire segment by its endpoints. This is sufficient for the full polyline tube, not merely sampled anchors. It deliberately rejects some safe paths near a rounded rim; the API documents that conservatism.

Straight rendered connections can shortcut a polyline bend, so the centerline-tube guarantee does not certify arbitrary straight bond meshes. The documentation now calls this out and recommends path-following tessellation where needed. This limitation does not produce an observed collision in the densely sampled frozen proof.

After repair: 11 focused/integration tests and TypeScript build pass. An additional independent audit checks 1001 pure poses per frozen proof input, identity uniqueness, finite positions, unit orthogonal frames, bond graph counts and threshold behavior, constant thread arc gaps, 143 reverse poses, input immutability, and 11 retained QuickJS frames replayed in reverse per proof. Both original proof paths remain accepted. The validation-only repair changes no returned valid poses, geometry, choreography or film hashes.

## Suite limits

The first full-suite run in the filesystem sandbox reported 920 passes and three failures: `asset-host-preflight.test.ts` and `gltf-files.test.ts` hit EPERM in local realpath; `neural-trajectory-proof.test.ts` reported an interrupted scene compile during parallel execution. Those failures are recorded in `full-suite.log` and are not hidden as a green suite. A subsequent serial run outside that filesystem restriction passed all 923 tests in 78 files (37.20 seconds); it is recorded separately in `full-suite-unsandboxed.log`. No unrelated implementation was changed for these failures.
