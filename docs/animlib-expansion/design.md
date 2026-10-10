# Reference-driven animation library expansion

Date: 2026-10-11. Branch: `amilibsam`. Starting commit: `2b666eb`.

## User intent

Make the existing animlib efficient for original animations with motion, visual
flow, and rendering comparable to the supplied mathematical, algorithmic,
neuroscience, quantum, and molecular references. Reuse existing assets, textures,
and external model data where appropriate. Distinct artists retain distinct
visual contracts. The user explicitly authorizes autonomous implementation,
multiple Astra/high agents, and repeated independent evaluation until satisfied.
Do not switch to, merge into, or push `main`.

## Architecture

Extend the existing TypeScript/QuickJS scene compiler and WebGPU/WebGL2 renderer.
Keep offline source-data preparation outside the scene sandbox. Prefer reusable
modules and typed interfaces over copied scene snippets. Geometry, mathematical
relations, absolute-time evaluation, and asset provenance must remain explicit.

Three boundaries guide implementation:

1. Host preparation converts external data/assets into bounded, validated native
   assets with source and license metadata. Scene code never fetches or imports
   arbitrary packages. Existing PDB and molecular-envelope preparation are reused.
2. Reusable domain builders and motion helpers compose ordinary animlib objects.
   Artist-specific palettes and composition live in separate examples/contracts,
   not contradictory renderer defaults. Preserve deterministic random seeds and
   arbitrary seeking. Keep geometry budgets and lifecycle handling enforced.
3. Render and review tools use the production renderer and the same absolute-time
   evaluation as the player. Proof clips, native frames, tests, and performance
   measurements are separate evidence; passing one cannot substitute for another.

An engine replacement would discard existing correctness and portability work.
Large bespoke scene scripts would fail the requested reuse and maintainability.
The selected approach is incremental modules with focused integration and demos.

## Evidence and acceptance

Each reference report records URL, title/creator attribution, exact inspected
intervals, complete-frame observations, motion evidence, and access limitations.
Descriptions, transcripts, and thumbnails alone cannot establish visual matching.
Inspect full representative animation passages including setup, interior motion,
endpoint, and hold. Never claim entire-channel coverage from a few examples.

Each implementation requirement links to observed evidence or a concrete enabling
dependency. Each visual proof has four independent verdicts: reasoning, visual
readability, reference style, and technical delivery (`ready`, `revise`, or
`unverified`). No averaged pass. Reviewers inspect actual output and reference.
Substantive mismatches require revision and rerendering. Untested/unsupported
reference capabilities remain open; a schematic molecule is not a cinematic
molecular fidelity pass.

Reference frames are review material, never generated movie backgrounds/textures.
Imported reusable assets carry provenance and applicable license restrictions.
Unverified original attribution must remain unverified.

## Engineering checks

Keep existing tests passing, add behavior/invariant tests before new code, and
check TypeScript and builds. Test invalid data and geometry budgets, deterministic
seeking, lifecycle/resource disposal, and renderer parity where changes touch it.
Benchmark actual reused geometry/compilation/rendering paths; do not substitute
CPU stubs for GPU performance claims. Avoid adding dependencies unless they serve
an observed requirement and have a bounded integration surface.

## Initial findings

- Existing engine already has paths, glyph/part morphs, meshes, solid/surface
  builders, retained deformations, molecular beads, PDB import, smooth envelopes,
  procedural textures/materials, outlines/sections, multiple views, and controls.
- Asset support currently exposes audio; general model/image asset reuse is absent.
- The supplied label “Quantum Sense” points to `@VisuallyExplained`; investigators
  must keep the linked channel and any separately identified Quantum Sense distinct.
- Offline video/frame tools compile once and call `evaluateScene`; retained
  absolute-time callbacks need an explicit evaluation audit before new motion
  proofs use those tools.

