# Prepared scientific assets and reusable motion

User requests faster scene creation without reducing quality, correct reuse only,
and database-derived large molecular structures with AI-directed motion.
Continue `codex/lecture-visual-catalog`; preserve unrelated local plugin work.

## Chosen architecture

Keep catalog metadata/Markdown human-editable and separated from binary geometry.
Add machine-readable reuse contracts to molecular records: applicable claims,
excluded claims, required inputs, preparation route, and motion limits. Model
navigation must check these before selecting an existing asset. Cache bounded
catalog document reads within the versioned process instead of repeating disk
reads on review/repair. Do not cache private lecture text in this public catalog.

Persist molecular preparation artifacts using content-derived keys containing
converter version, source hash, component dictionary hashes, exact chain selection
and representation. Store immutable GLB plus scientific provenance, verifying both
on reuse. Bound memory and disk reads, recover safely from incomplete writes,
deduplicate concurrent preparation without sharing caller cancellation, and make
warm preparation survive a fresh process. Default representation stays identical.

Add an explicit `backbone` representation for whole-complex questions, retaining
all selected deposited protein CA and nucleotide P anchors and documented gaps.
It must never be selected automatically to evade a budget or support atomic claims.
Existing mixed protein-trace/nucleotide-heavy-atom representation remains default.
Publish through the existing tool in both video and lecture pipelines. No mmCIF,
biological-assembly reconstruction, new invented chemistry, or MD solver implied.

Add bounded `s.rigidMotion` mathematical helper for supplied time-keyed rotation
and translation around a chosen pivot. It returns a seekable model-local pose
and transformed landmark points. Bind named model parts to this pose; geometry
stays immutable, outside prompts and scene VM. Preserve all intrapart distances.
Rotation order must match the renderer. Motion provenance must distinguish
authored illustration from supplied transforms; neither proves molecular dynamics.
Deformation/folding still requires appropriate prepared data or existing peptide
builders, not rigid motion disguised as a scientific trajectory.

## Acceptance

- Existing default geometry remains byte/coordinate equivalent; quality gates,
  renderer limits, scene limits and review budgets unchanged.
- Persistent cache verifies identity and invalidates for every relevant input;
  corruption and cancellation cannot publish wrong or partial assets.
- Large deposited example can be explicitly prepared, published and moved with
  short scene source and correct labels; no atomic claims from backbone geometry.
- Motion tests prove pivot, distance, seeking, bounds and VM compatibility.
- Catalog tooling retains full scientific limits while bounding response size.
- Cold/warm measurements separate download, preparation and scene work; report
  measured speedups only. Render native motion proof and independently review it.
- Run relevant full tests and production build; document limits and commit/push.
