# Local geometry representation probe

2026-10-16. Two hand-authored equivalent rewrites, no model calls, production changes, new DSL or subject template. **The combined source reduction is only 272 bytes / 5.56%. Stop pursuing this particular refactor as a compression/latency solution.** Local atom coordinates do demonstrate a useful relationship-preservation benefit under a separate emphasis stress test.

This follows [the proposed experiment](compact-authoring-next-experiment.md) and uses the successful `line-detailed/baseline` and `caffeine-full/baseline` sources from `data/realtime-workshop/complexity-matrix/screen-01`. It does not substitute for model authoring success, retained-world timing, arbitrary-subject coverage or the ≤10-second end-to-end goal.

## Exact source accounting

| Scene | Original UTF-8 bytes | Rewrite bytes | Saved bytes | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Detailed two-line comparison | 2,905 | 2,391 | 514 | 17.69% |
| Full 3D caffeine | 1,987 | 2,229 | −242 | −12.18% |
| Combined | 4,892 | 4,620 | 272 | 5.56% |

Counts are `Buffer.byteLength(source,'utf8')` of complete saved files, including comments and whitespace, without a minification pass. The unchanged caffeine host prelude adds 2,786 bytes to both arms; including it reduces the combined percentage to 3.54%. These are source bytes, not tokenizer counts or inferred latency. The molecular input SHA-256 was checked against the original case receipt. Exact source hashes are in `result.json`.

The line rewrite defines one input trajectory instead of five repeated expressions, uses two local JavaScript factories for native line/text construction, attaches the input label to its marker, and connects the vertical guide to the marker and second point. It keeps both horizontal projection callbacks because replacing them with helper anchors would add otherwise unnecessary objects. The six comparison handles are a named `compose` construction and the existing 4–5 second fade is expressed with `schedule`.

The molecule was already generated with loops and host-supplied data, leaving little construction repetition to remove. A shared bead factory changes absolute-coordinate meshes to zero-centered geometry plus a positioned handle; both atoms and legend beads use it. Legend labels attach to bead handles inside four compositions. Twenty-one single bonds use center connections. Four double bonds retain their original two-stroke geometry: `connect`'s perpendicular offset convention differs from the original, so replacing it would change the picture. The original reveal and rotation use `schedule` with exactly the original windows and linear easing. These extra relations cost more bytes than they remove.

| Native API/runtime measure | Line original → rewrite | Caffeine original → rewrite |
| --- | ---: | ---: |
| `compose` source call sites | 0 → 1 | 0 → 1 (four loop instances) |
| `schedule` source call sites | 0 → 1 | 0 → 1 |
| `attach` source call sites | 0 → 1 | 0 → 1 (four loop instances) |
| `connect` source call sites | 0 → 1 | 0 → 1 (21 loop instances) |
| Compiled attachment/connector declarations | 0 → 2 | 0 → 25 |
| Compiled reactive callbacks | 7 → 5 | 0 → 0 |

This is explicit **human-authored** API use. It says nothing about whether a model will use these APIs correctly when given unfamiliar source material. It also does not establish that `compose` or `schedule` individually saves bytes: much of the line reduction comes from ordinary reusable functions and deduplicating the trajectory expression.

## Equivalence and relationship evidence

The probe runs through the existing offline scene compiler/sampler and renders with the existing native WebGPU frame worker. Both originals and both rewrites compile without source repair and retain exactly eight seconds. It samples each pair at 0.1-second intervals from 0 through 8 (81 times), comparing all non-group primitives after explicit scoped-ID correspondence: geometry kind, every world-space point and mesh vertex, triangle topology, normals and remaining geometry properties, text, paint, line widths/profiles, effective opacity/scale/rotation, primitive anchors and camera. Added identity-transform composition groups are excluded from primitive comparison. It also checks the shared input marker, attached label offset and both points' line equations explicitly.

- Line: 20,031 numeric comparisons; maximum difference **0**.
- Caffeine: 1,809,552 numeric comparisons; maximum difference **8.88×10⁻¹⁶** world units.
- Molecular detail retained: **24 atoms including 10 hydrogens, 25 bonds represented by 29 strokes, 128 triangles per atom**. Legend beads remain separate from the molecular atom count.
- Native frames at 0, 1, 2, 4.5, 6 and 8 seconds, each at 1280×720 and 960×720: all 12 line frame pairs are pixel-identical. Caffeine differs in at most 12 RGBA channels in a frame, each by 1/255; all other channels match. Decoded-pixel receipts are in `pixel-comparison.json`.
- Full contact sheets were also decoded and hashed after an apparent display omission during review. Both line sheets and the 1280-width caffeine sheet are byte-identical across arms; the 960-width caffeine sheet differs by three channels of 1/255. The display artifact is absent from the saved PNGs. All paired PNG hashes are in the same receipt.

These comparisons preserve baseline limitations rather than silently improve them. Both the original detached molecular legend and its exact placements remain; the rewrite does not add chemistry claims, change the conformer, repair label layout, remove detail, or replace a molecular explanation with a generic icon. The equality check is stronger than object counts but still samples motion rather than proving every real-valued time mathematically.

## Separate atom emphasis stress

Neither original full-caffeine scene contains an atom emphasis action. Adding one to the matched rewrite would violate action equivalence. Instead, a separately identified diagnostic mutates sampled frame atom-group scales from 1 through 1.25 in five steps at t=0, 2, 4.5, 6 and 8, then reapplies native bindings. It measures atom centers from the mean of the rendered mesh vertices and verifies connected single-bond endpoints against those centers. This is 25 stress configurations; the authored timelines remain unchanged.

| Stress measurement | Original absolute geometry | Rewrite local geometry |
| --- | ---: | ---: |
| Maximum atom-center drift under scaling | 0.749031 world units | 2.86×10⁻¹⁷ |
| Maximum connected single-bond endpoint error | Not connected in original | 5.09×10⁻¹⁶ |

The original drift is a **hypothetical emphasis hazard**, not an observed defect in the original rigid-only animation. The diagnostic demonstrates why an atom's center should be its handle origin before scaling. It does not validate a production emphasis animation, dynamic double-bond offsets, arbitrary molecular deformation, cross-program bindings or retained-world patch ownership.

## Style and timing boundaries

The `3blue1brown-explanation-style` skill, its approved components/derivative images, rejected chart reference and review gate were inspected. The probe's style contract explicitly preserves the original visual language. The author inspected candidate contact sheets and the root agent independently viewed all four original/rewrite sheets; full-motion reference/style approval remains **unverified**. Numerical/pixel equivalence is preservation evidence, not a new scientific or pedagogical quality verdict. The original complexity screen's independent sampled-frame review remains the relevant prior review. No encoded movie or new full-motion quality score is claimed.

One sequential local compile observation was 48.9/19.1 ms for line original/rewrite and 67.4/62.8 ms for caffeine. The original compiles first and can pay initialization costs; this is not a controlled speed comparison. Rendering uses the current built `shared/animlib/dist` runtime, not a new production build. No provider generation, first useful browser frame, retained edit latency or live ingestion timing was measured.

## Artifacts and reproduction

All throwaway sources, exact compiled inputs, 48 full-size rendered frames, contact sheets, style contract, executable comparison and JSON receipts are under ignored `data/realtime-workshop/local-geometry-probe-01/`.

```powershell
node data/realtime-workshop/local-geometry-probe-01/probe.mjs
node data/realtime-workshop/local-geometry-probe-01/probe.mjs --render
node data/realtime-workshop/local-geometry-probe-01/compare-pixels.mjs
```

`probe.mjs` rewrites its own local result and render evidence, never the original screen. Its numerical comparison runs against the existing built runtime. The two source files are `line-detailed.js` and `caffeine-full.js`; `*-compiled.js` includes the unchanged host prelude where required. Pixel comparison decodes paired PNGs; its recorded results are independent from source byte accounting.

**Decision:** keep local-coordinate ownership and attachment examples as correctness guidance, but reject a new serialization layer or production abstraction on this evidence. The two-case set falls below the earlier 20% reduction gate and does not cover the full proposed matrix. Stop this bounded compression probe rather than adding subject-specific machinery to force a positive result. Model/runtime/retained-session experiments must carry their own evidence for the real-time objective.
