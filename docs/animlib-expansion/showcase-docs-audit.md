# Showcase documentation audit

Audited 2026-10-11 against checkpoint
`6e80d0a62df5ea085e724396438359b3fa99d196`, before the new showcase navigation.
This pass checks documentation and reproduction entry points; it does not add
visual acceptance or rerun the runtime suite.

## Checks

- The [coverage index](../../shared/animlib/docs/expansion-index.md),
  [final visual review](final-visual-coverage.md),
  [library review](final-library-review.md) and
  [capability audit](current-capability-audit.md) consistently distinguish the
  eleven accepted current-art scenes from historical source-art candidates and
  optional prepared assets. Acceptance remains bounded to each reviewed operation.
- The six current generator entry points and their documented source/manifest
  names agree with the source. Shear and matrix remain separately supplied
  manifests. Current RNA/transcription inputs are versioned JSON; their historical
  provenance paths are not live generator dependencies. Peptide retains its
  declared rig/staging/endpoint dependencies.
- Public exports and compiler/runtime wiring were spot-checked for compact queue,
  sampled state and nucleic motion. Multipart envelope preparation is exported
  through `animlib/core` and remains outside the scene VM. The API guides retain
  the scientific and workload bounds recorded in the acceptance reports.
- Peptide/transcription verifiers still gate historical preservation checks with
  explicit `--check-archives`. No old films are required for their normal current
  geometry checks. These scripts were inspected, not rerun in this pass.
- A fresh local-link scan covered **255 links, including 21 heading anchors,
  across 17 navigation/API/report documents**, with no missing path or anchor.
  Code spans/fences were excluded. Evidence is
  `data/animlib-expansion/showcase-doc-links.json`. This scan preceded the new
  showcase links and is not a web-link or all-repository documentation crawl.

## Documentation corrections

1. The library development command now explicitly builds workspace `animlib`;
   root `npm run build` also builds the backend preview, so it did not match the
   library-only command description.
2. The [input README](../../shared/animlib/demo/expansion/inputs/README.md) now
   documents both versioned RNA schedules and distinguishes provenance from
   generation dependencies.
3. The final library review has a dated integration follow-up. Its original
   pending-checkpoint text remains historical; the follow-up records `d272ffd`
   and `6e80d0a`, and distinguishes the earlier 229-link scan from the final
   231-link scan. The source/input paths, staged sampler and staging fixture were
   spot-checked in Git; the earlier 740-path prerequisite audit is attributed,
   not claimed as a new comprehensive scan.

## Final navigation follow-up

After the showcase guide, independent assembly review, browser QA, author report
and main-merge conflict audit were present, a final scan checked **276 local
links, including 21 heading anchors, across 24 documents**, with no missing path
or anchor. This includes the completed showcase navigation and those new reports.
Evidence is `data/animlib-expansion/showcase/verification/final-doc-links.json`.
The earlier 255-link scan above and 269-link scan in the assembly review remain
historical checkpoints; their evidence files were not overwritten. No runtime
checks were rerun for this final documentation pass.

## Remaining boundaries

No current documentation blocker was found. Local films, review images and
machine-specific FFmpeg paths remain evidence-workspace artifacts; reproduction
requires generated sources, installed dependencies, a compatible native GPU and
an installed FFmpeg. During this audit, root reran the integrated validation:
**972 tests in 87 files passed in 14.04 seconds**, with successful typecheck
and build (all exit 0, reported by root). This auditor inspected the saved logs
in `data/animlib-expansion/showcase-validation/{tests,typecheck,build}.log`; these
are root's fresh runs, not a second execution by this auditor. This audit adds
no clean-clone, native-pixel, performance or push claim, and leaves historical
review verdicts and frozen media unchanged.
