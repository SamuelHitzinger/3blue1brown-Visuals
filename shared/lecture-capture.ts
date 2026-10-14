/** Phone capabilities authorize only capture upload/status for one lecture. */
export type CaptureKind = 'photo' | 'audio';
export type CaptureItemState = 'queued' | 'processing' | 'ready' | 'skipped' | 'failed';
export interface CaptureMetadata {
  clientId: string;
  sequence: number;
  kind: CaptureKind;
  capturedAt: string;
  durationMs?: number;
}
export interface CaptureItem {
  id: string;
  clientId: string;
  kind: CaptureKind;
  capturedAt: string;
  status: CaptureItemState;
  error?: string;
}
export interface CaptureStatus {
  id: string;
  lectureId: string;
  title: string;
  state: 'waiting' | 'connected' | 'revoked' | 'expired';
  expiresAt: string;
  lastSeenAt?: string;
  lastPhotoAt?: string;
  lastAudioAt?: string;
  pending: number;
  processed: number;
  skipped: number;
  failed: number;
  items: CaptureItem[];
}
export interface CapturePairing {
  status: CaptureStatus;
  /** Absolute trusted HTTPS capture URL, with one-use secret in its fragment. */
  url: string;
}
export interface CaptureClaim {
  token: string;
  status: CaptureStatus;
}
export interface CaptureCapabilities {
  available: boolean;
  photo: boolean;
  audio: boolean;
  publicOrigin?: string;
  detail?: string;
}
export type CaptureExtractor = (file: File, metadata: CaptureMetadata, signal: AbortSignal) => Promise<string>;
