# Detailed-scene quality recovery

Two manual derivatives improve the previously rejected detailed surface and
caffeine comparisons. A fresh reviewer, blinded to revision identity and author
reports, preferred both revised versions. This is visual-quality recovery, not
evidence of faster model authoring or general live readiness.

## What changed

- Surface: static camera height 7.8 to 6.1; brighter fixed trace; larger `x=0`
  label in clear space with a leader. Same 40×40 mesh, moving slice and timeline.
- Molecule: true chemical subscripts; local C/O/N labels replace the detached
  legend; hydrogen annotation follows disclosure and rigid orientation. Same
  24 atoms, 25 bonds, 29 bond strokes, coordinates, detail-2 meshes and timeline.

The first author renders exposed partial surface-label occlusion and a molecular
leader crossing centered text. Each received one targeted repair before the
single independent review. Initial source/frames remain preserved. This was not
one-shot authoring, and the manual repair time is not model latency.

At 41 times from 0 to 8 seconds, baseline and revision preserve every selected
physical element state exactly. Molecular camera and both enclosing group
transforms/opacity also match. Surface physical mesh count is 3,200 triangles
plus two plane triangles; molecular atom meshes total 3,072 triangles. Surface
camera, trace color and annotations are declared presentation changes. Comparing
to the baseline proves preservation, not independent scientific correctness.

Native WebGPU produced two complete eight-second, 24fps, silent H.264 comparison
movies at 2560×720. FFmpeg decoded all 192 frames of each successfully. These are
native frame exports, not interpolated stills. Offline render/encode took 3.50s
for the surface and 3.08s for the molecule in single observed runs; these numbers
exclude authoring and do not measure live response or hardware presentation.

## Independent verdict and scope

[Fresh critic report](quality-revision-blind-review-2026-10-16.md) records all four
gates independently. Revised surface A and revised molecule B receive `ready`
for the visible reasoning, readability and reference-style composition. Original
surface B still receives `revise` for readability/style; original molecule A
receives `revise` for style. Technical delivery relies on supplied media records.

The critic inspected eight ordered sheets sampling roughly every half-second
through 7.5 seconds, native 2/4/6-second frames and all three skill reference
images. This is dense sampled-frame review, not playback. Smoothness between
samples and full-motion reference parity remain unverified. Chemistry reasoning
is limited to structural inspection and explicit-H disclosure, not a reaction
mechanism or molecular dynamics.

Comparison key: **surface A/left is revised, B/right original; molecule A/left
original, B/right revised.** Revision identity was withheld until review ended.
Ignored movies and evidence are under
`data/realtime-workshop/quality-revision-01/{surface,molecule}/comparison-AB.mp4`.
[Results and hashes](quality-revision-results-2026-10-16.json) identify exact
sources, numerical checks, movies and reviewer inputs.

## Transfer into generic authoring support

The library already implements label-aware connector endpoints. The compact
authoring prompt had only shown `endpoints:"center"`, encouraging an endpoint
inside the text. It now documents `s.connect(leader,object,label,{endpoints:"bounds"})`
for label leaders and explicit billboard/overlay annotation options. Both
authoring arms and the joined prompt share this guidance; previously frozen
requests remain unchanged. It does not add a subject-specific scene template.

This exposes existing capability rather than adding another helper layer.
`connectorLabel` measures connected text geometry; `applyBindings` updates the
trimming as objects move. Bound trimming does not route around other objects,
avoid unrelated labels or certify scientific visibility. Overlay labels prevent
depth hiding but still need collision checks. Near-edge billboard fitting occurs
after connector evaluation, so in-frame margins remain necessary. These limits
are explicit in guidance. The reviewed manual derivatives do not themselves use
the new prompt; no model-usage or review-loop reduction has been measured.

Next generic preflight candidate is projected leader-versus-text intersection
reporting using existing screen bounds. Current overlap detection checks text
against text, not raw leaders or transparent surface occlusion. It should produce
conservative warnings, not a claim of semantic correctness or a forced layout.

Focused connector/annotation suites passed **51 tests**; targeted strict
TypeScript checking of the prompt passed. An initial invocation used a missing
workspace-local executable; the corrected sandbox invocation passed 13 connector
tests but failed to load the annotation suite's Vite temporary module. Repeating
with the repository temp directory and approved local execution passed both
suites. No broad-suite pass is claimed. No provider requests occurred.

The ten-second end-to-end requirement and cross-subject generalization remain
unproven. New model payload uploads are still pending the separate destination
approval; local review work does not remove that boundary.
