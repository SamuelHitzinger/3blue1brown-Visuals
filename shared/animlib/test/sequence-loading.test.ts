import { afterEach, expect, it, vi } from 'vitest';
import { SceneSequence } from '../src/sequence.js';
import { SourceCompiler } from '../src/compiler-client.js';
import { evaluateScene } from '../src/timeline.js';
import type { CompiledScene } from '../src/types.js';

const source = `export default scene({audio:'prefix'}, s => {
  const scale = s.slider('scale', {reactive:true, min:1, max:3, default:1});
  const dot = s.circle('dot');
  s.bind(dot, [s.time, scale], (t, scale) => ({position:[t * scale, 0]}));
  s.keep(dot); s.wait(5);
});`;
const suffix = { id: 'suffix', source: "export default scene({audio:'suffix'}, s => s.wait(1));" };
const position = (scene: CompiledScene, time: number) => evaluateScene(scene, time).elements.find(e => e.id === 'dot')!.position[0];
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function gate() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => vi.restoreAllMocks());

it('samples during a suffix append that was queued behind an earlier playback sample', async () => {
  const preparation = gate(), entered = gate(), samplingEntered = gate(), releaseSample = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let initialSample: Promise<CompiledScene> | undefined, nextSample: Promise<CompiledScene> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    const update = SourceCompiler.prototype.update;
    vi.spyOn(SourceCompiler.prototype, 'update').mockImplementationOnce(async function (this: SourceCompiler, ...args) {
      const updates = await update.apply(this, args);
      samplingEntered.resolve(); await releaseSample.promise;
      return updates;
    });
    initialSample = sequence.sample(0, 1);
    await samplingEntered.promise;
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    releaseSample.resolve(); await initialSample; await entered.promise;
    let sampled: CompiledScene | undefined;
    nextSample = sequence.sample(0, 2).then(scene => { sampled = scene; return scene; });
    await vi.waitFor(() => expect(sampled).toBeDefined());
    expect(position(await nextSample, 2)).toBe(2);
    expect(sequence.sources.map(s => s.id)).toEqual(['prefix']);
  } finally { preparation.resolve(); releaseSample.resolve(); await initialSample; await append; await nextSample; sequence.dispose(); }
});

it.each([false, true])('samples the committed prefix while suffix preparation is pending (sample immediately: %s)', async immediate => {
  const preparation = gate(), entered = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let sampling: Promise<CompiledScene> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    const prefix = sequence.compiled[0];
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    if (!immediate) await entered.promise;
    let sampled: CompiledScene | undefined;
    sampling = sequence.sample(0, 2).then(scene => { sampled = scene; return scene; });
    await entered.promise;
    await vi.waitFor(() => expect(sampled).toBeDefined());
    expect(position(await sampling, 2)).toBe(2);
    expect(position(await sequence.sample(0, 3), 3)).toBe(3);
    expect(sequence.sources.map(s => s.id)).toEqual(['prefix']);
    expect(sequence.compiled).toEqual([prefix]);
    expect(position(prefix, 0)).toBe(0);
    expect(sequence.revision).toBe(1);
    preparation.resolve();
    expect((await append).ok).toBe(true);
    expect(sequence.compiled[0]).toBe(prefix);
    expect(sequence.frame(1, 0).elements.find(e => e.id === 'dot')!.position[0]).toBe(5);
  } finally { preparation.resolve(); await append; await sampling; sequence.dispose(); }
});

it.each(['replacement', 'control'] as const)('keeps samples after a queued %s behind its transactional update', async change => {
  const preparation = gate(), entered = gate(), changing = gate(), changeEntered = gate();
  let suffixPreparations = 0;
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio !== 'suffix') return;
    if (++suffixPreparations === 1) { entered.resolve(); await preparation.promise; }
    else { changeEntered.resolve(); await changing.promise; }
  } });
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let mutation: Promise<unknown> | undefined;
  let sampling: Promise<CompiledScene> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    mutation = change === 'replacement'
      ? sequence.submit({ type: 'replace', scene: 'prefix', source: source.replace('t * scale', 't * scale * 2') })
      : sequence.setControl('prefix', 'scale', 2);
    let sampled: CompiledScene | undefined;
    sampling = sequence.sample(0, 2).then(scene => { sampled = scene; return scene; });
    await tick();
    expect(sampled).toBeUndefined();
    preparation.resolve();
    expect((await append).ok).toBe(true);
    await changeEntered.promise;
    expect(sampled).toBeUndefined();
    expect(position(sequence.compiled[0], 0)).toBe(0);
    expect(sequence.compiled[0].controls[0].value).toBe(1);
    changing.resolve(); await mutation;
    expect(position(await sampling, 2)).toBe(4);
  } finally { preparation.resolve(); changing.resolve(); await append; await mutation; await sampling; sequence.dispose(); }
});

it('recovers a lost callback runtime on the normal queue after the pending append settles', async () => {
  const preparation = gate(), entered = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  const compiling = vi.spyOn(SourceCompiler.prototype, 'compile');
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let sampling: Promise<CompiledScene> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    const prefix = sequence.compiled[0];
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    const compiler = (sequence as unknown as { compiler: { failWorker(error: Error): void } }).compiler;
    compiler.failWorker(new Error('simulated worker loss'));
    let sampled: CompiledScene | undefined;
    sampling = sequence.sample(0, 2).then(scene => { sampled = scene; return scene; });
    await tick();
    expect(sampled).toBeUndefined();
    expect(compiling).toHaveBeenCalledTimes(2);
    preparation.resolve();
    expect((await append).ok).toBe(true);
    expect(position(await sampling, 2)).toBe(2);
    expect(compiling).toHaveBeenCalledTimes(4);
    expect(sequence.compiled[0]).not.toBe(prefix);
  } finally { preparation.resolve(); await append; await sampling; sequence.dispose(); }
});

it('keeps sampled prefix state playable after a suffix preparation failure', async () => {
  const preparation = gate(), entered = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let sampling: Promise<CompiledScene> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    const prefix = sequence.compiled[0];
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    let sampled: CompiledScene | undefined;
    sampling = sequence.sample(0, 2).then(scene => { sampled = scene; return scene; });
    await vi.waitFor(() => expect(sampled).toBeDefined());
    expect(position(await sampling, 2)).toBe(2);
    preparation.reject(new Error('audio unavailable'));
    expect(await append).toMatchObject({ ok: false, diagnostics: [{ message: 'audio unavailable' }] });
    expect(sequence.compiled).toEqual([prefix]);
    expect(position(await sequence.sample(0, 3), 3)).toBe(3);
    expect(sequence.revision).toBe(1);
  } finally { preparation.resolve(); await append; await sampling; sequence.dispose(); }
});

it.each(['replacement', 'control'] as const)('resamples if a %s commits before a bypassed sample returns', async change => {
  const preparation = gate(), entered = gate(), samplingEntered = gate(), releaseSample = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let sampling: Promise<CompiledScene> | undefined;
  let mutation: Promise<unknown> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    const update = SourceCompiler.prototype.update;
    vi.spyOn(SourceCompiler.prototype, 'update').mockImplementationOnce(async function (this: SourceCompiler, ...args) {
      const updates = await update.apply(this, args);
      samplingEntered.resolve(); await releaseSample.promise;
      return updates;
    });
    sampling = sequence.sample(0, 2);
    await samplingEntered.promise;
    mutation = change === 'replacement'
      ? sequence.submit({ type: 'replace', scene: 'prefix', source: source.replace('t * scale', 't * scale * 2') })
      : sequence.setControl('prefix', 'scale', 2);
    preparation.resolve();
    expect((await append).ok).toBe(true);
    await mutation;
    releaseSample.resolve();
    expect(position(await sampling, 2)).toBe(4);
  } finally { preparation.resolve(); releaseSample.resolve(); await append; await mutation; await sampling; sequence.dispose(); }
});

it('queues recovery if the runtime is lost during a bypassed sample', async () => {
  const preparation = gate(), entered = gate(), samplingEntered = gate(), loseRuntime = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  const compiling = vi.spyOn(SourceCompiler.prototype, 'compile');
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let sampling: Promise<{ scene: CompiledScene } | { error: unknown }> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    vi.spyOn(SourceCompiler.prototype, 'update').mockImplementationOnce(async function (this: SourceCompiler) {
      samplingEntered.resolve(); await loseRuntime.promise;
      (this as unknown as { failWorker(error: Error): void }).failWorker(new Error('simulated worker loss'));
      throw new Error('simulated worker loss');
    });
    let settled = false;
    sampling = sequence.sample(0, 2).then(scene => ({ scene }), error => ({ error })).then(result => { settled = true; return result; });
    await samplingEntered.promise;
    loseRuntime.resolve(); await tick();
    expect(settled).toBe(false);
    expect(compiling).toHaveBeenCalledTimes(2);
    preparation.resolve();
    expect((await append).ok).toBe(true);
    const result = await sampling;
    expect(result).toHaveProperty('scene');
    if ('scene' in result) expect(position(result.scene, 2)).toBe(2);
    expect(compiling).toHaveBeenCalledTimes(4);
  } finally { preparation.resolve(); loseRuntime.resolve(); await append; await sampling; sequence.dispose(); }
});

it('rejects a bypassed sample after disposal without recovery or a suffix commit', async () => {
  const preparation = gate(), entered = gate(), samplingEntered = gate(), releaseSample = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  const compiling = vi.spyOn(SourceCompiler.prototype, 'compile');
  let append: ReturnType<SceneSequence['submit']> | undefined;
  let rejected: Promise<unknown> | undefined;
  try {
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source }] })).ok).toBe(true);
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    const update = SourceCompiler.prototype.update;
    vi.spyOn(SourceCompiler.prototype, 'update').mockImplementationOnce(async function (this: SourceCompiler, ...args) {
      const updates = await update.apply(this, args);
      samplingEntered.resolve(); await releaseSample.promise;
      return updates;
    });
    rejected = expect(sequence.sample(0, 2)).rejects.toThrow('Scene sequence is disposed');
    await samplingEntered.promise;
    sequence.dispose(); preparation.resolve(); releaseSample.resolve();
    await rejected;
    expect(await append).toMatchObject({ ok: false });
    expect(sequence.sources.map(s => s.id)).toEqual(['prefix']);
    expect(compiling).toHaveBeenCalledTimes(2);
  } finally { preparation.resolve(); releaseSample.resolve(); await append; await rejected; sequence.dispose(); }
});

it('propagates a callback error during append without reconstructing the live runtime', async () => {
  const preparation = gate(), entered = gate();
  const sequence = new SceneSequence({ prepare: async scenes => {
    if (scenes[0].options.audio === 'suffix') { entered.resolve(); await preparation.promise; }
  } });
  const compiling = vi.spyOn(SourceCompiler.prototype, 'compile');
  let append: ReturnType<SceneSequence['submit']> | undefined;
  try {
    const failingSource = source.replace('(t, scale) => ({position:[t * scale, 0]})', '(t, scale) => { if (t === 2) throw new Error("bad sample"); return {position:[t * scale, 0]}; }');
    expect((await sequence.submit({ type: 'load', scenes: [{ id: 'prefix', source: failingSource }] })).ok).toBe(true);
    append = sequence.submit({ type: 'insert', after: 'prefix', scenes: [suffix] });
    await entered.promise;
    await expect(sequence.sample(0, 2)).rejects.toThrow('bad sample');
    expect(position(await sequence.sample(0, 3), 3)).toBe(3);
    expect(compiling).toHaveBeenCalledTimes(2);
  } finally { preparation.resolve(); await append; sequence.dispose(); }
});
