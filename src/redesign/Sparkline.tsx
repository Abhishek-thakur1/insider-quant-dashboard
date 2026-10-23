// Tiny SVG sparkline for stat cards (first-load; no chart library). Real points only.
import { useId } from 'react'
import { extent, type Point } from './logic.ts'

export function Sparkline({ points, label, h = 36 }: { points: Point[]; label: string; h?: number }) {
  const id = useId()
  if (points.length < 2) return <svg width="100%" height={h} role="img" aria-label={`${label}: not enough points to draw`} />
  const W = 120
  const [lo, hi] = extent(points.map((p) => p.v), 0.12)
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const last = points[points.length - 1]!.v
  const col = last > 0 ? 'var(--gain)' : last < 0 ? 'var(--loss)' : 'var(--accent)'
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" width="100%" height={h} role="img" aria-label={`${label}: ${points.length} points, ending at ${last}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".28" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={`${d}L${W},${h}L0,${h}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={col} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="draw" style={{ ['--len' as string]: 400 }} pathLength={400} />
    </svg>
  )
}
