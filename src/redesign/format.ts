// Number and time formatting for the redesign. Pure functions (tested in tests/format.test.mjs).
// Signed values always carry a sign and an arrow, so gains and losses never rely on colour alone.
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const MINUS = '−' // U+2212, the typographic minus

export type Tone = 'gain' | 'loss' | 'muted'
export const tone = (n: number | null | undefined): Tone => (n == null || n === 0 || Number.isNaN(n) ? 'muted' : n > 0 ? 'gain' : 'loss')
export const arrow = (n: number) => (n > 0 ? '▲' : n < 0 ? '▼' : '')

/** ₹1,23,456.78 (Indian grouping). */
export const rupees = (n: number) => `₹${inr2.format(n)}`
/** ▲ +₹1,234.50 / ▼ −₹120.00 / ₹0.00 */
export const signedRupees = (n: number) => (n === 0 ? `₹${inr2.format(0)}` : `${arrow(n)} ${n > 0 ? '+' : MINUS}₹${inr2.format(Math.abs(n))}`)
/** Compact for axes and tiles: ₹950, ₹12.4K, ₹3.2L, ₹1.1Cr (Indian units). */
export const compactRupees = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? MINUS : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(1)}Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)}L`
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}K`
  return `${s}₹${inr0.format(a)}`
}
/** +1.25R / −0.40R / 0.00R */
export const signedR = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? MINUS : ''}${Math.abs(n).toFixed(digits)}R`
/** +1.2% / −0.8% */
export const signedPct = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? MINUS : ''}${Math.abs(n).toFixed(digits)}%`
/** 62% (no sign; for rates) */
export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`

/** "NSE:AARTIPHARM-EQ" → "AARTIPHARM"; option symbols are kept readable. */
export const shortSymbol = (s: string) => s.replace(/^NSE:/, '').replace(/-EQ$/, '').replace(/-INDEX$/, '')

/** HH:MM in IST from epoch ms. */
export const istTime = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16)

export type Market = 'Open' | 'Pre-open' | 'Closed' | 'Holiday'
/** IST clock and market state. `healthStatus` from /api/health refines it (holiday). */
export const istParts = (now = Date.now(), healthStatus?: string | null) => {
  const d = new Date(now + 330 * 60_000)
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes()
  const wd = d.getUTCDay()
  const time = d.toISOString().slice(11, 19)
  let market: Market
  if (healthStatus === 'holiday') market = 'Holiday'
  else if (wd === 0 || wd === 6) market = 'Closed'
  else if (mins >= 9 * 60 && mins < 9 * 60 + 15) market = 'Pre-open'
  else if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) market = 'Open'
  else market = 'Closed'
  return { time, market, mins, weekend: wd === 0 || wd === 6 }
}

/** Seconds until the 15:15 IST intraday square-off; null once it has passed. */
export const secondsToSquareOff = (now = Date.now()) => {
  const d = new Date(now + 330 * 60_000)
  const s = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  const left = 15 * 3600 + 15 * 60 - s
  return left > 0 ? left : null
}
/** 3725 → "1:02:05", 125 → "2:05" */
export const clock = (secs: number) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
/** "just now", "12s ago", "4m ago", "2h ago" */
export const ago = (ms: number | null, now = Date.now()) => {
  if (ms == null) return 'not loaded yet'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 3) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}
