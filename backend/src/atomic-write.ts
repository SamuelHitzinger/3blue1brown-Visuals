import { rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

/** Shared persistence primitive; independent of narration and either workflow. */
export async function atomicWrite(path: string, data: string | Uint8Array) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, data, { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try { await rename(tmp, path); return; }
      catch (error) {
        // Windows readers/antivirus may briefly prevent replacement. Never unlink
        // the destination: readers must always see either the old or new state.
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error;
        await delay(10 * 2 ** attempt);
      }
    }
  } catch (error) { await unlink(tmp).catch(() => {}); throw error; }
}
