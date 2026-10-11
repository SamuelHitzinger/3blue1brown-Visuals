# RNA processing candidate and evidence

2026-10-11. This report records the authored candidate, not an independent
acceptance or a near-identical Nucleus fidelity verdict.

Two reusable public helpers were added in `nucleic-processing.ts`, with a new
types module and seven focused regressions. Root integrated public/core/VM
surfaces and separate parity checks. The helpers retain identities, explicit
topology and deterministic arbitrary seeks. Full API limits and scientific
scope are in `shared/animlib/docs/nucleic-processing.md`.

Source coverage: personally viewed all twelve ordered sheets containing 179
actual playing captures from 130.419031–157.994288s. Requested full native source
034/095/113/147/153/158; tool displayed these at 2048×1152, resized from 2195×1235.
This is dense ordered sampled playback, not inspection of every encoded source
frame. The style contract records source observations and rejection criteria.

Four final native WebGPU films are under
`data/animlib-expansion/rna-processing-proof/`, each 8 s / 240 frames / 30 fps,
H.264/yuv420p, silent. Dimensions are 1280×720 and 960×720. FFmpeg decoded all four
completely to 64 ordered samples per film at 8 fps. The author viewed all sixteen
resulting sheets (256 samples) and native full frames at both aspects, including
cut boundaries, open cut ends, closure/hold, both sides of the aperture and
camera crossing. This is sampled motion inspection, not real-time playback or
individual inspection of every encoded frame.

| Film | SHA-256 |
|---|---|
| splice-16x9 | `3bf5bdbbc6fa64faa71aa99bd75518ac1e158f7098822efd33534dddb227669a` |
| splice-4x3 | `470b50d3bc42afd316d5b8392ee251a06fe752ca9875ddf0f2235fe042f5ce8c` |
| pore-16x9 | `6123eabd596d633237067a31ce9aead7e51dc1690f4cf3879b1fcc2f50686455` |
| pore-4x3 | `bb0d750f67569bd05f3673954f190e3f5e4c18e603f57bf9e4ee698a769ee6bc` |

Source payloads are 5241 and 10961 characters. Splice uses 118 elements, pore 51;
largest serialized frame payloads 108235 and 59134 bytes. The last measured host
compile costs were 89.7/33.8 ms; 121 QuickJS samples including JSON serialization
took 971.2/771.2 ms. These are measurements on this machine, not browser rendering
or sustained realtime guarantees. Asset registry decoded 6964224 bytes total;
splice pinned 6571008 bytes and pore 393216 bytes. Full measurements accompany films.
All prepared geometry stays in asset packages; no factory source or asset mesh
arrays are embedded into the scene. Reverse seeks were exact at the scene-data
level. The seven focused regressions and TypeScript build passed; root owns the
broader integration/suite audit.

The splice film shows intact borders, two cuts at 1.4 s, departing yellow interval,
coherent rigid exon closure, replacement connection at 4.9 s, and a final hold.
The pore film preserves one chain with one yellow identity marker as it enters
and exits the same opening. A continuous camera move crosses the membrane's
edge to expose near/far occlusion. The initial 4:3 tail has a small but positive
frame margin after the framing revision.

Remaining source differences are material: the loop is initially pre-curved
and departs rigidly; the source shows loop formation. The proof uses a sparse
uniform environment, smaller simplified machinery, and a finite annular patch
instead of a softly shaded broad cellular membrane/populated depth field.
The source's timing/hold proportions and close-up camera schedule differ.
These are bounded capability proofs with declared schematic behavior, and
must remain subject to independent reasoning/readability/style/technical gates.

Reproduction from repository root after building animlib:

```
node shared/animlib/tools/prepare-rna-processing-assets.mjs
node shared/animlib/demo/expansion/rna-processing-proof.mjs
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/rna-processing-proof/splice-frames.json
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/rna-processing-proof/pore-frames.json
```

Use native `render-video.mjs` with the corresponding manifest, width 1280 or 960,
height 720 and fps 30. Set TEMP/TMP to
`data/animlib-expansion/tmp-rna-processing` for this worker. The source generation
requires existing nucleotide-anatomy assets, prepared by the separate original
anatomy generator. The membrane generator emits its original recipe provenance,
CC0 license and hashes; no source images or model identity claims are shipped.
