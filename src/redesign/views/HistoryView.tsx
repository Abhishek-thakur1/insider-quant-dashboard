// History and analytics: equity curve over the latest closed trades (R or ₹, with ranges), totals
// and per-detector bars for the selected date, activity heatmap, closed trades, CSV export.
// Lazy-loaded. Paper trading; every detector row shows n.
import { useMemo, useState } from 'react'
import { DetectorBars, EquityCurve } from '../charts'
import { calcStats, useRecentHistory, type Trade } from '../data'
import { signedR, signedRupees, tone } from '../format.ts'
import { byDetector, isFlagged, statsRows } from '../logic.ts'
import { Reveal, Skeleton } from '../motion'
import { Empty, FlaggedToggle, TradeList } from '../ui'

export default function HistoryView({ gated, all, heatmap, date, setDate, onSelect, includeFlagged, setIncludeFlagged }: { gated: Trade[]; all: Trade[]; heatmap: { date: string; count: number }[]; date: string; setDate: (s: string) => void; onSelect: (t: Trade) => void; includeFlagged: boolean; setIncludeFlagged: (v: boolean) => void }) {
  const [scope, setScope] = useState<'gated' | 'all'>('gated')
  const rows = scope === 'gated' ? gated : all
  // KPIs, detector bars and the equity curve use unflagged rows by default; the list and CSV keep every row.
  const kept = useMemo(() => statsRows(rows, includeFlagged), [rows, includeFlagged])
  const s = calcStats(kept)
  const det = useMemo(() => byDetector(kept), [kept])
  const recent = useRecentHistory(scope === 'gated')
  const recentKept = useMemo(() => statsRows(recent.data ?? [], includeFlagged), [recent.data, includeFlagged])
  const flaggedCount = new Set([...rows, ...(recent.data ?? [])].filter(isFlagged).map((t) => t.id)).size
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
  const kpis = [
    { label: 'Total R · paper', value: signedR(s.totalR), cls: tone(s.totalR), sub: `n = ${s.total}` },
    { label: 'Average R per trade', value: signedR(s.avgR), cls: tone(s.avgR), sub: s.total === 0 ? 'no trades' : s.total < 30 ? `n = ${s.total} · small sample, not an edge` : `n = ${s.total}` },
    { label: 'P&L · paper', value: signedRupees(s.pnl), cls: tone(s.pnl), sub: `${s.wins} wins of ${s.total}` },
  ]
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="seg" role="group" aria-label="Which trades">
          <button aria-pressed={scope === 'gated'} onClick={() => setScope('gated')}>Alerted (gated)</button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All recorded</button>
        </div>
        {rows.length > 0 && <button className="btn" onClick={exportCsv}>Export CSV</button>}
      </div>
      <FlaggedToggle include={includeFlagged} setInclude={setIncludeFlagged} flagged={flaggedCount} />
      <div className="nf-grid">{kpis.map((k, i) => (
        <Reveal key={k.label} i={i} className="card" style={{ display: 'grid', gap: 6 }}>
          <span className="lbl">{k.label}</span><span className={`num ${k.cls}`} style={{ fontSize: 'var(--t-2xl)' }}>{k.value}</span><span className="muted" style={{ fontSize: 'var(--t-s)' }}>{k.sub}</span>
        </Reveal>))}
      </div>
      <div className="nf-two">
        <section className="card" aria-labelledby="h-curve" style={{ display: 'grid', gap: 'var(--s2)' }}>
          <div className="card-head" style={{ marginBottom: 0 }}><h2 id="h-curve">Equity curve · paper</h2><span className="chip">{scope === 'gated' ? 'alerted' : 'all recorded'}</span></div>
          {recent.loading && !recent.data ? <Skeleton h={260} r={14} />
            : recent.error && !recent.data ? <Empty icon={<span>!</span>} text="Couldn't load recent history." sub={recent.error} />
              : <EquityCurve trades={recentKept} note={`Latest ${recentKept.length} closed trades across days${includeFlagged ? '' : `, flagged rows left out (${(recent.data?.length ?? 0) - recentKept.length})`} (the API returns at most 200; a longer history needs an API change, request listed). Ranges count back from the latest trade.`} />}
        </section>
        <section className="card" aria-labelledby="h-det">
          <div className="card-head"><h2 id="h-det">By detector, {date}</h2><span className="chip">n = {s.total}</span></div>
          {det.length === 0 ? <Empty icon={<span>∅</span>} text="No closed trades on this date." /> : <DetectorBars rows={det} />}
          <p className="muted" style={{ margin: 'var(--s3) 0 0', fontSize: 'var(--t-xs)' }}>Total R per detector, with n on every row. Fewer than 30 trades says nothing about an edge.</p>
        </section>
      </div>
      <section className="card" aria-labelledby="h-heat">
        <h2 id="h-heat" style={{ marginBottom: 'var(--s3)' }}>Activity, last 28 trading days</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6, maxWidth: 560 }}>
          {days.map((h) => (
            <button key={h.date} onClick={() => setDate(String(h.date).slice(0, 10))} title={`${String(h.date).slice(0, 10)}: ${h.count} closed trades`} aria-label={`${String(h.date).slice(0, 10)}, ${h.count} closed trades`}
              style={{ aspectRatio: '1', minHeight: 44, minWidth: 44, borderRadius: 8, border: String(h.date).slice(0, 10) === date ? '2px solid var(--fg)' : '1px solid var(--line)', background: `color-mix(in srgb, var(--accent) ${Math.round((h.count / max) * 80)}%, var(--surface-2))`, cursor: 'pointer' }} />
          ))}
        </div>
        <p className="muted" style={{ margin: 'var(--s2) 0 0', fontSize: 'var(--t-xs)' }}>Closed paper trades per day. Tap a day to open it.</p>
      </section>
      <section className="card" aria-labelledby="h-list">
        <h2 id="h-list" style={{ marginBottom: 'var(--s3)' }}>Closed trades ({rows.length})</h2>
        <TradeList trades={rows} onSelect={onSelect} empty={<Empty icon={<span>∅</span>} text="No closed trades for this date." />} />
      </section>
    </>
  )
}
