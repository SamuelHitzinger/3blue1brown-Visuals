import { describe, expect, it } from 'vitest';
import { textTex } from '../src/render-geometry.js';
import { layoutLatex } from '../src/latex.js';

describe('Unicode scripts in plain text labels', () => {
  it('typesets the original parabola label with a raised exponent', () => {
    const actual = layoutLatex(textTex('y = x²/2'));
    expect(actual).toEqual(layoutLatex(String.raw`\text{y = x}^{\text{2}}\text{/2}`));
    expect(actual).not.toEqual(layoutLatex(textTex('y = x2/2')));
  });

  it.each([
    ['m³', String.raw`\text{m}^{\text{3}}`],
    ['x⁰¹²³⁴⁵⁶⁷⁸⁹', String.raw`\text{x}^{\text{0123456789}}`],
    ['x⁻¹ + x⁺²', String.raw`\text{x}^{\text{-1}}\text{ + x}^{\text{+2}}`],
    ['H₂O', String.raw`\text{H}_{\text{2}}\text{O}`],
    ['x₀₁₂₃₄₅₆₇₈₉', String.raw`\text{x}_{\text{0123456789}}`],
    ['x₁²', String.raw`\text{x}_{\text{1}}^{\text{2}}`],
    ['²', String.raw`\text{}^{\text{2}}`],
  ])('preserves script placement for %s', (text, expected) => {
    expect(layoutLatex(textTex(text))).toEqual(layoutLatex(expected));
  });

  it('preserves existing mathematical Unicode and literal TeX escaping', () => {
    const unicode = 'a → b ± × ÷ ≤ ≥ ∞ · − °';
    expect(textTex(unicode)).toBe(`\\text{${unicode}}`);
    expect(layoutLatex(textTex(unicode)).paths.length).toBeGreaterThan(5);
    expect(textTex('x^2_{a} $5 & 20% # ~ \\')).toBe(String.raw`\text{x\textasciicircum 2\_\{a\} \$5 \& 20\% \# \textasciitilde  \backslash }`);
    expect(textTex('')).toBe(String.raw`\text{}`);
    expect(() => layoutLatex(textTex('emoji 😄'))).toThrow('vector glyph');
  });
});
