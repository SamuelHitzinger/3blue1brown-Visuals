import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { LecturePhotoSnippet } from '../../shared/lecture.js';

/** Optional visual metadata must never make an otherwise useful transcription fail. */
export function photoSnippetOf(value: unknown, dimensions?: { width: number; height: number }): LecturePhotoSnippet | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const input = value as Record<string, unknown>, crop = input.crop as Record<string, unknown> | undefined;
  if (!crop || typeof crop !== 'object' || Array.isArray(crop)) return;
  const { x, y, width, height } = crop;
  if (![x, y, width, height].every(v => typeof v === 'number' && Number.isFinite(v))) return;
  const rect = { x: x as number, y: y as number, width: width as number, height: height as number };
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1 || rect.y + rect.height > 1 || rect.width * rect.height > 0.8) return;
  if (dimensions && (rect.width * dimensions.width < 80 || rect.height * dimensions.height < 50)) return;
  if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 240) return;
  return { crop: rect, description: input.description.trim() };
}

export function visualEvidenceOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= 2000 ? value.trim() : undefined;
}

/** Only cropped pixels survive successful extraction; no full-frame fallback. */
export async function cropLecturePhoto(bytes: Uint8Array, candidate: unknown): Promise<{ photoSnippet: LecturePhotoSnippet; bytes: Uint8Array } | undefined> {
  if (!photoSnippetOf(candidate)) return;
  try {
    const image = await loadImage(Buffer.from(bytes));
    if (image.width > 4096 || image.height > 4096 || image.width * image.height > 4_000_000) return;
    const photoSnippet = photoSnippetOf(candidate, image); if (!photoSnippet) return;
    const { x, y, width, height } = photoSnippet.crop;
    const sw = Math.floor(width * image.width), sh = Math.floor(height * image.height);
    const scale = Math.min(1, 1200 / Math.max(sw, sh));
    const canvas = createCanvas(Math.max(1, Math.round(sw * scale)), Math.max(1, Math.round(sh * scale)));
    canvas.getContext('2d').drawImage(image, Math.floor(x * image.width), Math.floor(y * image.height), sw, sh, 0, 0, canvas.width, canvas.height);
    const cropped = new Uint8Array(await canvas.encode('jpeg', 85));
    return cropped.length <= 500_000 ? { photoSnippet, bytes: cropped } : undefined;
  } catch { return; }
}
