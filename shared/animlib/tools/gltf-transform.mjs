const check = (ok, message) => { if (!ok)
    throw Error(`glTF: ${message}`); };
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const multiply = (a, b) => Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].reduce((s, k) => s + a[k * 4 + i % 4] * b[Math.floor(i / 4) * 4 + k], 0));
export function nodeMatrix(node) {
    const vec = (v, n) => { check(Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e6), 'invalid transform vector'); return v; };
    if (node.matrix !== undefined) {
        check(!['translation', 'rotation', 'scale'].some(k => node[k] !== undefined), 'matrix and TRS cannot coexist');
        const m = vec(node.matrix, 16);
        check(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'nonaffine matrix');
        return m;
    }
    const t = vec(node.translation ?? [0, 0, 0], 3), s = vec(node.scale ?? [1, 1, 1], 3), q = vec(node.rotation ?? [0, 0, 0, 1], 4);
    check(Math.abs(Math.hypot(...q) - 1) < 1e-5, 'quaternion must be unit length');
    const [x, y, z, w] = q;
    return [(1 - 2 * y * y - 2 * z * z) * s[0], (2 * x * y + 2 * w * z) * s[0], (2 * x * z - 2 * w * y) * s[0], 0, (2 * x * y - 2 * w * z) * s[1], (1 - 2 * x * x - 2 * z * z) * s[1], (2 * y * z + 2 * w * x) * s[1], 0, (2 * x * z + 2 * w * y) * s[2], (2 * y * z - 2 * w * x) * s[2], (1 - 2 * x * x - 2 * y * y) * s[2], 0, ...t, 1];
}
export function geometryTransform(m) {
    const [a, d, g, , b, e, h, , c, f, i] = m, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    check(Number.isFinite(det) && Math.abs(det) > 1e-12, 'singular/unstable transform');
    const co = [e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h, b * f - c * e, c * d - a * f, a * e - b * d], same = m.every((v, i) => v === identity()[i]);
    return { reflected: det < 0, point: p => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]), normal: n => { if (same)
            return n.slice(); const out = [0, 1, 2].map(r => (co[r * 3] * n[0] + co[r * 3 + 1] * n[1] + co[r * 3 + 2] * n[2]) / det), length = Math.hypot(...out); check(length > 0 && Number.isFinite(length), 'invalid transformed normal'); return out.map(v => v === 0 ? 0 : v / length); } };
}
