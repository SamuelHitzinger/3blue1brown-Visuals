# Phone capture implementation plan

Continue `codex/lecture-visual-catalog` from `6a4b2d3`; preserve unrelated plugin work.
Spec: `docs/superpowers/specs/2026-10-14-phone-capture-design.md`.

- [x] Backend owner: durable restricted pairing/media ingestion service, lecture source adapter/provenance, debounced notes and visual fairness; unit/integration tests.
- [x] Frontend owner: standalone iPhone capture page, complete audio recording windows, bounded persistent upload queue, QR/pairing desktop panel, visible-idle lecture refresh; focused tests and mobile layout.
- [x] Root: shared capture contract, media normalizer, restrictive loopback gateway, main server wiring, private HTTPS startup/setup and operational docs.
- [x] Integration: real synthetic image/audio extraction, capability and gateway checks, browser mobile/desktop review, independent code review, fix findings.
- [x] Finish implementation verification: existing relevant suites, typechecks,
  production build, provenance/retention/latency limitations documented, and
  a fresh Live lecture session opened. Commit/push recorded in branch history.

Device gate: computer account must enable Tailscale Serve; user must connect
iPhone and grant Safari permissions. Local synthetic end-to-end and responsive
UI checks passed; actual device capture is not yet verified.
