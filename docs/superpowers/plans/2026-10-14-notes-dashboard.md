# Notes dashboard implementation

Use subagent-driven-development for independent backend and frontend tasks.
Spec: ../specs/2026-10-14-notes-dashboard-design.md

1. Backend/contracts/client: durable course lecture order, transactional reorder,
   note edits, stable section/concept association and concise synthesis. Tests.
2. Dashboard: course selection, lecture list CRUD, pointer/keyboard reorder,
   responsive independent stylesheet. No edits to App routing.
3. Lecture document: continuous editable sections, inline lazy visuals, section
   rail, collapsed source tools, export of edits. Responsive stylesheet and tests.
4. Controller: wire routes/navigation/course creation, verify integrated contracts,
   tests, browser desktop/mobile flows, independent review, commit and push.

## Verification

- Course dashboard, ordered lecture list, and continuous notebook implemented.
- Full backend suite: 428 tests passed. Final focused lecture suite: 23 passed.
- Final frontend suite: 125 passed. Production build and TypeScript checks passed.
- Browser checks on an isolated fixture database: lecture creation, rename,
  reorder persistence, course deep-link reload, deletion confirmation/cancel,
  section jumps, inline playback, edits surviving reload and AI refresh, and
  source citations. Desktop and 390px layouts checked visually.
- Review caught and resolved mixed legacy ordering, section-anchor collisions,
  and navigation-menu playback disposal. Mobile grid overflow also corrected.
- Existing local server restarted while idle; both existing lectures and phone
  pairing retained. Dashboard/course routes and capture health verified.
- Screenshot evidence is local under `.tmp/notes-dashboard-proof/`.
