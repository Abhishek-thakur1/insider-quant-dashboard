import { StrictMode, lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { resolveView } from './route'

// The redesign is the default; the classic dashboard is at ?view=classic (and #classic).
// #new keeps working for old links. Routing rules: src/route.ts.
const App2 = lazy(() => import('./redesign/App2'))
const ClassicApp = lazy(() => import('./ClassicApp'))

const current = () => resolveView(window.location.search, window.location.hash)

function Root() {
  const [view, setView] = useState(current)
  useEffect(() => {
    const on = () => setView(current())
    window.addEventListener('hashchange', on)
    window.addEventListener('popstate', on)
    return () => {
      window.removeEventListener('hashchange', on)
      window.removeEventListener('popstate', on)
    }
  }, [])
  return <Suspense fallback={null}>{view === 'classic' ? <ClassicApp /> : <App2 />}</Suspense>
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
