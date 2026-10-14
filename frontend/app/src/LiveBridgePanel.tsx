import { useEffect, useRef, useState } from 'react'

type Status = { active: boolean; expiresAt?: string }
export default function LiveBridgePanel({ lectureId }: { lectureId: string }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const acting = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const revision = useRef(0)
  async function request(method: string, signal: AbortSignal) {
    const response = await fetch(`/api/lectures/${lectureId}/live-bridge`, { method, signal, cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw Error(body.detail ?? 'Could not update ChatGPT connection.')
    return body
  }
  useEffect(() => {
    const current = new AbortController(); controller.current = current
    const version = revision.current
    void request('GET', current.signal).then(next => { if (!current.signal.aborted && version === revision.current) setStatus(next) }).catch(() => { if (!current.signal.aborted) setError('Could not check ChatGPT connection. Reopen this lecture to retry.') })
    return () => current.abort()
  }, [lectureId])
  const act = async (method: 'POST' | 'DELETE') => {
    const current = controller.current
    if (!current || current.signal.aborted || acting.current) return
    acting.current = true; revision.current++; setBusy(true); setError(''); setDownloaded(false)
    try {
      const next = await request(method, current.signal)
      if (current.signal.aborted) return
      if (method === 'POST') {
        const blob = new Blob([JSON.stringify({ origin: location.origin, lectureId, token: next.token, expiresAt: next.expiresAt }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob), link = document.createElement('a')
        link.href = url; link.download = 'aha-lecture-connection.json'; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setStatus({ active: true, expiresAt: next.expiresAt }); setDownloaded(true)
      } else setStatus({ active: false })
    } catch (reason) { if (!current.signal.aborted) setError(reason instanceof Error ? reason.message : 'Connection failed.') }
    finally { acting.current = false; if (!current.signal.aborted) setBusy(false) }
  }
  const active = status?.active && Date.parse(status.expiresAt ?? '') > Date.now()
  return <section className="learning-panel live-bridge-panel" aria-labelledby="live-bridge-heading">
    <h2 id="live-bridge-heading">ChatGPT Live + camera</h2>
    <p>Let ChatGPT send what it hears into this lecture and inspect photos from your paired phone. Notes and visuals update here.</p>
    <p className="learning-muted">Live supports still images through the plugin, not camera video. Photos are retrieved when ChatGPT calls the tool. Speech notes may omit or mishear content.</p>
    <ol>
      <li>Download a private connection file, then import it into the Aha Live Lecture plugin on this computer.</li>
      <li>Connect your phone above. Choose <strong>Camera for ChatGPT Live</strong> and keep Safari open.</li>
      <li>Start ChatGPT Live with the plugin. Ask it to inspect camera photos and save lecture speech notes at natural pauses.</li>
    </ol>
    <p className="learning-muted">Start with ChatGPT voice on the computer and camera on iPhone. Voice on the same iPhone requires a remote plugin connection and testing background voice with Safari.</p>
    <p>Only this lecture is shared. Up to eight recent photos are retained for fifteen minutes while connected.</p>
    {active && <p role="status">Connection enabled until {new Date(status!.expiresAt!).toLocaleTimeString()}. Plugin installation is a separate step.</p>}
    {error && <p className="learning-error" role="alert">{error}</p>}
    <div className="capture-pairing-actions"><button className="secondary-button" disabled={busy || status === null} onClick={() => { void act('POST') }}>{busy ? 'Updating…' : active ? 'Replace connection file' : 'Download connection file'}</button>{active && <button className="secondary-button" disabled={busy} onClick={() => { void act('DELETE') }}>Disconnect ChatGPT</button>}</div>
    {downloaded && <p role="status">Connection file downloaded. Import with <code>node scripts/configure.mjs --import &quot;path/to/aha-lecture-connection.json&quot;</code> from the plugin folder.</p>}
    <small>This file grants access to this lecture for eight hours. Keep it private. Replacing or disconnecting invalidates the old connection.</small>
  </section>
}
