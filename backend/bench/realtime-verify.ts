/** Offline verification of the unchanged saved model matrix. No model calls or repairs. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSource, evaluateScene } from 'animlib/core';
import type { CompiledScene, ElementState, Frame } from 'animlib/core';
import { lowerOperations } from './realtime-probe/lower.js';
import { buildPrompt, cases } from './realtime-probe/prompts.js';
import type { ProbeCase } from './realtime-probe/prompts.js';
import type { Format } from './realtime-probe/metrics.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2));
const near = (a: unknown, b: unknown): boolean => typeof a === 'number' && typeof b === 'number'
  ? Number.isFinite(a) && Math.abs(a - b) < 1e-6
  : Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, index) => near(value, b[index]))
    : a === b;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const vec = (value: readonly number[]) => value.length === 2 ? [...value, 0] : [...value];
type Check = { name: string; passed: boolean; detail?: string };
type Sample = { time: number; frame: Frame };

export function verifySemantics(which: ProbeCase, action: 'create' | 'edit', scene: CompiledScene,
  samples: Sample[], previous?: Frame): Check[] {
  const checks: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) => checks.push({ name, passed, ...(detail ? { detail } : {}) });
  const at = (time: number) => samples.find(sample => near(sample.time, time))?.frame ?? evaluateScene(scene, time);
  const get = (id: string, time: number) => at(time).elements.find(element => element.id === id);
  const endTime = action === 'create' ? 2 : 1, activeEnd = endTime / 2;
  const end = evaluateScene(scene, scene.duration);
  check('requested duration', near(scene.duration, endTime), `Expected ${endTime}s; observed ${scene.duration}s`);
  check('requested mode', scene.options.mode === cases[which].mode);
  check('hold ending and no orbit', scene.options.end === 'hold' && scene.options.orbit === false);
  const expectedIds: string[] = cases[which].world.map(element => element.id);
  if (action === 'edit' && which !== 'cube') expectedIds.push(which === 'curve' ? 'tangent' : 'result');
  check('complete required object IDs', expectedIds.every(id => end.elements.some(element => element.id === id)));
  check('required objects remain persistent', expectedIds.every(id => end.elements.find(element => element.id === id)?.persistent === true));
  const state = (element: ElementState | undefined) => element && {
    geometry: element.geometry, position: element.position, rotation: element.rotation,
    scale: element.scale, opacity: element.opacity, fill: element.fill, stroke: element.stroke,
    strokeWidth: element.strokeWidth, strokeStart: element.strokeStart, strokeEnd: element.strokeEnd,
  };
  for (const sample of samples.filter(sample => sample.time >= activeEnd)) {
    check(`stable hold at ${sample.time}s`, expectedIds.every(id =>
      same(state(sample.frame.elements.find(element => element.id === id)), state(get(id, activeEnd)))));
  }
  const timedChange = (id: string, key: string, duration: number) => {
    const tracks = scene.tracks.filter(track => track.action.ids.includes(id) && Object.hasOwn(track.action.properties ?? {}, key));
    check(`${id}.${key} scheduled over ${duration}s`, tracks.some(track => near(track.start, 0) && near(track.duration, duration)));
  };
  const label = (id: string, text: string, position?: number[], size?: number) => {
    const element = get(id, endTime);
    check(`${id} text`, element?.geometry.kind === 'text' && element.geometry.text === text);
    if (position) check(`${id} position`, near(element?.position, vec(position)));
    if (size !== undefined) check(`${id} font size`, near(element?.geometry.fontSize, size));
  };
  const line = (id: string, kind: 'arrow' | 'path' | 'line', points: readonly (readonly number[])[], color?: string) => {
    const element = get(id, endTime);
    check(`${id} geometry`, element?.geometry.kind === kind && near(element.geometry.points?.map(vec), points.map(vec)));
    if (color) check(`${id} color`, element?.stroke === color);
  };
  if (action === 'create') {
    for (const id of expectedIds) check(`${id} present at setup`, get(id, 0) !== undefined);
    if (which === 'cube') {
      const cube = get('cube', 0), vertices = cube?.geometry.vertices;
      check('cube dimensions and solid geometry', cube?.geometry.kind === 'mesh' && !!vertices?.length &&
        [0, 1, 2].every(axis => near(Math.max(...vertices!.map(v => v[axis])) - Math.min(...vertices!.map(v => v[axis])), 1.5)) &&
        (cube?.geometry.triangles?.length ?? 0) >= 12);
      check('cube centered, blue and unrotated initially', near(cube?.position, [0, 0, 0]) && near(cube?.rotation, [0, 0, 0]) && cube?.fill === 'BLUE');
      label('cube-label', 'Rotation preserves shape');
      check('cube label above the object', (get('cube-label', 0)?.position[1] ?? -Infinity) > .75);
      timedChange('cube', 'rotation', 1);
      check('cube final rotation', near(get('cube', 1)?.rotation, [0, .8, 0]));
      for (const time of [.25, .5, .75]) {
        const moving = get('cube', time);
        check(`cube has interior rotation at ${time}s`, !!moving && moving.rotation[1] > 0 && moving.rotation[1] < .8 &&
          near(moving.rotation[0], 0) && near(moving.rotation[2], 0));
      }
      check('cube shape and location retained through rotation', samples.every(sample => {
        const element = sample.frame.elements.find(element => element.id === 'cube');
        return !!element && same(element.geometry, cube?.geometry) && near(element.scale, 1) && near(element.position, [0, 0, 0]);
      }));
    } else if (which === 'curve') {
      line('x-axis', 'arrow', [[-2.5, 0], [2.5, 0]]);
      line('y-axis', 'arrow', [[0, -.5], [0, 2.5]]);
      line('curve', 'path', [[-2, 2], [-1.5, 1.125], [-1, .5], [-.5, .125], [0, 0], [.5, .125], [1, .5], [1.5, 1.125], [2, 2]], 'BLUE');
      const marker = get('marker', 2);
      check('yellow marker geometry and location', marker?.geometry.kind === 'circle' && near(marker.geometry.radius, .1) && near(marker.position, [1, .5, 0]) && marker.fill === 'YELLOW');
      label('curve-label', 'y = x²/2', [-1, 2.6], .28);
      const visibility = (element: ElementState | undefined) => element ? element.opacity * (element.strokeEnd ?? 1) : 0;
      check('curve hidden initially', near(visibility(get('curve', 0)), 0));
      check('curve fully revealed by 1s', near(visibility(get('curve', 1)), 1));
      for (const time of [.25, .5, .75]) check(`curve partial reveal at ${time}s`, visibility(get('curve', time)) > 0 && visibility(get('curve', time)) < 1);
      check('curve reveal scheduled over 1s', scene.tracks.some(track => track.action.ids.includes('curve') &&
        near(track.start, 0) && near(track.duration, 1) && ['opacity', 'strokeEnd'].some(key => Object.hasOwn(track.action.properties ?? {}, key))));
    } else {
      for (const [id, x, text] of [['input', -3, 'Input'], ['process', 0, 'Process'], ['output', 3, 'Output']] as const) {
        const box = get(id, 0);
        check(`${id} initial rectangle`, box?.geometry.kind === 'rectangle' && near(box.geometry.width, 2) && near(box.geometry.height, 1) &&
          near(box.position, [x, 0, 0]) && box.stroke === 'BLUE' && box.fill === 'none');
        label(`${id}-label`, text, [x, 0], .3);
      }
      line('left-link', 'arrow', [[-2, 0], [-1, 0]], 'WHITE');
      line('right-link', 'arrow', [[1, 0], [2, 0]], 'WHITE');
      timedChange('process', 'stroke', 1);
      check('process highlighted TEAL', get('process', 1)?.stroke === 'TEAL');
      check('highlight is intermediate at 0.5s', !same(get('process', .5)?.stroke, get('process', 0)?.stroke) && !same(get('process', .5)?.stroke, get('process', 1)?.stroke));
    }
  } else if (previous) {
    const old = previous.elements.filter(element => element.persistent);
    check('existing objects inherited without recreation/removal', old.every(element => scene.initial.some(initial => initial.id === element.id)) &&
      !scene.lifecycle.some(event => event.type !== 'keep' && event.ids.some(id => old.some(element => element.id === id))));
    const target = which === 'cube' ? 'cube' : which === 'curve' ? 'marker' : 'output';
    for (const element of old) {
      check(`${element.id} starts from actual create state`, same(state(get(element.id, 0)), state(element)));
      if (element.id !== target) check(`${element.id} unchanged throughout edit`, samples.every(sample =>
        same(state(sample.frame.elements.find(current => current.id === element.id)), state(element))));
    }
    const prior = old.find(element => element.id === target);
    check('target geometry and orientation retained', samples.every(sample => {
      const element = sample.frame.elements.find(current => current.id === target);
      return !!element && same(element.geometry, prior?.geometry) && same(element.rotation, prior?.rotation) && near(element.scale, prior?.scale);
    }));
    if (which === 'cube' || which === 'curve') {
      const destination = which === 'cube' ? [1, 0, 0] : [1.5, 1.125, 0];
      timedChange(target, 'position', .5);
      check('target destination', near(get(target, .5)?.position, destination));
      check('target moved at interior time', !same(get(target, .25)?.position, prior?.position) && !same(get(target, .25)?.position, destination));
      if (which === 'cube') {
        timedChange('cube', 'fill', .5);
        check('cube TEAL at movement endpoint', get('cube', .5)?.fill === 'TEAL');
        check('cube color also changes at interior time', !same(get('cube', .25)?.fill, prior?.fill) && get('cube', .25)?.fill !== 'TEAL');
      } else line('tangent', 'line', [[.75, 0], [2.25, 2.25]], 'TEAL');
    } else {
      timedChange('output', 'stroke', .5);
      check('output highlighted YELLOW', get('output', .5)?.stroke === 'YELLOW');
      check('output color changes at interior time', !same(get('output', .25)?.stroke, prior?.stroke) && get('output', .25)?.stroke !== 'YELLOW');
      label('result', 'Result', [3, -1], .28);
    }
  }
  return checks;
}

export async function main(args = process.argv.slice(2)) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--(input|output|match)=(.+)$/.exec(arg);
    if (!match || flags[match[1]]) throw new Error('Usage: bun backend/bench/realtime-verify.ts [--input=DIR] [--output=NEW_DIR] [--match=GLOB,GLOB] (default: *-02)');
    flags[match[1]] = match[2];
  }
  const input = resolve(flags.input ?? join(repo, 'data/realtime-workshop/model-probes'));
  const output = resolve(flags.output ?? join(repo, 'data/realtime-workshop/verification', new Date().toISOString().replace(/[:.]/g, '-')));
  const patterns = (flags.match ?? '*-02').split(',').map(glob => new RegExp(`^${glob.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`));
  const names = (await readdir(input, { withFileTypes: true })).filter(entry => entry.isDirectory() && patterns.some(pattern => pattern.test(entry.name))).map(entry => entry.name).sort();
  if (!names.length) throw new Error('No saved run directories matched');
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Immutable run: never overwrite prior verification evidence.
  const rows: Record<string, any>[] = [];
  const states = new Map<string, { frame: Frame; sourceHash: string; semanticPassed: boolean }>();
  for (const name of names) {
    const directory = join(output, name);
    await mkdir(directory);
    const row: Record<string, any> = { run: name, providerComplete: false,
      executable: null, semanticCorrect: null, status: 'unverified', checks: [] };
    const started = performance.now();
    try {
      const result = JSON.parse(await readFile(join(input, name, 'result.json'), 'utf8'));
      const which = result.case as ProbeCase | 'external', format = result.format as Format, action = result.action as 'create' | 'edit';
      if ((!Object.hasOwn(cases, which) && which !== 'external') || !['native-js', 'ops'].includes(format) || !['create', 'edit'].includes(action)) throw new Error('Unsupported saved run metadata');
      Object.assign(row, { case: which, format, action });
      const raw = await readFile(join(input, name, 'output.txt'), 'utf8');
      const prompts = JSON.parse(await readFile(join(input, name, 'prompt.json'), 'utf8'));
      row.providerComplete = result.status === 'complete';
      row.providerStatus = result.status;
      row.providerFailure = result.failure;
      row.rawSourceSha256 = hash(raw);
      row.savedSourceHashMatches = row.rawSourceSha256 === result.sourceSha256;
      row.promptMatchesCurrentFixture = which === 'external' ? null : same(prompts, buildPrompt(which, format, action));
      row.providerResponseMs = result.textMetrics.completeOutputMs;
      row.providerElapsedMs = result.elapsedMs;
      row.providerResponseWithin10s = result.completeResponseWithin10s;
      row.providerResponseWithin5sDiagnostic = result.completeResponseWithin5s;
      if (!row.savedSourceHashMatches || row.promptMatchesCurrentFixture === false) throw new Error('Saved source hash or fixture prompt mismatch; semantic expectations cannot be applied');
      if (!row.providerComplete) { row.status = 'provider-failed'; continue; }
      const priorRun = name.replace('-edit-', '-create-');
      const previous = action === 'edit' ? states.get(priorRun) : undefined;
      if (action === 'edit' && !previous) { row.status = 'blocked-by-nonexecutable-create'; continue; }
      if (previous) {
        row.previousSourceSha256 = previous.sourceHash;
        row.previousSemanticPassed = previous.semanticPassed;
        row.previousFrameSha256 = hash(JSON.stringify(previous.frame));
      }
      let source: string;
      try { source = format === 'ops' ? lowerOperations(raw, previous?.frame) : raw; }
      catch (error) { row.executable = false; row.status = 'operation-protocol-failed'; row.error = String(error); continue; }
      row.compiledSourceSha256 = hash(source);
      await writeFile(join(directory, 'source.js'), source);
      let scene: CompiledScene;
      const compileStart = performance.now();
      try { scene = await compileSource(source, { previous: previous?.frame }, { executionLimitMs: 2000 }); }
      catch (error) { row.executable = false; row.status = 'compile-failed'; row.error = String(error); continue; }
      finally { row.offlineCompileMs = performance.now() - compileStart; }
      row.executable = true;
      const requestedDuration = which === 'external' ? scene.duration : action === 'create' ? 2 : 1;
      const times = [...new Set([0, requestedDuration / 8, requestedDuration / 4, requestedDuration * 3 / 8,
        requestedDuration / 2, requestedDuration * 3 / 4, requestedDuration, scene.duration])].sort((a, b) => a - b);
      const samples = times.map(time => ({ time, frame: evaluateScene(scene, time) }));
      row.actualDuration = scene.duration;
      row.checkedTimes = times;
      if (which === 'external') {
        row.checks = [
          { name: 'positive finite duration', passed: Number.isFinite(scene.duration) && scene.duration > 0 },
          { name: 'nonempty evaluated construction', passed: samples.some(sample => sample.frame.elements.length > 0) },
          { name: 'finite evaluated object transforms', passed: samples.every(sample => sample.frame.elements.every(element =>
            [...element.position, ...element.rotation, element.scale, element.opacity].every(Number.isFinite))) },
        ];
        row.frameAssertionsPassed = row.checks.every((check: Check) => check.passed);
        row.status = row.frameAssertionsPassed ? 'external-executable-semantics-unverified' : 'external-frame-assertions-failed';
      } else {
        row.checks = verifySemantics(which, action, scene, samples, previous?.frame);
        row.semanticCorrect = row.checks.every((check: Check) => check.passed);
        row.status = row.semanticCorrect ? 'semantic-checks-passed' : 'semantic-checks-failed';
      }
      const frame = evaluateScene(scene, scene.duration);
      await save(join(directory, 'evaluated-frames.json'), samples);
      await save(join(directory, 'final-frame.json'), frame);
      await save(join(directory, 'render-input.json'), { source, previousFrame: previous?.frame,
        times: times.filter(time => time <= scene.duration), directory: join(directory, 'native-frames') });
      if (action === 'create') states.set(name, { frame, sourceHash: hash(source), semanticPassed: row.semanticCorrect === true });
    } catch (error) { row.status = 'verification-error'; row.error = String(error); }
    finally {
      row.offlineVerificationMs = performance.now() - started;
      await save(join(directory, 'result.json'), row); rows.push(row);
    }
  }
  const summary = { schemaVersion: 1, evidenceKind: 'offline-unmodified-output-semantic-verification', input, output,
    verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    lowererSha256: hash(await readFile(new URL('./realtime-probe/lower.ts', import.meta.url))),
    promptFixtureSha256: hash(await readFile(new URL('./realtime-probe/prompts.ts', import.meta.url))),
    counts: { attempts: rows.length, providerComplete: rows.filter(row => row.providerComplete).length,
      executable: rows.filter(row => row.executable === true).length, executableFailed: rows.filter(row => row.executable === false).length,
      executableUnverified: rows.filter(row => row.executable === null).length,
      semanticPassed: rows.filter(row => row.semanticCorrect === true).length, semanticFailed: rows.filter(row => row.semanticCorrect === false).length,
      semanticUnverified: rows.filter(row => row.semanticCorrect === null).length },
    limitations: [
      'No native render, visual quality, readability, media delivery or browser interaction was verified.',
      'Provider response timing and offline compilation timing are separate; neither is end-to-end input-to-visible readiness.',
      'State checks cover sampled interiors/endpoints and selected fixture obligations, not general semantic correctness.',
      'External lecture/image outputs receive only executable/frame assertions. Scientific/source fidelity is unverified; no hand-coded domain oracle is applied.',
      'Edits compile against the actual corresponding executable create frame, even if it failed semantic checks. No synthetic substitute is used.',
      'Saved edit prompts originally supplied a nominal world, not a freshly serialized actual create frame; this is offline continuity evaluation, not a new closed-loop model run.',
      'Provider failures are retained, not completed from partial text. Edits with nonexecutable creates remain blocked/unverified.',
      'No output cleanup, source repair, retry, model call or manual source replacement was performed.',
    ], rows };
  await save(join(output, 'summary.json'), summary);
  console.log(JSON.stringify({ output, counts: summary.counts, rows: rows.map(row => ({ run: row.run, status: row.status,
    failedChecks: row.checks.filter((check: Check) => !check.passed).map((check: Check) => check.name), error: row.error })) }, null, 2));
}

if (import.meta.main) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
