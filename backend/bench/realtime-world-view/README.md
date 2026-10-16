# Persistent-world browser experiment

From repository root, after building `animlib`:

```powershell
node_modules/.bin/bun.cmd backend/bench/realtime-world-view.ts
```

Open `http://127.0.0.1:5363/`. Each submitted instruction makes one OpenAI model
request using the existing local subscription authentication. No model request
occurs on page load. Server binds loopback and requires the same-origin POST.
Never expose this experimental server publicly.

Choose **Add geometry** for a new sandbox program with disjoint IDs, or
**Edit existing** for a property patch. The first program chooses the camera.
Programs retain their own clocks. A failed candidate leaves the previous world
running. Reloading the page creates a fresh world.

This prototype uses GPT-6.1 Sol, low reasoning, requested priority tier. Check
the recorded actual tier; tested responses reported default. There is no retry,
source repair, subject-template lookup, or quality-approval claim.

Measurements run from form submission through model response, compilation,
resource preparation and the first renderer submission for the new revision.
This is **not a hardware presentation timestamp** and does not establish that
the requested semantic change is correct. Warm GPU initialization precedes the
request. Speech capture, recognition and visual review are absent.

Raw prompts/outputs and provider metrics are retained under ignored
`data/realtime-workshop/live-requests/`. Browser outcomes, including failures,
are retained under `data/realtime-workshop/browser/`.

The core prototype rejects unsupported controls, cross-program attachments, camera animation
and interpolated edits to properties already owned by time callbacks. It has
bounded program/object counts and no history replay. See `LiveWorld.summary()`
for current limits. These restrictions are experiments, not narrowed product
acceptance criteria.

Finished time-bound programs retain one terminal callback snapshot. Concurrent
requests share that computation; failed computations can retry. Earlier samples
still evaluate callbacks normally. This relies on animlib's existing pure-callback
contract; callbacks that mutate closure state or consume random values are not
supported. The cache does not freeze host edits, internal attachments/connectors,
timeline evaluation or rendering. Compiler and asset ownership remain attached to
the original scene until its program is removed or the world is disposed.
