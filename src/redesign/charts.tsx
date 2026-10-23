// Hand-built SVG charts for the redesign (no chart library; loaded only with the views that use them).
// Real data only, ARIA-labelled, keyboard-steppable where interactive, drawn in pixel space
// (ResizeObserver) so text never stretches. Gains/losses carry signs and shapes, not colour alone.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Trade } from './data'
import { compactRupees, istTime, shortSymbol, signedPct, signedR, signedRupees, tone } from './format.ts'
import { cumulative, extent, inRange, type DetectorRow, type Funnel, type Range, type SignalRow, type Tile } from './logic.ts'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const ticks = (lo: number, hi: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n)
const dayLabel = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(5, 10).split('-').reverse().join('/')

/* ── Equity curve ─────────────────────────────────────────────────────────────── */
export function EquityCurve({ trades, note }: { trades: Trade[]; note?: string }) {
  const [unit, setUnit] = useState<'r' | 'pnl'>('r')
  const [range, setRange] = useState<Range>('ALL')
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()
  const pts = useMemo(() => inRange(cumulative(trades, unit), range), [trades, unit, range])
  const H = 230, L = 52, R = 14, T = 14, B = 26
  const fmt = (v: number) => (unit === 'r' ? signedR(v) : signedRupees(v))
  const axis = (v: number) => (unit === 'r' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}R` : compactRupees(v))
  const [lo, hi] = extent(pts.map((p) => p.v))
  const x = (i: number) => L + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * Math.max(1, W - L - R))
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const last = pts[pts.length - 1]?.v ?? 0
  const col = last >= 0 ? 'var(--gain)' : 'var(--loss)'
  const sameDay = pts.length > 1 && dayLabel(pts[0]!.x) === dayLabel(pts[pts.length - 1]!.x)
  const xl = (ms: number) => (sameDay ? istTime(ms) : dayLabel(ms))
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pts.length < 2) return
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - L) / Math.max(1, W - L - R)) * (pts.length - 1))
    setHover(Math.max(0, Math.min(pts.length - 1, i)))
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!pts.length) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover((h) => Math.max(0, Math.min(pts.length - 1, (h ?? pts.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
    }
  }
  const hp = hover !== null ? pts[hover] : null
  return (
    <div style={{ display: 'grid', gap: 'var(--s3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', justifyContent: 'space-between' }}>
        <div className="seg" role="group" aria-label="Unit">
          <button aria-pressed={unit === 'r'} onClick={() => setUnit('r')}>R</button>
          <button aria-pressed={unit === 'pnl'} onClick={() => setUnit('pnl')}>₹</button>
        </div>
        <div className="seg" role="group" aria-label="Range">
          {(['1D', '1W', '1M', 'ALL'] as Range[]).map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r === 'ALL' ? 'All' : r}</button>)}
        </div>
      </div>
      <div ref={ref} style={{ position: 'relative', minHeight: H }}>
        {pts.length < 2 ? (
          <div className="muted" style={{ height: H, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 'var(--t-s)' }}>Not enough closed trades in this range to draw a curve.</div>
        ) : W > 0 && (
          <svg width={W} height={H} role="img" tabIndex={0} onKeyDown={onKey} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
            aria-label={`Cumulative ${unit === 'r' ? 'R' : 'paper P&L'} over ${pts.length} closed trades, ending at ${fmt(last)}. Use the arrow keys to step through trades.`} style={{ display: 'block', touchAction: 'pan-y' }}>
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".32" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
            {ticks(lo, hi).map((v) => (
              <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4" />
                <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{axis(v)}</text></g>
            ))}
            <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" />
            {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{xl(pts[i]!.x)}</text>
            ))}
            <g className="wipe" key={`${unit}-${range}`}>
              <path d={`${line}L${x(pts.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`} fill={`url(#${gid})`} />
              <path d={line} fill="none" stroke={col} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            </g>
            {hp && hover !== null && (
              <g aria-hidden>
                <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--fg)" strokeOpacity=".35" />
                <circle cx={x(hover)} cy={y(hp.v)} r="5" fill="var(--surface)" stroke={col} strokeWidth="2.5" />
              </g>
            )}
          </svg>
        )}
        {hp && hover !== null && (
          <div role="status" className="card" style={{ position: 'absolute', top: 4, left: Math.min(Math.max(0, x(hover) - 80), Math.max(0, W - 170)), width: 160, padding: '8px 10px', pointerEvents: 'none', boxShadow: 'var(--e3)', fontSize: 'var(--t-xs)' }}>
            <div className="muted num">{dayLabel(hp.x)} {istTime(hp.x)} · {shortSymbol(hp.label)}</div>
            <div className={`num ${tone(hp.v)}`} style={{ fontSize: 'var(--t-m)' }}>{fmt(hp.v)}</div>
            <div className="muted">cumulative · paper</div>
          </div>
        )}
      </div>
      {note && <p className="muted" style={{ margin: 0, fontSize: 'var(--t-xs)' }}>{note}</p>}
    </div>
  )
}

/* ── Per-detector bars ────────────────────────────────────────────────────────── */
export function DetectorBars({ rows }: { rows: DetectorRow[] }) {
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.totalR)))
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--s3)' }} aria-label="Total R by detector">
      {rows.map((r, i) => {
        const w = (Math.abs(r.totalR) / max) * 50
        return (
          <li key={r.detector} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--t-s)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detector}</span>
              <span className="num muted" style={{ fontSize: 'var(--t-xs)' }}>n = {r.n} · win {r.winRate.toFixed(0)}% · avg {signedR(r.avgR)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--s2)', alignItems: 'center' }}>
              <div role="img" aria-label={`${r.detector}: ${signedR(r.totalR)} total over ${r.n} trades`} style={{ position: 'relative', height: 12, background: 'var(--surface-3)', borderRadius: 99 }}>
                <span aria-hidden style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: 'var(--line-strong)' }} />
                <span className="grow" aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 99, width: `${w}%`, left: r.totalR >= 0 ? '50%' : `${50 - w}%`, background: r.totalR >= 0 ? 'var(--gain)' : 'var(--loss)', transformOrigin: r.totalR >= 0 ? 'left' : 'right', animationDelay: `${i * 60}ms` }} />
              </div>
              <span className={`num ${tone(r.totalR)}`} style={{ minWidth: 64, textAlign: 'right' }}>{signedR(r.totalR)}</span>
            </div>
            {r.small && <span className="chip warn" style={{ justifySelf: 'start' }}>n {'<'} 30 · small sample, not an edge</span>}
          </li>
        )
      })}
    </ul>
  )
}

/* ── Filter funnel ────────────────────────────────────────────────────────────── */
export function FunnelChart({ f }: { f: Funnel }) {
  const base = Math.max(1, f.fires)
  const row = (label: string, n: number, color: string, extra?: React.ReactNode, i = 0) => (
    <li style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)', fontSize: 'var(--t-s)' }}><span>{label}</span><span className="num">{n} <span className="muted">({Math.round((n / base) * 100)}%)</span></span></div>
      <div style={{ height: 14, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
        <span className="grow" style={{ display: 'block', height: '100%', width: `${(n / base) * 100}%`, background: color, borderRadius: 99, animationDelay: `${i * 80}ms` }} />
      </div>
      {extra}
    </li>
  )
  return (
    <ol aria-label={`Filter funnel: ${f.fires} fires, ${f.rejectedTotal} rejected, ${f.passed} passed, ${f.alerted} alerted`} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--s3)' }}>
      {row('Fires', f.fires, 'var(--accent)', undefined, 0)}
      {row('Rejected by the filter', f.rejectedTotal, 'var(--loss)', f.rejected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{f.rejected.map((r) => <span key={r.reason} className="chip loss">{r.reason.toLowerCase()} · {r.n}</span>)}</div>
      ), 1)}
      {f.errors > 0 && row('Filter errors (recorded, never alerted)', f.errors, 'var(--warn)', undefined, 2)}
      {row('Passed', f.passed, 'var(--gain)', f.suppressed.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{f.suppressed.map((r) => <span key={r.reason} className="chip">not sent: {r.reason.toLowerCase().replace(/_/g, ' ')} · {r.n}</span>)}</div>
      ), 3)}
      {row('Alerted on Telegram', f.alerted, 'var(--info)', undefined, 4)}
    </ol>
  )
}

/* ── Signal timeline: score against time of day ──────────────────────────────── */
const OPEN = 9 * 60 + 15, CLOSE = 15 * 60 + 30
export function SignalTimeline({ rows }: { rows: SignalRow[] }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<SignalRow | null>(null)
  const H = 200, L = 34, R = 12, T = 12, B = 24
  const mins = (ms: number) => { const d = new Date(ms + 330 * 60_000); return d.getUTCHours() * 60 + d.getUTCMinutes() }
  const x = (ms: number) => L + ((Math.min(CLOSE, Math.max(OPEN, mins(ms))) - OPEN) / (CLOSE - OPEN)) * Math.max(1, W - L - R)
  const y = (s: number) => T + (1 - s / 100) * (H - T - B)
  const th = rows.find((r) => r.threshold != null)?.threshold ?? null
  const scored = rows.filter((r) => r.score != null)
  return (
    <div ref={ref} style={{ position: 'relative', minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={`${scored.length} scored fires between 09:15 and 15:30${th != null ? `; alert threshold ${th}` : ''}. ${rows.filter((r) => r.alerted).length} alerted.`} style={{ display: 'block' }}>
          {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">{v}</text></g>)}
          {['09:15', '11:00', '13:00', '15:30'].map((t) => { const [h, m] = t.split(':').map(Number); const xx = L + ((h! * 60 + m! - OPEN) / (CLOSE - OPEN)) * (W - L - R); return <text key={t} x={xx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">{t}</text> })}
          {th != null && <g><line x1={L} x2={W - R} y1={y(th)} y2={y(th)} stroke="var(--accent)" strokeDasharray="6 4" /><text x={W - R} y={y(th) - 5} textAnchor="end" fontSize="10" fill="var(--accent)" fontFamily="var(--mono)">threshold {th}</text></g>}
          {scored.map((r) => {
            const cx = x(r.firedAt), cy = y(r.score as number)
            const shape = r.alerted ? <circle cx={cx} cy={cy} r="6.5" fill="var(--info)" stroke="var(--surface)" strokeWidth="1.5" />
              : r.outcome === 'PASSED' ? <circle cx={cx} cy={cy} r="6" fill="none" stroke="var(--gain)" strokeWidth="2.5" />
                : <path d={`M${cx - 4.5},${cy - 4.5}L${cx + 4.5},${cy + 4.5}M${cx + 4.5},${cy - 4.5}L${cx - 4.5},${cy + 4.5}`} stroke="var(--loss)" strokeWidth="2.25" strokeLinecap="round" />
            return <g key={r.id} className="fade-in" onPointerEnter={() => setHover(r)} onPointerLeave={() => setHover(null)} style={{ cursor: 'default' }}><circle cx={cx} cy={cy} r="12" fill="transparent" />{shape}</g>
          })}
        </svg>
      )}
      {hover && (
        <div role="status" className="card" style={{ position: 'absolute', top: 4, left: Math.min(Math.max(0, x(hover.firedAt) - 90), Math.max(0, W - 190)), width: 180, padding: '8px 10px', pointerEvents: 'none', fontSize: 'var(--t-xs)', boxShadow: 'var(--e3)' }}>
          <div style={{ fontWeight: 600 }}>{shortSymbol(hover.symbol)} · {hover.side}</div>
          <div className="muted">{istTime(hover.firedAt)} · {hover.detector}</div>
          <div className="num">score {hover.score}/{hover.threshold ?? '—'} · {hover.alerted ? 'alerted' : hover.outcome === 'PASSED' ? 'passed' : `rejected ${(hover.rejectedAt ?? 'score').toLowerCase()}`}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)', fontSize: 'var(--t-xs)' }} className="muted" aria-hidden>
        <span>● <span style={{ color: 'var(--info)' }}>alerted</span></span><span>○ <span className="gain">passed, not sent</span></span><span>✕ <span className="loss">rejected</span></span>
      </div>
    </div>
  )
}

/* ── Heat tiles ───────────────────────────────────────────────────────────────── */
export function HeatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--s2)', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }} aria-label="Names that fired today">
      {tiles.map((t, i) => {
        const v = t.retPct
        const k = v == null ? 0 : Math.min(1, Math.abs(v) / 2)
        const bg = v == null ? 'var(--surface-2)' : `color-mix(in srgb, ${v >= 0 ? 'var(--gain)' : 'var(--loss)'} ${Math.round(12 + k * 45)}%, var(--surface-2))`
        return (
          <li key={t.symbol} className="fade-in" style={{ animationDelay: `${Math.min(i, 20) * 25}ms`, background: bg, borderRadius: 'var(--r-m)', padding: '10px 10px 8px', display: 'grid', gap: 2, border: t.alerted ? '2px solid var(--info)' : '1px solid var(--line)', minHeight: 64 }}
            aria-label={`${shortSymbol(t.symbol)}: ${t.fires} fire${t.fires === 1 ? '' : 's'}${t.alerted ? ', alerted' : ''}${v == null ? '' : `, closed-trade return ${signedPct(v)}`}`}>
            <span style={{ fontWeight: 600, fontSize: 'var(--t-s)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortSymbol(t.symbol)}</span>
            <span className="num" style={{ fontSize: 'var(--t-s)' }}>{v == null ? <span className="muted">no close</span> : `${v >= 0 ? '▲' : '▼'} ${signedPct(v, 2)}`}</span>
            <span className="muted" style={{ fontSize: '.66rem' }}>{t.fires}× fired{t.bestScore != null ? ` · best ${t.bestScore}` : ''}{t.alerted ? ' · alerted' : ''}</span>
          </li>
        )
      })}
    </ul>
  )
}
