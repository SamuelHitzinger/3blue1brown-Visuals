// Native source compiler, carry coordinator and renderer from each benchmark revision.
const baseline = new URLSearchParams(location.search).get('variant') === 'baseline';
try {
const [{ SceneSequence }, { CanvasRenderer }] = await Promise.all(baseline
  ? [import('@baseline/sequence.js'), import('@baseline/renderer.js')]
  : [import('@improved/sequence.js'), import('@improved/renderer.js')]);
const sequence = new SceneSequence();
const renderer = new CanvasRenderer(document.querySelector('canvas')!, undefined, sequence.assetGeometry);
let renderError: Error | undefined;
let lastIndex = -1, lastTime = -1, lastFrame: any, invalidated = true;
renderer.onError = (error: Error) => { renderError = error; };
renderer.onInvalidate = () => { invalidated = true; };
const api = {
  async load(scenes: any[]) {
    const result = await sequence.submit({ type: 'load', scenes });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    await renderer.prepare(sequence.compiled);
    return { durations: sequence.compiled.map((scene: any) => scene.duration), backend: renderer.backend };
  },
  async draw(index: number, time: number) {
    if (renderError) throw renderError;
    if (index === lastIndex && time === lastTime && !invalidated) return;
    if (index !== lastIndex || time !== lastTime) lastFrame = await sequence.evaluate(index, time);
    lastIndex = index; lastTime = time; invalidated = false;
    renderer.render(lastFrame, sequence.compiled[index].options);
    if (renderError) throw renderError;
  },
};
(window as any).comparisonArm = api;
window.parent.postMessage({ type: 'comparison-arm-ready', variant: baseline ? 'baseline' : 'candidate' }, location.origin);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  (window as any).comparisonError = message;
  window.parent.postMessage({ type: 'comparison-arm-error', message }, location.origin);
}
