import { expect, test } from "bun:test";
import { extractScenePlanningGuidance } from "../src/storyline-prompt.js";

for (const [name, newline] of [["LF", "\n"], ["CRLF", "\r\n"]] as const) {
  test(`inserted scene planning preserves visual and viewing guidance with ${name} line endings`, () => {
    const shared = [
      "## Plan feasible visuals",
      "",
      "Use feasible geometry.",
      "",
      "## Viewing mode",
      "",
      "All new app videos use `interactive`.",
    ].join(newline);
    const guidance = [
      "# Storyline agent guidance",
      "Budget the whole lesson at 125–150 words/minute.",
      "",
      shared,
      "",
      "## 3Blue1Brown reference lessons",
      "Reference material excluded from inserted scenes.",
    ].join(newline);

    expect(extractScenePlanningGuidance(guidance)).toBe(shared);
  });
}

test("inserted scene planning fails closed when a required section boundary is missing", () => {
  for (const guidance of [
    "## Viewing mode\nInteractive.\n## 3Blue1Brown reference lessons\n",
    "## Plan feasible visuals\nUse geometry.\n",
  ]) {
    expect(() => extractScenePlanningGuidance(guidance)).toThrow("Missing shared visual planning guidance");
  }
});
