# Compact frontier: unified visual proof

This original nine-second proof retains the independently reviewed compact queue
operations while adopting the user's 2026-10-11 3Blue1Brown visual direction.
Its motion reference remains Reducible's inspected insertion/extraction passage;
its typography, color roles and local arithmetic follow the approved mathematical
baseline. The older source-art film remains frozen.

## Reproduction and exact candidate

Run `node shared/animlib/demo/expansion/compact-frontier-3b1b.mjs` from repository
root after building animlib. It writes source, palette, manifest and native frame
requests under `data/animlib-expansion/compact-frontier-3b1b`. Render the manifest
with the normal `tools/render-video.mjs` exporter to a new filename to preserve
the reviewed candidate.

| Film | SHA-256 |
| --- | --- |
| `compact-frontier-16x9.mp4` | `00bf1188524e47d1c1c95cb6c96ceb35fb4b53ede1f9cdb50eda48fbbb9edf3c` |
| `compact-frontier-4x3.mp4` | `626e5716be3c8768b29c98cc7b20d2043c21641c26ad3e91f922312ce779f30b` |

Both films fully decode: 270 frames, nine seconds, 30 fps, silent H.264/yuv420p,
at 1280×720 and 960×720. `frozen-hashes.json` records seven source/helper/media
identities. Root personally inspected all ten ordered 8 fps sheets (144 encoded
samples), and native 3.025s/6.45s frames. Fourteen requested native times in each
aspect are available in `frames/frames.json` for independent review.

## Changes and scope

The same fixed graph, five immutable route/cost/destination records, .65s queue
transitions and two Dijkstra relaxations remain. Near-black space, gray scaffolds,
blue source, teal goal and warm active edges replace source-channel art. Math
labels remain beside their objects; cost comparisons move beside the relevant
edge operations. The diagonal D→B weight retains a collision-free local offset.

This proof demonstrates compact insertion/extraction and linked relaxation. It
does not demonstrate every graph algorithm or imply arbitrary graph layout is
collision-free. Fading incoming and outgoing cards briefly cross moving records,
as in the inspected choreography. [Independent review](compact-frontier-3b1b-independent-review.md)
accepted reasoning, readability, current art and technical delivery for this
bounded operation after inspecting both entire films and verifying unchanged motion.

At this checkpoint the complete CPU suite passes 972 tests in 87 files with four
workers; typecheck and build pass. Existing two native exact-MSAA parity failures
remain outside this CPU result.
