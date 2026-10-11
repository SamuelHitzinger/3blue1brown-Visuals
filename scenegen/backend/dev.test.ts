import { expect, test } from "bun:test";
import { loadPrompt } from "../../backend/src/agents/prompts.js";
import { CheckedRunner } from "./dev.ts";

test("a scene with a formula the player cannot render is rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (tex: string) => `export default scene({ mode: "2d", end: "hold" }, s => { s.latex("f", { tex: ${JSON.stringify(tex)}, position: [0, 0] }); s.wait(1); });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene("\\boldsymbol{\\mu}=1"), scene("\\vec{\\mu}=1")]) {
      results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    }
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "2D (because it is a formula): show it" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("Invalid LaTeX");
  expect(results[0]).toContain("\\mathbf or \\vec");
  expect(results[1]).toBe("ok");
});

test("a 3D part created outside its model's view is rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (late: boolean) => `export default scene({ mode: "2d", end: "hold" }, s => {
    let view;
    s.view("model", { rect: [0, 0, 0.6, 1], orbit: true, camera: { target: [0, 0, 0], height: 6, distance: 10 } }, v => {
      view = v;
      v.sphere("atom", { radius: 0.5, position: [0, 0, 0], fill: Color.RED });
      ${late ? "" : 'v.sphere("corner", { radius: 0.1, position: [1, 1, 1], fill: Color.GREY });'}
    });
    ${late ? 's.sphere("corner", { radius: 0.1, position: [1, 1, 1], fill: Color.GREY });' : ""}
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene(true), scene(false)]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "3D: a model" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("corner");
  expect(results[1]).toBe("ok");
});

test("a control with its own position is rejected, so controls stay top right", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (options: string) => `export default scene({ mode: "2d", end: "hold" }, s => {
    const k = s.slider("factor", { label: "Factor", default: 1, min: 0, max: 2, step: 0.1${options} });
    s.circle("dot", { radius: 0.2 * k + 0.1, position: [0, 0] });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene(", position: [0.05, 0.8]"), scene("")]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "2D (because it is a plane): a dot" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("top right");
  expect(results[1]).toBe("ok");
});

test("overlapping formulas are rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (gap: number) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.latex("a", { tex: "A=\\\\begin{bmatrix}1&1\\\\\\\\0&1\\\\end{bmatrix}", fontSize: 0.46, position: [3, 1] });
    s.latex("b", { tex: "B=\\\\begin{bmatrix}2&0\\\\\\\\0&1\\\\end{bmatrix}", fontSize: 0.46, position: [3, ${1 - gap}] });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene(0.9), scene(1.6)]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "2D (because it is a plane): two matrices" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("Text overlaps: a and b");
  expect(results[1]).toBe("ok");
});

test("a control that does nothing on the final frame is rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (radius: string) => `export default scene({ mode: "2d", end: "hold" }, s => {
    const k = s.slider("size", { label: "Size", default: 1, min: 0, max: 2, step: 0.1 });
    s.circle("dot", { radius: ${radius}, position: [0, 0] });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene("0.3"), scene("0.2 * k + 0.1")]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "2D (because it is a plane): a dot" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("without effect at the end: size");
  expect(results[1]).toBe("ok");
});

test("a dot drawn behind the line it sits on is rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (z: number) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.circle("dot", { radius: 0.12, position: [0, 0, ${z}], fill: Color.GOLD });
    s.line("curve", { points: [[0, -2], [0, 2]], stroke: Color.GREEN, strokeWidth: 0.06 });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene(0), scene(0.05)]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({})}`, validate: async () => {} });
  expect(results[0]).toContain("dot (under curve)");
  expect(results[1]).toBe("ok");
});

test("3D on the main scene and flat text in a 3D view are rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const main3d = `export default scene({ mode: "3d", orbit: true, end: "hold" }, s => { s.sphere("ball", { radius: 0.5, position: [0, 0, 0], fill: Color.RED }); s.wait(1); });`;
  const inView = (billboard: boolean) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.view("model", { rect: [0, 0, 0.6, 1], orbit: true, camera: { target: [0, 0, 0], height: 6, distance: 12, yaw: 0.6, pitch: 0.35 } }, v => {
      v.sphere("ball", { radius: 0.5, position: [0, 0, 0], fill: Color.RED });
      v.text("label", { text: "A", position: [1, 0, 0]${billboard ? ", billboard: true" : ""} });
    });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [main3d, inView(false), inView(true)]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({ planning: { current: { visualDescription: "3D: a ball" } } })}`, validate: async () => {} });
  expect(results[0]).toContain("Keep the main scene flat");
  expect(results[1]).toContain("billboard: true");
  expect(results[2]).toBe("ok");
});

test("the previous frame's bulk geometry is left out of the scene prompt", async () => {
  const visualization = await loadPrompt("scene-craft");
  const vertices = Array.from({ length: 500 }, (_, i) => [i, 0, 0]);
  const packet = { previousFrame: { elements: [{ id: "bowl", geometry: { kind: "mesh", vertices } }, { id: "dot", geometry: { kind: "circle", radius: 0.2 } }] }, planning: {} };
  let sent = "";
  await new CheckedRunner({ run: async task => { sent = task.prompt; return ""; } })
    .run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify(packet)}`, validate: async () => {} });
  expect(sent.length).toBeLessThan(400);
  expect(sent).toContain("[500 entries omitted]");
  expect(sent).toContain('"radius":0.2');
});

test("an arrow through a label, or a label cut off at the edge, is rejected", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (labelAt: string) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.arrow("flow", { points: [[-2, 0], [2, 0]], stroke: Color.BLUE, strokeWidth: 0.05 });
    s.latex("value", { tex: "=16", fontSize: 0.5, position: ${labelAt} });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene("[0, 0]"), scene("[7, 1]"), scene("[0, 0.6]"), scene("[2.5, 0]")]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({})}`, validate: async () => {} });
  expect(results[0]).toContain("flow through value");
  expect(results[1]).toContain("Cut off at the edge");
  expect(results[2]).toBe("ok");
  expect(results[3]).toContain("flow into value"); // the arrowhead would sit on the label
});

test("a focus frame that does not hug its formula is rejected with the measured size", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (frame: string) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.latex("formula", { tex: "a^2+2ab", fontSize: 0.5, position: [3, 1, 0.1] });
    s.rectangle("focus", { ${frame}, fill: Color.NONE, stroke: Color.YELLOW, strokeWidth: 0.03 });
    s.wait(1);
  });`;
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [scene("width: 2.1, height: 0.8, position: [3, 0.6, 0.15]"), scene("width: 2.1, height: 0.8, position: [3, 1, 0.15]")]) {
      results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    }
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({})}`, validate: async () => {} });
  expect(results[0]).toContain("to frame formula, use position [3.0");
  expect(results[1]).toBe("ok");
});

test("a focus frame must hold a whole element or a whole named part, drawn thin", async () => {
  const visualization = await loadPrompt("scene-craft");
  const scene = (tex: string, frame: string) => `export default scene({ mode: "2d", end: "hold" }, s => {
    s.latex("formula", { tex: ${JSON.stringify(tex)}, fontSize: 0.5, position: [3, 1, 0.1] });
    s.rectangle("focus", { ${frame}, fill: Color.NONE, stroke: Color.YELLOW });
    s.wait(1);
  });`;
  const plain = "A=mn", parts = "\\animpart{lhs}{A}\\animpart{eq}{=}\\animpart{rhs}{mn}";
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [
      scene(plain, "width: 1.1, height: 0.7, position: [3.45, 1, 0.15], strokeWidth: 0.02"),   // frames "mn" and cuts "="
      scene(plain, "width: 2.05, height: 0.66, position: [3, 1.02, 0.15], strokeWidth: 0.06"),  // right place, too thick
      scene(plain, "width: 2.05, height: 0.66, position: [3, 1.02, 0.15], strokeWidth: 0.02"),  // whole formula
    ]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: visualization, prompt: `Generate this scene:\n${JSON.stringify({})}`, validate: async () => {} });
  expect(results[0]).toMatch(/cuts through formula|slice of formula/);
  expect(results[0]).toContain("to frame formula, use position [3");
  expect(results[1]).toContain("too thick");
  expect(results[2]).toBe("ok");
  expect(parts).toContain("animpart");
});

test("a lesson plan may not use yellow or gold as an entity colour", async () => {
  const { PLANNING_CONTRACT } = await import("../../backend/src/agents/planning.js");
  const plan = (color: string) => JSON.stringify({ plan: { entities: [{ id: "sun", color }], scenes: [{ id: "beat-1", visualDescription: "3D: the sun" }] } });
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [plan("GOLD"), plan("ORANGE")]) results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    return "";
  } });
  await runner.run({ systemPrompt: PLANNING_CONTRACT, prompt: "lesson", validate: async () => {} });
  expect(results[0]).toContain("sun");
  expect(results[1]).toBe("ok");
});

test("a lesson plan must mark every scene as 3D or 2D with a reason", async () => {
  const { PLANNING_CONTRACT } = await import("../../backend/src/agents/planning.js");
  const plan = (description: string) => JSON.stringify({ plan: { scenes: [{ id: "beat-1", visualDescription: description }] } });
  const results: string[] = [];
  const runner = new CheckedRunner({ run: async task => {
    for (const output of [plan("Show the molecule"), plan("3D: show the molecule"), plan("2D (because it is a graph): plot energy")]) {
      results.push(await task.validate!(output).then(() => "ok", error => (error as Error).message));
    }
    return "";
  } });
  await runner.run({ systemPrompt: PLANNING_CONTRACT, prompt: "lesson", validate: async () => {} });
  expect(results[0]).toContain("beat-1");
  expect(results.slice(1)).toEqual(["ok", "ok"]);
});

test("tasks without validation, such as reviews, pass through untouched", async () => {
  const seen: unknown[] = [];
  const task = { systemPrompt: "review this lesson", prompt: "lesson" };
  await new CheckedRunner({ run: async received => { seen.push(received); return "ok"; } }).run(task);
  expect(seen[0]).toBe(task);
});

test("the scenegen rules are added to the planning and scene prompts", async () => {
  const { PLANNING_CONTRACT } = await import("../../backend/src/agents/planning.js");
  const { scenegenPrompt } = await import("./dev.ts");
  const craft = await loadPrompt("scene-craft");
  const seen: string[] = [];
  const runner = new CheckedRunner({ run: async task => { seen.push(task.systemPrompt); return ""; } });
  await runner.run({ systemPrompt: `timing\n\n${craft}\n\nreference`, prompt: "Generate this scene:\n{}", validate: async () => {} });
  await runner.run({ systemPrompt: `guidance\n\n${PLANNING_CONTRACT}`, prompt: "lesson", validate: async () => {} });
  expect(seen[0]).toBe(`timing\n\n${craft}\n\n${await scenegenPrompt("visualization")}\n\nreference`);
  expect(seen[1]).toBe(`guidance\n\n${PLANNING_CONTRACT}\n\n${await scenegenPrompt("planning")}`);
});
