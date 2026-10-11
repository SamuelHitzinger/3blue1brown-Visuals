# scenegen: extra visual rules, render checks and single-scene retry

Runs the backend unchanged, with two prompt additions and extra checks on every
generated scene. Nothing here is used by the normal `backend/src/index.ts` start, and
nothing under `backend/`, `frontend/` or `shared/` is changed.

```
cd backend
bun ../scenegen/backend/dev.ts                 # the app, with the rules and checks below
bun test ../scenegen/backend/dev.test.ts       # 15 tests
```

## Prompts

| File | Added to | What it adds |
|---|---|---|
| `prompts/planning.md` | the lesson-planning prompt | 3D by default with a `3D:` / `2D (because ...):` tag, true 3D shapes, intuition first, then the key equations with every variable explained and a pause to read them, one focus per sentence, colours with yellow reserved |
| `prompts/visualization.md` | the scene prompt, after `scene-craft.md` | 3D in its own view with a framed camera, controls top right, a formula column with real spacing, equations only while explained, the yellow focus frame and the 3D pulse, fixed layers, minimal objects, light scenes |

Both are re-read on use, so an edit applies to the next scene without a restart.

## Checks

Run after the backend's own validation; a failing scene goes back to the model with
the message. In `backend/scene-checks.ts` and `backend/focus-frames.ts`. Boxes come
from animlib's `getWorldBounds`.

| Check | Rejects a scene when |
|---|---|
| LaTeX render | A formula uses a command the player cannot render |
| Plan view tags | A planned scene is not marked `3D:` or `2D (because ...):` |
| Plan colours | An entity is coloured YELLOW or GOLD (reserved for the highlight) |
| 3D in a view | A scene planned as 3D has no view region, or the main camera is tilted |
| Upright text | Text inside a 3D view is not a billboard or is rotated |
| 3D parts in their view | A 3D object is drawn outside the view that holds its model |
| Controls top right | A control is given its own position |
| Controls work at the end | A control changes nothing on the final held frame |
| Markers in front | A point is drawn behind a line or curve it sits on |
| Text overlap | animlib's `detectSceneOverlaps` reports overlapping settled text |
| Cut off at the edge | A formula, label, arrow or marker leaves the 16:9 frame |
| Lines through labels | A line or arrow runs through a label or formula |
| Focus frame fit | A yellow focus frame is off-centre, cuts through a glyph, frames only a slice of a formula, or is drawn thick; the message gives the measured position and size |
| Too much text | More than twelve formulas, definition lines and labels are visible at once |
| Too heavy | More than 300 separate animations, which the browser player cannot build in time |

Check failures are logged to `out/scenegen-check-failures.log`.

## Prompt size

The wrapper also trims the previous scene's frame in each scene prompt: bulk geometry
(mesh vertices, triangles, normals, long point lists) is replaced by its size. The
model fetches earlier objects with `s.previous.get(id)` and never needs those numbers,
and they were often most of the prompt. Validation still uses the full frame.

## Tools

```
bun ../scenegen/backend/rescene.ts <videoId> <sceneIndex> [--apply]   # regenerate one scene, keep narration
bun ../scenegen/backend/rescene.ts <videoId> 3 --pending 2=<file> --apply   # change neighbouring scenes together
bun ../scenegen/backend/scan.ts <videoId>                              # run the checks over a saved video
```

`rescene` uses the current prompts, so it is the quick way to try a prompt edit.
`--apply` replaces the scene in the saved video once every later scene still compiles
on top of it; the previous source is kept under `out/visualization-tests/`.
