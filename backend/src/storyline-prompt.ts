import { readFile } from "node:fs/promises";
import { loadPrompt } from "./agents/prompts.js";

/** Pass these messages to the storyline writer; its Markdown output goes to NarrationService.submit(). */
export async function buildStorylineMessages(material: string, sceneRequest = false) {
  const [guidance, capabilities, viewingMode] = await Promise.all([
    loadPrompt(sceneRequest ? "scene-request-guidance" : "guidance"),
    readFile(new URL("../../shared/animlib/docs/capabilities.md", import.meta.url), "utf8"),
    loadPrompt("viewing-mode"),
  ]);
  return [
    { role: "system" as const, content: `${guidance}\n\n${viewingMode}\n\n${capabilities}` },
    { role: "user" as const, content: material },
  ];
}
