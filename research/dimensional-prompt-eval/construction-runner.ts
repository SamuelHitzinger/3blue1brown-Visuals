import type { AgentRunner, AgentRunMetrics, AgentTask } from '../../backend/src/agents/runtime.js';

const fields = ['representation', 'majorPartsAndConnections', 'activeRegion',
  'operationAndClearance', 'viewEvidence', 'compileCostRisks'] as const;
const constructionRunners = new WeakSet<AgentRunner>();
export type ConstructionBrief = { schemaVersion: 1 } & Record<typeof fields[number], string>;
export const CONSTRUCTION_BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['schemaVersion', ...fields],
  properties: { schemaVersion: { const: 1 }, ...Object.fromEntries(fields.map(field =>
    [field, { type: 'string', minLength: 1, maxLength: 1024 }])) },
} as const;

/** Deliberately structural: a valid proposal is not evidence of API or visual correctness. */
export function parseConstructionBrief(text: string): ConstructionBrief {
  if (text.length > 8192) throw Error('Construction brief exceeds 8192 characters.');
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Construction brief must be an object.');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || Object.keys(record).length !== fields.length + 1
    || Object.keys(record).some(key => key !== 'schemaVersion' && !fields.includes(key as typeof fields[number]))) {
    throw Error('Construction brief has an unsupported schema or fields.');
  }
  for (const field of fields) {
    const item = record[field];
    if (typeof item !== 'string' || !item.trim() || item.length > 1024) {
      throw Error(`Construction brief ${field} must contain 1–1024 nonblank characters.`);
    }
  }
  return record as ConstructionBrief;
}

function uniqueIndex(text: string, exact: string, name: string): number {
  const index = exact ? text.indexOf(exact) : -1;
  if (index < 0 || text.indexOf(exact, index + 1) >= 0) throw Error(`Expected one exact ${name}.`);
  return index;
}

/** A byte-for-byte move: no paraphrase, new heading, or duplicated checklist. */
export function moveConstructionChecklist(system: string, checklist: string, reference: string): string {
  const from = uniqueIndex(system, checklist, 'construction checklist');
  const anchor = uniqueIndex(system, reference, 'API reference');
  if (from < anchor + reference.length && anchor < from + checklist.length) throw Error('Checklist overlaps API reference.');
  const without = system.slice(0, from) + system.slice(from + checklist.length);
  const insert = uniqueIndex(without, reference, 'API reference') + reference.length;
  return without.slice(0, insert) + checklist + without.slice(insert);
}

export interface ConstructionContext {
  viewMode: '2d' | '3d';
  /** Caller-selected authoritative plan, current narration/timing, continuity and asset metadata. */
  prompt: string;
}
export interface ConstructionInput {
  systemPrompt: string;
  prompt: string;
  outputMode: AgentTask['outputMode'];
  logContext: AgentTask['logContext'];
  images: AgentTask['images'];
}
export interface ConstructionEvent {
  taskId: string;
  sceneKey: string;
  role: 'construction-specialist' | 'scene' | 'review' | 'repair';
  kind: 'start' | 'finish';
  originalInput: ConstructionInput;
  effectiveInput: ConstructionInput;
  /** Optional caller-provided model input, including the underlying runtime completion suffix. */
  modelSystemPrompt?: string;
  metrics?: AgentRunMetrics;
  elapsedMs?: number;
  output?: string;
  error?: string;
}
export interface ConstructionRunnerOptions {
  mode?: 'off' | 'order-only' | 'specialist';
  checklist?: string;
  apiReference?: string;
  contextForScene?: (task: AgentTask) => Promise<ConstructionContext>;
  specialistPrompt?: string;
  /** Exact substrings of apiReference, selected by the caller before the run. */
  referenceExcerpts?: readonly string[];
  /** Shared by this wrapper instance; instantiate once per generation job. */
  maxSpecialists?: number;
  onEvent?: (event: ConstructionEvent) => void | Promise<void>;
  modelSystemForTask?: (task: AgentTask) => string;
}

function input(task: AgentTask): ConstructionInput {
  return { systemPrompt: task.systemPrompt, prompt: task.prompt, outputMode: task.outputMode,
    logContext: task.logContext, images: task.images };
}

/** Abort promptly even if a caller's async context/log adapter is still pending. */
async function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    // The operation has already produced a promise; consume a later rejection.
    void promise.catch(() => {});
    signal.throwIfAborted();
  }
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([promise, cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}

/** Opt-in experiment adapter. Its underlying runner must be undecorated by this adapter. */
export function createConstructionRunner(base: AgentRunner, options: ConstructionRunnerOptions = {}): AgentRunner {
  const mode = options.mode ?? 'off';
  if (mode === 'off') return base;
  if (mode !== 'order-only' && mode !== 'specialist') throw Error('Unknown construction runner mode.');
  if (constructionRunners.has(base)) throw Error('Construction runner requires an undecorated base runner.');
  const { checklist, apiReference, contextForScene } = options;
  if (!checklist || !apiReference || !contextForScene) throw Error('Construction mode needs exact checklist/reference and context resolver.');
  const maxSpecialists = options.maxSpecialists ?? 3;
  if (!Number.isSafeInteger(maxSpecialists) || maxSpecialists < 1 || maxSpecialists > 32) throw Error('Invalid specialist budget (1–32).');
  let specialistSystem = '';
  if (mode === 'specialist') {
    if (!options.specialistPrompt?.trim() || options.specialistPrompt.length > 12000) throw Error('Missing or oversized specialist prompt.');
    const excerpts = options.referenceExcerpts ?? [];
    if (!excerpts.length || excerpts.some(excerpt => !excerpt || !apiReference.includes(excerpt))
      || excerpts.reduce((sum, excerpt) => sum + excerpt.length, 0) > 32000) {
      throw Error('Specialist reference excerpts must be verbatim, nonempty and at most 32000 characters total.');
    }
    specialistSystem = `${options.specialistPrompt}\n\nOutput JSON schema:\n${JSON.stringify(CONSTRUCTION_BRIEF_SCHEMA)}\n\nVerbatim installed API excerpts:\n${excerpts.join('\n\n')}`;
  }
  const scenes = new Map<string, { context: string; signal?: AbortSignal; brief?: Promise<ConstructionBrief> }>();
  let specialistCount = 0, taskCount = 0;

  async function execute(original: AgentTask, effective: AgentTask, role: ConstructionEvent['role'], sceneKey: string,
    accept?: (output: string) => unknown): Promise<string> {
    const event = { taskId: `construction-${++taskCount}`, sceneKey, role,
      originalInput: input(original), effectiveInput: input(effective),
      modelSystemPrompt: options.modelSystemForTask?.(effective) };
    effective.signal?.throwIfAborted();
    await withSignal(Promise.resolve(options.onEvent?.({ ...event, kind: 'start' })), effective.signal);
    effective.signal?.throwIfAborted();
    const started = performance.now();
    let metrics: AgentRunMetrics | undefined, output: string | undefined, failure: unknown;
    try {
      output = await withSignal(base.run({ ...effective, onMetrics(value) { metrics = value; effective.onMetrics?.(value); } }), effective.signal);
      effective.signal?.throwIfAborted();
      accept?.(output);
      return output;
    } catch (error) { failure = error; throw error; }
    finally {
      // Finish events still run on cancellation. Logging failures must not mask a model/abort failure.
      try { await withSignal(Promise.resolve(options.onEvent?.({ ...event, kind: 'finish', elapsedMs: performance.now() - started,
        metrics, output, ...(failure === undefined ? {} : { error: failure instanceof Error ? failure.message : String(failure) }) })), effective.signal); }
      catch (logError) { if (failure === undefined) throw logError; }
    }
  }

  async function construct(task: AgentTask, context: ConstructionContext, key: string): Promise<ConstructionBrief> {
    const helper: AgentTask = { systemPrompt: specialistSystem, prompt: context.prompt,
      signal: task.signal, logContext: task.logContext, outputMode: 'submit-only',
      validate: async output => { parseConstructionBrief(output); } };
    const output = await execute(helper, helper, 'construction-specialist', key, parseConstructionBrief);
    task.signal?.throwIfAborted();
    return parseConstructionBrief(output);
  }

  const runner: AgentRunner = { async run(task) {
    const { videoId, sceneIndex, stage } = task.logContext ?? {};
    if (!videoId || sceneIndex === undefined || !['scene', 'review', 'repair'].includes(stage ?? '')) return base.run(task);
    task.signal?.throwIfAborted();
    const key = `${videoId}:${sceneIndex}`;
    let entry = scenes.get(key);
    if (stage === 'scene') {
      const context = await withSignal(contextForScene(task), task.signal);
      task.signal?.throwIfAborted();
      // Another initial call may have populated this scene while the resolver awaited.
      entry = scenes.get(key);
      if (!['2d', '3d'].includes(context.viewMode) || typeof context.prompt !== 'string' || !context.prompt.trim()
        || context.prompt.length > 40000) throw Error('Invalid or oversized construction context (40000 characters maximum).');
      const signature = JSON.stringify(context);
      if (entry && (entry.context !== signature || entry.signal !== task.signal)) throw Error('Construction scene context or cancellation signal changed.');
      if (context.viewMode === '2d') return base.run(task);
      // Fail on a stale/mismatched ordering anchor before spending a helper call.
      moveConstructionChecklist(task.systemPrompt, checklist, apiReference);
      if (!entry) {
        if (mode === 'specialist' && specialistCount >= maxSpecialists) throw Error('Construction specialist budget exhausted.');
        entry = { context: signature, signal: task.signal };
        scenes.set(key, entry);
        if (mode === 'specialist') {
          specialistCount++;
          entry.brief = construct(task, context, key);
        }
      }
    }
    if (!entry) return base.run(task);
    const brief = entry.brief ? await withSignal(entry.brief, task.signal) : undefined;
    task.signal?.throwIfAborted();
    const effective = { ...task, systemPrompt: moveConstructionChecklist(task.systemPrompt, checklist, apiReference),
      prompt: brief ? `${task.prompt}\n\nConstruction specialist proposal (not validation evidence; authoritative plan, narration, timing, controls and installed API remain binding):\n${JSON.stringify(brief)}` : task.prompt };
    return execute(task, effective, stage as 'scene' | 'review' | 'repair', key);
  } };
  constructionRunners.add(runner);
  return runner;
}
