// System health: coarse public status from GET /api/health (engine PR #24) plus the browser's own
// stream state. By design the public endpoint carries no quota, monitor or restart details. Lazy-loaded.
import { Activity, CalendarOff, CircleAlert, Moon, Radio, Signal, Timer } from 'lucide-react'
import type { Loadable } from '../data'
import { ago, istTime } from '../format.ts'
import type { Health } from '../logic.ts'
import { Reveal } from '../motion'
import { Empty, ViewSkeleton } from '../ui'

const STATUS: Record<string, { label: string; text: string; icon: React.ReactNode; cls: string }> = {
  live: { label: 'Live', text: 'The engine is receiving market data: the latest 5-minute Nifty candle closed within the last 10 minutes.', icon: <Radio size={22} aria-hidden />, cls: 'gain' },
  stale: { label: 'Stale', text: 'Inside market hours, but no fresh 5-minute Nifty candle in the last 10 minutes. The watchdog restarts the engine if the feed stays silent.', icon: <CircleAlert size={22} aria-hidden />, cls: 'warn' },
  closed: { label: 'Closed', text: 'Outside 09:15-15:30 IST. The engine runs only during the session.', icon: <Moon size={22} aria-hidden />, cls: 'muted' },
  holiday: { label: 'Holiday', text: 'NSE holiday. The engine does not run today.', icon: <CalendarOff size={22} aria-hidden />, cls: 'muted' },
}

export default function HealthView({ health, stream, updatedAt, now, market }: { health: Loadable<Health | null>; stream: string; updatedAt: number | null; now: number; market: string }) {
  if (health.loading && !health.data) return <ViewSkeleton />
  if (!health.data) return <div className="card"><Empty icon={<CircleAlert size={20} />} text="Couldn't load system health." sub={health.error ?? 'The API did not answer.'} /></div>
  const h = health.data
  const st = STATUS[h.status] ?? { label: h.status, text: 'Unknown status from the API.', icon: <Activity size={22} aria-hidden />, cls: 'muted' }
  const tiles: { icon: React.ReactNode; label: string; value: string; sub: string }[] = [
    { icon: <Signal size={18} aria-hidden />, label: 'Stocks seen today', value: String(h.stocksSeenToday), sub: 'symbols with today\'s VWAP state' },
    { icon: <Timer size={18} aria-hidden />, label: 'Last Nifty candle', value: h.lastIndexCandleAt ? istTime(h.lastIndexCandleAt) : '—', sub: h.lastIndexCandleAt ? `closed ${ago(h.lastIndexCandleAt, now)}` : 'none stored yet' },
    { icon: <Activity size={18} aria-hidden />, label: 'Ticks per 5 min', value: h.ticksPer5m == null ? 'n/a' : String(h.ticksPer5m), sub: h.ticksPer5m == null ? 'not published by the engine yet (API request listed)' : 'from the engine heartbeat' },
    { icon: <Radio size={18} aria-hidden />, label: 'Your live stream', value: stream, sub: `dashboard data updated ${ago(updatedAt, now)}` },
  ]
  return (
    <>
      <Reveal className="card" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 'var(--s4)', alignItems: 'center' }}>
        <span className={st.cls} style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 18, background: 'var(--surface-2)' }}>{st.icon}</span>
        <span style={{ display: 'grid', gap: 4 }}>
          <span className="lbl">Engine status · market {market.toLowerCase()}</span>
          <span className={st.cls} style={{ font: '600 var(--t-2xl) var(--display)' }}>{st.label}</span>
          <span className="muted" style={{ fontSize: 'var(--t-s)' }}>{st.text} Checked {ago(health.at, now)}.</span>
        </span>
      </Reveal>
      <div className="nf-grid">{tiles.map((t, i) => (
        <Reveal key={t.label} i={i + 1} className="card" style={{ display: 'grid', gap: 'var(--s2)' }}>
          <span className="lbl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="accent">{t.icon}</span>{t.label}</span>
          <span className="num" style={{ fontSize: 'var(--t-xl)' }}>{t.value}</span>
          <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>{t.sub}</span>
        </Reveal>))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 'var(--t-s)' }}>Public health is deliberately coarse: no quota, monitor, restart or host details (owner's rule; the dashboard has no login). Paper trading only.</p>
    </>
  )
}
