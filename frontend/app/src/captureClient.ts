import type { CaptureCapabilities, CaptureClaim, CaptureItem, CaptureMetadata, CapturePairing, CaptureStatus } from '../../../shared/lecture-capture'

export class CaptureHTTPError extends Error {
  status: number
  retryAfterMs: number
  constructor(message: string, status: number, retryAfterMs = 0) { super(message); this.status = status; this.retryAfterMs = retryAfterMs }
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30_000)
  const response = await fetch(url, { ...options, cache: 'no-store', signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout })
  let invalid = false
  const body = response.status === 204 ? undefined : await response.json().catch(() => { invalid = true; return null })
  if (!response.ok || invalid) {
    const after = response.headers.get('Retry-After') ?? ''
    const delay = /^\d+$/.test(after) ? Number(after) * 1000 : Math.max(0, Date.parse(after) - Date.now()) || 0
    throw new CaptureHTTPError(body?.detail ?? 'The capture service could not respond. Please try again.', response.ok ? 502 : response.status, delay)
  }
  return body as T
}
const ownerPath = (lectureId: string) => `/api/lectures/${encodeURIComponent(lectureId)}/capture-pairings`
export const getCaptureCapabilities = (signal?: AbortSignal) => request<CaptureCapabilities>('/api/lecture-capture/config', { signal })
export const getDeviceCaptureCapabilities = (signal?: AbortSignal) => request<CaptureCapabilities>('/api/capture/config', { signal })
export const getCapturePairing = (lectureId: string, signal?: AbortSignal) => request<CaptureStatus | null>(ownerPath(lectureId), { signal })
export const createCapturePairing = (lectureId: string) => request<CapturePairing>(ownerPath(lectureId), { method: 'POST' })
export const revokeCapturePairing = (lectureId: string, pairingId: string) => request<void>(`${ownerPath(lectureId)}/${encodeURIComponent(pairingId)}`, { method: 'DELETE' })
export const retryCapturePairing = (lectureId: string, pairingId: string) => request<CaptureStatus>(`${ownerPath(lectureId)}/${encodeURIComponent(pairingId)}/retry`, { method: 'POST' })
export const claimCapture = (secret: string, deviceToken: string) => request<CaptureClaim>('/api/capture/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, deviceToken }) })
export const getCaptureStatus = (token: string, signal?: AbortSignal) => request<CaptureStatus>('/api/capture/status', { headers: { Authorization: `Bearer ${token}` }, signal })
export const retryCaptureItem = (token: string, itemId: string) => request<CaptureItem>(`/api/capture/items/${encodeURIComponent(itemId)}/retry`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
export function uploadCapture(token: string, item: { metadata: CaptureMetadata; blob: Blob }, signal?: AbortSignal) {
  const data = new FormData()
  data.set('metadata', JSON.stringify(item.metadata))
  const extension = item.metadata.kind === 'photo' ? 'jpg' : /mp4|m4a/.test(item.blob.type) ? 'm4a' : item.blob.type.includes('ogg') ? 'ogg' : item.blob.type.includes('wav') ? 'wav' : 'webm'
  data.set('file', item.blob, `capture.${extension}`)
  return request<CaptureItem>('/api/capture/items', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data, signal })
}
export const claimStorageKey = 'aha-capture-pending-claim'
export const sessionStorageKey = 'aha-capture-session'
type CaptureStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const tokenKey = (id: string) => `aha-capture-token-${id}`
export function saveCaptureClaim(storage: CaptureStorage, claim: CaptureClaim) {
  storage.setItem(tokenKey(claim.status.id), claim.token)
  storage.setItem(sessionStorageKey, claim.status.id)
  storage.removeItem(claimStorageKey)
}
export function readCaptureClaim(storage: Pick<Storage, 'getItem'>): { token: string; pairingId: string } | null {
  const pairingId = storage.getItem(sessionStorageKey)
  const token = pairingId && storage.getItem(tokenKey(pairingId))
  return pairingId && token && /^[a-f0-9]{64}$/.test(token) ? { token, pairingId } : null
}
export function forgetCaptureClaim(storage: CaptureStorage, pairingId: string) {
  storage.removeItem(tokenKey(pairingId))
  if (storage.getItem(sessionStorageKey) === pairingId) storage.removeItem(sessionStorageKey)
}
export function prepareCaptureClaim(storage: Pick<Storage, 'getItem' | 'setItem'>, secret: string): { secret: string; deviceToken: string } {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('This pairing link is invalid. Create another on your computer.')
  let previous: { secret?: string; deviceToken?: string } | null = null
  try { previous = JSON.parse(storage.getItem(claimStorageKey) || 'null') } catch { /* Replace an invalid pending record before sending. */ }
  if (previous?.secret === secret && previous.deviceToken && /^[a-f0-9]{64}$/.test(previous.deviceToken)) return { secret, deviceToken: previous.deviceToken }
  const deviceToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  const claim = { secret, deviceToken }
  storage.setItem(claimStorageKey, JSON.stringify(claim)) // Must succeed before the one-use exchange.
  return claim
}
