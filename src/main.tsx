import { StrictMode, lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// The classic dashboard stays the default; the redesign is opt-in at #new until the owner
// approves switching. A hash route, because vercel.json (no SPA fallback) is unchanged.
const App2 = lazy(() => import('./redesign/App2'))
const ClassicApp = lazy(() => import('./ClassicApp'))

const isNew = () => window.location.hash === '#new'

function Root() {
  const [redesign, setRedesign] = useState(isNew)
  useEffect(() => {
    const on = () => setRedesign(isNew())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return <Suspense fallback={null}>{redesign ? <App2 /> : <ClassicApp />}</Suspense>
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
