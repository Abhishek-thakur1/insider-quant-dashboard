// Number formatting: ₹ with Indian grouping, signed values always carry + / − and an arrow.
const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const rupees = (n: number) => `₹${inr.format(n)}`
export const signedRupees = (n: number) => `${n > 0 ? '▲ +' : n < 0 ? '▼ −' : ''}₹${inr.format(Math.abs(n))}`
export const signedR = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}R`
export const tone = (n: number) => (n > 0 ? 'gain' : n < 0 ? 'loss' : 'muted')

/** IST clock and market state from the clock alone (no holiday data on existing endpoints). */
export const istParts = (now = Date.now()) => {
  const d = new Date(now + 330 * 60_000)
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes()
  const wd = d.getUTCDay()
  const time = d.toISOString().slice(11, 19)
  let market: 'Open' | 'Pre-open' | 'Closed'
  if (wd === 0 || wd === 6) market = 'Closed'
  else if (mins >= 9 * 60 && mins < 9 * 60 + 15) market = 'Pre-open'
  else if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) market = 'Open'
  else market = 'Closed'
  return { time, market, mins }
}
