// History and analytics for a date: totals, cumulative R, per-detector table, activity heatmap,
// closed trades, CSV export. Lazy-loaded. Paper trading; every row shows n.
import { lazy, Suspense, useMemo, useState } from 'react'
import { calcStats, type Trade } from '../data'
import { signedR, signedRupees, tone } from '../format.ts'
import { byDetector } from '../logic.ts'
import { Reveal } from '../motion'
import { Empty, TradeList } from '../ui'

const HistoryChart = lazy(() => import('../HistoryChart'))

export default function HistoryView({ gated, all, heatmap, date, setDate, onSelect }: { gated: Trade[]; all: Trade[]; heatmap: { date: string; count: number }[]; date: string; setDate: (s: string) => void; onSelect: (t: Trade) => void }) {
  const [scope, setScope] = useState<'gated' | 'all'>('gated')
  const rows = scope === 'gated' ? gated : all
  const s = calcStats(rows)
  const det = useMemo(() => byDetector(rows), [rows])
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
    { label: 'Average R per trade', value: signedR(s.avgR), cls: tone(s.avgR), sub: s.total < 30 ? 'small sample, not an edge' : `n = ${s.total}` },
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
      <div className="nf-grid">{kpis.map((k, i) => (
        <Reveal key={k.label} i={i} className="card" style={{ display: 'grid', gap: 6 }}>
          <span className="lbl">{k.label}</span><span className={`num ${k.cls}`} style={{ fontSize: 'var(--t-2xl)' }}>{k.value}</span><span className="muted" style={{ fontSize: 'var(--t-s)' }}>{k.sub}</span>
        </Reveal>))}
      </div>
      <div className="nf-two">
        <section className="card" aria-labelledby="h-curve" style={{ minHeight: 260, display: 'grid', gap: 'var(--s2)' }}>
          <h2 id="h-curve">Cumulative R, {date}</h2>
          <Suspense fallback={<p className="muted">Loading chart…</p>}><HistoryChart trades={rows} /></Suspense>
        </section>
        <section className="card" aria-labelledby="h-det">
          <h2 id="h-det" style={{ marginBottom: 'var(--s3)' }}>By detector</h2>
          {det.length === 0 ? <Empty icon={<span>∅</span>} text="No closed trades." /> : (
            <table className="num" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-s)' }}>
              <thead><tr className="lbl"><th style={{ textAlign: 'left' }}>Detector</th><th>n</th><th>Win</th><th style={{ textAlign: 'right' }}>Total R</th></tr></thead>
              <tbody>{det.map((r) => (
                <tr key={r.detector} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 0', fontFamily: 'var(--body)' }}>{r.detector}</td><td style={{ textAlign: 'center' }}>{r.n}</td><td style={{ textAlign: 'center' }}>{r.winRate.toFixed(0)}%</td><td style={{ textAlign: 'right' }} className={tone(r.totalR)}>{signedR(r.totalR)}</td>
                </tr>))}</tbody>
            </table>)}
          <p className="muted" style={{ margin: 'var(--s2) 0 0', fontSize: 'var(--t-xs)' }}>Every row shows n. Small samples say nothing about an edge.</p>
        </section>
      </div>
      <section className="card" aria-labelledby="h-heat">
        <h2 id="h-heat" style={{ marginBottom: 'var(--s3)' }}>Activity, last 28 trading days</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, maxWidth: 420 }}>
          {days.map((h) => (
            <button key={h.date} onClick={() => setDate(String(h.date).slice(0, 10))} title={`${String(h.date).slice(0, 10)}: ${h.count} closed trades`} aria-label={`${String(h.date).slice(0, 10)}, ${h.count} closed trades`}
              style={{ aspectRatio: '1', minHeight: 32, borderRadius: 8, border: String(h.date).slice(0, 10) === date ? '2px solid var(--fg)' : '1px solid var(--line)', background: `color-mix(in srgb, var(--accent) ${Math.round((h.count / max) * 80)}%, var(--surface-2))`, cursor: 'pointer' }} />
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
