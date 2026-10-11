# Optional construction experiment adapter

Status: research support only, not wired into the active matrix or production.
No model inference was used to implement or test it. A later full generation
run is still necessary to establish visual benefit and total cost.

`construction-runner.ts` exposes one `AgentRunner` decorator and the structural
brief schema/parser. `construction-specialist.md` is the generic proposed helper
prompt. The focused test uses fake runners and synthetic contracts; it does not
snapshot or rewrite production prompts.

## Comparison and invariants

Use the same winning frozen prompt candidate, fresh complete generation jobs,
requests, model, thinking, timing, compilation budgets and native gates for:

1. Existing candidate unchanged.
2. `order-only`: move the exact short construction checklist from the spatial
   scene-craft fragment to immediately after the exact installed API reference.
   No new instructions, paraphrase or source change. The trailing review/repair
   role contract stays after the moved checklist.
3. `specialist`: same ordering plus one actual underlying runner conversation
   before each initial spatial scene, returning a bounded construction brief.

The third arm is an augmented pipeline, not a prompt-only comparison. It must
include specialist latency and tokens in total effort. It is host-orchestrated
delegation; the scene author has no new tool to summon further agents. Prose
asking one author to act as designer/checker does not provide that delegation.

The default mode is off and returns the original runner. Planar tasks and
non-scene tasks pass through unchanged. A spatial author keeps its exact tools,
validator, output mode, images, asset publisher, signal and metrics callback.
The brief is cached by video/scene and appended to matching native reviewer and
repair user prompts. Those prompts already include the canonical author packet;
the decorator does not depend on mutating `options.task` inside the generator.
Duplicate concurrent initial calls share one helper. A changed scene context or
initial cancellation signal fails rather than silently reusing a stale brief.

## Integrating later without replacing the generator

Keep `createPiGenerator` and its existing native visual gate. Apply the frozen
prompt substitutions before this adapter sees a task. Pass it an undecorated
`PiAgentRunner`, or a logger/tool-meter wrapper that makes no prompt changes.
Do not wrap this adapter in another instance of itself. The existing harness
monolith should not be patched while the current matrix is running.

```ts
const construction = createConstructionRunner(loggedPi, {
  mode: chosenArm, // 'order-only' or 'specialist'
  checklist: exactChecklistIncludingItsExistingTrailingWhitespace,
  apiReference: exactBuildAuthoringReferenceResult,
  contextForScene: async task => boundedApprovedPacketFor(task.logContext!),
  specialistPrompt: await readFile(new URL('./construction-specialist.md', import.meta.url), 'utf8'),
  referenceExcerpts: frozenVerbatimExcerpts,
  maxSpecialists: settings.maximumScenes,
  onEvent: saveDistinctConstructionEvent,
  modelSystemForTask: task => task.systemPrompt + actualRuntimeCompletionFor(task),
});
const runner = { run(task) {
  return construction.run({ ...task, systemPrompt: substituteFrozenCandidate(task.systemPrompt) });
} };
// Pass runner into the unchanged createPiGenerator call.
```

Select the exact checklist from the spatial candidate by fixed start/end markers
and preserve its line endings. Select the API reference using the same installed
reference builder as generation. The adapter requires exactly one occurrence
of each and fails before a helper call if either is stale or ambiguous. For
`order-only`, the checklist move preserves the complete system string length.

The context resolver must supply this approved scene's own view mode, not a
root/default mode or a subject-keyword inference. Supply a deliberately small
authoritative packet: current visual description, relevant entity/control
identities, narration timing/operations, continuity and available asset metadata.
Include the constraints necessary to avoid redesigning the lesson. The proposal
may fill in construction choices but cannot add obligations unsupported by the
request; the author checks missing capabilities in its full reference. Do not forward
the entire ~238 kB author system or silently truncate input; oversize fails.
Choose and freeze useful API excerpts before inference. Each must be a literal
substring of the installed reference; the adapter does not hallucinate a helper
API summary. Keep any excerpt selection policy the same across tested cases.

`onEvent` receives separate task IDs, scene identity, role, original/effective
system and user text, images/output mode, output/failure, elapsed time and Pi
metrics. It runs for the helper and each modified author/reviewer/repair request.
The regular runner logger remains responsible for pass-through calls. Save
these events in ignored raw run artifacts, not the production metadata logger,
which deliberately excludes prompts. Supply `modelSystemForTask` to record the
actual Pi completion suffix too; without it the event describes the input to
the underlying runner, not the final provider system message. Pi's ordinary
`logContext` stage remains `scene`; the event's `construction-specialist` role
is the authoritative distinct identity for reports. Do not merge its usage into
author usage or count the same underlying call twice.

## Bounds, failures and limits

- Default maximum three specialists per adapter instance; caller supplies the
  full-job scene bound (accepted range 1–32). Instantiate once per fresh job.
- Context: at most 40,000 characters. Specialist prompt: 12,000. Verbatim API
  excerpts: 32,000 total. These are input bounds, not raised execution budgets.
- The current phase context adapter rejects a previous frame with more than
  128 elements. This is a limitation of the single-scene follow-up experiment,
  not a supported policy for large-structure multi-scene lessons or production.
  Before that later experiment, design and freeze an explicit semantic frame
  summary using carried/shared core IDs and poses, group relationships, total
  and omitted counts, and the complete-frame hash. The author must still receive
  the complete canonical frame. Do not silently truncate or reduce scene/source
  fidelity to fit the helper; that summary policy needs its own frozen manifest.
- Brief: exact version-1 schema, six nonblank text fields, at most 1,024
  characters each and 8,192 characters overall. No unknown fields. The schema
  is exported as `CONSTRUCTION_BRIEF_SCHEMA`; parsing also rejects whitespace
  fields. Structural acceptance does not validate geometry or API correctness.
- The helper uses `submit-only` with that validator. It inherits the same
  underlying Pi model/settings, cancellation signal, normal turn/provider retry
  bounds and existing runtime web tools. It receives no scene inspection or
  asset publication tools. The adapter adds no model retries or runtime budgets.
- Invalid helper output fails the arm and is cached as a failure; it does not
  quietly fall back to a no-helper arm. Existing compiler/native gates remain
  necessary even after a structurally valid proposal.
- Cancellation prevents a subsequent author call and promptly releases waits
  for context or helper output. Underlying Pi receives the exact original
  signal. A noncooperating fake/base runner cannot be forcibly terminated by
  this adapter; cancellation metrics can be absent until that base settles.
- A proposal may still restate the weak plan, invent a visually poor topology,
  or cost more than it saves. The prompt asks for meaningful connected structure
  before dense tessellation and aggregate compile-work estimates; neither is
  guaranteed by the schema. Judge the result using native frames and full
  failures, not primitive counts or approval alone.

After a winning comparison, production integration could use this same narrow
runner boundary. The production generator is shared across jobs and invoked per
scene: do not attach a wrapper with a lifetime budget/cache of three to its
singleton runner. Scope a future wrapper to one author plus its review/repair,
or explicitly manage per-video budgets and cache eviction. The phase harness's
one wrapper per fresh full generation job has the correct experimental scope.
Author-initiated nested delegation would need a separate
runtime tool/API change and is deliberately outside this experiment.
