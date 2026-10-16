# Mid-session static model inventory

The lecture world must admit a newly published model without reconstructing the world, restarting prior motion or granting a new response deadline. This is resource admission, separate from scene publication. The full target still includes arbitrary-subject retrieval, scientific representation checks, speech alignment and visible response within ten seconds; this change does not claim those gates are met.

## Contract

- Host inventory grows append-only from canonical, hash-verified published static assets. Existing runtime IDs keep their metadata, bytes and scientific provenance. Identical retries are no-ops; conflicting replacements fail atomically. The startup selection cap remains four, while cumulative inventory is bounded at 64.
- Host publishes a new digest/revision only after a complete batch has been staged. Retain known inventory identities so a browser using an earlier valid snapshot can reconcile; unknown identities fail. Each model generation pins candidates and a complete manifest synchronously before inference, and returns that pinned manifest.
- A trusted local registration route accepts exact published runtime asset IDs, never paths or URLs. It rebuilds the configured local index and validates canonical publication records. This is the integration point for retrieval/import completion, not automatic external search or semantic relevance certification.
- Browser validates same-origin capability URLs, immutable identities and bounded metadata, then appends to its existing ModelStore and LiveWorld. It preserves renderer/world instances and updates its inventory identity only after successful registration. Stale response snapshots may not remove assets or downgrade an already newer accepted revision.
- ModelStore registration clones and validates the whole batch before publication. Preserve compatible same-hash URL refresh behavior, but forbid scientific provenance changes under an existing ID.
- LiveWorld stages a copy-on-write metadata append, with its own inventory revision. It does not increment scene revision, cancel pending programs, alter camera or restart clocks. Each program compiles with its admission-time metadata snapshot.
- Registration cancellation/deadline guards run before publication. Later scene preparation retains the existing model decode → renderer preparation → guarded world commit ordering. Valid admitted resources may remain cached after a scene operation is cancelled.

## Implementation sequence and proof

1. Harden ModelStore batch staging and provenance identity; test malformed later entries leave earlier entries unpublished.
2. Add staged LiveWorld metadata append and a shared asset-backed coordinator; test motion, pending compilation, retries, disposal and count limits.
3. Extend the host session with staged append, bounded identity ancestry and immutable snapshots; test newly published assets, stale bytes, conflicting identity and concurrent appends.
4. Wire the local registration route, generation snapshot and browser reconciliation. Exercise registration and rendering without starting provider inference.
5. Run a local integration proof: begin with an active native scene and empty model inventory, publish/register a model afterward, add it to the same world, preserve previous motion, and reject stale/invalid mutations. Record inventory/scene revisions, cold load versus reuse, and separate render submission from hardware presentation.

No provider requests or uploads are part of this work. Detailed visual assets are retained; clips, skins, semantic asset discovery and a 2D-to-3D camera transition remain separate capabilities.
