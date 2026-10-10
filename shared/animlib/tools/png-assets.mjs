import { PNG } from 'pngjs';
import { inflateSync } from 'node:zlib';
const check = (ok, message) => { if (!ok)
    throw Error(`PNG: ${message}`); };
/** pngjs 7.0.0 with a checked 8-bit/noninterlaced header and bounded inflate. */
export function decodePNG(bytes) {
    check(bytes instanceof Uint8Array && bytes.length >= 45 && bytes.length <= 64 * 1024 * 1024, 'source byte limit or truncated header');
    const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    check(b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.readUInt32BE(8) === 13 && b.toString('ascii', 12, 16) === 'IHDR', 'invalid signature/IHDR');
    const width = b.readUInt32BE(16), height = b.readUInt32BE(20), depth = b[24], type = b[25], channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[type];
    check(width > 0 && width <= 4096 && height > 0 && height <= 4096, 'dimensions exceed 4096');
    check(depth === 8, 'only 8-bit source images supported; no silent quantization');
    check(channels && b[26] === 0 && b[27] === 0 && b[28] === 0, 'unsupported compression/filter/interlace');
    let at = 8, ended = false;
    const compressed = [];
    while (at < b.length) {
        check(at + 12 <= b.length, 'truncated chunk');
        const length = b.readUInt32BE(at), name = b.toString('ascii', at + 4, at + 8);
        check(length <= 64 * 1024 * 1024 && at + 12 + length <= b.length, 'invalid chunk length');
        check(!['acTL', 'fcTL', 'fdAT', 'iCCP', 'cICP'].includes(name), 'animation or custom color profile unsupported');
        if (name === 'gAMA')
            check(length === 4 && b.readUInt32BE(at + 8) === 45455, 'non-sRGB gamma unsupported');
        if (name === 'cHRM') {
            const srgb = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
            check(length === 32 && srgb.every((v, i) => b.readUInt32BE(at + 8 + i * 4) === v), 'non-sRGB chromaticity unsupported');
        }
        if (name === 'IDAT')
            compressed.push(b.subarray(at + 8, at + 8 + length));
        at += length + 12;
        if (name === 'IEND') {
            check(length === 0 && at === b.length, 'trailing PNG data');
            ended = true;
            break;
        }
    }
    check(ended && compressed.length, 'missing image data/end');
    const expected = (width * channels + 1) * height, raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected + 1 });
    check(raw.length === expected, 'inflated byte length mismatch');
    const image = PNG.sync.read(b, { checkCRC: true });
    check(image.width === width && image.height === height && image.data.length === width * height * 4, 'decoder dimension/length mismatch');
    return { width, height, pixels: new Uint8Array(image.data) };
}
