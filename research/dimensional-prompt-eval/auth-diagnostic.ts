import { agentConfig } from '../../backend/src/agents/config';
import { authPath, createModelRuntime } from '../../backend/src/agents/auth';
import { readStoredCredential } from '@earendil-works/pi-coding-agent';

const config = agentConfig();
const credential = readStoredCredential(config.provider, authPath(config));
console.log(JSON.stringify({ phase: 'local', provider: config.provider, mode: config.authMode,
  configured: credential?.type === 'oauth',
  expired: credential?.type === 'oauth' ? credential.expires <= Date.now() : null }));
try {
  const runtime = await createModelRuntime(config);
  console.log(JSON.stringify({ phase: 'runtime', created: true }));
  const auth = await runtime.getAuth(config.provider, { signal: AbortSignal.timeout(30_000) });
  console.log(JSON.stringify({ phase: 'getAuth', authenticated: Boolean(auth) }));
} catch (error: any) {
  const message = String(error?.message ?? '');
  console.log(JSON.stringify({ phase: 'failure', name: error?.name,
    code: typeof error?.code === 'string' ? error.code : undefined,
    status: typeof error?.status === 'number' ? error.status : undefined,
    permissionDenied: /EPERM|EACCES|permission denied|access denied/i.test(message),
    lock: /lock/i.test(message), refresh: /refresh/i.test(message),
    network: /fetch failed|network|ECONN|ETIMEDOUT|ENOTFOUND|socket/i.test(message),
    invalidGrant: /invalid.grant|revoked|expired/i.test(message),
  }));
  process.exitCode = 1;
}
