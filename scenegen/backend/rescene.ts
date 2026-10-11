// Regenerate ONE scene of an existing video with the current
// scenegen/prompts/visualization.md, keeping its narration, audio, captions and
// plan. For iterating on that prompt without waiting for a whole new video.
//
// Run from backend/:
//   bun ../scenegen/backend/rescene.ts <videoId> <sceneIndex>           # write a candidate only
//   bun ../scenegen/backend/rescene.ts <videoId> <sceneIndex> --apply   # also show it in the app
//   bun ../scenegen/backend/rescene.ts <videoId> 3 --pending 2=<candidate.js> --apply   # change 2 and 3 together
//
// --apply replaces that scene's source in the video's saved manifest after checking
// that every later scene still compiles on top of it. The previous source is kept
// next to the candidate so it can be restored with --restore <file>.
import { Database } from "bun:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileSource, evaluateScene, SceneSequence } from "animlib/core";
import { agentConfig } from "../../backend/src/agents/config.js";
import { PiAgentRunner, validationMessage } from "../../backend/src/agents/runtime.js";
import { sceneSource } from "../../backend/src/agents/generator.js";
import { loadPrompt } from "../../backend/src/agents/prompts.js";
import { buildAuthoringReference } from "../../backend/src/agents/authoring-reference.js";
import { scenegenPrompt } from "./dev.ts";
import { validateScenePlan } from "../../backend/src/agents/scene-plan.js";
import { SCENE_AGENT_INSTRUCTIONS } from "../../backend/src/narration/handoff.js";
import { DEAD_CONTROL_HINT, deadControls, renderProblems } from "./scene-checks.ts";

const [videoId, indexArg, ...flags] = process.argv.slice(2);
const index = Number(indexArg);
if (!/^[a-f0-9-]{36}$/.test(videoId ?? "") || !Number.isInteger(index) || index < 0) {
  console.error("Usage: bun ../scenegen/backend/rescene.ts <videoId> <sceneIndex> [--apply | --restore <file>]");
  process.exit(2);
}
const config = agentConfig();
const directory = join(config.dataDir, videoId);
const outDir = new URL(`../../out/visualization-tests/${videoId}/`, import.meta.url);
await mkdir(outDir, { recursive: true });

// --pending <index>=<file> (repeatable): earlier candidates that were written but not
// applied yet, e.g. when two neighbouring scenes must change together.
const pending = new Map<number, string>();
for (let i = 0; i < flags.length; i++) {
  if (flags[i] !== "--pending") continue;
  const [at, file] = (flags[i + 1] ?? "").split(/=(.*)/s);
  pending.set(Number(at), await readFile(file, "utf8"));
}

const input = JSON.parse(await readFile(join(directory, `scene-${index}.input.json`), "utf8"));
const lesson = JSON.parse(await readFile(join(directory, "lesson.json"), "utf8").catch(() => "{}"));
const planned = lesson.plan?.scenes?.[index];

// Start from where the video's CURRENT earlier scenes end (they may have been
// regenerated since the saved input was written).
if (index > 0) {
  const db = new Database(process.env.VIDEO_DB_PATH ?? "data/videos.sqlite", { readonly: true });
  const row = db.query("SELECT manifest FROM videos WHERE id = ?").get(videoId) as { manifest: string } | null;
  db.close();
  const earlier = row ? (JSON.parse(row.manifest).scenes as { id: string; source: string }[]).slice(0, index)
    .map((scene, i) => ({ ...scene, source: pending.get(i) ?? scene.source })) : [];
  if (earlier.length === index) {
    const sequence = new SceneSequence();
    try {
      const loaded = await sequence.submit({ type: "load", scenes: earlier.map(s => ({ id: s.id, source: s.source })) });
      if (loaded.ok) input.previousFrame = sequence.frame(index - 1, sequence.compiled[index - 1].duration);
    } finally { sequence.dispose(); }
  }
}

async function validate(output: string) {
  const compiled = await compileSource(sceneSource(output), { previous: input.previousFrame });
  if (compiled.options.audio !== input.audioAssetId || compiled.options.end !== input.endMode) {
    throw new Error(`Scene must use audio "${input.audioAssetId}" and end mode "${input.endMode}".`);
  }
  const duration = input.scene.durationSec;
  if (Math.abs(compiled.duration - duration) > 1e-6) {
    throw new Error(`The scene must last ${duration} seconds; it currently lasts ${compiled.duration}. Add the remaining time with a final s.wait().`);
  }
  if (planned) validateScenePlan(compiled, evaluateScene(compiled, duration), planned);
  const problems = renderProblems(compiled);
  const dead = await deadControls(sceneSource(output), compiled, input.previousFrame);
  if (dead.length) problems.push(`Controls without effect at the end: ${dead.join(", ")}.\n${DEAD_CONTROL_HINT}`);
  if (problems.length) throw new Error(problems.join("\n\n"));
}

/** Swap the scene into the saved manifest once all later scenes still build on it. */
async function apply(source: string) {
  const db = new Database(process.env.VIDEO_DB_PATH ?? "data/videos.sqlite");
  try {
    const row = db.query("SELECT manifest FROM videos WHERE id = ?").get(videoId) as { manifest: string } | null;
    if (!row) throw new Error("Video not found in the local database.");
    const manifest = JSON.parse(row.manifest);
    if (!manifest.scenes[index]) throw new Error(`The video has no published scene ${index} yet.`);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const [at, replacement] of [...pending, [index, source] as const]) {
      if (!manifest.scenes[at]) throw new Error(`The video has no published scene ${at}.`);
      await writeFile(new URL(`scene-${at}.before-${stamp}.js`, outDir), manifest.scenes[at].source);
      manifest.scenes[at].source = replacement;
    }
    const sequence = new SceneSequence();
    try {
      const result = await sequence.submit({ type: "load", scenes: manifest.scenes.map((s: { id: string; source: string }) => ({ id: s.id, source: s.source })) });
      if (!result.ok) throw new Error(`Not applied: a later scene no longer compiles on top of this one.\n${result.diagnostics.map(d => `${d.scene ?? ""}: ${d.message}`).join("\n")}`);
    } finally { sequence.dispose(); }
    manifest.revision++;
    db.query("UPDATE videos SET manifest = ? WHERE id = ?").run(JSON.stringify(manifest), videoId);
    console.log(`Applied to video ${videoId}, scene(s) ${[...pending.keys(), index].join(", ")}. Reload http://localhost:${process.env.PORT ?? 8080}/watch/${videoId}`);
  } finally { db.close(); }
}

const restore = flags.indexOf("--restore");
if (restore >= 0) {
  await apply(await readFile(flags[restore + 1], "utf8"));
} else {
  const reference = buildAuthoringReference(await readFile(new URL("../../shared/animlib/docs/reference.md", import.meta.url), "utf8"));
  const viewingMode = await loadPrompt("viewing-mode");
  const visualization = await scenegenPrompt("visualization");
  const craft = await loadPrompt("scene-craft");
  const systemPrompt = `${SCENE_AGENT_INSTRUCTIONS.replace("Return animlib SceneSource { id, source }.", "Return only JavaScript with one default-exported scene, without a JSON wrapper.")}\nFor video delivery, end your timeline at exactly durationSec using a final s.wait() as needed. Use validate_output before finishing.\n\n${viewingMode}\n\n${craft}\n\n${visualization}\n\n${reference}`;
  const prompt = `Generate this scene using the authoritative narration packet and lesson plan:\n${JSON.stringify(input)}`;
  console.log(`Regenerating scene ${index} of ${videoId} with the current visualization prompt ...`);
  let source: string;
  try {
    source = sceneSource(await new PiAgentRunner(config).run({ systemPrompt, prompt, validate }));
    await validate(source);
  } catch (error) {
    console.error(`Failed: ${validationMessage(error)}`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new URL(`scene-${index}.${stamp}.js`, outDir);
  await writeFile(file, source);
  console.log(`Candidate written: out/visualization-tests/${videoId}/scene-${index}.${stamp}.js`);
  if (flags.includes("--apply")) await apply(source);
  else console.log("Not applied. Add --apply to show it in the app.");
}
