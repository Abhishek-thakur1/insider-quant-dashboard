// Data layer for the redesign — the SAME endpoints the classic dashboard uses
// (/api/today, /api/trades/history, /api/trades/heatmap, /api/live-pnl, /api/events).
// No new API calls in stage 1.
import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import { resolveApiBase } from '../apiBase'
import type { Health, SignalRow } from './logic.ts'

export interface Trade {
  id: number | string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice?: number
  pnl?: number
  timestamp: number
  exitTimestamp?: number | null
  detectorName: string
  regimeClass?: string
  gated?: boolean
  capitalGated?: boolean
  size: number
  actualSize?: number
  r_multiple?: number
  durationClass?: 'INTRADAY' | 'SWING'
  exitReason?: string
  target?: number
  stopLoss?: number
  /** engine PR #24: data-quality flags (history and open trades) */
  dataQuality?: string[]
}

export const API_URL = resolveApiBase(import.meta.env.VITE_API_URL, typeof window !== 'undefined' ? window.location.protocol : undefined)
export const ALL = 'ALL'
export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

/** A position's identity across REST (numeric DB id) and SSE (string position id): symbol + entry time. */
export const tradeKey = (t: Pick<Trade, 'symbol' | 'timestamp'>) => `${t.symbol}@${t.timestamp}`

export type StreamState = 'connecting' | 'live' | 'retrying' | 'off'

export interface Stats { total: number; wins: number; winRate: number; totalR: number; avgR: number; pnl: number; best: number | null; worst: number | null }
export const calcStats = (trades: Trade[]): Stats => {
  const total = trades.length
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length
  const rs = trades.filter((t) => typeof t.r_multiple === 'number').map((t) => t.r_multiple as number)
  const totalR = rs.reduce((a, b) => a + b, 0)
  return {
    total,
    wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalR,
    avgR: rs.length ? totalR / rs.length : 0,
    pnl: trades.reduce((a, t) => a + (t.pnl ?? 0), 0),
    best: rs.length ? Math.max(...rs) : null,
    worst: rs.length ? Math.min(...rs) : null,
  }
}

export function useDashboardData(date: string, detector: string) {
  const isToday = date === todayStr()
  const [gatedHistory, setGated] = useState<Trade[]>([])
  const [allHistory, setAll] = useState<Trade[]>([])
  const [openTrades, setOpen] = useState<Trade[]>([])
  const [heatmap, setHeatmap] = useState<{ date: string; count: number }[]>([])
  const [livePnl, setLivePnl] = useState<Record<string, number>>({})
  const [stream, setStream] = useState<StreamState>('off')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  // quiet: a background refresh (polling fallback / reconnect) that doesn't flash the loading state
  const load = async (quiet = false) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    try {
      const det = detector !== ALL ? `&detector=${encodeURIComponent(detector)}` : ''
      const [g, a, h, t] = await Promise.all([
        axios.get(`${API_URL}/api/trades/history?date=${date}${det}`),
        axios.get(`${API_URL}/api/trades/history?date=${date}${det}&includeUngated=true`),
        axios.get(`${API_URL}/api/trades/heatmap`).catch(() => ({ data: { data: [] } })),
        isToday ? axios.get(`${API_URL}/api/today?includeUngated=true`) : Promise.resolve({ data: { openTrades: [] } }),
      ])
      if (id !== reqId.current) return
      setGated(g.data.data ?? [])
      setAll(a.data.data ?? [])
      setHeatmap(h.data?.data ?? [])
      setOpen((t.data.openTrades ?? []).filter((x: Trade) => detector === ALL || x.detectorName === detector))
      setUpdatedAt(Date.now())
      setError(null)
    } catch (e) {
      if (id === reqId.current) setError('Could not reach the API. Showing the last data loaded.')
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [date, detector])

  useEffect(() => {
    if (!isToday) { setStream('off'); return }
    setStream('connecting')
    const sse = new EventSource(`${API_URL}/api/events?includeUngated=true`)
    // The Vercel /api rewrite closes the stream every ~150 s; after a reconnect, re-read so an
    // event sent during the gap isn't missed.
    let dropped = false
    sse.onopen = () => {
      setStream('live')
      if (dropped) { dropped = false; void load(true) }
    }
    sse.onmessage = (ev) => {
      try {
        const p = JSON.parse(ev.data)
        if (p.type === 'signal_event') {
          const tr: Trade = p.data
          if (detector !== ALL && tr.detectorName !== detector) return
          if (tr.exitPrice) {
            // close: remove by symbol + entry time (REST and SSE ids differ), then refresh history
            setOpen((prev) => prev.filter((o) => tradeKey(o) !== tradeKey(tr)))
            void load()
          } else {
            setOpen((prev) => (prev.some((o) => tradeKey(o) === tradeKey(tr)) ? prev : [tr, ...prev]))
          }
          setUpdatedAt(Date.now())
        } else if (p.type === 'pnl_update') {
          setLivePnl((prev) => ({ ...prev, [p.data.symbol]: p.data.unrealizedPnl }))
          setUpdatedAt(Date.now())
        }
      } catch { /* ignore a malformed frame */ }
    }
    sse.onerror = () => { dropped = true; setStream('retrying') }
    const poll = setInterval(async () => {
      try {
        const r = await axios.get(`${API_URL}/api/live-pnl`)
        if (r.data?.data) setLivePnl((prev) => ({ ...prev, ...r.data.data }))
      } catch { /* the stream state already shows trouble */ }
    }, 2500)
    // Polling fallback: re-read today's data every 30 s whatever the stream does.
    const refresh = setInterval(() => { void load(true) }, 30000)
    return () => { sse.close(); clearInterval(poll); clearInterval(refresh) }
  }, [isToday, detector])

  const detectors = useMemo(() => Array.from(new Set(allHistory.map((t) => t.detectorName).filter(Boolean))).sort(), [allHistory])

  return { isToday, gatedHistory, allHistory, openTrades, heatmap, livePnl, stream, updatedAt, error, loading, detectors, reload: load }
}

export type Loadable<T> = { data: T | null; loading: boolean; error: string | null; at: number | null }

/** GET a JSON endpoint, re-read every `everyMs` (0 = once). Keeps the last good data on error. */
function usePoll<T>(path: string | null, pick: (body: any) => T, everyMs: number): Loadable<T> {
  const [s, set] = useState<Loadable<T>>({ data: null, loading: !!path, error: null, at: null })
  useEffect(() => {
    if (!path) { set({ data: null, loading: false, error: null, at: null }); return }
    let live = true
    const run = async () => {
      try {
        const r = await axios.get(`${API_URL}${path}`)
        if (live) set({ data: pick(r.data), loading: false, error: null, at: Date.now() })
      } catch {
        if (live) set((p) => ({ ...p, loading: false, error: 'Could not reach the API.' }))
      }
    }
    set((p) => ({ ...p, loading: true }))
    void run()
    const t = everyMs ? setInterval(run, everyMs) : undefined
    return () => { live = false; if (t) clearInterval(t) }
  }, [path, everyMs])
  return s
}

/** Every fire for a date (engine PR #24, GET /api/signals). Re-read every 30 s for today. */
export const useSignals = (date: string, isToday: boolean) =>
  usePoll<SignalRow[]>(`/api/signals?date=${date}`, (b) => b?.data ?? [], isToday ? 30_000 : 0)

/** Coarse public health (engine PR #24, GET /api/health). Re-read every 30 s. */
export const useHealth = () => usePoll<Health | null>('/api/health', (b) => b?.data ?? null, 30_000)

/** The latest closed trades across days (the API returns at most 200), for the equity curve. */
export const useRecentHistory = (gatedOnly: boolean) =>
  usePoll<Trade[]>(`/api/trades/history${gatedOnly ? '' : '?includeUngated=true'}`, (b) => b?.data ?? [], 60_000)
