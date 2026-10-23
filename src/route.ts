// Which dashboard a URL shows. The redesign is the default; the classic dashboard stays reachable.
//   /                 → new
//   /?view=classic    → classic        /#classic → classic
//   /?view=new        → new            /#new     → new (old links)
// The query wins over the hash, so /?view=classic#new is classic. Unknown values fall back to new.
// Query and hash only: vercel.json has no SPA fallback, so a path route would 404.
export type View = 'new' | 'classic'

export function resolveView(search: string, hash: string): View {
  const q = new URLSearchParams(search).get('view')
  if (q === 'classic' || q === 'new') return q
  return hash === '#classic' ? 'classic' : 'new'
}
