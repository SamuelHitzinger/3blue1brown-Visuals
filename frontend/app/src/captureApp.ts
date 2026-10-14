/** Keep installation identity independent of a lecture's one-use fragment. */
export function setupCaptureApp() {
  document.title = 'Aha! Recorder'
  document.body.classList.add('capture-app')
  const viewport = document.querySelector('meta[name="viewport"]')
  viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
  const additions: HTMLElement[] = []
  const meta = (name: string, content: string) => { const tag = document.createElement('meta'); tag.name = name; tag.content = content; document.head.append(tag); additions.push(tag) }
  const link = (rel: string, href: string) => { const tag = document.createElement('link'); tag.rel = rel; tag.href = href; document.head.append(tag); additions.push(tag) }
  meta('apple-mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-title', 'Aha! Recorder'); meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
  link('manifest', '/capture.webmanifest'); link('apple-touch-icon', '/capture-icon-192.png')
  const theme = document.querySelector('meta[name="theme-color"]'), previous = theme?.getAttribute('content')
  theme?.setAttribute('content', '#101411')
  return () => { document.body.classList.remove('capture-app'); additions.forEach(tag => tag.remove()); if (previous) theme?.setAttribute('content', previous) }
}
