# Scoped visual references

`visual-references.ts` loads `backend/prompts/visual-references/catalog.json`.
The catalog has five stable style families, each with at least five distinct
image paths and reference IDs. Paths stay inside the catalog directory; source
URLs, timestamps (or an explicit official lesson source), dimensions, purpose,
and limitations are required.

Production `PiAgentRunner.routeStyles` makes two small semantic decisions:
family selection from compact family metadata, then example selection from
only those families' reference metadata. Neither routing call receives images
or instructional paragraphs. At most two families, three images per family,
and five images total enter subsequent model context. Unknown contexts may
select nothing. Test/offline runners without `routeStyles` use deterministic
metadata scoring; it is not a substitute for production semantic routing of
negation, analogies, or unfamiliar terminology.

Lesson planning and editorial repair use the request's selected packet.
Scene authoring routes the current scene's purpose, visual description, key
points, and view separately. Review, targeted repair, and complete rewrites
retain that scene packet. Molecular teaching instructions and specialized
recipes load only for the molecular family. Shared engine APIs remain
available. Family visual grammar does not override scientific accuracy,
source material, or the understanding-first plan: duration follows content.
Higher dimensions must use explicitly identified projections or slices.

Internal `lesson.styles.json` and `scene-N.styles.json` persist bounded
selected image bytes, instructions, catalog/version hashes, and context
hashes. They deliberately survive catalog updates during an interrupted
job with the same context. An edited request or scene replaces its selection
and changes the hash used by dependent checkpoints. Public/audit scene packets
contain IDs and hashes, not image bytes.
Instruction policy version 5 identifies this change. Source problem images
are preserved separately. Every multimodal call receives a one-based role
map distinguishing source problems, style examples, and rendered evidence.
New candidates clear old rendered evidence; a repair restart retains its
own rejected candidate's evidence.

Run focused checks from the repository root:

```sh
npm run typecheck --workspace @aha/backend
npm run test --workspace @aha/backend -- test/visual-references.test.ts test/visual-gate.test.ts test/editorial.test.ts test/agents.test.ts test/authoring-reference.test.ts test/storyline-prompt.test.ts
```

Unit tests cover isolation, dimensions, bounds, no-match behavior, the real
Pi delegation entrypoint, cache/restart identity, source image roles,
editorial repair, scene selection, review/repair restarts, and repeated
render failures. Actual semantic decisions also require a live model smoke
test with representative family, mixed, negated, 4D, and unknown prompts;
mocked router replies alone do not establish semantic quality.
