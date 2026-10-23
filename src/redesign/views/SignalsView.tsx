// Signals feed: every detector fire for the date with its score, filter outcome and alert status
// (GET /api/signals, engine PR #24). Answers "why no alert?" at a glance. Lazy-loaded.
import { CheckCircle2, CircleAlert, Send, XCircle, Zap } from 'lucide-react'
import { ALL, useSignals } from '../data'
import { istTime, shortSymbol } from '../format.ts'
import type { SignalRow } from '../logic.ts'
import { Reveal } from '../motion'
import { Empty, SideChip, ViewSkeleton } from '../ui'

export default function SignalsView({ date, isToday, query, detector }: { date: string; isToday: boolean; query: string; detector: string }) {
  const s = useSignals(date, isToday)
  if (s.loading && !s.data) return <ViewSkeleton />
  if (s.error && !s.data) return <div className="card"><Empty icon={<CircleAlert size={20} />} text="Couldn't load the signals log." sub={s.error} /></div>
  const rows = (s.data ?? []).filter((r) => (detector === ALL || r.detector === detector) && (!query || r.symbol.toLowerCase().includes(query) || r.detector.toLowerCase().includes(query)))
  return (
    <section className="card" aria-labelledby="sig-h">
      <div className="card-head">
        <h2 id="sig-h">Signals {isToday ? 'today' : `on ${date}`}</h2>
        <span className="chip">{rows.length} fire{rows.length === 1 ? '' : 's'}</span>
      </div>
      <p className="muted" style={{ margin: '0 0 var(--s3)', fontSize: 'var(--t-s)' }}>Every detector fire, newest first. A fire alerts only if it passes the filter (score ≥ threshold, regime and EV gates). Paper trading.</p>
      {rows.length === 0 ? <Empty icon={<Zap size={20} />} text={isToday ? 'No fires yet today.' : 'No fires on this date.'} sub="Quiet sessions are normal: detectors fire only when their setup appears." />
        : <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--s2)' }}>{rows.map((r, i) => <Reveal key={r.id} i={i}><SignalItem r={r} /></Reveal>)}</ol>}
    </section>
  )
}

export function Outcome({ r }: { r: SignalRow }) {
  if (r.alerted) return <span className="chip accent"><Send size={12} aria-hidden /> alerted</span>
  if (r.outcome === 'PASSED') return <span className="chip gain"><CheckCircle2 size={12} aria-hidden /> passed{r.suppressedReason ? ` · not sent: ${r.suppressedReason.toLowerCase().replace(/_/g, ' ')}` : ''}</span>
  if (r.outcome === 'ERROR') return <span className="chip warn"><CircleAlert size={12} aria-hidden /> filter error</span>
  return <span className="chip loss"><XCircle size={12} aria-hidden /> rejected · {(r.rejectedAt ?? 'score').toLowerCase()}</span>
}

function SignalItem({ r }: { r: SignalRow }) {
  const s = r.score, th = r.threshold
  return (
    <li className="card flat" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 'var(--s3)', alignItems: 'center', padding: 'var(--s3)' }}>
      <span className="num muted" style={{ fontSize: 'var(--t-s)' }}>{istTime(r.firedAt)}</span>
      <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontWeight: 600 }}>{shortSymbol(r.symbol)}</span><SideChip side={r.side} /><Outcome r={r} /></span>
        <span className="muted" style={{ fontSize: 'var(--t-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detector}{r.marketRegime ? ` · ${r.marketRegime}` : ''}{r.dataQuality.length ? ` · ${r.dataQuality.join(', ')}` : ''}</span>
      </span>
      <span style={{ display: 'grid', justifyItems: 'end', gap: 4, minWidth: 64 }} aria-label={s == null ? 'no score' : `score ${s} of threshold ${th ?? '—'}`}>
        <span className="num" style={{ fontSize: 'var(--t-l)' }}>{s ?? '—'}<span className="muted" style={{ fontSize: 'var(--t-xs)' }}>/{th ?? '—'}</span></span>
        {s != null && th != null && <span className="bar" style={{ width: 64, height: 6 }}><i style={{ width: `${Math.min(100, s)}%`, background: s >= th ? 'var(--gain)' : 'var(--muted)' }} /><span aria-hidden style={{ position: 'absolute', left: `${th}%`, top: -2, width: 2, height: 10, background: 'var(--fg)' }} /></span>}
      </span>
    </li>
  )
}
