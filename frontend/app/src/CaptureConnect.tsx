import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera } from './Icons'
import { pairingSecretFromLink } from './captureClient'

/** Scan inside the installed app: iOS Safari and home-screen storage may differ. */
export default function CaptureConnect({ onConnect, onCancel }: { onConnect: (secret: string) => void; onCancel?: () => void }) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const connect = useRef(onConnect); connect.current = onConnect
  useEffect(() => {
    if (!scanning) return
    let cancelled = false, stream: MediaStream | undefined, timer: ReturnType<typeof setTimeout> | undefined
    const stop = () => { stream?.getTracks().forEach(track => track.stop()); clearTimeout(timer) }
    const hide = () => { if (document.visibilityState !== 'visible') { cancelled = true; stop(); setScanning(false) } }
    document.addEventListener('visibilitychange', hide)
    const open = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      if (cancelled) { stop(); return }
      video.current!.srcObject = stream; await video.current!.play()
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true })!
      const scan = () => {
        if (cancelled) return
        const camera = video.current
        if (camera && camera.readyState >= 2 && camera.videoWidth) {
          canvas.width = 640; canvas.height = Math.round(640 * camera.videoHeight / camera.videoWidth)
          context.drawImage(camera, 0, 0, canvas.width, canvas.height)
          const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
          if (result) {
            try {
              const secret = pairingSecretFromLink(result.data, location.origin)
              stop(); setScanning(false); connect.current(secret); return
            } catch (error) { setError((error as Error).message) }
          }
        }
        timer = setTimeout(scan, 250)
      }
      scan()
    }
    void open().catch(() => { stop(); if (!cancelled) { setError('Allow camera access to scan, or paste the recording link below.'); setScanning(false) } })
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', hide) }
  }, [scanning])
  return <section className="capture-connect">
    <Camera size={38}/><h2>Connect a lecture</h2><p>Open a lecture on your computer, then scan its QR code here.</p>
    {scanning && <video ref={video} muted playsInline aria-label="QR scanner preview"/>}
    <button className="capture-button" onClick={() => { setError(''); setScanning(value => !value) }}>{scanning ? 'Stop scanning' : 'Scan lecture QR'}</button>
    {error && <p role="alert">{error}</p>}
    <details><summary>Paste recording link instead</summary><form onSubmit={event => { event.preventDefault(); try { onConnect(pairingSecretFromLink(link, location.origin)) } catch (error) { setError((error as Error).message) } }}>
      <label htmlFor="capture-link">Recording link</label><input id="capture-link" type="url" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…/capture#pair=…" autoComplete="off"/>
      <button className="capture-button" type="submit">Connect</button>
    </form></details>
    {onCancel && <button className="capture-text-button" onClick={onCancel}>Back to recorder</button>}
  </section>
}
