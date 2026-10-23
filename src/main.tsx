import { StrictMode, lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// The redesign is the default; the classic dashboard stays reachable at #classic until the
// owner approves removing it. A hash route, because vercel.json (no SPA fallback) is unchanged.
const App2 = lazy(() => import('./redesign/App2'))
const ClassicApp = lazy(() => import('./ClassicApp'))

function Root() {
  const [classic, setClassic] = useState(() => window.location.hash === '#classic')
  useEffect(() => {
    const on = () => setClassic(window.location.hash === '#classic')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return <Suspense fallback={null}>{classic ? <ClassicApp /> : <App2 />}</Suspense>
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
