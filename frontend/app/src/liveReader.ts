import type { LectureLiveSnapshot } from '../../../shared/lecture-view'

export interface LiveReaderCredentials { id: string; token: string }
export type ReaderConnection = 'connecting' | 'connected' | 'reconnecting' | 'unauthorized'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validToken = (value: string | null): value is string => !!value && /^[0-9a-f]{64}$/i.test(value)

/** Run once before React mounts, so StrictMode cannot consume a fragment twice. */
export function readLiveReaderCredentials(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  replaceUrl: (url: string) => void,
): LiveReaderCredentials {
  const candidate = location.pathname.match(/^\/live\/([^/]+)\/?$/)?.[1] ?? ''
  const id = uuid.test(candidate) ? candidate : ''
  const fragment = new URLSearchParams(location.hash.slice(1))
  if (fragment.has('token')) replaceUrl(`${location.pathname}${location.search}`)
  if (!id) return { id: '', token: '' }
  const key = `aha-live-reader-${id}`
  if (fragment.has('token')) {
    const token = fragment.get('token')
    if (!validToken(token)) return { id, token: '' }
    try { storage?.setItem(key, token) } catch { /* This tab can still use its in-memory credential. */ }
    return { id, token }
  }
  try { const token = storage?.getItem(key) ?? null; return { id, token: validToken(token) ? token : '' } }
  catch { return { id, token: '' } }
}

interface PollClock { setTimeout: (callback: () => void, ms: number) => number; clearTimeout: (id: number) => void }
export function watchLiveNotes(
  id: string,
  token: string,
  accept: (snapshot: LectureLiveSnapshot) => void,
  connection: (state: ReaderConnection) => void,
  options: { fetcher?: typeof fetch; clock?: PollClock } = {},
) {
  const fetcher = options.fetcher ?? fetch
  const clock = options.clock ?? globalThis
  let stopped = false
  let revision = -1
  let nextPoll: number | undefined
  let deadline: number | undefined
  let controller: AbortController | undefined
  connection('connecting')
  const refresh = async () => {
    controller = new AbortController()
    const request = controller
    deadline = clock.setTimeout(() => request.abort(), 12000)
    try {
      const response = await fetcher(`/api/lecture-view/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: request.signal,
      })
      if (stopped || request.signal.aborted) return
      if ([401, 403, 404, 410].includes(response.status)) {
        stopped = true
        connection('unauthorized')
        return
      }
      if (!response.ok) throw new Error('Could not refresh notes')
      const snapshot = await response.json() as LectureLiveSnapshot
      if (stopped || request.signal.aborted) return
      if (snapshot.id !== id || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('Invalid lecture snapshot')
      if (snapshot.revision > revision) { revision = snapshot.revision; accept(snapshot) }
      connection('connected')
    } catch {
      if (!stopped) connection('reconnecting')
    } finally {
      if (deadline !== undefined) clock.clearTimeout(deadline)
      // Schedule after completion: slow connections never accumulate overlapping requests.
      if (!stopped) nextPoll = clock.setTimeout(() => { void refresh() }, 2000)
    }
  }
  void refresh()
  return () => {
    stopped = true
    controller?.abort()
    if (nextPoll !== undefined) clock.clearTimeout(nextPoll)
    if (deadline !== undefined) clock.clearTimeout(deadline)
  }
}
