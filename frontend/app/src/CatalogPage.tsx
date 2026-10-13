import { useEffect, useRef, useState } from 'react'
import type { CatalogDetail, CatalogEntry, CatalogSearchResult, CatalogTier } from '../../../shared/animlib/catalog/types'
import { ArrowLeft, ArrowRight, Atom, BookOpen, Layers3, Search, X } from './Icons'
import { catalogInlineTokens } from './catalogReferences'

const tiers = [
  { id: 'resource', title: 'Resources', label: 'The building blocks', description: 'Models, molecules, datasets, and source material.', icon: Atom, color: 'sage' },
  { id: 'technique', title: 'Techniques', label: 'Ways to show an idea', description: 'Visual approaches for the subject you’re explaining.', icon: Layers3, color: 'blue' },
  { id: 'foundation', title: 'Foundations', label: 'What makes it click', description: 'Principles for clear, thoughtful visual explanations.', icon: BookOpen, color: 'butter' },
] as const
const readiness = { ready: 'Ready to use', 'host-preparation': 'Preparation needed', reference: 'Reference' }
async function readJSON<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail || 'The catalog is unavailable. Please try again.')
  return body
}

function CatalogInline({ text, document }: { text: string; document: string }) {
  return <>{catalogInlineTokens(text, document).map((token, index) => token.type === 'link' ? <a key={index} href={token.href} target="_blank" rel="noopener noreferrer">{token.text}</a> : token.type === 'code' ? <code key={index}>{token.text}</code> : token.text)}</>
}

/** Markdown is rendered as React text with validated links, never executable HTML. */
function CatalogDocument({ content, document }: { content: string; document: string }) {
  const blocks = content.split(/(```[^\n]*\n[\s\S]*?```)/g).filter(Boolean)
  return <div className="catalog-document">{blocks.map((block, index) => block.startsWith('```') ? <pre key={index}><code>{block.replace(/^```[^\n]*\n/, '').replace(/```$/, '').trimEnd()}</code></pre> : block.split(/\n\s*\n/).filter(Boolean).map((part, partIndex) => {
    const key = `${index}-${partIndex}`
    const heading = /^(#{1,6})\s+(.+)$/.exec(part.trim())
    if (heading) return heading[1].length <= 2 ? <h3 key={key}><CatalogInline text={heading[2]} document={document}/></h3> : <h4 key={key}><CatalogInline text={heading[2]} document={document}/></h4>
    const lines = part.split('\n')
    if (lines.every(line => /^\s*[-*]\s/.test(line))) return <ul key={key}>{lines.map((line, i) => <li key={i}><CatalogInline text={line.replace(/^\s*[-*]\s/, '')} document={document}/></li>)}</ul>
    return <p key={key}><CatalogInline text={part} document={document}/></p>
  }))}</div>
}

export default function CatalogPage({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<CatalogTier | ''>('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<CatalogSearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [detail, setDetail] = useState<CatalogDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ query, offset: String(offset), limit: '20' })
      if (tier) params.set('tier', tier)
      void fetch(`/api/visualization-catalog?${params}`, { signal: controller.signal }).then(readJSON<CatalogSearchResult>).then(next => { if (!controller.signal.aborted) setResult(next) }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not search the catalog.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 180)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [query, tier, offset, retry])
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(''); return }
    const controller = new AbortController()
    setDetail(null); setDetailError(''); setDetailLoading(true)
    void fetch(`/api/visualization-catalog/${encodeURIComponent(selectedId)}`, { signal: controller.signal }).then(readJSON<CatalogDetail>).then(next => { if (!controller.signal.aborted) { setDetail(next); requestAnimationFrame(() => detailHeading.current?.focus({ preventScroll: true })) } }).catch(reason => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : 'Could not load this entry.') }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selectedId, retry])
  const choose = (entry: CatalogEntry) => { onSelect(entry.id); requestAnimationFrame(() => document.getElementById('catalog-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  return <main className="learning-page catalog-page">
    <div className="learning-heading"><span className="learning-eyebrow">Visualization catalog</span><h1>Good explanations<br/>start with good ingredients.</h1><p>Explore the resources, techniques, and principles behind your visual learning.</p></div>
    <div className="catalog-tier-grid">{tiers.map(item => <button key={item.id} className={`catalog-tier-card ${item.color} ${tier === item.id ? 'active' : ''}`} aria-pressed={tier === item.id} onClick={() => { setTier(tier === item.id ? '' : item.id); setOffset(0) }}><div><item.icon size={26}/><span>{item.label}</span></div><h2>{item.title}</h2><p>{item.description}</p><ArrowRight size={19}/></button>)}</div>
    <div className="catalog-toolbar"><label className="learning-search"><Search size={19}/><input aria-label="Search visualization catalog" placeholder="Try molecules, linear algebra, or visual reasoning…" value={query} onChange={event => { setQuery(event.target.value); setOffset(0) }}/>{query && <button aria-label="Clear catalog search" onClick={() => { setQuery(''); setOffset(0) }}><X size={15}/></button>}</label><div>{tier ? <button className="catalog-clear-filter" onClick={() => { setTier(''); setOffset(0) }}>{tiers.find(item => item.id === tier)?.title}<X size={13}/></button> : <span>All three layers</span>}<span>{result?.total ?? '—'} entries</span></div></div>
    <div className={`catalog-content ${selectedId ? 'has-detail' : ''}`}>
      <section className="catalog-results" aria-label="Catalog entries" aria-busy={loading}>
        {loading ? <div className="learning-empty" role="status">Finding the right ingredients…</div> : error ? <div className="learning-empty"><p role="alert">{error}</p><button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : result?.entries.length ? <>{result.entries.map(entry => { const item = tiers.find(option => option.id === entry.tier)!; return <button className={`catalog-entry ${selectedId === entry.id ? 'selected' : ''}`} key={entry.id} onClick={() => choose(entry)}><span className={`catalog-entry-icon ${item.color}`}><item.icon size={20}/></span><span className="catalog-entry-copy"><span className="catalog-entry-label">{item.title} <span>· {readiness[entry.readiness]}</span></span><strong>{entry.title}</strong><span>{entry.description}</span><span className="catalog-tags">{entry.domains.slice(0, 3).map(domain => <span key={domain}>{domain}</span>)}</span></span><ArrowRight size={17}/></button> })}<div className="catalog-pagination"><button className="secondary-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}><ArrowLeft size={14}/> Previous</button><span>{offset + 1}–{Math.min(offset + result.entries.length, result.total)} of {result.total}</span><button className="secondary-button" disabled={offset + result.entries.length >= result.total} onClick={() => setOffset(offset + 20)}>Next <ArrowRight size={14}/></button></div></> : <div className="learning-empty"><Search size={30}/><h3>No matches yet</h3><p>Try a broader topic, or explore all three layers.</p><button className="secondary-button" onClick={() => { setQuery(''); setTier(''); setOffset(0) }}>Clear filters</button></div>}
      </section>
      {selectedId && <aside className="catalog-detail learning-panel" id="catalog-detail" aria-label="Catalog entry details"><button className="catalog-detail-close" aria-label="Close catalog entry" onClick={() => onSelect('')}><X size={18}/></button>{detailLoading ? <p role="status">Opening entry…</p> : detailError ? <div><p className="learning-error" role="alert">{detailError}</p><button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : detail && <><span className="learning-eyebrow">{tiers.find(item => item.id === detail.tier)?.title}</span><h2 ref={detailHeading} tabIndex={-1}>{detail.title}</h2><p className="catalog-detail-summary">{detail.description}</p><span className="catalog-readiness">{readiness[detail.readiness]}</span><CatalogDocument content={detail.content} document={detail.document}/><div className="catalog-provenance"><h3>Source & provenance</h3><p>{detail.provenance}</p></div>{detail.limitations.length > 0 && <div className="catalog-limits"><h3>Before you use it</h3><ul>{detail.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}{detail.relatedIds.length > 0 && <div className="catalog-related"><h3>Connected ideas</h3>{detail.relatedIds.map(related => <button key={related} onClick={() => onSelect(related)}>{related.replace(/[._-]/g, ' ')}<ArrowRight size={14}/></button>)}</div>}</>}</aside>}
    </div>
  </main>
}
