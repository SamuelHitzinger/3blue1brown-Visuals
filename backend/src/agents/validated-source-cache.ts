/** Reuse successful checks only inside one immutable source/asset context. No failed promises are cached. */
export function cacheValidatedSources<T>(validate: (source: string) => Promise<T>, revision: () => number, signal: AbortSignal) {
  let cachedRevision = revision();
  const cache = new Map<string, T>();
  return async (source: string): Promise<T> => {
    signal.throwIfAborted();
    const currentRevision = revision();
    if (cachedRevision !== currentRevision) { cache.clear(); cachedRevision = currentRevision; }
    if (cache.has(source)) return cache.get(source)!;
    const result = await validate(source);
    signal.throwIfAborted();
    // Asset publication may finish while compilation is running.
    if (revision() === currentRevision) {
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(source, result);
    }
    return result;
  };
}
