import { useEffect, useRef } from 'react'
import CurrentUser from './CurrentUser'
import { ArrowUpRight, BookOpen, FolderOpen, Library, Moon, Sun, X } from './Icons'

type NavigationDrawerProps = {
  open: boolean
  current: 'home' | 'library' | 'lectures'
  onClose: () => void
  onHome: () => void
  onLectures: () => void
  onLibrary: () => void
  theme: 'light' | 'dark'
  onTheme: (theme: 'light' | 'dark') => void
}

export default function NavigationDrawer({ open, current, onClose, onHome, onLectures, onLibrary, theme, onTheme }: NavigationDrawerProps) {
  const drawer = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const buttons = () => Array.from(drawer.current?.querySelectorAll<HTMLButtonElement>('button') || [])
    buttons()[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      }
      if (event.key === 'Tab') {
        const items = buttons()
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  return <div className={`navigation-layer ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}>
    <button className="drawer-scrim" aria-label="Close navigation backdrop" tabIndex={-1} onClick={onClose}/>
    <aside id="navigation-drawer" className="navigation-drawer" role="dialog" aria-modal="true" aria-label="Navigation" ref={drawer}>
      <div className="drawer-header">
        <div className="drawer-brand">Aha!</div>
        <button className="icon-button drawer-close" aria-label="Close navigation" onClick={onClose}><X className="drawer-close-glyph"/></button>
      </div>
      <nav className="drawer-links" aria-label="Your space">
        <button className={current === 'home' ? 'active' : ''} aria-current={current === 'home' ? 'page' : undefined} onClick={onHome}><span className="drawer-icon butter"><FolderOpen size={22}/></span><span>Home</span><ArrowUpRight size={18}/></button>
        <button className={current === 'lectures' ? 'active' : ''} aria-current={current === 'lectures' ? 'page' : undefined} onClick={onLectures}><span className="drawer-icon sage"><BookOpen size={22}/></span><span>Notes</span><ArrowUpRight size={18}/></button>
        <button className={current === 'library' ? 'active' : ''} aria-current={current === 'library' ? 'page' : undefined} onClick={onLibrary}><span className="drawer-icon lavender"><Library size={22}/></span><span>Library</span><ArrowUpRight size={18}/></button>
      </nav>
      <div className="drawer-bottom">
        <CurrentUser open={open}/>
        <button className="drawer-theme-toggle" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onClick={() => onTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Sun size={22}/> : <Moon size={22}/>}
        </button>
      </div>
    </aside>
  </div>
}
