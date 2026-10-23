// Lazy-loaded (Recharts stays out of the first-load bundle): cumulative R over the day's closed trades.
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Trade } from './data'

export default function HistoryChart({ trades }: { trades: Trade[] }) {
  let cum = 0
  const data = [...trades]
    .filter((t) => t.exitTimestamp != null && typeof t.r_multiple === 'number')
    .sort((a, b) => (a.exitTimestamp as number) - (b.exitTimestamp as number))
    .map((t) => {
      cum += t.r_multiple as number
      return { time: new Date(t.exitTimestamp as number).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }), r: Number(cum.toFixed(2)) }
    })
  if (!data.length) return <p className="muted" style={{ margin: 0 }}>No closed trades with an R value for this date.</p>
  return (
    <div style={{ height: 220 }} role="img" aria-label={`Cumulative R ends at ${data[data.length - 1]!.r}R over ${data.length} trades`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs><linearGradient id="nfR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="time" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}R`} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }} formatter={(v) => [`${v}R`, 'cumulative']} />
          <Area type="monotone" dataKey="r" stroke="var(--accent)" strokeWidth={2} fill="url(#nfR)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
