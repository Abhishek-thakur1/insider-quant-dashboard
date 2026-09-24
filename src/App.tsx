import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity,
  LayoutDashboard,
  History,
  TrendingUp,
  Crosshair,
  AlertCircle,
  MoreHorizontal,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Calendar,
  X,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  id: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  timestamp: number;
  exitTimestamp?: number | null;
  detectorName: string;
  regimeClass?: string;
  gated?: boolean;
  capitalGated?: boolean;
  size: number;
  actualSize?: number;
  r_multiple?: number;
  durationClass?: 'INTRADAY' | 'SWING';
  exitReason?: 'STOP_LOSS' | 'TARGET' | 'EOD_EXPIRED';
  target?: number;
  stopLoss?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toFixed(2);
const fmtPnl = (n: number) => `${n >= 0 ? '+' : ''}₹${fmt(n)}`;
const safeDate = (ts: number | null | undefined): Date | null => {
  if (!ts) return null;
  const d = new Date(ts);
  return isValid(d) ? d : null;
};

const DURATION_BADGE: Record<string, string> = {
  SWING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  INTRADAY: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

// ─── TradeDetailsModal ────────────────────────────────────────────────────────

const TradeDetailsModal = ({
  trade,
  onClose,
  livePnl,
}: {
  trade: Trade;
  onClose: () => void;
  livePnl?: number;
}) => {
  const isHistory = !!trade.exitPrice;
  const duration = trade.durationClass || 'INTRADAY';

  // Safe target/stop fallback — direction-aware
  const displayTarget =
    trade.target ??
    (trade.side === 'LONG'
      ? Number((trade.entryPrice * 1.05).toFixed(2))
      : Number((trade.entryPrice * 0.95).toFixed(2)));
  const displayStop =
    trade.stopLoss ??
    (trade.side === 'LONG'
      ? Number((trade.entryPrice * 0.95).toFixed(2))
      : Number((trade.entryPrice * 1.05).toFixed(2)));

  const exitDate = safeDate(trade.exitTimestamp ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pt-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-[#141416] border border-[#222225] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#222225] shrink-0">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base ${
                trade.side === 'LONG'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {trade.side}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-mono">{trade.symbol}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{trade.detectorName}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${DURATION_BADGE[duration]}`}
                >
                  {duration}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-[#1c1c1e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar">
          <div>
            <div className="text-xs text-gray-500 mb-1">Entry Price</div>
            <div className="text-lg font-bold text-white font-mono">
              ₹{trade.entryPrice}{' '}
              <span className="text-sm text-gray-500">({trade.actualSize ?? trade.size}x)</span>
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {format(new Date(trade.timestamp), 'dd MMM, HH:mm')}
            </div>
          </div>

          {isHistory && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Exit Price</div>
              <div className="text-lg font-bold text-white font-mono">₹{trade.exitPrice}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                {exitDate ? format(exitDate, 'dd MMM, HH:mm') : '—'}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-gray-500 mb-1">Target</div>
            <div className="text-lg font-bold text-green-400 font-mono">₹{displayTarget}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
            <div className="text-lg font-bold text-red-400 font-mono">₹{displayStop}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Regime</div>
            <div className="text-sm font-semibold text-white">{trade.regimeClass || 'UNIVERSAL'}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <div className={`text-sm font-bold uppercase ${isHistory ? 'text-gray-400' : 'text-blue-400'}`}>
              {isHistory ? (trade.exitReason ?? 'CLOSED') : 'Active'}
              {trade.gated ? ' · Gated' : ' · Ungated'}
              {trade.capitalGated ? ' · CAP-GATED' : ''}
            </div>
          </div>

          {isHistory && trade.r_multiple !== undefined && (
            <div>
              <div className="text-xs text-gray-500 mb-1">R-Multiple</div>
              <div
                className={`text-lg font-bold font-mono ${
                  trade.r_multiple >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {trade.r_multiple >= 0 ? '+' : ''}
                {trade.r_multiple.toFixed(2)}R
              </div>
            </div>
          )}
        </div>

        {/* PnL Footer */}
        <div className="px-5 pb-5 shrink-0">
          <div className="p-4 rounded-xl bg-[#1a1a1c] border border-[#222225] flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-400">
              {isHistory ? 'Realized PnL' : 'Live Unrealized PnL'}
            </span>
            <span
              className={`text-2xl font-bold font-mono tracking-tight ${
                ((isHistory ? trade.pnl : livePnl) ?? 0) >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {isHistory
                ? fmtPnl(trade.pnl ?? 0)
                : livePnl !== undefined
                ? fmtPnl(livePnl)
                : 'Waiting...'}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({
  icon,
  label,
  sublabel,
  value,
  valueClass = 'text-white',
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value: string;
  valueClass?: string;
  warning?: string;
}) => (
  <div className="glass-card p-6">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1a1a1c] flex items-center justify-center border border-[#222225]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-400">{label}</div>
          {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
        </div>
      </div>
      <button className="text-gray-600 hover:text-white transition-colors">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>
    <div className={`text-3xl font-bold font-mono tracking-tight ${valueClass}`}>{value}</div>
    {warning && (
      <div className="text-[10px] text-orange-400/80 mt-2 flex items-start gap-1 leading-tight">
        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>{warning}</span>
      </div>
    )}
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';
const ALL_DETECTORS_KEY = 'ALL';

export default function App() {
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [intradayPnl, setIntradayPnl] = useState(0);
  const [swingPnl, setSwingPnl] = useState(0);
  const [livePnlUpdates, setLivePnlUpdates] = useState<Record<string, number>>({});
  const [currentView, setCurrentView] = useState<'dashboard' | 'history' | 'performance'>('dashboard');
  const [signalsFilter, setSignalsFilter] = useState<'live' | 'history'>('live');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDetector, setSelectedDetector] = useState<string>(ALL_DETECTORS_KEY);
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);
  const [allDetectors, setAllDetectors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchInitialData = async () => {
    try {
      let url = `${API_URL}/api/trades/history?date=${selectedDate}`;
      if (selectedDetector !== ALL_DETECTORS_KEY) url += `&detector=${selectedDetector}`;

      const [histRes, heatmapRes, allHistRes] = await Promise.all([
        axios.get(url),
        axios.get(`${API_URL}/api/trades/heatmap`).catch(() => ({ data: { data: [] } })),
        // Fetch unfiltered history for the same date to populate the detector dropdown
        // — avoids the bug where the dropdown collapses once a filter is applied
        axios
          .get(`${API_URL}/api/trades/history?date=${selectedDate}`)
          .catch(() => ({ data: { data: [] } })),
      ]);

      const trades: Trade[] = histRes.data.data || [];
      setHistory(trades);

      // Build detector list from the unfiltered result so it never disappears
      const detectors = Array.from(
        new Set((allHistRes.data.data || []).map((t: Trade) => t.detectorName).filter(Boolean))
      ) as string[];
      setAllDetectors(detectors);

      if (heatmapRes.data?.data) setHeatmapData(heatmapRes.data.data);

      // Split PnL by duration class from history
      const recomputeSplit = (trades: Trade[]) => {
        const intraday = trades
          .filter((t) => (t.durationClass || 'INTRADAY') === 'INTRADAY')
          .reduce((sum, t) => sum + (t.pnl || 0), 0);
        const swing = trades
          .filter((t) => t.durationClass === 'SWING')
          .reduce((sum, t) => sum + (t.pnl || 0), 0);
        setIntradayPnl(intraday);
        setSwingPnl(swing);
      };

      if (isToday) {
        const todayRes = await axios.get(`${API_URL}/api/today`);
        setOpenTrades(todayRes.data.openTrades || []);

        if (selectedDetector === ALL_DETECTORS_KEY) {
          // Use Redis accumulator for the total but split by history for the breakdown
          const total = Number(todayRes.data.realizedPnl || 0);
          // Compute the split from the history subset and normalize to match total
          const histTotal = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          if (histTotal !== 0) {
            const scale = total / histTotal;
            const intraday = trades
              .filter((t) => (t.durationClass || 'INTRADAY') === 'INTRADAY')
              .reduce((sum, t) => sum + (t.pnl || 0) * scale, 0);
            setIntradayPnl(intraday);
            setSwingPnl(total - intraday);
          } else {
            setIntradayPnl(0);
            setSwingPnl(0);
          }
        } else {
          recomputeSplit(trades);
        }
      } else {
        setOpenTrades([]);
        recomputeSplit(trades);
      }
    } catch (err) {
      console.error('API Fetch Error:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [selectedDate, selectedDetector]);

  // ── SSE + polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isToday) return;

    const sse = new EventSource(`${API_URL}/api/events`);

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'signal_event') {
          if (selectedDetector !== ALL_DETECTORS_KEY && payload.data.detectorName !== selectedDetector)
            return;

          const trade: Trade = payload.data;
          if (trade.exitPrice) {
            setOpenTrades((prev) => prev.filter((t) => t.id !== trade.id));
            setHistory((prev) => [trade, ...prev]);
            const pnl = trade.pnl || 0;
            if (trade.durationClass === 'SWING') {
              setSwingPnl((prev) => prev + pnl);
            } else {
              setIntradayPnl((prev) => prev + pnl);
            }
          } else {
            setOpenTrades((prev) => [trade, ...prev]);
          }
        } else if (payload.type === 'pnl_update') {
          setLivePnlUpdates((prev) => ({ ...prev, [payload.data.symbol]: payload.data.unrealizedPnl }));
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    sse.onerror = () => {
      console.warn('SSE error, retrying...');
      fetchInitialData();
    };

    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/live-pnl`);
        if (res.data?.data) setLivePnlUpdates((prev) => ({ ...prev, ...res.data.data }));
      } catch (e) {
        console.warn('Poll failed:', e);
      }
    }, 2500);

    return () => {
      sse.close();
      clearInterval(poll);
    };
  }, [isToday, selectedDetector]);

  useEffect(() => {
    if (!isToday && signalsFilter === 'live') setSignalsFilter('history');
  }, [isToday]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalPnl = intradayPnl + swingPnl;
  const totalUnrealizedPnl = isToday
    ? openTrades.reduce((acc, t) => acc + (livePnlUpdates[t.symbol] || 0), 0)
    : 0;

  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) || t.detectorName?.toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  const intradayHistory = useMemo(
    () => filteredHistory.filter((t) => (t.durationClass || 'INTRADAY') === 'INTRADAY'),
    [filteredHistory]
  );
  const swingHistory = useMemo(
    () => filteredHistory.filter((t) => t.durationClass === 'SWING'),
    [filteredHistory]
  );

  const calcStats = (trades: Trade[]) => {
    const total = trades.length;
    const wins = trades.filter((t) => t.exitReason === 'TARGET' || (t.pnl && t.pnl > 0)).length;
    const rMultiples = trades.filter((t) => t.r_multiple !== undefined).map((t) => t.r_multiple!);
    const totalR = rMultiples.reduce((a, b) => a + b, 0);
    const avgR = rMultiples.length > 0 ? totalR / rMultiples.length : 0;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, winRate, totalR, avgR };
  };

  const overallStats = calcStats(filteredHistory);
  const intradayStats = calcStats(intradayHistory);
  const swingStats = calcStats(swingHistory);

  // Chart data — safe against null exitTimestamp and NaN pnl
  const chartData = useMemo(() => {
    let cumulative = 0;
    const data = [...filteredHistory]
      .reverse()
      .filter((t) => t.exitTimestamp != null)
      .map((t) => {
        cumulative += t.pnl ?? 0;
        const d = safeDate(t.exitTimestamp ?? null);
        return {
          time: d ? format(d, 'HH:mm') : '?',
          pnl: Number(cumulative.toFixed(2)),
        };
      });
    if (data.length === 0) data.push({ time: '09:15', pnl: 0 });
    return data;
  }, [filteredHistory]);

  // Per-detector stats for Performance view
  const detectorStats = useMemo(() => {
    return allDetectors
      .map((detector) => {
        const dTrades = filteredHistory.filter((t) => t.detectorName === detector);
        return { detector, ...calcStats(dTrades) };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.totalR - a.totalR);
  }, [filteredHistory, allDetectors]);

  // Export
  const exportCsv = () => {
    const headers = [
      'Symbol', 'Side', 'Duration', 'Entry Time', 'Exit Time', 'Detector', 'Regime',
      'Gated', 'Capital Gated', 'Unconstrained Size', 'Actual Size',
      'Entry Price', 'Exit Price', 'PnL', 'R-Multiple', 'Exit Reason',
    ];
    const rows = filteredHistory.map((t) => [
      t.symbol, t.side, t.durationClass || 'INTRADAY',
      new Date(t.timestamp).toISOString(),
      t.exitTimestamp ? new Date(t.exitTimestamp).toISOString() : '',
      t.detectorName, t.regimeClass || 'UNIVERSAL',
      t.gated ? 'YES' : 'NO', t.capitalGated ? 'YES' : 'NO',
      t.size || 100, t.actualSize ?? t.size ?? 100,
      t.entryPrice, t.exitPrice || '', t.pnl ?? 0,
      t.r_multiple !== undefined ? t.r_multiple : '',
      t.exitReason || '',
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `ninefifteen_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderTradeRow = (trade: Trade, isHistory: boolean) => {
    const livePnl = livePnlUpdates[trade.symbol];
    const duration = trade.durationClass || 'INTRADAY';
    return (
      <motion.div
        key={trade.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#1a1a1c] border border-[#222225] rounded-xl hover:border-[#333] transition-colors cursor-pointer gap-3 md:gap-0"
        onClick={() => setSelectedTrade(trade)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
              trade.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {trade.side.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-white font-mono text-sm">{trade.symbol}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-500">
                {trade.detectorName}
              </span>
              <span
                className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${DURATION_BADGE[duration]}`}
              >
                {duration === 'SWING' ? '🌙 SWING' : '⚡ INTRADAY'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-8 border-t border-[#222225] md:border-t-0 pt-3 md:pt-0">
          <div className="text-left">
            <div className="text-sm font-bold text-white font-mono">₹{trade.entryPrice}</div>
            <div className="text-[10px] text-gray-500">Entry ({trade.actualSize ?? trade.size}x)</div>
          </div>
          {trade.target && (
            <div className="text-left">
              <div className="text-sm font-bold text-green-400 font-mono">₹{trade.target}</div>
              <div className="text-[10px] text-gray-500">Target</div>
            </div>
          )}
          <div className="text-right min-w-[70px]">
            {isHistory ? (
              <>
                <div
                  className={`text-sm font-bold font-mono ${
                    (trade.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {fmtPnl(trade.pnl ?? 0)}
                </div>
                <div className="text-[10px] text-gray-500">{trade.exitReason}</div>
              </>
            ) : livePnl !== undefined ? (
              <>
                <div
                  className={`text-sm font-bold font-mono ${livePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {fmtPnl(livePnl)}
                </div>
                <div className="text-[10px] text-blue-500 font-semibold animate-pulse">LIVE</div>
              </>
            ) : (
              <div className="text-xs text-gray-500">Waiting...</div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedTrade(trade); }}
            className="px-3 py-1.5 bg-[#222225] hover:bg-[#2a2a2e] text-xs font-semibold text-white rounded-lg transition-colors border border-[#333] shrink-0"
          >
            Details
          </button>
        </div>
      </motion.div>
    );
  };

  const renderEmptyState = (msg: string) => (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
      <p className="text-sm">{msg}</p>
    </div>
  );

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] bg-[#0f0f10] text-gray-300 font-sans overflow-hidden">

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#141416] border-r border-[#222225] flex-col p-6 shrink-0">
        <div className="flex items-center gap-3 mb-10 text-white">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold tracking-wide">Ninefifteen</h1>
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">General</div>
        <nav className="flex-1 space-y-1">
          {(['dashboard', 'history', 'performance'] as const).map((view) => {
            const icons = {
              dashboard: <LayoutDashboard className="w-5 h-5" />,
              history: <History className="w-5 h-5" />,
              performance: <TrendingUp className="w-5 h-5" />,
            };
            const labels = { dashboard: 'Dashboard', history: 'Trade History', performance: 'Performance' };
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  currentView === view
                    ? 'bg-[#1c1c1e] text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-[#1c1c1e]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {icons[view]}
                  <span className="font-medium">{labels[view]}</span>
                </div>
                {currentView === view && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-8">Preferences</div>
        <nav className="space-y-1 mb-8">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1c1c1e] rounded-xl transition-colors">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-[#1c1c1e] rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </a>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar pb-24 lg:pb-8">

        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 lg:mb-8">
          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">N</div>
              <div>
                <div className="text-sm font-semibold text-white">Ninefifteen</div>
                <div className="text-[10px] text-gray-400">Paper Trading Mode</div>
              </div>
            </div>
            <button className="w-10 h-10 rounded-xl bg-[#141416] border border-[#222225] flex items-center justify-center hover:text-white transition-colors shrink-0 lg:hidden">
              <Bell className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:w-64 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols, detectors…"
                className="w-full bg-[#141416] border border-[#222225] rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Detector filter */}
            <div className="relative">
              <select
                value={selectedDetector}
                onChange={(e) => setSelectedDetector(e.target.value)}
                className="appearance-none bg-[#141416] border border-[#222225] rounded-xl px-3 py-2.5 pr-8 text-sm font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer min-w-[140px]"
              >
                <option value={ALL_DETECTORS_KEY}>All Detectors</option>
                {allDetectors.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Date picker */}
            <div className="relative bg-[#141416] border border-[#222225] px-3 py-2.5 rounded-xl flex items-center gap-2 min-w-[140px]">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="bg-transparent text-white text-sm font-semibold outline-none cursor-pointer w-full [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              />
              {!isToday && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-[#141416]" title="Viewing Historical Data" />
              )}
            </div>

            <button className="hidden lg:flex w-10 h-10 rounded-xl bg-[#141416] border border-[#222225] items-center justify-center hover:text-white transition-colors shrink-0">
              <Bell className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-3 shrink-0 pl-2">
              <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">N</div>
              <div>
                <div className="text-sm font-semibold text-white">Ninefifteen</div>
                <div className="text-xs text-gray-400">Paper Trading Mode</div>
              </div>
            </div>
          </div>
        </header>

        {/* ── KPI Cards — always shown ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          {/* PnL card — split INTRADAY / SWING */}
          <div className="glass-card p-6 lg:col-span-1">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1c] flex items-center justify-center border border-[#222225]">
                  <TrendingUp className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-400">Realized PnL</div>
                  {isToday && (
                    <div className="text-xs text-blue-500 font-semibold mt-0.5">
                      Unrealized: ₹{fmt(totalUnrealizedPnl)}
                    </div>
                  )}
                </div>
              </div>
              <button className="text-gray-600 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
            </div>

            {/* Combined total */}
            <div className={`text-3xl font-bold font-mono tracking-tight ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPnl(totalPnl)}
              {isToday && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  Total: ₹{fmt(totalPnl + totalUnrealizedPnl)}
                </span>
              )}
            </div>

            {/* Split breakdown */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-2 bg-[#1a1a1c] rounded-lg border border-[#222225]">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] font-semibold text-cyan-400 border border-cyan-400/30 bg-cyan-500/10 px-1 rounded">INTRADAY</span>
                </div>
                <div className={`text-base font-bold font-mono ${intradayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPnl(intradayPnl)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{intradayStats.total} trades · {intradayStats.winRate.toFixed(0)}% win</div>
              </div>
              <div className="p-2 bg-[#1a1a1c] rounded-lg border border-[#222225]">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] font-semibold text-purple-400 border border-purple-400/30 bg-purple-500/10 px-1 rounded">SWING</span>
                </div>
                <div className={`text-base font-bold font-mono ${swingPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPnl(swingPnl)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{swingStats.total} trades · {swingStats.winRate.toFixed(0)}% win</div>
              </div>
            </div>

            {!isToday && new Date(selectedDate) < new Date('2026-09-14') && (
              <div className="text-[10px] text-orange-400/80 mt-3 flex items-start gap-1 leading-tight">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Historical PnL before Sept 14 is an approximation ignoring concurrent capital constraints.</span>
              </div>
            )}
          </div>

          {/* Win Rate */}
          <StatCard
            icon={<Crosshair className="w-5 h-5 text-gray-300" />}
            label="Win Rate"
            sublabel={`${overallStats.total} closed trades`}
            value={`${overallStats.winRate.toFixed(1)}%`}
            valueClass="text-blue-400"
          />

          {/* Active */}
          <StatCard
            icon={<Activity className="w-5 h-5 text-gray-300" />}
            label="Active Signals"
            sublabel={`${overallStats.totalR >= 0 ? '+' : ''}${overallStats.totalR.toFixed(2)}R total`}
            value={String(openTrades.length)}
            valueClass="text-white"
          />
        </div>

        {/* ── Dashboard view ────────────────────────────────────────────────── */}
        {currentView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 h-auto lg:h-[420px]">
            {/* Signals / History list */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col min-h-[400px] lg:min-h-0">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-5 shrink-0 gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {signalsFilter === 'live' ? 'Active Positions' : 'Closed Trades'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSignalsFilter('live')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      signalsFilter === 'live'
                        ? 'bg-[#1c1c1e] text-blue-400 border-blue-500/30'
                        : 'bg-transparent text-gray-400 border-transparent hover:text-white'
                    }`}
                  >
                    Live ({openTrades.length})
                  </button>
                  <button
                    onClick={() => setSignalsFilter('history')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      signalsFilter === 'history'
                        ? 'bg-[#1c1c1e] text-blue-400 border-blue-500/30'
                        : 'bg-transparent text-gray-400 border-transparent hover:text-white'
                    }`}
                  >
                    History ({filteredHistory.length})
                  </button>
                  {signalsFilter === 'history' && filteredHistory.length > 0 && (
                    <button
                      onClick={exportCsv}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg border bg-[#1c1c1e] text-gray-300 border-[#333] hover:text-white"
                    >
                      Export CSV
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-2 custom-scrollbar">
                <AnimatePresence>
                  {signalsFilter === 'live'
                    ? openTrades.length === 0
                      ? renderEmptyState('No active positions.')
                      : openTrades.map((t) => renderTradeRow(t, false))
                    : filteredHistory.length === 0
                    ? renderEmptyState('No closed trades for this date.')
                    : filteredHistory.map((t) => renderTradeRow(t, true))}
                </AnimatePresence>
              </div>
            </div>

            {/* Heatmap */}
            <div className="glass-card p-6 flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-5">Trading Activity</h2>
              <div className="flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-7 gap-1.5">
                  {(() => {
                    const latest28 = heatmapData.slice(0, 28).reverse();
                    const padded = Array.from({ length: 28 }, (_, i) => latest28[i] || { date: '', count: -1 });
                    const maxCount = Math.max(...heatmapData.map((d) => d.count), 1);
                    return padded.map((day, i) => {
                      if (day.count === -1) return <div key={`e-${i}`} className="h-8 rounded-md bg-[#1c1c1e] border border-[#222225]" />;
                      const intensity = day.count / maxCount;
                      const bg = intensity > 0.8 ? 'bg-blue-400' : intensity > 0.5 ? 'bg-blue-600' : intensity > 0.1 ? 'bg-blue-900' : 'bg-[#1c1c1e]';
                      const sel = selectedDate === day.date;
                      return (
                        <div
                          key={day.date}
                          onClick={() => setSelectedDate(day.date)}
                          title={`${day.date}: ${day.count} signals`}
                          className={`h-8 rounded-md ${bg} ${sel ? 'border-2 border-white' : 'border border-[#222225]'} cursor-pointer hover:border-gray-400 transition-all`}
                        />
                      );
                    });
                  })()}
                </div>
                <div className="flex justify-between items-center mt-5">
                  <div>
                    <div className="text-xs text-gray-500">Selected Day</div>
                    <div className="text-sm font-bold text-white">
                      {heatmapData.find((d) => d.date === selectedDate)?.count || 0} signals
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">History Total</div>
                    <div className="text-sm font-bold text-white">
                      {heatmapData.reduce((a, d) => a + d.count, 0)} signals
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Trade History view ────────────────────────────────────────────── */}
        {currentView === 'history' && (
          <div className="glass-card p-6 flex flex-col min-h-[500px] mb-6">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">Trade History</h2>
                <div className="text-xs text-gray-500 mt-0.5">{filteredHistory.length} closed trades for {selectedDate}</div>
              </div>
              <div className="flex gap-2">
                {filteredHistory.length > 0 && (
                  <button onClick={exportCsv} className="px-4 py-2 text-xs font-semibold rounded-lg border bg-[#1c1c1e] text-gray-300 border-[#333] hover:text-white transition-colors">
                    Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* INTRADAY section */}
            {intradayHistory.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-cyan-400 border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 rounded">⚡ INTRADAY</span>
                  <span className="text-xs text-gray-500">{intradayStats.total} trades · {intradayStats.winRate.toFixed(0)}% win · {fmtPnl(intradayPnl)}</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {intradayHistory.map((t) => renderTradeRow(t, true))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* SWING section */}
            {swingHistory.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-purple-400 border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 rounded">🌙 SWING</span>
                  <span className="text-xs text-gray-500">{swingStats.total} trades · {swingStats.winRate.toFixed(0)}% win · {fmtPnl(swingPnl)}</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {swingHistory.map((t) => renderTradeRow(t, true))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {filteredHistory.length === 0 && renderEmptyState('No closed trades for this date.')}
          </div>
        )}

        {/* ── Performance view ──────────────────────────────────────────────── */}
        {currentView === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Chart */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col min-h-[350px]">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-white">Cumulative PnL</h2>
                  <div className="text-xs text-gray-500 mt-0.5">{filteredHistory.length} trades · {selectedDate}</div>
                </div>
                <button className="text-gray-500 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 -ml-4 -mr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#333" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#141416', border: '1px solid #222225', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      labelStyle={{ color: '#888' }}
                      formatter={(v) => [`₹${fmt(Number(v ?? 0))}`, 'PnL'] as [string, string]}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBlue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strategy Stats */}
            <div className="glass-card p-6 flex flex-col min-h-[350px]">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 shrink-0">
                <TrendingUp className="w-5 h-5 text-gray-400" /> Strategy Stats
              </h2>

              {/* Overall R */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 bg-[#1a1a1c] border border-[#222225] rounded-xl text-center">
                  <div className="text-xs text-gray-500 mb-1">Total R</div>
                  <div className={`text-xl font-bold font-mono ${overallStats.totalR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {overallStats.totalR >= 0 ? '+' : ''}{overallStats.totalR.toFixed(2)}R
                  </div>
                </div>
                <div className="p-3 bg-[#1a1a1c] border border-[#222225] rounded-xl text-center">
                  <div className="text-xs text-gray-500 mb-1">Avg R / Trade</div>
                  <div className={`text-xl font-bold font-mono ${overallStats.avgR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {overallStats.avgR >= 0 ? '+' : ''}{overallStats.avgR.toFixed(2)}R
                  </div>
                </div>
              </div>

              {/* INTRADAY / SWING split */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 bg-[#1a1a1c] border border-cyan-500/20 rounded-xl">
                  <div className="text-[10px] font-semibold text-cyan-400 mb-1">⚡ INTRADAY</div>
                  <div className={`text-base font-bold font-mono ${intradayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPnl(intradayPnl)}</div>
                  <div className="text-[10px] text-gray-500">{intradayStats.total} trades · {intradayStats.winRate.toFixed(0)}% win</div>
                </div>
                <div className="p-3 bg-[#1a1a1c] border border-purple-500/20 rounded-xl">
                  <div className="text-[10px] font-semibold text-purple-400 mb-1">🌙 SWING</div>
                  <div className={`text-base font-bold font-mono ${swingPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPnl(swingPnl)}</div>
                  <div className="text-[10px] text-gray-500">{swingStats.total} trades · {swingStats.winRate.toFixed(0)}% win</div>
                </div>
              </div>

              {/* Per-detector */}
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detector Breakdown</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {detectorStats.map((stat) => (
                  <div
                    key={stat.detector}
                    className="flex justify-between items-center p-3 bg-[#1a1a1c] border border-[#222225] rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {stat.detector.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-xs text-gray-500">{stat.total} trades · {stat.winRate.toFixed(0)}% win</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold font-mono text-sm ${stat.totalR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stat.totalR >= 0 ? '+' : ''}{stat.totalR.toFixed(2)}R
                      </div>
                      <div className="text-[10px] text-gray-500">avg {stat.avgR >= 0 ? '+' : ''}{stat.avgR.toFixed(2)}R</div>
                    </div>
                  </div>
                ))}
                {detectorStats.length === 0 && (
                  <div className="text-center text-gray-500 text-sm mt-4">No closed trades for this period.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Trade Details Modal */}
      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailsModal
            trade={selectedTrade}
            livePnl={livePnlUpdates[selectedTrade.symbol]}
            onClose={() => setSelectedTrade(null)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#141416]/95 backdrop-blur-md border-t border-[#222225] flex items-center justify-around p-2 pb-safe z-40">
        <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center p-2 rounded-lg ${currentView === 'dashboard' ? 'text-blue-400' : 'text-gray-500'}`}>
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">Dashboard</span>
        </button>
        <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center p-2 rounded-lg ${currentView === 'history' ? 'text-blue-400' : 'text-gray-500'}`}>
          <History className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">History</span>
        </button>
        <button onClick={() => setCurrentView('performance')} className={`flex flex-col items-center p-2 rounded-lg ${currentView === 'performance' ? 'text-blue-400' : 'text-gray-500'}`}>
          <TrendingUp className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold">Stats</span>
        </button>
      </nav>
    </div>
  );
}
