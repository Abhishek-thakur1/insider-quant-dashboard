// Motion primitives with a purpose: count-ups, change flashes, skeletons, staggered entrance.
// All of them respect prefers-reduced-motion (framer's hook plus the CSS guard in tokens.css).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/** Animates from the previous value to `value` (ease-out, ~600 ms) and formats every frame. */
export function CountUp({ value, format, className, duration = 600 }: { value: number; format: (n: number) => string; className?: string; duration?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce || from.current === value) { from.current = value; setShown(value); return }
    const start = performance.now(), a = from.current, b = value
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration)
      setShown(a + (b - a) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce, duration])
  return <span className={className}>{format(shown)}</span>
}

/** Flashes its children when `value` changes: teal up, coral down, accent otherwise. */
export function Flash({ value, children, className = '' }: { value: number | string | undefined; children: ReactNode; className?: string }) {
  const prev = useRef(value)
  const [cls, setCls] = useState('')
  const [n, setN] = useState(0)
  useEffect(() => {
    if (prev.current !== undefined && value !== undefined && prev.current !== value) {
      setCls(typeof value === 'number' && typeof prev.current === 'number' ? (value > prev.current ? 'flash-up' : 'flash-down') : 'flash-same')
      setN((x) => x + 1)
    }
    prev.current = value
  }, [value])
  // the key restarts the CSS animation on every change; the formatted value itself carries the sign and arrow
  return <span key={n} className={`${className} ${cls}`.trim()}>{children}</span>
}

export const Skeleton = ({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) =>
  <span className="skel" aria-hidden style={{ display: 'block', height: h, width: w, borderRadius: r }} />

/** Staggered entrance for a list of cards. */
export function Reveal({ children, i = 0, className, style }: { children: ReactNode; i?: number; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} style={style} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : Math.min(i, 10) * 0.05, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}
