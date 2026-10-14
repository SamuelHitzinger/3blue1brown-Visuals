import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('restart refuses a previous process still alive after health disappears', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aha-lifecycle-'));
  process.env.AHA_VIDEO_HOME = home;
  const { start, stop, processAlive } = await import('../scripts/runtime.mjs');
  await writeFile(join(home, 'server.json'), JSON.stringify({ pid: process.pid, identity: 'not-a-server', origin: 'http://127.0.0.1:1' }));
  assert.equal(processAlive(process.pid), true);
  await assert.rejects(start({ smoke: true }), /still alive but not healthy/);
  assert.equal((await stop()).stopped, false);
  assert.equal(processAlive(process.pid), true, 'An unverified PID must not be terminated');
});
