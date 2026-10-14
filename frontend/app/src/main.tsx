import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dynapuff/600.css'
import App from './App'
import CapturePage from './CapturePage'
import LiveNotesPage from './LiveNotesPage'
import { readLiveReaderCredentials } from './liveReader'
import './styles.css'
import './interface.css'
import './plan.css'
import './artwork.css'
import './workspace.css'
import './learning.css'

// Consume fragment credentials once, before StrictMode and any application fetches.
let readerStorage: Storage | undefined
try { readerStorage = window.sessionStorage } catch { /* Fresh links still work in memory. */ }
const liveReader = window.location.pathname.startsWith('/live/')
  ? readLiveReaderCredentials(window.location, readerStorage, url => window.history.replaceState(null, '', url))
  : null
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{liveReader ? <LiveNotesPage credentials={liveReader}/> : window.location.pathname === '/capture' ? <CapturePage/> : <App />}</React.StrictMode>)
