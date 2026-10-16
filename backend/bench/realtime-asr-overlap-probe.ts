/** Local-only paired ASR experiment. No decoder text, semantic edits, providers, or downloads. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPcmWav, pacePcm, WorkerLineReader, type ReleasedChunk } from './realtime-media-stream.js';

type Arm = 'independent' | 'rolling';
function check(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');

export function overlapInput(previous: ReleasedChunk | undefined, current: ReleasedChunk, arm: Arm) {
  check(current.sourceEndSec - current.sourceStartSec === 4 && current.pcm.length === 128000, 'Expected released four-second PCM');
  if (arm === 'independent' || current.index === 0) return { sourceStartSec: current.sourceStartSec, sourceEndSec: current.sourceEndSec, pcm: current.pcm };
  check(previous, 'Rolling input requires previous released chunk');
  check(previous.index + 1 === current.index && previous.sourceEndSec === current.sourceStartSec
    && previous.sourceEndSec - previous.sourceStartSec === 4 && previous.pcm.length === 128000, 'Expected contiguous four-second previous PCM');
  return { sourceStartSec: previous.sourceStartSec, sourceEndSec: current.sourceEndSec, pcm: Buffer.concat([previous.pcm, current.pcm]) };
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

async function pairedRun(options: { audio: string; language: string; sourceId: string; order: Arm[]; out: string; python: string; model: string }) {
  const out = resolve(options.out); await mkdir(out);
  const source = await openPcmWav(options.audio);
  const controller = new AbortController(), ready = deferred<void>(), complete = deferred<void>(), exited = deferred<void>();
  const events = join(out, 'host-events.ndjson'), trials: Record<string, unknown>[] = [], sourceHash = createHash('sha256');
  let failure: unknown, closing = false, clockDomain: string | undefined, stderrBytes = 0, previous: ReleasedChunk | undefined;
  const pending = new Map<string, { arm: Arm; chunk: ReleasedChunk; input: ReturnType<typeof overlapInput>; sentAtMs: number; sha256: string; started: boolean; done: ReturnType<typeof deferred<void>> }>();
  const emit = (event: Record<string, unknown>) => appendFileSync(events, JSON.stringify({ hostAtMs: performance.now(), ...event }) + '\n');
  const child = spawn(options.python, ['-B', resolve('backend/bench/realtime-media/local-asr.py'), 'stream',
    `--model-path=${options.model}`, `--out=${join(out, 'worker')}`, `--language=${options.language}`,
    '--max-chunks=10', '--max-audio-seconds=56', '--idle-seconds=30', '--session-seconds=90'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const fail = (error: unknown) => {
    if (failure) return; failure = error; controller.abort(error); ready.reject(error); complete.reject(error); exited.reject(error);
    for (const work of pending.values()) work.done.reject(error);
    child.kill();
  };
  const timeout = setTimeout(() => fail(Error('Paired probe exceeded 90 seconds')), 90000);
  child.on('error', fail); child.stdin.on('error', fail);
  child.on('close', code => { if (!closing || code !== 0) fail(Error(`Worker exit ${code}`)); else exited.resolve(); });
  child.stderr.on('data', (bytes: Buffer) => {
    stderrBytes += bytes.length; if (stderrBytes > 65536) { fail(Error('Worker stderr limit')); return; }
    appendFileSync(join(out, 'worker-stderr.txt'), bytes);
  });
  const reading = (async () => {
    const lines = new WorkerLineReader((event: any, receivedAtMs) => {
      emit({ type: 'worker-event', receivedAtMs, event });
      if (event.type === 'ready') {
        check(!clockDomain && typeof event.clockDomain === 'string', 'Invalid ready event'); clockDomain = event.clockDomain; ready.resolve(); return;
      }
      if (event.type === 'error') throw Error('Worker reported failure');
      if (event.type === 'complete') { check(closing && pending.size === 0 && event.status === 'complete', 'Unexpected complete'); complete.resolve(); return; }
      check(event.type === 'inference-start' || event.type === 'trial', 'Unexpected worker event');
      const receipt = event.type === 'trial' ? event.receipt : event, work = pending.get(receipt?.id);
      check(work && receipt.sourceId === options.sourceId && receipt.clockDomain === clockDomain, 'Unmatched worker receipt');
      if (event.type === 'inference-start') { check(!work.started, 'Repeated inference start'); work.started = true; return; }
      const trial = event.trial;
      check(work.started && event.pcmSha256 === work.sha256 && trial.sourceWindowStartSec === work.input.sourceStartSec
        && trial.sourceWindowEndSec === work.input.sourceEndSec && trial.availableAfterSourceSec === work.chunk.sourceEndSec, 'Trial input mismatch');
      check(Number.isFinite(trial.inferenceMs) && trial.inferenceMs >= 0
        && Math.abs(receipt.inferenceCompletedAtMs - receipt.inferenceStartedAtMs - trial.inferenceMs) < 1e-5
        && receivedAtMs - work.sentAtMs + 1e-5 >= trial.inferenceMs, 'Invalid worker timing');
      trials.push({ arm: work.arm, endpointIndex: work.chunk.index, newSourceStartSec: work.chunk.sourceStartSec,
        sourceReadyAtMs: work.chunk.sourceReadyAtMs, sentAtMs: work.sentAtMs, receivedAtMs,
        endpointToReceiptMs: receivedAtMs - work.chunk.sourceReadyAtMs, pcmSha256: work.sha256, receipt, trial });
      pending.delete(receipt.id); work.done.resolve();
    }, controller.signal);
    for await (const bytes of child.stdout) lines.push(bytes);
    lines.finish();
  })(); void reading.catch(fail);
  const send = (value: unknown) => new Promise<void>((done, reject) => child.stdin.write(JSON.stringify(value) + '\n', error => error ? reject(error) : done()));
  try {
    check(source.durationSec === 20, 'Expected immutable 20-second fixture');
    await writeFile(join(out, 'started.json'), JSON.stringify({ ...options, sourceDurationSec: source.durationSec, sampleRate: 16000,
      fileBytes: source.fileBytes, modifiedAtMs: source.modifiedAtMs, uniqueAudioSeconds: 20, decodedAudioSeconds: 56,
      mode: 'paced-paired-serial', limitation: 'Two arms share one serial worker; endpoint-to-receipt includes experimental queue/order overhead. No semantic reconciliation.' }, null, 2), { flag: 'wx' });
    await ready.promise;
    const epochMs = performance.now(); emit({ type: 'source-clock', epochMs, sourceOffsetSec: 885, rate: 1 });
    await pacePcm({ durationSec: 20, epochMs, sourceOffsetSec: 885, signal: controller.signal, read: source.read,
      send: async chunk => {
        sourceHash.update(chunk.pcm);
        emit({ type: 'source-release', index: chunk.index, sourceStartSec: chunk.sourceStartSec, sourceEndSec: chunk.sourceEndSec,
          sourceReadyAtMs: chunk.sourceReadyAtMs, readStartedAtMs: chunk.readStartedAtMs, pcmSha256: hash(chunk.pcm) });
        for (const arm of options.order) {
          const input = overlapInput(previous, chunk, arm), id = `${arm}-${chunk.index}`, done = deferred<void>(), sentAtMs = performance.now();
          pending.set(id, { arm, chunk, input, sentAtMs, sha256: hash(input.pcm), started: false, done });
          emit({ type: 'input-sent', arm, id, sourceStartSec: input.sourceStartSec, sourceEndSec: input.sourceEndSec, sentAtMs,
            sourceReadyAtMs: chunk.sourceReadyAtMs, pcmBytes: input.pcm.length, pcmSha256: hash(input.pcm) });
          await send({ type: 'chunk', id, sourceId: options.sourceId, sourceStartSec: input.sourceStartSec,
            sourceEndSec: input.sourceEndSec, pcm16Base64: input.pcm.toString('base64') });
          await done.promise;
        }
        previous = chunk;
      } });
    closing = true; await send({ type: 'shutdown' }); child.stdin.end();
    await complete.promise; await exited.promise; await reading;
    check(trials.length === 10, 'Expected ten paired trials');
    const result = { status: 'complete', providerRequests: 0, releasedPcmSha256: sourceHash.digest('hex'), trials };
    await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    return result;
  } catch (error) {
    fail(error); await writeFile(join(out, 'failure.json'), JSON.stringify({ status: 'failed', message: String(error), trials }, null, 2), { flag: 'wx' }); throw error;
  } finally { clearTimeout(timeout); if (!closing || failure) child.kill(); await source.close(); }
}

async function main() {
  const out = resolve(process.argv[2] ?? 'data/realtime-workshop/asr-overlap-paired-01'); await mkdir(out);
  await writeFile(join(out, 'probe.ts'), await readFile(fileURLToPath(import.meta.url)), { flag: 'wx' });
  const python = 'C:/Users/samue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const model = resolve('.tmp/realtime-media/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66');
  const summary = [];
  for (const [sourceId, language] of [['mit-oscillations', 'en'], ['local-lecture', 'de']]) for (const order of [['independent', 'rolling'], ['rolling', 'independent']] as Arm[][]) {
    const name = `${sourceId}-${order[0]}-first`, runOut = join(out, name);
    const result = await pairedRun({ audio: resolve(`data/realtime-workshop/media/${sourceId}/t0885-0905.wav`), language, sourceId, order, out: runOut, python, model });
    const row = { name, path: runOut, status: result.status, trials: result.trials.length, releasedPcmSha256: result.releasedPcmSha256 };
    summary.push(row); console.log(JSON.stringify(row));
  }
  await writeFile(join(out, 'summary.json'), JSON.stringify({ providerRequests: 0, runs: summary }, null, 2), { flag: 'wx' });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
