import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, CheckCircle, Crosshair, TrendingUp, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// If VITE_API_URL is undefined, default to empty string so it uses relative paths (Vercel Proxy)
const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function App() {
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [pnl, setPnl] = useState(0);

  const fetchData = async () => {
    try {
      const [openRes, histRes, pnlRes] = await Promise.all([
        axios.get(`${API_URL}/api/trades/open`),
        axios.get(`${API_URL}/api/trades/history`),
        axios.get(`${API_URL}/api/pnl/daily`)
      ]);
      setOpenTrades(openRes.data.data || []);
      setHistory(histRes.data.data || []);
      setPnl(pnlRes.data.pnl || 0);
    } catch (err) {
      console.error("API Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Compute stats
  const totalTrades = history.length;
  const wins = history.filter(t => t.exitReason === 'TARGET').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;

  // Chart data
  let cumulative = 0;
  const chartData = [...history].reverse().map(t => {
    cumulative += t.pnl;
    return {
      time: format(new Date(t.exitTimestamp), 'HH:mm:ss'),
      pnl: cumulative
    };
  });
  if (chartData.length === 0) chartData.push({ time: '09:15:00', pnl: 0 }); // Baseline

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans">
      <header className="flex justify-between items-center mb-8 border-b border-[#262626] pb-4">
        <div className="flex items-center gap-3">
          <Activity className="text-primary w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-wider">INSIDER QUANT ENGINE</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-success rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
          <span className="text-sm text-gray-400 font-mono tracking-widest uppercase">Live Connection</span>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Daily PnL</span>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className={`text-3xl font-bold font-mono ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
            ₹{pnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Win Rate</span>
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div className="text-3xl font-bold font-mono">{winRate}%</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Total Trades</span>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-3xl font-bold font-mono">{totalTrades}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-lg">
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Active Signals</span>
            <Crosshair className="w-5 h-5 text-warning" />
          </div>
          <div className="text-3xl font-bold font-mono text-blue-400">{openTrades.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PnL Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> 
            Cumulative PnL Curve
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="time" stroke="#525252" fontSize={12} tickMargin={10} />
                <YAxis stroke="#525252" fontSize={12} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', borderColor: '#262626', color: '#fff' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Area type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPnl)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Trades Feed */}
        <div className="bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col h-[400px]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Live Open Signals
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            <AnimatePresence>
              {openTrades.length === 0 && (
                <div className="text-center text-gray-500 mt-10">No active signals currently.</div>
              )}
              {openTrades.map((trade) => (
                <motion.div 
                  key={trade.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#1a1a1a] border border-[#333] p-4 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${trade.side === 'LONG' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                        {trade.side}
                      </span>
                      <span className="ml-2 font-mono font-bold">{trade.symbol}</span>
                    </div>
                    <span className="text-xs text-gray-500">{format(new Date(trade.timestamp), 'HH:mm:ss')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mt-3">
                    <div>Entry: <span className="text-white font-mono">₹{trade.entryPrice}</span></div>
                    <div>Target: <span className="text-success font-mono">₹{trade.target}</span></div>
                    <div>Stop: <span className="text-danger font-mono">₹{trade.stopLoss}</span></div>
                    <div>Detector: <span className="text-white">{trade.detectorName.split(/(?=[A-Z])/).join(' ')}</span></div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
