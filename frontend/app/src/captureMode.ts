export type CaptureMode = 'standard' | 'chatgpt'
export function capturePhotoIntervalMs(mode: CaptureMode, standardSeconds: number) {
  return mode === 'chatgpt' ? 10_000 : standardSeconds * 1000
}
export function capturePreset(mode: CaptureMode, capabilities: { audio: boolean; photo: boolean }) {
  return { audio: mode === 'standard' && capabilities.audio, photo: capabilities.photo }
}
