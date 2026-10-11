import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

// Simple, open pictograms with pill-shaped ends and curved corners.
function icon(name: string, drawing: ReactNode) {
  function Icon({ size = 24, className = '', ...props }: IconProps) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props} className={`aha-icon ${className}`}>{drawing}</svg>
  }
  Icon.displayName = name
  return Icon
}

export const ArrowRight = icon('ArrowRight', <path d="M4 12h14M13 6l4.5 4.5q1.5 1.5 0 3L13 18"/>)
export const ArrowLeft = icon('ArrowLeft', <path d="M20 12H6m5-6-4.5 4.5q-1.5 1.5 0 3L11 18"/>)
export const ArrowUpRight = icon('ArrowUpRight', <path d="M6 18 17 7M7 6h8q3 0 3 3v8"/>)
export const ChevronDown = icon('ChevronDown', <path d="m6 9 4.5 4.5q1.5 1.5 3 0L18 9"/>)
export const Plus = icon('Plus', <path d="M5 12h14M12 5v14"/>)
export const X = icon('X', <path d="m6 6 12 12M18 6 6 18"/>)
export const Trash = icon('Trash', <><path d="M4 6h16M9 6V4q0-1 1-1h4q1 0 1 1v2M6 6l1 13q.2 2 2 2h6q1.8 0 2-2l1-13M10 10v7m4-7v7" strokeWidth="2.5"/></>)
export const Check = icon('Check', <path d="m5 12 3 3.5q1.5 1.8 3-.2L19 7"/>)
export const Search = icon('Search', <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>)
export const Bookmark = icon('Bookmark', <path d="M8 4h8q3 0 3 3v11q0 3-2.5 1.5l-3-1.8q-1.5-.9-3 0l-3 1.8Q5 21 5 18V7q0-3 3-3Z"/>)
export const Archive = icon('Archive', <><rect x="3" y="3" width="18" height="5" rx="2"/><path d="M5 8v10q0 3 3 3h8q3 0 3-3V8M10 12h4" strokeWidth="2.5"/></>)
export const FolderOpen = icon('FolderOpen', <><path d="M3 16V7q0-3 3-3h3c2 0 2 3 4 3h5q3 0 3 3"/><path d="M7 11h12q3 0 2.4 3l-.7 3q-.7 3-3.7 3H6q-3 0-2.4-3l.6-3q.6-3 2.8-3Z"/></>)
export const BookOpen = icon('BookOpen', <><path d="M12 7c-2-2-5-3-7-3Q3 4 3 6v10q0 2 2 2c3 0 5 1 7 2 2-1 4-2 7-2q2 0 2-2V6q0-2-2-2c-2 0-5 1-7 3Z"/><path d="M12 7v13"/></>)
export const Library = icon('Library', <><path d="M4 5c-.4 4-.4 10 0 14M10 4c.4 5 .4 10 0 15m6-13c.7 4 2 9 3 13"/></>)
export const ListTree = icon('ListTree', <><path d="M5 4v12q0 3 3 3h3M5 8h6"/><rect x="12" y="5" width="8" height="6" rx="3"/><rect x="12" y="16" width="8" height="6" rx="3"/></>)
export const FileText = icon('FileText', <><rect x="5" y="3" width="14" height="18" rx="4"/><path d="M9 8h6m-6 4h6m-6 4h3" strokeWidth="2.5"/></>)
export const FileImage = icon('FileImage', <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><path d="m5 18 4-4q1.5-1.5 3 0l1 1m-1-1 2-3q1-1.5 2 0l4 6" strokeWidth="2.5"/></>)
export const Camera = icon('Camera', <><path d="M8 6l1-2h6l1 2h2q3 0 3 3v9q0 3-3 3H6q-3 0-3-3V9q0-3 3-3Z"/><circle cx="12" cy="13" r="3.5" strokeWidth="2.5"/></>)
export const Upload = icon('Upload', <><path d="M12 15V5M7 9l3.5-3.5q1.5-1.5 3 0L17 9M4 15v2q0 4 4 4h8q4 0 4-4v-2"/></>)
export const SlidersHorizontal = icon('SlidersHorizontal', <><path d="M3 7h3m6 0h9M3 17h9m6 0h3"/><rect x="6" y="4" width="6" height="6" rx="3"/><rect x="12" y="14" width="6" height="6" rx="3"/></>)
export const Atom = icon('Atom', <><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-40 12 12)" strokeWidth="2.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(40 12 12)" strokeWidth="2.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></>)
export const Layers3 = icon('Layers3', <><path d="m10 3-6 3q-2 1 0 2l6 3q2 1 4 0l6-3q2-1 0-2l-6-3q-2-1-4 0ZM3 13l7 3.5q2 1 4 0l7-3.5M3 18l7 3.5q2 1 4 0l7-3.5"/></>)
export const Sparkles = icon('Sparkles', <path d="M10 5v14M3 12h14m3-9v4m-2-2h4"/>)
export const Play = icon('Play', <path d="M7 6q0-3 2.5-1.5l10 6q2.5 1.5 0 3l-10 6Q7 21 7 18V6Z"/>)
export const Pause = icon('Pause', <path d="M7 5v14M17 5v14" strokeWidth="5"/>)
export const RotateCcw = icon('RotateCcw', <path d="M4 10a8 8 0 1 1 1 7M3 4v3q0 3 3 3h3"/>)
export const Maximize = icon('Maximize', <path d="M9 3H7q-4 0-4 4v2m12-6h2q4 0 4 4v2M3 15v2q0 4 4 4h2m12-6v2q0 4-4 4h-2"/>)
export const ClosedCaptions = icon('ClosedCaptions', <path d="M10 8.5a4.5 4.5 0 1 0 0 7m11-7a4.5 4.5 0 1 0 0 7"/>)
export const LoaderCircle = icon('LoaderCircle', <><circle cx="12" cy="12" r="8.5" opacity=".18"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/></>)
export const Sun = icon('Sun', <><circle cx="12" cy="12" r="4"/><path d="M12 2v1M12 21v1M2 12h1m18 0h1M5 5l.5.5m13 13 .5.5M5 19l.5-.5M18.5 5.5 19 5" strokeWidth="2.5"/></>)
export const Moon = icon('Moon', <path d="M11.5 3c1 0 1.2.4.6 1.2C8 10 12.8 16.7 19 15c.9-.2 1.4.3.8 1.2A9 9 0 1 1 11.5 3Z"/>)
export const Settings = icon('Settings', <><circle cx="12" cy="12" r="6"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.5 5.5l1.4 1.4m10.2 10.2 1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" strokeWidth="4"/></>)

export function MenuGlyph() {
  return <svg className="menu-glyph" viewBox="0 0 30 28" fill="none" aria-hidden="true"><path d="M3 5.5c7-.7 17-.7 24 0M3 14c7 .7 17 .7 24 0M3 22.5c7-.7 17-.7 24 0"/></svg>
}

