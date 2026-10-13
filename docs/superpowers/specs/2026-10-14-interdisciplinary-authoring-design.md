# Faster interdisciplinary visual authoring

## Intent and scope

Continue the existing lecture/catalog branch in SamuelHitzinger/3blue1brown-Visuals. The user wants substantially more complex explanations across disciplines with faster generation. Preserve the existing video and lecture flows, scientific honesty, geometry-led explanation, validation, and rendered review. Camera/audio capture and a new website redesign are outside this continuation.

The first implementation is a balanced expansion across physics, engineering, probability, ecology/economics, optics/quantum interference, and neuroscience. It extends existing animlib primitives and sampled-state support; it does not add another renderer or a general simulation engine.

## Measured starting point

The current lecture author receives approximately 210,187 characters before its request packet. General and molecular recipe bodies account for 66,473 characters of the authoring reference. A saved live sample needed 301.4 seconds, including a 41.3-second review with 62,005 input tokens and no cache reads. Author timing was not recorded, so the rest cannot be attributed precisely.

Catalog retrieval is already fast at 15 entries (about 0.025 ms per warm search in the local audit). Its immediate weakness is missing discipline/mechanism coverage and large full-record tool responses. Its scaling weakness is repeated normalization, full scans, and rebuilt lookup maps.

## Design

1. Keep full craft, execution, scientific, timing, interaction and validation contracts in model context. Replace only complete general/molecular recipe bodies with a concise index and bounded, verbatim reference reads. Preserve the full-reference builder and fail-closed heading coverage. Author, reviewer, repair and regeneration all retain access to omitted material.
2. Reuse validated candidate IDs for lecture completion and a bounded, job-local successful-validation cache keyed by source and model metadata. Failed or aborted work must never become a cached success. Retain authoritative final checks and mandatory rendered review. Record nonprivate author timing/token metrics.
3. Add small, pure, bounded `modalState`, `conservativeTransport`, `complexInterference` and `eventRates` constructions to the real scene VM. Validate and copy prepared inputs, derive related readouts from the same state, and reuse existing geometry/bindings/sampledState. Publish runnable recipes and precise numerical/scientific limits. These are supplied-mode, explicit-transition, coherent-amplitude and kernel-estimate calculations, not an eigenproblem solver, CFD engine, inferred causal system or many-body simulator.
4. Cache catalog ID/token indexes; rank exact/alias and term coverage deterministically. Add useful domain/readiness selection and compact byte-bounded agent summaries while preserving complete public details. Expand technique metadata and guides with actual supported API links, assumptions, provenance, runnable recipes and verification criteria.

## Acceptance

- Existing tests, typechecks and shipped builds pass; no skipped quality gate or changed model defaults.
- On-demand reference sections reconstruct exactly and reject unknown/unbounded requests. Every relevant generation stage receives the tool.
- Numerical invariants cover modal derivatives/energy, transfer accounting/conservation, phase interference, kernel symmetry/normalization, bounds and mutation isolation.
- Actual QuickJS compilation and forward/reverse/repeated samples exercise new helpers and recipes.
- A representative coupled-oscillator proof passes independent reasoning, readability, reference-style and technical review at both delivery aspects.
- Reproducible measurements distinguish prompt size, reference payload, catalog latency, helper work, compile/evaluation time and observed model latency. No promised speedup from a character reduction alone.
- Commit and push completed changes on the existing requested branch; preserve unrelated local files.
