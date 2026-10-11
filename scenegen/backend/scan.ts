// Run the scenegen render checks over every scene of a saved video.
// Run from backend/:  bun ../scenegen/backend/scan.ts <videoId>
import { Database } from "bun:sqlite";
import { SceneSequence } from "animlib/core";
import { renderProblems } from "./scene-checks.ts";

const videoId = process.argv[2];
const db = new Database(process.env.VIDEO_DB_PATH ?? "data/videos.sqlite", { readonly: true });
const row = db.query("SELECT manifest FROM videos WHERE id = ?").get(videoId) as { manifest: string } | null;
db.close();
if (!row) { console.error("Video not found in the local database."); process.exit(2); }
const scenes = (JSON.parse(row.manifest).scenes as { id: string; source: string }[]).map(scene => ({ id: scene.id, source: scene.source }));
const sequence = new SceneSequence();
try {
  const loaded = await sequence.submit({ type: "load", scenes });
  if (!loaded.ok) { console.error(loaded.diagnostics.map(d => `${d.scene ?? ""}: ${d.message}`).join("\n")); process.exit(1); }
  sequence.compiled.forEach((compiled, i) => {
    const problems = renderProblems(compiled);
    console.log(`${scenes[i].id}: ${problems.length ? "\n  " + problems.join("\n\n").replace(/\n/g, "\n  ") : "ok"}`);
  });
} finally { sequence.dispose(); }
