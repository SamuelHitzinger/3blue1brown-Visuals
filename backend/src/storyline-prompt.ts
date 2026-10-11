import { loadPrompt } from "./agents/prompts.js";

/** Pass these messages to the storyline writer; its Markdown output goes to NarrationService.submit(). */
export async function buildStorylineMessages(material: string, sceneRequest = false) {
  const guidance = await loadPrompt("guidance");
  let content = guidance;
  if (sceneRequest) {
    const sharedPlanning = /^## Plan feasible visuals\n[\s\S]*?(?=^## 3Blue1Brown reference lessons)/m.exec(guidance)?.[0];
    if (!sharedPlanning) throw new Error('Missing shared visual planning guidance for inserted scenes.');
    content = `${await loadPrompt("scene-request-guidance")}\n\n${sharedPlanning.trim()}`;
  }
  return [
    { role: "system" as const, content },
    { role: "user" as const, content: material },
  ];
}
