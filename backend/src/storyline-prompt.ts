import { loadPrompt } from "./agents/prompts.js";

export function extractScenePlanningGuidance(guidance: string): string {
  const sharedPlanning = /^## Plan feasible visuals\r?\n[\s\S]*?(?=^## 3Blue1Brown reference lessons)/m.exec(guidance)?.[0];
  if (!sharedPlanning) throw new Error('Missing shared visual planning guidance for inserted scenes.');
  return sharedPlanning.trim();
}

/** Pass these messages to the storyline writer; its Markdown output goes to NarrationService.submit(). */
export async function buildStorylineMessages(material: string, sceneRequest = false) {
  const guidance = await loadPrompt("guidance");
  let content = guidance;
  if (sceneRequest) {
    content = `${await loadPrompt("scene-request-guidance")}\n\n${extractScenePlanningGuidance(guidance)}`;
  }
  return [
    { role: "system" as const, content },
    { role: "user" as const, content: material },
  ];
}
