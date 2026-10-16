# Strict single world operation

2026-10-16. The existing single-request probe now accepts `--kind=world` through both its CLI and `runProbe(args, options)` library entry. This is a narrow join between native source authoring and the existing experimental `LiveWorld`; it does not execute a model response, provide live ingestion, or establish real-time quality.

World requests require `--case=external`, `--prompt-file` and `--system-file`. They use the same model/settings, single forced tool, terminal agreement, cancellation checks and write-once evidence path as scene/brief requests. Default `--strict=require` makes Pi forward strict JSON schema. No repair turn or new graphics language is introduced.

The `submit_world` wire envelope always contains exactly `action`, `source`, `changes` and `remove`:

```json
{
  "action": "edit",
  "source": "",
  "changes": [{
    "id": "existing-point",
    "props": {
      "position": [2, 0, 0],
      "rotation": null,
      "scale": null,
      "opacity": null,
      "fill": "TEAL"
    },
    "duration": 2
  }],
  "remove": []
}
```

`add` requires unchanged native scene source and empty `changes`/`remove`. `edit` requires empty source and at least one change or removal. Every change requires a stable ID, explicit duration, and all five `props` fields. Null means unchanged; each change must set at least one property. This explicit nullable representation is required by strict object schemas. Pi's installed converter rejects structured `anyOf` unions, so vectors use the accepted nullable `type` array representation. The real Pi conversion is exercised in tests; no paid provider request has confirmed server-side acceptance yet.

After validating **raw completed and terminal arguments match exactly**, acceptance removes null property fields and returns a typed `WorldSubmission` using a subset of native `WorldPatch` property types. No source text, non-null value, ID or duration is changed. The raw received arguments remain in `completed-tool-calls.json` and `terminal-tool-calls.json`; normalized accepted data appears in both `submission.json` and `world.json`. World submissions never create `source.js` or `brief.json`. The receipt's submission hash/byte count covers the complete normalized JSON operation, including add-source content. The legacy receipt `action` field still records the CLI prompt-action flag; the explicit world-only `worldOperation` receipt field records the accepted `add`/`edit` choice, or null on failure. It agrees with `world.json.action`; tests distinguish this from CLI `action`.

Bounds reuse exported `WORLD_LIMITS`: native add source ≤128,000 UTF-8 bytes, at most 256 changes and 256 removals, and the native patch serialization limit of 1,000,000 JavaScript string characters. The probe also applies the native stable-ID pattern, finite three-component position/rotation vectors bounded to ±1,000,000, scale in [0,1,000,000], opacity in [0,1], duration in [0,60], and native palette-token validation for fill. This first transport subset accepts string fill tokens only, not translucent color objects. Extras, accessors, non-plain/nonfinite data, unsupported properties, empty changes, duplicate change/removal IDs and direct change/remove overlap are rejected. `baseRevision`, program IDs, signal and publication deadlines are host-owned and are never model fields.

The caller dispatches exactly one accepted branch: native source to `LiveWorld.addProgram`, or normalized changes/removals to `LiveWorld.apply`, supplying its own program ID and base revision. `LiveWorld` remains authoritative for target existence, lifetime ID ownership, binding-owned properties, callback tween restrictions, subtree-removal conflicts, geometry/resource limits and commit atomicity. Schema acceptance is not publication authorization. The caller must recheck signal, evidence, revision and deadline at publication, including cancellation while evidence files are being persisted. There is no combined atomic add-and-edit operation or cross-program attachment support.

There is currently no abstain/insufficient-evidence branch. The host must decide whether evidence supports requesting an operation before using this forced-tool contract, and must reject unsupported content afterward; it must not force a fabricated creation/edit merely because this envelope requires a branch. That decision and the ingestion loop remain unimplemented here.

Validation: 16 focused tests / 189 assertions pass; targeted strict TypeScript checking passes. Tests exercise real Pi schema conversion, bounded/closed validation, both exact add/edit receipts, preserved scene/brief behavior and cancellation, plus actual QuickJS compilation and `LiveWorld` add → two-second native position interpolation → removal. The world smoke checks the halfway point, final fill/position, removed identity, revision and authoritative rejection of an unknown target. All provider events are local fixtures; no paid calls, model-quality scores, latency claims or production integration are included.

```powershell
.\node_modules\.bin\bun.cmd test backend/bench/realtime-tool-probe.test.ts
.\node_modules\.bin\tsc.cmd --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types bun --strict --skipLibCheck --verbatimModuleSyntax backend/bench/realtime-tool-probe.ts backend/bench/realtime-tool-probe.test.ts
```
