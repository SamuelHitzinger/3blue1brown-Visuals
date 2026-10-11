/** Native export hosts consume the same embedded GLB payload as the backend. */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ModelStore } from '../dist/model-store.js';

export function createOfflineModelStore(payload) {
  return new ModelStore(payload?.assets ?? {}, {
    read: async asset => {
      const encoded = payload?.files?.[asset.url];
      if (typeof encoded !== 'string') throw new Error(`Missing embedded model file: ${asset.url}`);
      return new Uint8Array(Buffer.from(encoded, 'base64'));
    },
    decode: async image => {
      const decoded = await loadImage(Buffer.from(image.bytes));
      if (decoded.width !== image.width || decoded.height !== image.height) throw new Error('Model image dimensions mismatch');
      const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
      context.drawImage(decoded, 0, 0);
      return { width: decoded.width, height: decoded.height, pixels: new Uint8Array(context.getImageData(0, 0, image.width, image.height).data) };
    },
  });
}
