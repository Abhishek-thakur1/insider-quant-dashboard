// Pure data shaping for the redesign's cards and charts (tested in tests/logic.test.mjs).
// Real data only: every function takes API rows and returns derived values; nothing is invented.
import type { Trade } from './data.ts'

export const SMALL_SAMPLE = 30

/** One row of GET /api/signals (engine PR #24). */
export interface SignalRow {
  id: string; firedAt: number; symbol: string; detector: string; side: string
  score: number | null; threshold: number | null; outcome: string; rejectedAt: string | null
  regimeClass: string | null; marketRegime: string | null; alerted: boolean; suppressedReason: string | null
  dataQuality: string[]; tradeId: number | null
}
/** GET /api/health (coarse, public). */
export interface Health { status: 'live' | 'stale' | 'closed' | 'holiday' | string; asOf: number; ticksPer5m: number | null; stocksSeenToday: number; lastIndexCandleAt: number | null }

/** Where `last` sits between stop (0%) and target (100%), clamped; null when a level is missing. */
export const stopToTarget = (t: Pick<Trade, 'stopLoss' | 'target'>, last: number | null) => {
  if (typeof t.stopLoss !== 'number' || typeof t.target !== 'number' || last === null || !Number.isFinite(last)) return null
  const span = t.target - t.stopLoss
  return span === 0 ? null : Math.min(100, Math.max(0, ((last - t.stopLoss) / span) * 100))
}
/** Last price implied by live P&L and quantity (the live feed sends P&L, not price). */
export const impliedPrice = (t: Pick<Trade, 'entryPrice' | 'side' | 'size' | 'actualSize'>, pnl: number | undefined) => {
  const qty = t.actualSize ?? t.size
  if (pnl === undefined || !qty) return null
  return t.entryPrice + (t.side === 'LONG' ? pnl / qty : -pnl / qty)
}

export interface Point { x: number; v: number; label: string }
/** Cumulative R or ₹ over closed trades, in exit order. Trades without the value are skipped. */
export const cumulative = (trades: Trade[], key: 'r' | 'pnl'): Point[] => {
  const rows = trades
    .filter((t) => t.exitTimestamp != null && (key === 'r' ? typeof t.r_multiple === 'number' : typeof t.pnl === 'number'))
    .sort((a, b) => (a.exitTimestamp as number) - (b.exitTimestamp as number))
  let c = 0
  return rows.map((t) => {
    c += key === 'r' ? (t.r_multiple as number) : (t.pnl as number)
    return { x: t.exitTimestamp as number, v: Math.round(c * 100) / 100, label: t.symbol }
  })
}

export type Range = '1D' | '1W' | '1M' | 'ALL'
const DAY = 86_400_000
/** Keep the points within the range, measured back from the latest point (not the wall clock). */
export const inRange = (pts: Point[], range: Range): Point[] => {
  if (range === 'ALL' || pts.length === 0) return pts
  const last = pts[pts.length - 1]!.x
  const span = range === '1D' ? DAY : range === '1W' ? 7 * DAY : 30 * DAY
  const kept = pts.filter((p) => p.x > last - span)
  // re-base so the window starts at zero: the curve shows the change within the window
  const base = pts[pts.indexOf(kept[0]!) - 1]?.v ?? 0
  return kept.map((p) => ({ ...p, v: Math.round((p.v - base) * 100) / 100 }))
}

export interface DetectorRow { detector: string; n: number; wins: number; winRate: number; totalR: number; avgR: number; pnl: number; small: boolean }
export const byDetector = (trades: Trade[]): DetectorRow[] => {
  const m = new Map<string, Trade[]>()
  for (const t of trades) { const k = t.detectorName || 'unknown'; const l = m.get(k); if (l) l.push(t); else m.set(k, [t]) }
  return [...m.entries()].map(([detector, ts]) => {
    const rs = ts.filter((t) => typeof t.r_multiple === 'number').map((t) => t.r_multiple as number)
    const totalR = rs.reduce((a, b) => a + b, 0)
    const wins = ts.filter((t) => (t.pnl ?? 0) > 0).length
    return { detector, n: ts.length, wins, winRate: ts.length ? (wins / ts.length) * 100 : 0, totalR, avgR: rs.length ? totalR / rs.length : 0, pnl: ts.reduce((a, t) => a + (t.pnl ?? 0), 0), small: ts.length < SMALL_SAMPLE }
  }).sort((a, b) => b.n - a.n || b.totalR - a.totalR)
}

export interface Funnel { fires: number; rejected: { reason: string; n: number }[]; rejectedTotal: number; errors: number; passed: number; alerted: number; suppressed: { reason: string; n: number }[] }
/** fires → rejected (by gate) → passed → alerted, from the signals log. */
export const funnel = (rows: SignalRow[]): Funnel => {
  const rej = new Map<string, number>(), sup = new Map<string, number>()
  let passed = 0, errors = 0, alerted = 0
  for (const r of rows) {
    if (r.outcome === 'PASSED') passed++
    else if (r.outcome === 'ERROR') errors++
    else { const k = r.rejectedAt ?? 'SCORE'; rej.set(k, (rej.get(k) ?? 0) + 1) }
    if (r.alerted) alerted++
    else if (r.outcome === 'PASSED' && r.suppressedReason) sup.set(r.suppressedReason, (sup.get(r.suppressedReason) ?? 0) + 1)
  }
  const sort = (m: Map<string, number>) => [...m.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n)
  const rejected = sort(rej)
  return { fires: rows.length, rejected, rejectedTotal: rejected.reduce((a, b) => a + b.n, 0), errors, passed, alerted, suppressed: sort(sup) }
}

export interface Tile { symbol: string; fires: number; alerted: boolean; bestScore: number | null; pnl: number | null; retPct: number | null }
/** One tile per symbol that fired or traded today; retPct = closed-trade P&L ÷ notional (not day change). */
export const heatTiles = (signals: SignalRow[], trades: Trade[]): Tile[] => {
  const m = new Map<string, Tile>()
  const get = (s: string) => m.get(s) ?? (m.set(s, { symbol: s, fires: 0, alerted: false, bestScore: null, pnl: null, retPct: null }), m.get(s)!)
  for (const r of signals) { const t = get(r.symbol); t.fires++; t.alerted ||= r.alerted; if (r.score != null) t.bestScore = Math.max(t.bestScore ?? -Infinity, r.score) }
  for (const tr of trades) {
    if (typeof tr.pnl !== 'number') continue
    const t = get(tr.symbol); const notional = tr.entryPrice * (tr.actualSize ?? tr.size)
    t.pnl = (t.pnl ?? 0) + tr.pnl
    if (notional > 0) t.retPct = ((t.retPct ?? 0) + (tr.pnl / notional) * 100)
  }
  return [...m.values()].sort((a, b) => (b.retPct ?? -Infinity) - (a.retPct ?? -Infinity) || b.fires - a.fires)
}

/** Signals by the paper-trade id they created (signals.trade_id). */
export const signalsByTrade = (rows: SignalRow[]) => {
  const m = new Map<number, SignalRow>()
  for (const r of rows) if (r.tradeId != null) m.set(r.tradeId, r)
  return m
}

/** Was this trade actually sent to Telegram? The signal log decides; trades older than the log
 *  (it starts 2026-10-21) fall back to the trade's own filter-passed flag. */
export const wasAlerted = (t: Pick<Trade, 'id' | 'gated'>, byTrade: Map<number, SignalRow>) => {
  const s = byTrade.get(Number(t.id))
  return s ? s.alerted : t.gated === true
}

/** Why a recorded trade was not alerted, from its signal row; "Not alerted" when the API has no reason. */
export const notAlertedReason = (s: SignalRow | undefined): string => {
  if (!s) return 'Not alerted'
  if (s.outcome === 'ERROR') return 'Filter error'
  if (s.outcome === 'PASSED') return s.suppressedReason ? `Passed, not sent: ${s.suppressedReason.toLowerCase().replace(/_/g, ' ')}` : 'Passed, not sent'
  const gate = (s.rejectedAt ?? '').toUpperCase()
  if (gate === 'EV') return 'EV gate'
  if (gate === 'REGIME') return 'Regime gate'
  if (s.score != null && s.threshold != null && s.score < s.threshold) return `score ${s.score} < ${s.threshold}`
  return gate ? `${gate.toLowerCase()} gate` : 'Not alerted'
}

/** Min/max with padding for chart scales; always includes 0 so the zero line is visible. */
export const extent = (vals: number[], pad = 0.08): [number, number] => {
  if (!vals.length) return [-1, 1]
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
  if (lo === hi) { lo -= 1; hi += 1 }
  const p = (hi - lo) * pad
  return [lo - p, hi + p]
}
