/** Replay two exact structured submissions with one silent clock; no generation or approval. */
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { compileSource } from '../../shared/animlib/dist/compiler.js';
import { loadProbeSource } from './realtime-render.js';
import { validateSubmission } from './realtime-tool-probe.js';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const imageIdentity = (image: any) => image ? { sha256: image.sha256, bytes: image.bytes, mimeType: image.mimeType } : null;
const milliseconds = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const limitation = 'Model-only timings exclude capture, recognition, compilation, rendering and presentation. Shared perception plus authoring is a sum of recorded model stages, not measured end-to-end readiness. These sources have no visual quality approval.';

async function evidence(directory: string) {
  const meta = await readJson(join(directory, 'result.json'));
  if (meta.evidenceKind !== 'single-structured-model-submission' || meta.schemaVersion !== 1
    || meta.status !== 'complete' || meta.providerComplete !== true || meta.submissionAccepted !== true || meta.completedToolCalls !== 1) {
    throw new Error('Requires one accepted complete structured submission.');
  }
  const prompts = await readJson(join(directory, 'prompt.json'));
  if (typeof prompts.prompt !== 'string' || typeof prompts.systemPrompt !== 'string'
    || hash(JSON.stringify(prompts)) !== meta.promptSha256) throw new Error('Recorded prompt hash mismatch.');
  if (meta.image) {
    const bytes = await readFile(meta.image.path);
    if (hash(bytes) !== meta.image.sha256 || bytes.length !== meta.image.bytes) throw new Error('Recorded image hash mismatch.');
  }
  return { meta, prompts };
}

export interface PairOptions {
  /** Trusted host declaration, never inferred from generated code. */
  declaredData?: { path: string; sha256: string };
  /** Preserve verified failed submissions for an audit UI; never mark them playable. */
  reportCompilationFailures?: boolean;
}

export async function loadPair(baselineDirectory: string, candidateDirectory: string, briefDirectory?: string, options: PairOptions = {}) {
  const directories = [baselineDirectory, candidateDirectory].map(path => resolve(path));
  if (directories[0] === directories[1]) throw new Error('Pass two different probe directories.');
  const inputs = await Promise.all(directories.map(async directory => ({ directory, ...await evidence(directory), ...await loadProbeSource(directory) })));
  const [a, b] = inputs;
  if (a.prompts.prompt !== b.prompts.prompt) throw new Error('Unmatched author user prompt.');
  if (JSON.stringify(imageIdentity(a.meta.image)) !== JSON.stringify(imageIdentity(b.meta.image))) throw new Error('Unmatched author image.');
  const fields = ['model', 'provider', 'thinkingRequested', 'serviceTierRequested', 'strictRequested', 'maxTokensRequested',
    'timeoutMs', 'maxRetries', 'transportRequested', 'toolSchemaSha256', 'serviceTierActual'];
  for (const field of fields) {
    if (!Object.hasOwn(a.meta, field) || !Object.hasOwn(b.meta, field) || JSON.stringify(a.meta[field]) !== JSON.stringify(b.meta[field])) {
      throw new Error(`Unmatched author setting: ${field}`);
    }
  }
  for (const field of ['serviceTier', 'reasoningEffort', 'maxOutputTokens']) {
    if (!a.meta.payloadSent || !b.meta.payloadSent || !Object.hasOwn(a.meta.payloadSent, field)
      || !Object.hasOwn(b.meta.payloadSent, field) || a.meta.payloadSent[field] !== b.meta.payloadSent[field]) {
      throw new Error(`Unmatched sent author setting: ${field}`);
    }
  }
  let prelude = '', declaredData: { sha256: string; bytes: number } | null = null;
  if (options.declaredData) {
    if (!a.prompts.prompt.includes('Host defines read-only lexical DATA')) throw new Error('Host DATA declaration is absent from the verified shared prompt.');
    const bytes = await readFile(resolve(options.declaredData.path));
    if (hash(bytes) !== options.declaredData.sha256) throw new Error('Declared host data hash mismatch.');
    // Identical deterministic prelude to the offline matrix renderer; no model-source repair.
    prelude = `const DATA=${JSON.stringify(JSON.parse(bytes.toString('utf8')))};\n`;
    declaredData = { sha256: hash(bytes), bytes: bytes.length };
  }
  const executions = inputs.map(input => prelude + input.source);
  const compiled = await Promise.all(executions.map(async source => {
    try { return { duration: (await compileSource(source)).duration, compileError: null as string | null }; }
    catch (error) {
      if (!options.reportCompilationFailures) throw error;
      return { duration: null, compileError: error instanceof Error ? error.message : String(error) };
    }
  }));
  const durations = compiled.map(result => result.duration);
  const pairError = compiled.some(result => result.compileError) ? 'Compilation failed; synchronized pair playback unavailable.'
    : durations.some(value => value === null || !Number.isFinite(value) || value <= 0 || value > 300)
      || Math.abs(durations[0]! - durations[1]!) > .002
      ? 'Scene duration must be positive, at most 300 seconds, and equal in both arms.' : null;
  if (pairError && !options.reportCompilationFailures) throw new Error(pairError);
  const duration = pairError ? null : durations[0]!;
  let brief: { sha256: string; providerTerminalMs: number | null; toolCallCompleteMs: number | null; model: string; serviceTierActual: string | null } | null = null;
  if (briefDirectory) {
    const directory = resolve(briefDirectory), { meta, prompts } = await evidence(directory);
    if (meta.kind !== 'brief' || meta.format !== 'causal-brief') throw new Error('Expected a structured brief run.');
    const bytes = await readFile(join(directory, 'brief.json'));
    if (hash(bytes) !== meta.submissionSha256 || bytes.length !== meta.submissionBytes) throw new Error('Recorded brief hash or byte count mismatch.');
    const value = validateSubmission('brief', JSON.parse(bytes.toString('utf8')));
    const exact = bytes.toString('utf8');
    if (!a.prompts.prompt.includes(exact) && !a.prompts.prompt.includes(JSON.stringify(value))) {
      throw new Error('Exact verified brief is absent from the shared author prompt.');
    }
    if (JSON.stringify(imageIdentity(meta.image)) !== JSON.stringify(imageIdentity(a.meta.image))) throw new Error('Brief and author image differ.');
    if (!prompts.prompt.trim()) throw new Error('Brief evidence prompt is empty.');
    brief = { sha256: meta.submissionSha256, providerTerminalMs: milliseconds(meta.providerTerminalMs),
      toolCallCompleteMs: milliseconds(meta.validToolCallCompleteMs), model: meta.model, serviceTierActual: meta.serviceTierActual ?? null };
  }
  const arms = inputs.map((input, index) => {
    const authorMs = milliseconds(input.meta.providerTerminalMs);
    return { label: index === 0 ? 'A' : 'B', role: index === 0 ? 'baseline' : 'candidate', source: input.source,
      sourceSha256: input.rawSha256, executionSource: executions[index], executionSourceSha256: hash(executions[index]),
      probeResultSha256: input.probeResultSha256, duration: compiled[index].duration, compileError: compiled[index].compileError,
      providerTerminalMs: authorMs, toolCallCompleteMs: milliseconds(input.meta.validToolCallCompleteMs),
      outputTokens: input.meta.tokens?.output ?? null, sourceBytes: input.meta.submissionBytes,
      modelStageSumMs: brief?.providerTerminalMs !== null && brief?.providerTerminalMs !== undefined && authorMs !== null
        ? brief.providerTerminalMs + authorMs : null };
  });
  return { duration, playable: !pairError, pairError, arms, brief, declaredData, limitation, engine: 'Both arms use the current shared/animlib/dist build.',
    match: { userPromptSha256: hash(a.prompts.prompt), imageSha256: a.meta.image?.sha256 ?? null,
      systemPromptsEqual: a.prompts.systemPrompt === b.prompts.systemPrompt,
      systemPromptHashes: inputs.map(input => hash(input.prompts.systemPrompt)),
      model: a.meta.model, provider: a.meta.provider, thinking: a.meta.thinkingRequested,
      serviceTierRequested: a.meta.serviceTierRequested, serviceTierActual: a.meta.serviceTierActual,
      settingsVerified: fields, sentSettingsVerified: ['serviceTier', 'reasoningEffort', 'maxOutputTokens'] } };
}

export async function main(args = process.argv.slice(2)) {
  const positional: string[] = []; let brief: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--brief' && !brief && args[index + 1] && !args[index + 1].startsWith('--')) brief = args[++index];
    else if (arg.startsWith('--brief=') && !brief && arg.length > 8) brief = arg.slice(8);
    else if (!arg.startsWith('--')) positional.push(arg);
    else throw new Error('Use BASELINE_DIR CANDIDATE_DIR [--brief=BRIEF_DIR].');
  }
  if (positional.length !== 2) throw new Error('Use BASELINE_DIR CANDIDATE_DIR [--brief=BRIEF_DIR].');
  const pair = await loadPair(positional[0], positional[1], brief);
  const repo = resolve(import.meta.dir, '../..'), dist = join(repo, 'shared/animlib/dist'), payload = JSON.stringify(pair);
  const server = await createServer({ configFile: false, root: join(import.meta.dir, 'realtime-pair-view'),
    server: { host: '127.0.0.1', port: 5364, strictPort: true, fs: { allow: [repo] } },
    resolve: { alias: { '@baseline': dist, '@improved': dist } },
    optimizeDeps: { exclude: ['quickjs-emscripten', 'quickjs-emscripten-core', '@jitl/quickjs-wasmfile-debug-sync',
      '@jitl/quickjs-wasmfile-debug-asyncify', '@jitl/quickjs-wasmfile-release-sync', '@jitl/quickjs-wasmfile-release-asyncify'] },
    plugins: [{ name: 'verified-probe-pair', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/pair.json') return next();
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(payload);
      });
    } }],
  });
  await server.listen();
  console.log(JSON.stringify({ url: 'http://127.0.0.1:5364/', duration: pair.duration,
    sourceHashes: pair.arms.map(arm => arm.sourceSha256), matched: pair.match, brief: pair.brief, limitation }));
  return server;
}

if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
