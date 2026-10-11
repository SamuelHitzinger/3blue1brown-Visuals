# Animlib Authoring Documentation Implementation Plan

> **For agentic workers:** Use subagent-driven development for the independent research and writing domains below, followed by an independent integrated review.

**Goal:** Expand `reference.md` into a practical animation cookbook and make `capabilities.md` a complete, accurate planning guide for the orchestrator.

**Architecture:** Keep the two existing documents authoritative. Parallel specialists derive recipes from current exported APIs and reviewed generators; root integrates the reference sections and updates the production heading inventory. Compile executable examples and verify the exact content delivered to agents.

**Tech Stack:** Markdown, TypeScript, animlib scene compiler, Bun backend tests.

**Spec:** User request in this chat: heavily expand instructions for many animation subjects, particularly molecules and complex proteins, and expose the library's full capabilities to the orchestrator.

## Constraints

- Work on `amilibsam`; preserve current runtime behavior and main's GLB features.
- Use existing library APIs, assets and reviewed examples; label prerequisites and illustrative data.
- Distinguish deposited structure, schematic mechanism and physical simulation.
- Keep the user's mathematical visual direction across subjects; other references inform motion.
- Keep ordinary scene code separate from host-only import/preparation.
- Do not present hard resource ceilings as recommended scene sizes.

## Review Focus

- Examples must use current names, arguments, returned handles and persistence semantics.
- Complex protein workflows must distinguish static meshes from articulated backbones and atomic poses.
- Prepared assets and GLB models must retain their different styling and deformation limits.
- New headings must be explicitly included in the production authoring-reference inventory.
- Planning claims must not imply unavailable simulation, imported skeletal animation or automatic biochemical inference.

## Tasks

1. Derive molecular/protein/nucleic recipes from code, tests, prepared assets and accepted demonstrations. Write an integration fragment with explicit inputs, steps, failure modes and runnable examples.
2. Derive geometry, algebra, graph/algorithm, sampled-state, asset, camera, lighting and annotation recipes. Write a separate integration fragment; avoid duplicating molecular material.
3. Expand `shared/animlib/docs/capabilities.md` with a request-to-representation matrix, reusable workflows, orchestration decisions, prerequisites, performance and limits.
4. Integrate fragments into `shared/animlib/docs/reference.md`, preserving existing sections. Update `backend/src/agents/authoring-reference.ts` and its coverage tests for exact new headings and retained content.
5. Compile explicitly executable recipe fences with their declared inputs, check local documentation links and run focused authoring-reference tests plus backend typecheck. Add bounded documentation validation where needed.
6. Have an independent agent review integrated documents against APIs and the actual extracted authoring reference; repair findings and save a local checkpoint.

Each writing task is independently reviewable. No new animation runtime API is planned.

## Completion Evidence

Completed on 2026-10-11 on `amilibsam`:

- Added 20 general and molecular recipe subsections, including 13 standalone
  `js scene` examples and separately marked host preparation recipes.
- Expanded the capability guide with request routing, representation decisions,
  asset ownership, complete domain coverage, scientific scope and practical limits.
- Updated the strict backend heading inventory and verified that the complete
  recipe collections reach scene authors. Existing planner/editorial tests verify
  that the entire capability guide reaches their agents.
- `node node_modules/vitest/vitest.mjs run --root shared/animlib
  test/authoring-recipes.test.ts --maxWorkers=1`: 14 tests passed. Every marked scene
  compiles at default limits, produces finite frames, and supports deterministic
  reverse seeks. This durable test reads the published reference directly.
- From `backend`, `../node_modules/bun/bin/bun.exe test
  test/authoring-reference.test.ts test/narration.test.ts test/editorial.test.ts`:
  49 tests passed. Library and backend typechecks also passed.
- The general author verified 31 supporting helper tests. The molecular author
  verified 554 scene samples, the PDB host recipe on pinned 1CRN, discovery of
  44 biological packages, and prepared `1crn-surface` loading/clipping/motion.
- Local documentation audit: 88 links and 15 anchors checked without failures.
- Three independent Astra/high reviewers checked general recipes, molecular
  recipes and capabilities. Corrections specify linear numeric interpolation,
  silent-only native video export and the curved-path interaction boundary.

These checks establish executable examples and source/API agreement. They do
not claim new rendered visual acceptance or physical molecular simulation.
Existing reviewed-film evidence remains scoped to its linked versioned artifacts.
