# First joined public-lecture run

2026-10-16. The paced source, local recognition, causal scheduler, strict model
submission, retained world, native renderer and browser pixels now connect in
one measured experiment. **The run fails explanatory quality:** six accepted
model decisions produced five deferrals, one static addition and no edits.
This is integration evidence, not a passing ten-second animation result.

## Actual path and evidence

`backend/bench/realtime-lecture-join.ts` serves a bounded local experiment at
`http://127.0.0.1:5366/`. Its browser client keeps one `LiveWorld` and renderer,
receives evidence through SSE, and submits one cancellable model request at a
time. Exact evidence IDs/versions are resolved against the server ledger.
The earliest changed-source endpoint sets the ten-second deadline; new context,
queueing and provider dispatch never reset it. Deferrals retire uncovered work.
Cancellation acknowledgement waits for provider cleanup before another dispatch.

The source is the public MIT recording at 885–905 seconds: five paced four-second
PCM windows recognized locally, plus its frame at 900 seconds released only when
source playout reaches that timestamp. No cached transcript, official caption,
future frame, prewritten interpretation or private audio enters model requests.
Authentication and local runtimes warm before playout; this is not a cold-start
measurement or live microphone capture. Each request uses Luna, reasoning off,
strict `submit_world`, zero retries and requested priority. Every response reports
actual tier `default`.

Raw evidence is preserved under ignored
`data/realtime-workshop/lecture-join/d9d30bcb-a22a-4faf-9724-bd7a49ef563e`.
The adjacent `lecture-join-capture-01` directory contains frozen source snapshots,
their hashes, 180 browser screenshots, capture metadata and a final screenshot.
[Sanitized results](lecture-join-results-2026-10-16.json) retain exact timing values,
submission hashes, capture hashes and source identities without raw transcripts.
All nine source snapshots matched the executing files at audit time. After the
run, two browser status strings were corrected to promise only continued
visibility: a retained static world does not necessarily continue moving.

## Timing is not semantic success

| Plan | Changed source endpoint | Decision | Recognition/frame delay | Provider terminal | Endpoint to browser response, upper estimate |
| --- | ---: | --- | ---: | ---: | ---: |
| 1 | 889 s | defer | 278 ms | 1,111 ms | 1,593 ms |
| 2 | 893 s | defer | 241 ms | 1,214 ms | 1,643 ms |
| 3 | 897 s | add | 245 ms | 1,956 ms | 2,386 ms |
| 4 | frame 900 s | defer | 6 ms | 1,096 ms | 1,275 ms |
| 5 | 901 s | defer | 225 ms | 1,215 ms | 1,644 ms |
| 6 | 905 s | defer | 223 ms | 1,028 ms | 1,455 ms |

For plan 3, the source endpoint to world commit is **2,551.881–2,557.681 ms**;
endpoint to actual renderer submission is **2,561.881–2,567.681 ms**. Starting at
the beginning of that four-second source window instead gives
**6,561.881–6,567.681 ms**. Evidence availability to renderer submission is
**2,316.876–2,322.676 ms**. Browser response to commit takes 172.1 ms, followed
by 10.0 ms to renderer submission. These brackets use one measured 5.8 ms
browser/server round trip; clock drift remains unmeasured.

Only chunk-0002 is the committed visual obligation. Earlier chunks remain
context and their deferrals remain uncovered. All five deferrals have retired
scheduler status and `withinDeadline:false`; fast refusal is not animation
coverage. The single successful transport receipt retains
`semanticCompletion:"unknown"` and `hardwarePresentedAtMs:null`.

Original screenshot 0161 shows an empty explanatory canvas. Screenshot 0162
shows the new text and arrow at revision 1. A canvas-only bright-pixel scan of
all 180 captures identifies the same first nonempty image, and both originals
were visually inspected. The following marker read gives an upper mapped
observation of approximately **2.600 seconds after the source endpoint**.
This is browser compositor evidence with clock/capture uncertainty, not an
exact monitor presentation timestamp or the first meaningful explanation.
Screenshots cover only 7.117 seconds around publication; the capture limit
was reached before later decisions. The final screenshot is a separate sample.

## Independent quality verdict

A fresh reviewer, `/root/joined_visual_critic`, received the actual final browser
screenshot, unchanged native source, evidence available at creation, later board
frame and three approved/rejected reference images. Model configuration, latency
results and prior conclusions were withheld. The reviewer inspected sampled
images and source; no full-motion playback was claimed.

| Gate | Verdict | Finding |
| --- | --- | --- |
| Reasoning | revise | The initial speech fragment does not identify the left-hand quantity. The source nevertheless labels it acceleration. The connector asserts a formula without demonstrating its sign or proportionality. |
| Readability | revise | Symbols are legible but form a small cluster in a mostly empty world. The diagonal arrow lacks a defined mathematical meaning; whole-equation yellow does not connect terms to geometry. |
| Reference style | revise | The approved construction preserves objects and performs an operation. This source creates two text nodes and one arrow, then waits eight seconds; it contains no authored transformation. |
| Technical delivery | unverified | A rendered screenshot exists. Continuous motion, transitions and full playback were not established by the review. |

The board frame corroborating acceleration arrived about 438 ms after renderer
submission. Later corroboration cannot justify the earlier inference. That frame
also supplies useful relationships absent from the world, yet plan 4 defers on
the claim that existing objects already explain them. The browser's next prompt
contains IDs, kinds, transforms and colors but omits text contents, arrow
endpoints, attachments, bindings and actions. It cannot faithfully describe what
the existing scene says or demonstrates.

No later entity edit, ongoing unrelated motion, real recognition correction,
asset fetch or speech-to-action alignment occurred. No matched quality baseline
was authored for this exact causal input sequence. Earlier public-lecture pairs
use different evidence boundaries and cannot establish parity for this run.

## Next architecture decision

Enrich the existing bounded world description with exact label content, compact
geometry/relationship descriptors, property ownership and active motion. Retain
operation-to-entity-to-evidence links and unresolved referents. Keep model claims
about meaning separate from measured rendering success. A duration or entity
name is insufficient evidence that a relation has been explained.

This is a generic state/provenance change within the existing native authoring
path, not a library of subject-specific lessons or an extra review-model loop.
Preserve this failed run unchanged; evaluate any candidate against the same
evidence boundary and an unseen subject. The [complexity protocol](complexity-matrix-protocol.md)
still requires separate gates for sparse/dense 2D, coarse/detailed 3D surfaces,
molecular topology and retained changes. Easy graphs cannot compensate for a
failed molecule or surface. The current eight-case breadth screen does not prove
controlled detail-only scaling or generalization.

## Verification and reproduction

The following focused run passed **57 tests / 428 assertions**. Targeted strict
TypeScript checking also passed. These cover the tested contracts, not general
semantic correctness or all browser/transport lifecycle behavior. The actual run
adds successful end-to-end publication and pixel evidence, while the quality
review rejects the explanation. No broad-suite pass is claimed.

```powershell
.\node_modules\.bin\bun.cmd test backend/bench/realtime-lecture-join.test.ts backend/bench/realtime-tool-probe.test.ts backend/bench/realtime-media/events.test.ts backend/bench/realtime-media/replay.test.ts
.\node_modules\.bin\tsc.cmd --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types bun --strict --skipLibCheck --verbatimModuleSyntax backend/bench/realtime-lecture-join.ts backend/bench/realtime-lecture-join.test.ts backend/bench/realtime-lecture-view/main.ts
```

With existing public fixtures, local ASR model, built animlib and authorized
provider credentials available, start the server with
`.\node_modules\.bin\bun.cmd backend/bench/realtime-lecture-join.ts`, then use
Start in its local page. Starting invokes real provider requests. A new run gets
a fresh directory; reloading the page creates a fresh world. The fixed public
fixture paths are intentional experimental scope, not a general media importer.
