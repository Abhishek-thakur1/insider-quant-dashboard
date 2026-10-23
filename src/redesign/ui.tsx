// Shared UI pieces for the redesign views (empty states, skeletons, trade rows).
import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import type { Trade } from "./data"
import { tradeKey } from "./data"
import { istTime, shortSymbol, signedR, signedRupees, tone } from "./format.ts"
import { Skeleton } from "./motion"

export function Empty({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="fade-in" style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 'var(--s2)', padding: 'var(--s6) var(--s4)' }}>
      <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: 'var(--accent-bg)', color: 'var(--accent)' }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{text}</span>
      {sub && <span className="muted" style={{ fontSize: 'var(--t-s)', maxWidth: 360 }}>{sub}</span>}
    </div>
  )
}

export function ViewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 'var(--s4)' }}>
      <div className="nf-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card" style={{ display: 'grid', gap: 10 }}><Skeleton h={12} w="40%" /><Skeleton h={30} w="70%" /><Skeleton h={36} /><Skeleton h={12} w="55%" /></div>)}</div>
      <div className="nf-two">{[0, 1].map((i) => <div key={i} className="card" style={{ display: 'grid', gap: 10 }}><Skeleton h={18} w="35%" />{[0, 1, 2].map((j) => <Skeleton key={j} h={52} r={14} />)}</div>)}</div>
    </div>
  )
}

export const SideChip = ({ side }: { side: string }) => (
  <span className={`chip ${side === 'LONG' ? 'gain' : 'loss'}`}>{side === 'LONG' ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}{side}</span>
)

/** `tag` overrides the per-row status chip (Today passes the alerted / rejection reason). */
export function TradeList({ trades, onSelect, empty, tag }: { trades: Trade[]; onSelect: (t: Trade) => void; empty: React.ReactNode; tag?: (t: Trade) => React.ReactNode }) {
  if (!trades.length) return <>{empty}</>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--s2)' }}>
      {trades.map((t, i) => (
        <motion.li key={`${tradeKey(t)}-${t.id}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
          <button onClick={() => onSelect(t)} className="card flat click" style={{ width: '100%', textAlign: 'left', padding: 'var(--s3)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--s2)', alignItems: 'center', color: 'var(--fg)', minHeight: 56 }}>
            <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{shortSymbol(t.symbol)}</span><SideChip side={t.side} />
                {tag ? tag(t) : t.gated ? <span className="chip accent">alerted</span> : <span className="chip muted">not alerted</span>}
              </span>
              <span className="muted" style={{ fontSize: 'var(--t-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.detectorName} · {istTime(t.timestamp)}{t.exitReason ? ` · ${t.exitReason}` : ''}</span>
            </span>
            <span style={{ textAlign: 'right', display: 'grid' }}>
              <span className={`num ${tone(t.pnl ?? 0)}`}>{signedRupees(t.pnl ?? 0)}</span>
              {typeof t.r_multiple === 'number' && <span className={`num ${tone(t.r_multiple)}`} style={{ fontSize: 'var(--t-xs)' }}>{signedR(t.r_multiple)}</span>}
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  )
}

