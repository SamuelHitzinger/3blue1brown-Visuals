import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const document = mathjax.document('', {
  InputJax: new TeX({ packages: ['base', 'ams'], maxBuffer: 2000, maxMacros: 100 }),
  OutputJax: new SVG({ fontCache: 'none' }),
})
type MathImage = { src: string; width: number; height: number }
const cache = new Map<string, MathImage | null>()

function stackedEqualities(math: string) {
  if (math.includes('\\begin')) return math
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < math.length; i++) {
    if (math[i] === '\\') { i++; continue }
    if (math[i] === '{') depth++
    if (math[i] === '}') depth--
    if (math[i] === '=' && depth === 0) { parts.push(math.slice(start, i)); start = i + 1 }
  }
  parts.push(math.slice(start))
  return parts.length > 2 ? `\\begin{aligned}${parts[0]}&=${parts[1]}${parts.slice(2).map(part => `\\\\&=${part}`).join('')}\\end{aligned}` : math
}

/** Restricted TeX rendered in an inert image; no HTML, URL or extension packages. */
export function noteMathImage(math: string): MathImage | null {
  if (!math || math.length > 1000) return null
  if (cache.has(math)) return cache.get(math)!
  let result: MathImage | null = null
  try {
    let root = document.convert(math, { display: true })
    let svg = adaptor.tags(root, 'svg')[0]
    const initialBox = svg ? (adaptor.getAttribute(svg, 'viewBox') ?? '').split(/\s+/).map(Number) : []
    if (initialBox[2] * .023 > 380) {
      const stacked = stackedEqualities(math)
      if (stacked !== math) { root = document.convert(stacked, { display: true }); svg = adaptor.tags(root, 'svg')[0] }
    }
    const markup = adaptor.outerHTML(root)
    if (svg && !markup.includes('data-mjx-error') && !markup.includes('data-mml-node="merror"')) {
      const box = (adaptor.getAttribute(svg, 'viewBox') ?? '').split(/\s+/).map(Number)
      if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
        adaptor.setAttribute(svg, 'xmlns', 'http://www.w3.org/2000/svg')
        adaptor.setAttribute(svg, 'color', '#23685d')
        result = { src: `data:image/svg+xml,${encodeURIComponent(adaptor.outerHTML(svg))}`, width: Math.ceil(box[2] * .023), height: Math.ceil(box[3] * .023) }
      }
    }
  } catch { /* Keep the readable plain-text equation. */ }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!)
  cache.set(math, result)
  return result
}
