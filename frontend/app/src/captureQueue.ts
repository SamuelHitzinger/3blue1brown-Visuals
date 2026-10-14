import type { CaptureMetadata } from '../../../shared/lecture-capture'
import { CaptureHTTPError } from './captureClient.ts'

export interface CaptureEntry { pairingId: string; metadata: CaptureMetadata; blob: Blob }
export interface CaptureStore { list(): Promise<CaptureEntry[]>; put(item: CaptureEntry): Promise<void>; remove(clientId: string): Promise<void> }
export interface QueueSnapshot { pending: number; bytes: number; unsaved: number; uploading: boolean; blocked: boolean; message: string; maxSequence: number }

export class IndexedCaptureStore implements CaptureStore {
  private db: Promise<IDBDatabase>
  private pairingId: string
  constructor(pairingId: string) {
    this.pairingId = pairingId
    this.db = new Promise((resolve, reject) => {
      const request = indexedDB.open('aha-lecture-capture', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('items', { keyPath: 'key' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Could not open capture storage. Allow website storage and try again.'))
      request.onblocked = () => reject(new Error('Capture storage is open in another tab. Close that tab and retry.'))
    })
  }
  private async transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', mode), request = operation(tx.objectStore('items'))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not save capture material on this phone.'))
    })
  }
  async list() {
    const all = await this.transaction('readonly', store => store.getAll()) as (CaptureEntry & { key: string })[]
    return all.filter(item => item.pairingId === this.pairingId).sort((a, b) => a.metadata.sequence - b.metadata.sequence)
  }
  async put(item: CaptureEntry) { await this.transaction('readwrite', store => store.put({ ...item, key: `${this.pairingId}:${item.metadata.clientId}` })) }
  async remove(clientId: string) { await this.transaction('readwrite', store => store.delete(`${this.pairingId}:${clientId}`)) }
  close() { void this.db.then(db => db.close()).catch(() => {}) }
}

/** One sender, durable IDs, and a two-item emergency reserve for the final audio/photo. */
export class CaptureQueue {
  private store: CaptureStore
  private send: (item: CaptureEntry) => Promise<unknown>
  private changed: (state: QueueSnapshot) => void
  private maxItems: number
  private maxBytes: number
  private entries: CaptureEntry[] = []
  private volatile: CaptureEntry[] = []
  private operation: Promise<void> = Promise.resolve()
  private flight: Promise<void> | null = null
  private nextAttempt = 0
  private failures = 0
  private rejected = new Map<string, string>()
  private blocked = false
  private message = ''
  private disposed = false
  constructor(store: CaptureStore, send: (item: CaptureEntry) => Promise<unknown>, changed: (state: QueueSnapshot) => void, limits = { maxItems: 30, maxBytes: 40 * 1024 * 1024 }) {
    this.store = store; this.send = send; this.changed = changed; this.maxItems = limits.maxItems; this.maxBytes = limits.maxBytes
  }
  snapshot(): QueueSnapshot {
    const all = [...this.entries, ...this.volatile]
    const rejection = this.rejected.size ? `${this.rejected.size} ${this.rejected.size === 1 ? 'capture is' : 'captures are'} retained on this phone for retry: ${this.rejected.values().next().value}. Other capture can continue while storage has room.` : ''
    return { pending: all.length, bytes: all.reduce((sum, item) => sum + item.blob.size, 0), unsaved: this.volatile.length, uploading: !!this.flight, blocked: this.blocked, message: this.message || rejection, maxSequence: Math.max(0, ...all.map(item => item.metadata.sequence)) }
  }
  private notify() { if (!this.disposed) this.changed(this.snapshot()) }
  async restore() { this.entries = await this.store.list(); this.notify() }
  hasCapacity() { const state = this.snapshot(); return !state.blocked && !state.unsaved && state.pending < this.maxItems - 2 && state.bytes < this.maxBytes - 12 * 1024 * 1024 }
  enqueue(item: CaptureEntry): Promise<void> {
    const action = this.operation.then(async () => {
      if ([...this.entries, ...this.volatile].some(existing => existing.metadata.clientId === item.metadata.clientId)) return
      try {
        const state = this.snapshot()
        if (state.pending >= this.maxItems || state.bytes + item.blob.size > this.maxBytes) throw new Error('The upload queue is full. Capture is paused while material is sent.')
        await this.store.put(item)
        this.entries.push(item)
      } catch (error) {
        // Producers stop on this rejection; retain their already-completed final clip.
        this.volatile.push(item)
        this.message = error instanceof Error ? error.message : 'Could not save material on this phone.'
        throw error
      } finally { this.notify() }
    })
    this.operation = action.catch(() => {})
    return action
  }
  flush(): Promise<void> {
    if (this.flight) return this.flight
    if (this.disposed || this.blocked || Date.now() < this.nextAttempt) return Promise.resolve()
    this.flight = this.drain().finally(() => { this.flight = null; this.notify() })
    this.notify(); return this.flight
  }
  private async drain() {
    await this.operation
    while (!this.disposed) {
      const item = [...this.entries, ...this.volatile].filter(item => !this.rejected.has(item.metadata.clientId)).sort((a, b) => a.metadata.sequence - b.metadata.sequence)[0]
      if (!item) { this.message = ''; return }
      try {
        await this.send(item)
        if (this.entries.includes(item)) await this.store.remove(item.metadata.clientId)
        this.entries = this.entries.filter(entry => entry !== item)
        this.volatile = this.volatile.filter(entry => entry !== item)
        this.failures = 0; this.nextAttempt = 0; this.message = ''
        this.notify()
      } catch (error) {
        if (this.disposed) return
        // Invalid media belongs to this item, not the connection. Keep its bytes
        // for explicit retry, but allow later captures through. Authentication
        // and pairing failures still halt the entire sender below.
        if (error instanceof CaptureHTTPError && [400, 415, 422].includes(error.status)) {
          this.rejected.set(item.metadata.clientId, error.message)
          this.failures = 0; this.nextAttempt = 0; this.message = ''
          this.notify()
          await this.operation
          continue
        }
        const transient = !(error instanceof CaptureHTTPError) || error.status === 408 || error.status === 429 || error.status >= 500
        this.blocked = !transient
        this.message = error instanceof Error ? error.message : 'Connection interrupted. Retrying automatically.'
        this.nextAttempt = Date.now() + Math.max(error instanceof CaptureHTTPError ? error.retryAfterMs : 0, Math.min(30_000, 1000 * 2 ** Math.min(this.failures++, 5)) + Math.random() * 400)
        this.notify(); return
      }
      await this.operation
    }
  }
  retry() { this.blocked = false; this.nextAttempt = 0; this.rejected.clear(); return this.flush() }
  dispose() { this.disposed = true }
}
