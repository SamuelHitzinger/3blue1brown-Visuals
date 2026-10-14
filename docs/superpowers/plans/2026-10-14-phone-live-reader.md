# Phone + live reader implementation

Use subagent-driven-development with independent ownership; reuse existing
feature branch codex/lecture-visual-catalog. Baseline ed430e1.

1. Backend: shared lecture-view contract; owner POST/GET/DELETE
   /api/lectures/:id/view-link; hashed eight-hour reader capability in lecture DB;
   GET /api/lecture-view/:id with Bearer token. Project only notes/visuals/status
   and edits. Restrict gateway to this read endpoint and /live/:id shell. Tests.
2. Phone: simplify CapturePage and CSS; add camera zoom/manual capture to engine,
   with meaningful crop/zoom/lifecycle tests. Preserve queue and pause recovery.
3. Reader: standalone LiveNotesPage; token storage/fragment removal; bounded
   refresh with stale-response guards; reader link QR/revoke UI on LecturePage.
   Wire main.tsx and cover credential/polling helpers.
4. Integration: full affected suites/build, desktop/tablet browser proof on
   isolated fixtures, independent review, idle-server deployment, commit/push.

API contract: LectureViewLink {url,expiresAt}; LectureViewLinkStatus
{active,expiresAt?}; LectureLiveSnapshot contains id,title,revision,updatedAt,
sourceRevision,synthesizedRevision,status,notes,noteEdits?,personalNotes,
visualizations,error?. New shared file shared/lecture-view.ts.

Root owns integration and QA. Backend agent owns lectures.ts/server.ts/gateway
and backend tests/shared contract. Phone agent owns CapturePage/captureEngine/
capture.css and phone-specific tests. Reader agent owns new live-reader files,
LecturePage/main.tsx and reader tests. No agent builds tracked frontend/site.

Completed 2026-10-14. User chose computer-only reading for now; existing desktop
notebook updates directly, with the private reader available for a later device.
Scoped authenticated model downloads preserve imported visual support. Final
frontend suite passed 146 tests; backend baseline and focused follow-up runs,
review fixes, synthetic browser proof, and device limitations are recorded in
docs/phone-capture-validation.md. Idle local server restarted successfully;
private HTTPS capture and all three saved lectures remained available.
