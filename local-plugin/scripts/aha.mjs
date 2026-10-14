#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { VideoClient, summarize } from './client.mjs';
import { stateRoot, runtimeRoot, pluginRoot, readJSON, saveJSON, configuration, doctor, setup, start, stop, running } from './runtime.mjs';
import { verifyDistribution } from './package.mjs';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    'env-file': { type: 'string' }, chromium: { type: 'string' }, port: { type: 'string' },
    request: { type: 'string' }, id: { type: 'string' }, wait: { type: 'string' }, offline: { type: 'boolean' },
  } });
  const command = positionals[0] ?? 'help';
  if (positionals.length > 1) throw new Error('Use named options; see help.');
  if (command === 'help') return {
    commands: ['configure --env-file ABSOLUTE_PATH [--chromium ABSOLUTE_PATH] [--port 47831]', 'setup [--offline]',
      'doctor', 'verify', 'start', 'create --request ABSOLUTE_JSON_PATH', 'status --id VIDEO_ID [--wait 30]', 'list', 'stop'],
    requestFormat: { idempotencyKey: 'A stable UUID; keep it on retries', request: { title: 'Lesson title', topic: 'Complete user prompt', documents: [] }, files: [] },
    stateRoot, runtimeRoot,
  };
  if (command === 'configure') {
    if (await running()) throw new Error('Stop the plugin before changing its configuration.');
    const config = await readJSON(join(stateRoot, 'config.json'), {});
    for (const [flag, field] of [['env-file', 'envFile'], ['chromium', 'chromium']]) {
      if (values[flag]) {
        const path = resolve(values[flag]);
        if (!existsSync(path)) throw new Error(`${flag} does not exist.`);
        config[field] = path;
      }
    }
    if (values.port) {
      const port = Number(values.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be an integer from 1024 to 65535.');
      config.port = port;
    }
    await saveJSON(join(stateRoot, 'config.json'), config);
    return { configured: true, ...config, stateRoot };
  }
  if (command === 'setup') return setup({ offline: values.offline });
  if (command === 'doctor') return doctor();
  if (command === 'verify') {
    const result = await verifyDistribution(pluginRoot);
    if (!result.ok) process.exitCode = 1;
    return result;
  }
  if (command === 'start') return start();
  if (command === 'stop') return stop();
  if (!['create', 'status', 'list'].includes(command)) throw new Error('Unknown command. Run help.');
  const state = await running();
  if (!state) throw new Error('Plugin backend is not running. Run start first.');
  const client = new VideoClient(state.origin);
  if (command === 'list') return (await client.list()).map(video => summarize(video, state.origin));
  if (command === 'create') {
    if (state.smoke) throw new Error('This is a test backend. Use a production plugin instance to create real videos.');
    if (!values.request) throw new Error('Provide --request with a JSON file.');
    const path = resolve(values.request);
    const input = JSON.parse(await readFile(path, 'utf8'));
    if (!input.request || typeof input.request !== 'object') throw new Error('Request file needs request and idempotencyKey fields.');
    if (input.files !== undefined && (!Array.isArray(input.files) || input.files.some(file => typeof file !== 'string'))) throw new Error('files must be an array of local file paths.');
    if (input.request.narrationMode !== 'subtitles') {
      const { env } = await configuration();
      if (!env.ELEVENLABS_API_KEY?.trim() || !env.ELEVENLABS_VOICE_ID?.trim()) throw new Error('Narration is not configured. Set the existing ElevenLabs key and voice; do not silently switch to subtitles.');
    }
    const video = await client.create(input.request, input.idempotencyKey, (input.files ?? []).map(file => resolve(dirname(path), file)));
    const result = summarize(video, state.origin);
    await saveJSON(join(stateRoot, 'receipts', `${video.id}.json`), { ...result, idempotencyKey: input.idempotencyKey });
    return result;
  }
  if (!values.id) throw new Error('Provide --id.');
  const seconds = Number(values.wait ?? 0);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) throw new Error('--wait must be between 0 and 60 seconds.');
  const until = Date.now() + seconds * 1000;
  let video;
  do {
    video = await client.status(values.id);
    if (['complete', 'failed'].includes(video.status) || Date.now() >= until) break;
    await delay(Math.min(1000, until - Date.now()));
  } while (true);
  return summarize(video, state.origin);
}

main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
});
