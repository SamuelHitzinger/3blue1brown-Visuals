import type { LectureVisualization } from '../../../shared/lecture'

/** Own immutable model blobs for the lifetime of one reader page. */
export function createReaderModelCache(id: string, token: string, options: {
  fetcher?: typeof fetch;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
} = {}) {
  const fetcher = options.fetcher ?? fetch
  const create = options.createObjectURL ?? URL.createObjectURL.bind(URL)
  const revoke = options.revokeObjectURL ?? URL.revokeObjectURL.bind(URL)
  const urls = new Map<string, string>()
  const pending = new Map<string, Promise<string>>()
  const controllers = new Set<AbortController>()
  let disposed = false
  const load = (sha: string) => {
    if (disposed) return Promise.reject(new Error('Reader closed'))
    if (urls.has(sha)) return Promise.resolve(urls.get(sha)!)
    if (pending.has(sha)) return pending.get(sha)!
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = globalThis.setTimeout(() => controller.abort(), 12000)
    const promise = (async () => {
      try {
        const response = await fetcher(`/api/lecture-view/${encodeURIComponent(id)}/models/${sha}.glb`, {
          headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        })
        if (!response.ok) throw new Error('The model could not load. Check the connection and reader link, then retry.')
        const blob = await response.blob()
        if (disposed || controller.signal.aborted) throw new Error('Model loading was interrupted.')
        const url = create(blob)
        urls.set(sha, url)
        return url
      } finally { globalThis.clearTimeout(timeout); controllers.delete(controller); pending.delete(sha) }
    })()
    pending.set(sha, promise)
    return promise
  }
  return {
    async resolve(visual: LectureVisualization): Promise<LectureVisualization> {
      const assets = await Promise.all(Object.entries(visual.assets ?? {}).map(async ([key, asset]) => {
        const sha = /^\/api\/models\/([a-f0-9]{64})\.glb$/.exec(asset.url)?.[1]
        if (!sha || (asset.sha256 && asset.sha256 !== sha)) throw new Error('This visual contains a model that is unavailable through the reader link.')
        return [key, { ...asset, sha256: sha, url: await load(sha) }] as const
      }))
      return { ...visual, assets: Object.fromEntries(assets) }
    },
    dispose() {
      disposed = true
      controllers.forEach(controller => controller.abort())
      urls.forEach(revoke)
      urls.clear()
    },
  }
}
export type ReaderModelCache = ReturnType<typeof createReaderModelCache>
