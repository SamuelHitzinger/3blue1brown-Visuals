import { expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('unknown model fails before request and retains an immutable, sanitized run', async () => {
  const directory = join(await mkdtemp(join(tmpdir(), 'aha-realtime-probe-')), 'run');
  const cli = fileURLToPath(new URL('../realtime-model-probe.ts', import.meta.url));
  const args = [process.execPath, cli, 'run', '--case=cube', '--format=ops', '--action=create',
    '--model=offline-nonexistent-probe-model', '--thinking=low', '--service-tier=priority', `--out=${directory}`];
  // Fake in-memory credential: model resolution fails before any provider request.
  const env = { ...process.env, AGENT_AUTH_MODE: 'api-key', AGENT_PROVIDER: 'openai', OPENAI_API_KEY: 'offline-test-placeholder' };
  const first = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await first.exited).toBe(1);
  const resultPath = join(directory, 'result.json');
  const before = await readFile(resultPath, 'utf8');
  const result = JSON.parse(before);
  expect(result.status).toBe('failed');
  expect(result.failure.code).toBe('MODEL');
  expect(result.requestElapsedMs).toBeNull();
  expect(result.textMetrics.completeOutputMs).toBeNull();
  expect(result.priorityConfirmed).toBe(false);
  expect(before).not.toContain('offline-test-placeholder');
  expect(await readFile(join(directory, 'output.txt'), 'utf8')).toBe('');
  const second = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await second.exited).toBe(1);
  expect(await readFile(resultPath, 'utf8')).toBe(before);
});
