// Ninefifteen redesign — the default view since 2026-10-23 (classic: ?view=classic).
// Stage 2 (UI polish): design system v2, motion, live states; Signals and Health from engine PR #24.
// Existing endpoints only. Paper trading, no proven edge — labelled on every P&L view.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MotionConfig, AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, CalendarDays, CircleSlash, Clock, History as HistoryIcon, LayoutDashboard, Layers, Moon, Radio, Search, Send, Sun, WifiOff, X, XCircle, Zap } from 'lucide-react'
import { ALL, calcStats, todayStr, tradeKey, useDashboardData, useHealth, useSignals, type Trade } from './data'
import { ago, clock, istParts, pct, rupees, secondsToSquareOff, shortSymbol, signedR, signedRupees, tone } from './format.ts'
import { cumulative, impliedPrice, isFlagged, notAlertedReason, signalsByTrade, statsRows, stopToTarget, wasAlerted, type SignalRow } from './logic.ts'
import { CountUp, Flash, Reveal } from './motion'
import { Empty, FlaggedToggle, SideChip, TradeList, ViewSkeleton } from './ui'
import { Sparkline } from './Sparkline'
import './tokens.css'

const HistoryView = lazy(() => import('./views/HistoryView'))
const SignalsView = lazy(() => import('./views/SignalsView'))
const HealthView = lazy(() => import('./views/HealthView'))

type View = 'today' | 'positions' | 'signals' | 'history' | 'health'
const VIEWS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', icon: Layers },
  { id: 'signals', label: 'Signals', icon: Zap },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'health', label: 'Health', icon: Activity },
]

const loadPref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const savePref = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export default function App2() {
  const [view, setView] = useState<View>(() => { const v = loadPref('nf:view', 'today') as View; return VIEWS.some((x) => x.id === v) ? v : 'today' })
  const [theme, setTheme] = useState(() => loadPref('nf:theme', 'dark'))
  // Stats leave out rows with data-quality flags unless the viewer opts in (owner, 31 Oct).
  const [includeFlagged, setIncludeFlagged] = useState(() => loadPref('nf:includeFlagged', 'false') === 'true')
  const [date, setDate] = useState(todayStr())
  const [detector, setDetector] = useState(ALL)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Trade | null>(null)
  const [now, setNow] = useState(Date.now())
  const d = useDashboardData(date, detector)
  const health = useHealth()
  const signals = useSignals(date, d.isToday)

  useEffect(() => { savePref('nf:view', view) }, [view])
  useEffect(() => { savePref('nf:theme', theme) }, [theme])
  useEffect(() => { savePref('nf:includeFlagged', String(includeFlagged)) }, [includeFlagged])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const q = query.trim().toLowerCase()
  const match = (t: Trade) => !q || t.symbol.toLowerCase().includes(q) || t.detectorName?.toLowerCase().includes(q)
  const gated = useMemo(() => d.gatedHistory.filter(match), [d.gatedHistory, q])
  const all = useMemo(() => d.allHistory.filter(match), [d.allHistory, q])
  const dayFires = useMemo(() => (signals.data ?? []).filter((r) => detector === ALL || r.detector === detector), [signals.data, detector])
  const open = useMemo(() => d.openTrades.filter(match), [d.openTrades, q])
  const ist = istParts(now, health.data?.status)

  return (
    <MotionConfig reducedMotion="user">
      <div className="nf" data-theme={theme === 'light' ? 'light' : 'dark'}>
        <div className="nf-shell">
          <aside className="nf-side" aria-label="Sidebar">
            <div style={{ display: 'grid', gap: 2, marginBottom: 'var(--s5)' }}>
              <span style={{ font: '600 1.45rem var(--display)' }}>Ninefifteen</span>
              <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>NSE intraday · paper</span>
            </div>
            <nav aria-label="Main" style={{ display: 'grid', gap: 'var(--s1)' }}>
              {VIEWS.map((v) => (
                <button key={v.id} className="navbtn" aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
                  <v.icon size={18} aria-hidden /> {v.label}
                </button>
              ))}
            </nav>
            <div style={{ marginTop: 'auto', display: 'grid', gap: 'var(--s2)' }}>
              <span className="pill paper">PAPER TRADING · no proven edge</span>
              <a href="?view=classic" className="muted linkpad" style={{ fontSize: 'var(--t-s)' }}>Classic view</a>
            </div>
          </aside>

          <main className="nf-main">
            <TopBar ist={ist} stream={d.stream} updatedAt={d.updatedAt} now={now} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
            <StateBanner market={ist.market} weekend={ist.weekend} stream={d.stream} isToday={d.isToday} error={d.error} />
            {view !== 'health' && <Controls date={date} setDate={setDate} detector={detector} setDetector={setDetector} detectors={d.detectors} query={query} setQuery={setQuery} isToday={d.isToday} />}
            <Suspense fallback={<ViewSkeleton />}>
              {view === 'today' && <TodayView d={d} all={all} open={open} fires={dayFires} signalsLoaded={!!signals.data} now={now} onSelect={setSelected} includeFlagged={includeFlagged} setIncludeFlagged={setIncludeFlagged} />}
              {view === 'positions' && <PositionsView open={open} livePnl={d.livePnl} isToday={d.isToday} loading={d.loading} onSelect={setSelected} now={now} />}
              {view === 'signals' && <SignalsView signals={signals} date={date} isToday={d.isToday} query={q} detector={detector} trades={d.allHistory} />}
              {view === 'history' && <HistoryView gated={gated} all={all} heatmap={d.heatmap} date={date} setDate={setDate} onSelect={setSelected} includeFlagged={includeFlagged} setIncludeFlagged={setIncludeFlagged} />}
              {view === 'health' && <HealthView health={health} stream={d.stream} updatedAt={d.updatedAt} now={now} market={ist.market} />}
            </Suspense>
            <footer className="nf-foot">
              <a href="?view=classic" className="muted linkpad" style={{ fontSize: 'var(--t-s)', paddingInline: 'var(--s3)' }}>Classic view</a>
            </footer>
          </main>
        </div>

        <nav className="nf-bottom" aria-label="Main" style={{ gridTemplateColumns: `repeat(${VIEWS.length}, 1fr)` }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} aria-current={view === v.id ? 'page' : undefined} aria-label={v.label}>
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
  const open = ist.market === 'Open'
  const s = stream === 'live' ? { icon: <Radio size={13} aria-hidden className="gain pulse" />, text: 'live' } : stream === 'off' ? { icon: <CircleSlash size={13} aria-hidden className="muted" />, text: 'off (not today)' } : { icon: <WifiOff size={13} aria-hidden className="warn" />, text: stream === 'connecting' ? 'connecting' : 'reconnecting' }
  return (
    <header style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center', minWidth: 0 }}>
        <span className="pill"><span className="sr">Market {ist.market}. </span><span aria-hidden className={open ? 'gain pulse' : ist.market === 'Pre-open' ? 'warn' : 'muted'}>●</span> {ist.market === 'Holiday' ? 'NSE holiday' : <><span className="hide-sm">Market </span>{ist.market.toLowerCase()}</>}</span>
        <span className="pill num"><Clock size={13} aria-hidden className="muted" /> {ist.time}<span className="hide-sm"> IST</span></span>
        <span className="pill" title={`updated ${ago(updatedAt, now)}`}>{s.icon}<span className="sr">Live stream {s.text}, updated {ago(updatedAt, now)}. </span><span className="hide-sm">stream {s.text}</span></span>
        <span className="pill muted hide-sm">updated {ago(updatedAt, now)}</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <span className="pill paper">PAPER</span>
        <button className="btn" onClick={onTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
      </div>
    </header>
  )
}

/** One calm line that explains a quiet or degraded state, so it looks intentional, not broken. */
function StateBanner({ market, weekend, stream, isToday, error }: { market: string; weekend: boolean; stream: string; isToday: boolean; error: string | null }) {
  let icon = <Clock size={16} aria-hidden />, text: string | null = null, cls = 'muted'
  if (error) { icon = <AlertTriangle size={16} aria-hidden />; text = `${error} Numbers below are the last ones loaded.`; cls = 'warn' }
  else if (!isToday) text = null
  else if (market === 'Holiday') text = 'NSE holiday: the engine does not run today. Records from the last session stay below.'
  else if (weekend) text = 'Weekend: the market is closed. Showing today\'s records (normally none).'
  else if (market === 'Pre-open') text = 'Pre-open: the engine starts tracking at 09:15 IST.'
  else if (market === 'Closed') text = 'Market closed. The day\'s paper record is final; live updates resume at 09:15 IST on the next trading day.'
  else if (stream === 'retrying' || stream === 'connecting') { icon = <WifiOff size={16} aria-hidden />; text = 'Live stream reconnecting. Numbers still refresh every 30 seconds.'; cls = 'warn' }
  if (!text) return null
  return (
    <div role="status" className={`card flat ${cls}`} style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', padding: 'var(--s3) var(--s4)', fontSize: 'var(--t-s)' }}>
      {icon}<span style={{ color: 'var(--fg)' }}>{text}</span>
    </div>
  )
}

function Controls(p: { date: string; setDate: (s: string) => void; detector: string; setDetector: (s: string) => void; detectors: string[]; query: string; setQuery: (s: string) => void; isToday: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center' }}>
      <label style={{ position: 'relative', flex: '1 1 220px', display: 'flex' }}>
        <Search size={16} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input id="nf-search" value={p.query} onChange={(e) => p.setQuery(e.target.value)} placeholder="Search a symbol or detector" aria-label="Search" style={{ paddingLeft: 36, width: '100%' }} />
        {p.query && <button className="btn" aria-label="Clear search" onClick={() => p.setQuery('')} style={{ position: 'absolute', right: 0, top: 0, border: 0, background: 'transparent' }}><X size={16} /></button>}
      </label>
      <select id="nf-detector" value={p.detector} onChange={(e) => p.setDetector(e.target.value)} aria-label="Detector" style={{ flex: '1 1 160px', maxWidth: 280 }}>
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

function StatCard({ label, value, format, sub, spark, sparkLabel, i, valueTone }: { label: string; value: number | null; format: (n: number) => string; sub: React.ReactNode; spark?: ReturnType<typeof cumulative>; sparkLabel?: string; i: number; valueTone?: string }) {
  return (
    <Reveal i={i} className="card" style={{ display: 'grid', gap: 'var(--s2)', alignContent: 'start' }}>
      <span className="lbl">{label}</span>
      <span className={`num ${valueTone ?? (value === null ? 'muted' : tone(value))}`} style={{ fontSize: 'var(--t-2xl)', fontWeight: 500, lineHeight: 1.1 }}>
        {value === null ? '—' : <Flash value={value}><CountUp value={value} format={format} /></Flash>}
      </span>
      {spark && <Sparkline points={spark} label={sparkLabel ?? label} />}
      <span className="muted" style={{ fontSize: 'var(--t-s)' }}>{sub}</span>
    </Reveal>
  )
}

function TodayView({ d, all, open, fires, signalsLoaded, now, onSelect, includeFlagged, setIncludeFlagged }: { d: ReturnType<typeof useDashboardData>; all: Trade[]; open: Trade[]; fires: SignalRow[]; signalsLoaded: boolean; now: number; onSelect: (t: Trade) => void; includeFlagged: boolean; setIncludeFlagged: (v: boolean) => void }) {
  // Alerted = actually sent to Telegram (signal log); recorded-only = every other paper trade.
  const byTrade = useMemo(() => signalsByTrade(fires), [fires])
  const alerted = useMemo(() => all.filter((t) => wasAlerted(t, byTrade)), [all, byTrade])
  const recorded = useMemo(() => all.filter((t) => !wasAlerted(t, byTrade)), [all, byTrade])
  // Stats and sparklines use unflagged rows unless the viewer includes flagged ones; the lists show every row.
  const alertedStats = statsRows(alerted, includeFlagged), allStats = statsRows(all, includeFlagged)
  const g = calcStats(alertedStats), a = calcStats(allStats)
  const unreal = open.reduce((s, t) => s + (d.livePnl[t.symbol] ?? 0), 0)
  const flagged = all.filter(isFlagged)
  const flags = [...new Set(flagged.flatMap((t) => t.dataQuality ?? []))]
  const rejected = fires.filter((r) => r.outcome === 'REJECTED').length
  const day = d.isToday ? 'today' : 'on this date'
  if (d.loading && !d.updatedAt) return <ViewSkeleton />
  return (
    <>
      <div className="nf-grid" role="group" aria-label="Paper P&L">
        <StatCard i={0} label="Alerted P&L · paper" value={g.pnl} format={signedRupees} spark={cumulative(alertedStats, 'pnl')} sparkLabel="Alerted cumulative P&L"
          sub={g.total ? <>{signedR(g.totalR)} · {g.total} trade{g.total === 1 ? '' : 's'} · best {g.best === null ? '—' : signedR(g.best)} · worst {g.worst === null ? '—' : signedR(g.worst)}</> : `No alerted trades closed ${day}`} />
        <StatCard i={1} label="All recorded (paper)" value={a.pnl} format={signedRupees} spark={cumulative(allStats, 'pnl')} sparkLabel="All recorded cumulative P&L"
          sub={a.total < 30 ? `n=${a.total}, too small to mean anything` : `n=${a.total}`} />
        <StatCard i={2} label="Win rate · alerted" value={g.total ? g.winRate : null} format={(n) => pct(n)} valueTone="accent"
          sub={g.total ? <>{g.wins} of {g.total}{g.total < 30 ? ' · small sample, not an edge' : ''}</> : 'no closed alerted trades'} />
        <StatCard i={3} label="Open now · paper" value={open.length} format={(n) => String(Math.round(n))} valueTone="accent"
          sub={d.isToday ? <>unrealized <span className={`num ${tone(unreal)}`}>{signedRupees(unreal)}</span></> : 'only shown for today'} />
      </div>
      {flagged.length > 0 && (
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-s)' }}><AlertTriangle size={13} aria-hidden className="warn" /> {flagged.length} of {all.length} rows carry data-quality flags ({flags.join(', ')}).</p>
      )}
      <FlaggedToggle include={includeFlagged} setInclude={setIncludeFlagged} flagged={flagged.length} />
      <div className="nf-two">
        <section className="card" aria-labelledby="t-alerted">
          <div className="card-head"><h2 id="t-alerted">Alerted trades (sent to Telegram)</h2><span className="chip accent">{alerted.length}</span></div>
          <TradeList trades={alerted} onSelect={onSelect} tag={() => <span className="chip accent"><Send size={12} aria-hidden /> alerted</span>}
            empty={<Empty icon={<Send size={20} />} text={`No alerts ${day}.${signalsLoaded && fires.length ? ` The filter rejected ${rejected} of ${fires.length} signals.` : ''}`} sub={recorded.length ? 'The trades below were recorded on paper only.' : undefined} />} />
        </section>
        <section className="card" aria-labelledby="t-open">
          <div className="card-head"><h2 id="t-open">Open positions</h2><span className="chip">{open.length}</span></div>
          {!d.isToday ? <Empty icon={<Layers size={20} />} text="Open positions are only shown for today." />
            : open.length === 0 ? <Empty icon={<Layers size={20} />} text="Flat. No open paper positions right now." sub="Intraday positions are squared off at 15:15 IST." />
              : <div style={{ display: 'grid', gap: 'var(--s3)' }}>{open.map((t, i) => <Reveal key={`${tradeKey(t)}-${t.id}`} i={i}><PositionCard t={t} pnl={d.livePnl[t.symbol]} now={now} onSelect={onSelect} /></Reveal>)}</div>}
        </section>
      </div>
      <section className="card" aria-labelledby="t-recorded">
        <div className="card-head"><h2 id="t-recorded">Recorded only (rejected by the filter, paper)</h2><span className="chip">{recorded.length}</span></div>
        <p className="muted" style={{ margin: '0 0 var(--s3)', fontSize: 'var(--t-s)' }}>Every detector fire is recorded as a simulated paper trade, including fires the filter rejected. These were never sent as alerts and were not taken.</p>
        <TradeList trades={recorded} onSelect={onSelect} tag={(t) => <span className="chip loss"><XCircle size={12} aria-hidden /> {notAlertedReason(byTrade.get(Number(t.id)))}</span>}
          empty={<Empty icon={<Clock size={20} />} text={`No recorded-only trades closed ${day}.`} />} />
      </section>
    </>
  )
}

function PositionCard({ t, pnl, now, onSelect }: { t: Trade; pnl: number | undefined; now: number; onSelect: (t: Trade) => void }) {
  const last = impliedPrice(t, pnl)
  const pos = stopToTarget(t, last)
  const entryPos = stopToTarget(t, t.entryPrice)
  const mins = Math.max(0, Math.round((now - t.timestamp) / 60000))
  const left = (t.durationClass ?? 'INTRADAY') === 'INTRADAY' ? secondsToSquareOff(now) : null
  return (
    <motion.button layoutId={`trade-${t.id}`} className="card flat click" onClick={() => onSelect(t)} style={{ width: '100%', textAlign: 'left', display: 'grid', gap: 'var(--s3)', color: 'var(--fg)' }} aria-label={`${shortSymbol(t.symbol)} ${t.side} open position`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)', alignItems: 'center' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontWeight: 600, fontSize: 'var(--t-l)' }}>{shortSymbol(t.symbol)}</span><SideChip side={t.side} /></span>
        <span className={`num ${tone(pnl ?? 0)}`} style={{ fontSize: 'var(--t-l)' }}>{pnl === undefined ? <span className="muted" style={{ fontSize: 'var(--t-s)' }}>waiting for price</span> : <Flash value={pnl}>{signedRupees(pnl)}</Flash>}</span>
      </div>
      <div className="num" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, fontSize: 'var(--t-s)' }}>
        <span><span className="lbl" style={{ display: 'block' }}>Stop</span>{typeof t.stopLoss === 'number' ? <span className="loss">{rupees(t.stopLoss)}</span> : <span className="muted">not recorded</span>}</span>
        <span><span className="lbl" style={{ display: 'block' }}>Entry</span>{rupees(t.entryPrice)}</span>
        <span style={{ textAlign: 'right' }}><span className="lbl" style={{ display: 'block' }}>Target</span>{typeof t.target === 'number' ? <span className="gain">{rupees(t.target)}</span> : <span className="muted">not recorded</span>}</span>
      </div>
      {pos !== null ? (
        <div role="img" aria-label={`Price is ${pos.toFixed(0)}% of the way from stop to target`} style={{ position: 'relative' }}>
          <div className="bar" style={{ height: 10, background: 'linear-gradient(90deg, var(--loss-bg), var(--surface-3) 45%, var(--gain-bg))' }}><i style={{ width: `${pos}%`, background: pos >= (entryPos ?? 50) ? 'var(--gain)' : 'var(--loss)', opacity: .85 }} /></div>
          {entryPos !== null && <span aria-hidden style={{ position: 'absolute', top: -3, left: `calc(${entryPos}% - 1px)`, width: 2, height: 16, background: 'var(--fg)', borderRadius: 2, opacity: .7 }} />}
        </div>
      ) : <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>{typeof t.stopLoss === 'number' && typeof t.target === 'number' ? 'Progress appears with the first live price.' : 'Levels not recorded, so no progress bar.'}</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)', fontSize: 'var(--t-xs)' }} className="muted">
        <span>{t.detectorName} · {mins} min open</span>
        <span className="num">{left !== null ? <>square-off in <span style={{ color: left < 900 ? 'var(--warn)' : 'var(--fg)' }}>{clock(left)}</span></> : (t.durationClass === 'SWING' ? 'swing' : 'past 15:15')}</span>
      </div>
    </motion.button>
  )
}

function PositionsView({ open, livePnl, isToday, loading, onSelect, now }: { open: Trade[]; livePnl: Record<string, number>; isToday: boolean; loading: boolean; onSelect: (t: Trade) => void; now: number }) {
  if (!isToday) return <div className="card"><Empty icon={<Layers size={20} />} text="Open positions are only shown for today." sub="Pick today's date to see them." /></div>
  if (loading && !open.length) return <ViewSkeleton />
  if (!open.length) return <div className="card"><Empty icon={<Layers size={20} />} text="No open paper positions right now." sub="Intraday positions are closed at 15:15 IST. New ones appear here the moment a detector fires." /></div>
  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 'var(--t-s)' }}>Paper positions · live P&amp;L from the event stream · the bar runs from stop (left) to target (right); the tick marks the entry.</p>
      <div className="nf-grid">{open.map((t, i) => <Reveal key={`${tradeKey(t)}-${t.id}`} i={i}><PositionCard t={t} pnl={livePnl[t.symbol]} now={now} onSelect={onSelect} /></Reveal>)}</div>
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
      onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / .55)', backdropFilter: 'blur(3px)', zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <motion.aside initial={{ x: 60, opacity: .6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: 'min(460px, 100%)', height: '100%', borderRadius: 'var(--r-xl) 0 0 var(--r-xl)', display: 'grid', alignContent: 'start', gap: 'var(--s4)', overflowY: 'auto', paddingTop: 'calc(var(--s5) + env(safe-area-inset-top,0px))', paddingBottom: 'calc(var(--s5) + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)' }}>
          <div style={{ display: 'grid', gap: 4 }}><h2 style={{ fontSize: 'var(--t-xl)' }}>{shortSymbol(t.symbol)}</h2><span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><SideChip side={t.side} /><span className="chip">{(t.durationClass ?? 'INTRADAY').toLowerCase()}</span>{t.gated ? <span className="chip accent">alerted</span> : <span className="chip">recorded only</span>}</span></div>
          <button className="btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="card flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--s2)' }}>
          <span className="lbl">{closed ? 'Realized P&L · paper' : 'Live P&L · paper'}</span>
          <span className={`num ${tone(pnl ?? 0)}`} style={{ fontSize: 'var(--t-xl)' }}>{pnl === undefined ? 'waiting' : signedRupees(pnl)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--s3)' }}>
          {row('Detector', <span style={{ fontFamily: 'var(--body)' }}>{t.detectorName}</span>)}
          {row('R', typeof t.r_multiple === 'number' ? <span className={tone(t.r_multiple)}>{signedR(t.r_multiple)}</span> : '—')}
          {row('Entry', `${rupees(t.entryPrice)} × ${t.actualSize ?? t.size}`)}
          {row('Exit', closed ? rupees(t.exitPrice as number) : 'open')}
          {row('Stop', typeof t.stopLoss === 'number' ? rupees(t.stopLoss) : <span className="muted">not recorded</span>)}
          {row('Target', typeof t.target === 'number' ? rupees(t.target) : <span className="muted">not recorded</span>)}
          {row('Entered', new Date(t.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }))}
          {row('Exited', t.exitTimestamp ? new Date(t.exitTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '—')}
          {row('Exit reason', t.exitReason ?? '—')}
          {row('Capital', t.capitalGated ? 'size reduced or skipped' : 'full size')}
          {row('Regime class', t.regimeClass ?? '—')}
          {row('Data quality', (t.dataQuality ?? []).length ? (t.dataQuality ?? []).join(', ') : 'no flags')}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-s)' }}>Only recorded values are shown, nothing is estimated. The filter's score breakdown per trade is not in the API yet (request listed).</p>
      </motion.aside>
    </motion.div>
  )
}
