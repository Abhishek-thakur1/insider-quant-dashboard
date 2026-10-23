// Ninefifteen redesign — stage 1: shell + tokens, Today, Positions, History at parity with
// the classic dashboard (still reachable at #classic). Existing endpoints only. Paper trading.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MotionConfig, AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, History as HistoryIcon, LayoutDashboard, Layers, Moon, Search, Sun, X } from 'lucide-react'
import { ALL, calcStats, todayStr, tradeKey, useDashboardData, type Trade } from './data'
import { istParts, rupees, signedR, signedRupees, tone } from './format'
import './tokens.css'

const HistoryChart = lazy(() => import('./HistoryChart'))

type View = 'today' | 'positions' | 'history'
const VIEWS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', icon: Layers },
  { id: 'history', label: 'History', icon: HistoryIcon },
]

const loadPref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const savePref = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export default function App2() {
  const [view, setView] = useState<View>(() => (loadPref('nf:view', 'today') as View))
  const [theme, setTheme] = useState(() => loadPref('nf:theme', 'dark'))
  const [date, setDate] = useState(todayStr())
  const [detector, setDetector] = useState(ALL)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Trade | null>(null)
  const [now, setNow] = useState(Date.now())
  const d = useDashboardData(date, detector)

  useEffect(() => { savePref('nf:view', view) }, [view])
  useEffect(() => { savePref('nf:theme', theme) }, [theme])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const match = (t: Trade) => !query || t.symbol.toLowerCase().includes(query.toLowerCase()) || t.detectorName?.toLowerCase().includes(query.toLowerCase())
  const gated = useMemo(() => d.gatedHistory.filter(match), [d.gatedHistory, query])
  const all = useMemo(() => d.allHistory.filter(match), [d.allHistory, query])
  const open = useMemo(() => d.openTrades.filter(match), [d.openTrades, query])
  const ist = istParts(now)

  return (
    <MotionConfig reducedMotion="user">
      <div className="nf" data-theme={theme === 'light' ? 'light' : 'dark'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', minHeight: '100dvh' }} className="nf-shell">
          <style>{`
            .nf-shell { grid-template-columns: minmax(0,1fr) }
            @media (min-width: 1024px) { .nf-shell { grid-template-columns: 232px minmax(0,1fr) !important } .nf-side { display: flex !important } .nf-bottom { display: none !important } }
            .nf-main { padding: 16px max(16px, env(safe-area-inset-right,0px)) 96px max(16px, env(safe-area-inset-left,0px)); display: grid; gap: 16px; align-content: start; min-width: 0 }
            @media (min-width: 1024px) { .nf-main { padding: 24px 32px 40px } }
            .nf-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)) }
            .nf-two { display: grid; gap: 12px; grid-template-columns: minmax(0,1fr) } @media (min-width: 900px) { .nf-two { grid-template-columns: minmax(0,2fr) minmax(0,1fr) } }
          `}</style>

          <aside className="nf-side" style={{ display: 'none', flexDirection: 'column', gap: 6, padding: 20, borderRight: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', top: 0, height: '100dvh' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 18 }}>
              <span style={{ font: '600 1.35rem var(--display)' }}>Ninefifteen</span>
            </div>
            {VIEWS.map((v) => (
              <button key={v.id} className="btn" aria-pressed={view === v.id} onClick={() => setView(v.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', background: view === v.id ? 'var(--surface-2)' : 'transparent', borderColor: view === v.id ? undefined : 'transparent' }}>
                <v.icon size={18} aria-hidden /> {v.label}
              </button>
            ))}
            <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
              <span className="pill paper">PAPER TRADING · no proven edge</span>
              <a href="#classic" className="muted" style={{ fontSize: '.8rem' }}>Open the classic dashboard</a>
            </div>
          </aside>

          <main className="nf-main">
            <TopBar ist={ist} stream={d.stream} updatedAt={d.updatedAt} now={now} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
            <Controls date={date} setDate={setDate} detector={detector} setDetector={setDetector} detectors={d.detectors} query={query} setQuery={setQuery} isToday={d.isToday} />
            {d.error && <div className="card" role="status" style={{ borderColor: 'color-mix(in srgb, var(--warn) 50%, var(--line))' }}><span className="warn">{d.error}</span></div>}
            {view === 'today' && <TodayView d={d} gated={gated} all={all} open={open} onSelect={setSelected} />}
            {view === 'positions' && <PositionsView open={open} livePnl={d.livePnl} isToday={d.isToday} onSelect={setSelected} now={now} />}
            {view === 'history' && <HistoryView gated={gated} all={all} heatmap={d.heatmap} date={date} setDate={setDate} onSelect={setSelected} />}
          </main>
        </div>

        <nav className="nf-bottom" aria-label="Main" style={{ position: 'fixed', insetInline: 0, bottom: 0, display: 'grid', gridTemplateColumns: `repeat(${VIEWS.length}, 1fr)`, background: 'color-mix(in srgb, var(--surface) 94%, transparent)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--line)', padding: `6px max(8px, env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(8px, env(safe-area-inset-left,0px))`, zIndex: 20 }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} aria-current={view === v.id ? 'page' : undefined}
              style={{ background: 'none', border: 0, color: view === v.id ? 'var(--accent)' : 'var(--muted)', display: 'grid', justifyItems: 'center', gap: 2, padding: 6, font: '600 .7rem var(--body)', cursor: 'pointer' }}>
              <v.icon size={20} aria-hidden /> {v.label}
            </button>
          ))}
        </nav>

        <AnimatePresence>{selected && <TradeDrawer trade={selected} livePnl={d.livePnl[selected.symbol]} onClose={() => setSelected(null)} />}</AnimatePresence>
      </div>
    </MotionConfig>
  )
}

function TopBar({ ist, stream, updatedAt, now, theme, onTheme }: { ist: ReturnType<typeof istParts>; stream: string; updatedAt: number | null; now: number; theme: string; onTheme: () => void }) {
  const ago = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null
  const streamLabel = stream === 'live' ? '● stream live' : stream === 'connecting' ? '○ connecting' : stream === 'retrying' ? '○ reconnecting' : '○ stream off (not today)'
  return (
    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className="pill" aria-label={`Market ${ist.market}`}><span className={ist.market === 'Open' ? 'gain' : 'muted'}>●</span> Market {ist.market}</span>
        <span className="pill num">{ist.time} IST</span>
        <span className="pill">{streamLabel}</span>
        <span className="pill muted">{ago === null ? 'not loaded yet' : `updated ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`} ago`}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="pill paper">PAPER</span>
        <button className="btn" onClick={onTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      </div>
    </header>
  )
}

function Controls(p: { date: string; setDate: (s: string) => void; detector: string; setDetector: (s: string) => void; detectors: string[]; query: string; setQuery: (s: string) => void; isToday: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <label style={{ position: 'relative', flex: '1 1 200px', display: 'flex' }}>
        <Search size={16} aria-hidden style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input id="nf-search" value={p.query} onChange={(e) => p.setQuery(e.target.value)} placeholder="Search a symbol or detector" aria-label="Search" style={{ paddingLeft: 32, width: '100%' }} />
        {p.query && <button className="btn" aria-label="Clear search" onClick={() => p.setQuery('')} style={{ position: 'absolute', right: 4, top: 3, padding: '3px 6px' }}><X size={14} /></button>}
      </label>
      <select id="nf-detector" value={p.detector} onChange={(e) => p.setDetector(e.target.value)} aria-label="Detector">
        <option value={ALL}>All detectors</option>
        {p.detectors.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <CalendarDays size={16} aria-hidden className="muted" />
        <input id="nf-date" type="date" value={p.date} max={todayStr()} onChange={(e) => e.target.value && p.setDate(e.target.value)} aria-label="Date" />
      </label>
      {!p.isToday && <span className="chip warn">viewing {p.date}</span>}
    </div>
  )
}

function Kpi({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 6 }}>
      <span className="lbl">{label}</span>
      <span className={`num ${cls ?? ''}`} style={{ fontSize: '1.6rem', fontWeight: 500, lineHeight: 1.1 }}>{value}</span>
      {sub && <span className="muted" style={{ fontSize: '.8rem' }}>{sub}</span>}
    </div>
  )
}

function TodayView({ d, gated, all, open, onSelect }: { d: ReturnType<typeof useDashboardData>; gated: Trade[]; all: Trade[]; open: Trade[]; onSelect: (t: Trade) => void }) {
  const g = calcStats(gated)
  const a = calcStats(all)
  const unreal = open.reduce((s, t) => s + (d.livePnl[t.symbol] ?? 0), 0)
  const intraday = calcStats(all.filter((t) => (t.durationClass ?? 'INTRADAY') === 'INTRADAY'))
  const swing = calcStats(all.filter((t) => t.durationClass === 'SWING'))
  return (
    <>
      <div className="nf-grid">
        <Kpi label="Gated P&L (alerted)" value={signedRupees(g.pnl)} cls={tone(g.pnl)} sub={`${signedR(g.totalR)} · ${g.total} trades · best ${g.best === null ? '—' : signedR(g.best)} · worst ${g.worst === null ? '—' : signedR(g.worst)}`} />
        <Kpi label="All recorded P&L" value={signedRupees(a.pnl)} cls={tone(a.pnl)} sub={`${a.total} closed · intraday ${signedRupees(intraday.pnl)} · swing ${signedRupees(swing.pnl)}`} />
        <Kpi label="Win rate (gated)" value={g.total ? `${g.wins} / ${g.total}` : '—'} sub={g.total ? `${g.winRate.toFixed(0)}% · n = ${g.total}${g.total < 30 ? ' · small sample, not an edge' : ''}` : 'no closed gated trades'} />
        <Kpi label="Open now" value={String(open.length)} sub={d.isToday ? `unrealized ${signedRupees(unreal)}` : 'only shown for today'} />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '.8rem' }}>
        P&amp;L is summed from the closed paper trades for this date. Rows flagged as duplicates or invalid can't be shown separately yet: the API doesn't return data-quality flags (an API request is pending).
      </p>
      <div className="nf-two">
        <section className="card" aria-labelledby="t-recent">
          <h2 id="t-recent" style={{ fontSize: '1.15rem', marginBottom: 10 }}>Closed today</h2>
          <TradeList trades={all} onSelect={onSelect} empty={d.loading ? 'Loading…' : 'No closed trades for this date yet.'} />
        </section>
        <section className="card" aria-labelledby="t-open">
          <h2 id="t-open" style={{ fontSize: '1.15rem', marginBottom: 10 }}>Open positions</h2>
          <TradeList trades={open} onSelect={onSelect} live={d.livePnl} empty={d.isToday ? 'No open positions.' : 'Open positions are only shown for today.'} />
        </section>
      </div>
    </>
  )
}

function TradeList({ trades, onSelect, live, empty }: { trades: Trade[]; onSelect: (t: Trade) => void; live?: Record<string, number>; empty: string }) {
  if (!trades.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
      {trades.map((t) => {
        const p = live ? live[t.symbol] : t.pnl
        return (
          <li key={`${tradeKey(t)}-${t.id}`}>
            <button onClick={() => onSelect(t)} className="card click" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'center', color: 'var(--fg)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{t.symbol.replace(/^NSE:|-EQ$/g, '')}</span>{' '}
                <span className="chip">{t.side}</span>{' '}
                {t.gated ? <span className="chip gain">alerted</span> : <span className="chip muted">recorded</span>}
                <span className="muted" style={{ display: 'block', fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.detectorName} · {new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })}{t.exitReason ? ` · ${t.exitReason}` : ''}</span>
              </span>
              <span className={`num ${tone(p ?? 0)}`} style={{ textAlign: 'right' }}>{p === undefined ? <span className="muted">waiting</span> : signedRupees(p)}
                {typeof t.r_multiple === 'number' && <span className="muted" style={{ display: 'block', fontSize: '.78rem' }}>{signedR(t.r_multiple)}</span>}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Where the last price sits between stop (0%) and target (100%); null when a level isn't recorded. */
const progress = (t: Trade, lastPrice: number | null) => {
  if (typeof t.stopLoss !== 'number' || typeof t.target !== 'number' || lastPrice === null) return null
  const span = t.target - t.stopLoss
  return span === 0 ? null : Math.min(100, Math.max(0, ((lastPrice - t.stopLoss) / span) * 100))
}

function PositionsView({ open, livePnl, isToday, onSelect, now }: { open: Trade[]; livePnl: Record<string, number>; isToday: boolean; onSelect: (t: Trade) => void; now: number }) {
  if (!isToday) return <div className="card"><p className="muted" style={{ margin: 0 }}>Open positions are only shown for today. Pick today's date to see them.</p></div>
  if (!open.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>No open positions right now. Intraday positions are closed at 15:15 IST.</p></div>
  const ist = istParts(now)
  const toSquareOff = 15 * 60 + 15 - ist.mins
  return (
    <div className="nf-grid">
      {open.map((t) => {
        const qty = t.actualSize ?? t.size
        const pnl = livePnl[t.symbol]
        const last = pnl !== undefined && qty ? t.entryPrice + (t.side === 'LONG' ? pnl / qty : -pnl / qty) : null
        const pct = progress(t, last)
        const mins = Math.max(0, Math.round((now - t.timestamp) / 60000))
        return (
          <button key={`${tradeKey(t)}-${t.id}`} className="card click" onClick={() => onSelect(t)} style={{ textAlign: 'left', display: 'grid', gap: 10, color: 'var(--fg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{t.symbol.replace(/^NSE:|-EQ$/g, '')}</span>
              <span className="chip">{t.side} · {(t.durationClass ?? 'INTRADAY').toLowerCase()}</span>
            </div>
            <div className="num" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, fontSize: '.85rem' }}>
              <span><span className="lbl" style={{ display: 'block' }}>Entry</span>{rupees(t.entryPrice)}</span>
              <span><span className="lbl" style={{ display: 'block' }}>Stop</span>{typeof t.stopLoss === 'number' ? <span className="loss">{rupees(t.stopLoss)}</span> : <span className="muted">not recorded</span>}</span>
              <span><span className="lbl" style={{ display: 'block' }}>Target</span>{typeof t.target === 'number' ? <span className="gain">{rupees(t.target)}</span> : <span className="muted">not recorded</span>}</span>
            </div>
            {pct !== null && <div className="bar" role="img" aria-label={`Price is ${pct.toFixed(0)}% of the way from stop to target`}><i style={{ width: `${pct}%` }} /></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '.85rem' }}>
              <span className={`num ${tone(pnl ?? 0)}`}>{pnl === undefined ? <span className="muted">live P&amp;L waiting</span> : `${signedRupees(pnl)} live`}</span>
              <span className="muted">{mins} min{(t.durationClass ?? 'INTRADAY') === 'INTRADAY' && toSquareOff > 0 ? ` · square-off in ${Math.floor(toSquareOff / 60)}:${String(toSquareOff % 60).padStart(2, '0')}` : ''}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function HistoryView({ gated, all, heatmap, date, setDate, onSelect }: { gated: Trade[]; all: Trade[]; heatmap: { date: string; count: number }[]; date: string; setDate: (s: string) => void; onSelect: (t: Trade) => void }) {
  const [scope, setScope] = useState<'gated' | 'all'>('gated')
  const rows = scope === 'gated' ? gated : all
  const s = calcStats(rows)
  const byDetector = useMemo(() => {
    const m = new Map<string, Trade[]>()
    for (const t of rows) m.set(t.detectorName, [...(m.get(t.detectorName) ?? []), t])
    return [...m.entries()].map(([k, v]) => ({ detector: k, ...calcStats(v) })).sort((x, y) => y.totalR - x.totalR)
  }, [rows])
  const exportCsv = () => {
    const head = ['Symbol', 'Side', 'Duration', 'Entry Time', 'Exit Time', 'Detector', 'Regime', 'Gated', 'Capital Gated', 'Unconstrained Size', 'Actual Size', 'Entry Price', 'Exit Price', 'PnL', 'R-Multiple', 'Exit Reason']
    const lines = rows.map((t) => [t.symbol, t.side, t.durationClass || 'INTRADAY', new Date(t.timestamp).toISOString(), t.exitTimestamp ? new Date(t.exitTimestamp).toISOString() : '', t.detectorName, t.regimeClass || 'UNIVERSAL', t.gated ? 'YES' : 'NO', t.capitalGated ? 'YES' : 'NO', t.size, t.actualSize ?? t.size, t.entryPrice, t.exitPrice ?? '', t.pnl ?? 0, t.r_multiple ?? '', t.exitReason ?? ''].join(','))
    const a = document.createElement('a')
    a.href = encodeURI('data:text/csv;charset=utf-8,' + [head.join(','), ...lines].join('\n'))
    a.download = `ninefifteen_${date}_${scope}.csv`
    document.body.appendChild(a); a.click(); a.remove()
  }
  const max = Math.max(1, ...heatmap.map((h) => h.count))
  const days = heatmap.slice(0, 28).reverse()
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button className="btn" aria-pressed={scope === 'gated'} onClick={() => setScope('gated')}>Alerted (gated)</button>
        <button className="btn" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All recorded</button>
        {rows.length > 0 && <button className="btn" onClick={exportCsv}>Export CSV</button>}
      </div>
      <div className="nf-grid">
        <Kpi label="Total R" value={signedR(s.totalR)} cls={tone(s.totalR)} sub={`n = ${s.total}`} />
        <Kpi label="Average R per trade" value={signedR(s.avgR)} cls={tone(s.avgR)} sub={s.total < 30 ? 'small sample, not an edge' : undefined} />
        <Kpi label="P&L" value={signedRupees(s.pnl)} cls={tone(s.pnl)} sub={`${s.wins} wins of ${s.total}`} />
      </div>
      <div className="nf-two">
        <section className="card" aria-labelledby="h-curve" style={{ minHeight: 260, display: 'grid', gap: 8 }}>
          <h2 id="h-curve" style={{ fontSize: '1.15rem' }}>Cumulative R, {date}</h2>
          <Suspense fallback={<p className="muted">Loading chart…</p>}><HistoryChart trades={rows} /></Suspense>
        </section>
        <section className="card" aria-labelledby="h-det">
          <h2 id="h-det" style={{ fontSize: '1.15rem', marginBottom: 10 }}>By detector</h2>
          {byDetector.length === 0 ? <p className="muted" style={{ margin: 0 }}>No closed trades.</p> : (
            <table className="num" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead><tr className="lbl"><th style={{ textAlign: 'left' }}>Detector</th><th>n</th><th>Win</th><th style={{ textAlign: 'right' }}>Total R</th></tr></thead>
              <tbody>{byDetector.map((r) => (
                <tr key={r.detector} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'var(--body)' }}>{r.detector}</td><td style={{ textAlign: 'center' }}>{r.total}</td><td style={{ textAlign: 'center' }}>{r.winRate.toFixed(0)}%</td><td style={{ textAlign: 'right' }} className={tone(r.totalR)}>{signedR(r.totalR)}</td>
                </tr>))}</tbody>
            </table>)}
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '.75rem' }}>Every row shows n. Small samples say nothing about an edge.</p>
        </section>
      </div>
      <section className="card" aria-labelledby="h-heat">
        <h2 id="h-heat" style={{ fontSize: '1.15rem', marginBottom: 10 }}>Activity, last 28 trading days</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, maxWidth: 420 }}>
          {days.map((h) => (
            <button key={h.date} onClick={() => setDate(String(h.date).slice(0, 10))} title={`${String(h.date).slice(0, 10)}: ${h.count} closed trades`} aria-label={`${String(h.date).slice(0, 10)}, ${h.count} closed trades`}
              style={{ aspectRatio: '1', maxWidth: '100%', borderRadius: 6, border: String(h.date).slice(0, 10) === date ? '2px solid var(--fg)' : '1px solid var(--line)', background: `color-mix(in srgb, var(--accent) ${Math.round((h.count / max) * 80)}%, var(--surface-2))`, cursor: 'pointer' }} />
          ))}
        </div>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '.75rem' }}>Counts closed paper trades per day. Tap a day to open it.</p>
      </section>
      <section className="card" aria-labelledby="h-list">
        <h2 id="h-list" style={{ fontSize: '1.15rem', marginBottom: 10 }}>Closed trades ({rows.length})</h2>
        <TradeList trades={rows} onSelect={onSelect} empty="No closed trades for this date." />
      </section>
    </>
  )
}

function TradeDrawer({ trade: t, livePnl, onClose }: { trade: Trade; livePnl?: number; onClose: () => void }) {
  const closed = typeof t.exitPrice === 'number'
  const pnl = closed ? t.pnl ?? 0 : livePnl
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const row = (label: string, value: React.ReactNode) => (<div style={{ display: 'grid', gap: 2 }}><span className="lbl">{label}</span><span className="num">{value}</span></div>)
  return (
    <motion.div role="dialog" aria-modal="true" aria-label={`${t.symbol} trade details`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / .55)', zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <motion.aside initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: 'min(440px, 100%)', height: '100%', borderRadius: 0, display: 'grid', alignContent: 'start', gap: 16, overflowY: 'auto', paddingTop: 'calc(16px + env(safe-area-inset-top,0px))', paddingBottom: 'calc(16px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div><h2 style={{ fontSize: '1.4rem' }}>{t.symbol}</h2><span className="muted" style={{ fontSize: '.85rem' }}>{t.detectorName} · {t.side} · {(t.durationClass ?? 'INTRADAY').toLowerCase()}</span></div>
          <button className="btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          {row('Entry', `${rupees(t.entryPrice)} × ${t.actualSize ?? t.size}`)}
          {row('Exit', closed ? rupees(t.exitPrice as number) : 'open')}
          {row('Stop', typeof t.stopLoss === 'number' ? rupees(t.stopLoss) : <span className="muted">not recorded</span>)}
          {row('Target', typeof t.target === 'number' ? rupees(t.target) : <span className="muted">not recorded</span>)}
          {row('Entered', new Date(t.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }))}
          {row('Exited', t.exitTimestamp ? new Date(t.exitTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '—')}
          {row('Exit reason', t.exitReason ?? '—')}
          {row('R', typeof t.r_multiple === 'number' ? <span className={tone(t.r_multiple)}>{signedR(t.r_multiple)}</span> : '—')}
          {row('Alert', t.gated ? 'passed the filter (alerted)' : 'recorded only')}
          {row('Capital', t.capitalGated ? 'size reduced or skipped' : 'full size')}
        </div>
        <div className="card" style={{ background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="lbl">{closed ? 'Realized P&L (paper)' : 'Live P&L (paper)'}</span>
          <span className={`num ${tone(pnl ?? 0)}`} style={{ fontSize: '1.4rem' }}>{pnl === undefined ? 'waiting' : signedRupees(pnl)}</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '.8rem' }}>The signal, filter breakdown and alert text for this trade need the signals API (pending review). Only recorded values are shown, nothing is estimated.</p>
      </motion.aside>
    </motion.div>
  )
}
