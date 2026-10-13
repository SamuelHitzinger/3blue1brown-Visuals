const repository = 'https://github.com/SamuelHitzinger/3blue1brown-Visuals/blob/codex/lecture-visual-catalog/'
const catalogRoot = ['shared', 'animlib', 'catalog']
const forbidden = /[\\\u0000-\u001f\u007f]/

/** Resolve documentation links without providing an arbitrary local-file endpoint. */
export function catalogReferenceURL(target: string, document: string): string | null {
  if (forbidden.test(target)) return null
  const value = target.trim()
  if (!value) return null
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
  }
  if (value.startsWith('/') || !/^[a-z\d][a-z\d._/-]*$/i.test(document) || document.split('/').some(part => !part || part === '.' || part === '..')) return null
  const split = value.search(/[?#]/)
  const pathname = split < 0 ? value : value.slice(0, split)
  const suffix = split < 0 ? '' : value.slice(split)
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (forbidden.test(decoded) || decoded.startsWith('/') || decoded.includes('%') || decoded.includes(':')) return null
  const parts = [...catalogRoot, ...document.split('/')]
  if (decoded) {
    parts.pop()
    for (const part of decoded.split('/')) {
      if (!part || part === '.') continue
      if (part === '..') { if (!parts.length) return null; parts.pop() }
      else parts.push(part)
    }
  }
  if (!parts.length) return null
  return repository + parts.map(part => encodeURIComponent(part)).join('/') + suffix
}

export type CatalogInlineToken = { type: 'text' | 'code'; text: string } | { type: 'link'; text: string; href: string }

/** A deliberately small inline grammar; all unmatched content remains literal text. */
export function catalogInlineTokens(text: string, document: string): CatalogInlineToken[] {
  const tokens: CatalogInlineToken[] = []
  const pattern = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)/g
  let previous = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > previous) tokens.push({ type: 'text', text: text.slice(previous, match.index) })
    if (match[1] !== undefined) tokens.push({ type: 'code', text: match[1] })
    else {
      const href = catalogReferenceURL(match[3], document)
      tokens.push(href ? { type: 'link', text: match[2], href } : { type: 'text', text: match[2] })
    }
    previous = match.index + match[0].length
  }
  if (previous < text.length) tokens.push({ type: 'text', text: text.slice(previous) })
  return tokens
}
