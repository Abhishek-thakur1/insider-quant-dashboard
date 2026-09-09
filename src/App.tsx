import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Activity, 
  LayoutDashboard, 
  History, 
  Settings,
  LogOut,
  Search,
  Bell,
  MoreHorizontal,
  TrendingUp,
  Crosshair,
  AlertCircle,
  TerminalSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TradeDetailsModal = ({ trade, onClose, livePnl }: { trade: any, onClose: () => void, livePnl?: number }) => {
  if (!trade) return null;
  const isHistory = !!trade.exitPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#141416] border border-[#222225] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b border-[#222225]">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${trade.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {trade.side}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-mono">{trade.symbol}</h2>
              <div className="text-xs text-gray-500">{trade.detectorName} • {trade.regimeClass || 'UNIVERSAL'}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-[#1c1c1e] transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-1">Entry Price</div>
            <div className="text-lg font-bold text-white font-mono">₹{trade.entryPrice}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Target</div>
            <div className="text-lg font-bold text-green-400 font-mono">₹{trade.target}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
            <div className="text-lg font-bold text-red-400 font-mono">₹{trade.stopLoss}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <div className={`text-sm font-bold uppercase ${isHistory ? 'text-gray-400' : 'text-blue-400'}`}>{isHistory ? 'Closed' : 'Active'}</div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="p-4 rounded-xl bg-[#1a1a1c] border border-[#222225] flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-400">Total PnL</span>
            <span className={`text-2xl font-bold font-mono tracking-tight ${
              (isHistory ? trade.pnl : livePnl) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {isHistory ? (trade.pnl >= 0 ? '+' : '') + `₹${trade.pnl}` : (livePnl !== undefined ? (livePnl >= 0 ? '+' : '') + `₹${livePnl.toFixed(2)}` : 'Waiting...')}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function App() {
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [pnl, setPnl] = useState(0);

  const [livePnlUpdates, setLivePnlUpdates] = useState<Record<string, number>>({});
  const [currentView, setCurrentView] = useState<'dashboard' | 'history' | 'performance'>('dashboard');
  const [signalsFilter, setSignalsFilter] = useState<'live' | 'filtered'>('live');
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

  const fetchInitialData = async () => {
    try {
      const [todayRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/api/today`),
        axios.get(`${API_URL}/api/trades/history`)
      ]);
      
      setOpenTrades(todayRes.data.openTrades || []);
      setPnl(todayRes.data.realizedPnl || 0);
      setHistory(histRes.data.data || []);
    } catch (err) {
      console.error("API Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Setup SSE connection
    const sse = new EventSource(`${API_URL}/api/stream`);

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'signal_event') {
          // A trade opened or closed
          if (payload.data.status === 'CLOSED' || payload.data.exitPrice) {
            // Remove from open trades
            setOpenTrades(prev => prev.filter(t => t.id !== payload.data.id));
            // Add to history
            setHistory(prev => [payload.data, ...prev]);
            // Update Realized PnL locally until next fetch
            if (payload.data.pnl) {
                setPnl(prev => prev + payload.data.pnl);
            }
          } else {
            // It's a new OPEN trade
            setOpenTrades(prev => [payload.data, ...prev]);
          }
        } else if (payload.type === 'pnl_update') {
          // Live tick PnL update
          setLivePnlUpdates(prev => ({
            ...prev,
            [payload.data.symbol]: payload.data.unrealizedPnl
          }));
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    sse.onerror = () => {
      console.warn("SSE Connection error, retrying...");
      // Re-fetch initial state to heal any missed events during disconnect
      fetchInitialData();
    };

    return () => sse.close();
  }, []);

  // Compute Unrealized PnL from the live updates
  const totalUnrealizedPnl = openTrades.reduce((acc, trade) => {
    return acc + (livePnlUpdates[trade.symbol] || 0);
  }, 0);

  const totalTrades = history.length;
  const wins = history.filter(t => t.exitReason === 'TARGET').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

  let cumulative = 0;
  const chartData = [...history].reverse().map(t => {
    cumulative += t.pnl;
    return {
      time: format(new Date(t.exitTimestamp), 'HH:mm'),
      pnl: cumulative
    };
  });
  if (chartData.length === 0) chartData.push({ time: '09:15', pnl: 0 });

  return (
    <div className="flex h-screen bg-[#0f0f10] text-gray-300 font-sans overflow-hidden">
      
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-[#141416] border-r border-[#222225] flex-col p-6">
        <div className="flex items-center gap-3 mb-10 text-white">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold tracking-wide">IQ Engine</h1>
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">General</div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setCurrentView('dashboard')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${currentView === 'dashboard' ? 'bg-[#1c1c1e] text-blue-400' : 'text-gray-400 hover:text-white hover:bg-[#1c1c1e]'}`}>
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </div>
            {currentView === 'dashboard' && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>}
          </button>
          <button onClick={() => setCurrentView('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'history' ? 'bg-[#1c1c1e] text-blue-400' : 'text-gray-400 hover:text-white hover:bg-[#1c1c1e]'}`}>
            <History className="w-5 h-5" />
            <span className="font-medium">Trade History</span>
          </button>
          <button onClick={() => setCurrentView('performance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'performance' ? 'bg-[#1c1c1e] text-blue-400' : 'text-gray-400 hover:text-white hover:bg-[#1c1c1e]'}`}>
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Performance</span>
          </button>
        </nav>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-8">Preferences</div>
        <nav className="space-y-2 mb-8">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1c1c1e] rounded-xl transition-colors">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-[#1c1c1e] rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </a>
        </nav>

        <div className="glass-card p-5 mt-auto relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 to-transparent"></div>
          <div className="relative z-10 text-center">
            <div className="text-sm font-bold text-white mb-2">Automated Execution</div>
            <p className="text-xs text-gray-400 mb-4">Upgrade to real money execution layer.</p>
            <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
              Deploy API Keys
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search symbols, detectors..." 
              className="w-full bg-[#141416] border border-[#222225] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-3 bg-[#141416] border border-[#222225] px-4 py-2 rounded-xl">
              <span className="text-lg font-bold text-white">{format(new Date(), 'dd')}</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-400 uppercase">{format(new Date(), 'MMM, yyyy')}</span>
                <span className="text-[10px] text-gray-500">{format(new Date(), 'EEEE')}</span>
              </div>
            </div>
            
            <button className="w-10 h-10 rounded-xl bg-[#141416] border border-[#222225] flex items-center justify-center hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                Q
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Quant Engine</div>
                <div className="text-xs text-gray-400">Paper Trading Mode</div>
              </div>
            </div>
          </div>
        </header>

        {/* Top KPI Cards - Always shown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="glass-card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1c] flex items-center justify-center border border-[#222225]">
                  <TrendingUp className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-400">Daily PnL</div>
                  <div className="text-xs flex gap-2">
                    <span className="text-gray-500">Realized</span>
                    <span className="text-blue-500 font-semibold border-l border-[#333] pl-2">Unrealized: ₹{totalUnrealizedPnl.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <button className="text-gray-500 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
            </div>
            <div className={`text-3xl font-bold font-mono tracking-tight ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ₹{pnl.toFixed(2)} <span className="text-sm font-normal text-gray-500 ml-1">Total: ₹{(pnl + totalUnrealizedPnl).toFixed(2)}</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1c] flex items-center justify-center border border-[#222225]">
                  <Crosshair className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-400">Win Rate</div>
                  <div className="text-xs text-gray-500">JaneStreet Filter</div>
                </div>
              </div>
              <button className="text-gray-500 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-blue-400">
              {winRate}%
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1c] flex items-center justify-center border border-[#222225]">
                  <Activity className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-400">Active Signals</div>
                  <div className="text-xs text-gray-500">{totalTrades} Total Trades</div>
                </div>
              </div>
              <button className="text-gray-500 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-white">
              {openTrades.length}
            </div>
          </div>
        </div>

        {currentView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 h-auto lg:h-[400px]">
            {/* Active Signals List */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col min-h-[400px] lg:min-h-0">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-lg font-semibold text-white">{signalsFilter === 'live' ? 'Active Positions' : 'Filtered History'}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setSignalsFilter('live')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${signalsFilter === 'live' ? 'bg-[#1c1c1e] text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-400 border-transparent hover:text-white'}`}>Live Market</button>
                  <button onClick={() => setSignalsFilter('filtered')} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${signalsFilter === 'filtered' ? 'bg-[#1c1c1e] text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-400 border-transparent hover:text-white'}`}>Filtered</button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-3 custom-scrollbar">
                <AnimatePresence>
                  {(signalsFilter === 'live' ? openTrades : history).length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p>No signals currently.</p>
                    </div>
                  )}
                  {(signalsFilter === 'live' ? openTrades : history).map((trade) => (
                    <motion.div 
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-4 bg-[#1a1a1c] border border-[#222225] rounded-xl hover:border-[#333] transition-colors cursor-pointer"
                      onClick={() => setSelectedTrade(trade)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${trade.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {trade.side.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white font-mono">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.detectorName ? trade.detectorName.split(/(?=[A-Z])/).join(' ') : 'Unknown'}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-bold text-white font-mono">₹{trade.entryPrice}</div>
                        <div className="text-xs text-gray-500">Entry</div>
                      </div>
                      
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-green-400 font-mono">₹{trade.target}</div>
                        <div className="text-xs text-gray-500">Target</div>
                      </div>

                      <div className="text-right">
                        {trade.exitPrice ? (
                          <>
                            <div className={`text-sm font-bold font-mono ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold">{trade.exitReason}</div>
                          </>
                        ) : (livePnlUpdates[trade.symbol] !== undefined ? (
                          <>
                            <div className={`text-sm font-bold font-mono ${livePnlUpdates[trade.symbol] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {livePnlUpdates[trade.symbol] >= 0 ? '+' : ''}₹{livePnlUpdates[trade.symbol].toFixed(2)}
                            </div>
                            <div className="text-[10px] text-blue-500 font-semibold animate-pulse">LIVE PnL</div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-500">Waiting for tick...</div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedTrade(trade); }}
                        className="px-4 py-2 bg-[#222225] hover:bg-[#2a2a2e] text-xs font-semibold text-white rounded-lg transition-colors border border-[#333]"
                      >
                        Details
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Activity Heatmap Mock */}
            <div className="glass-card p-6 flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-6">Trading Activity</h2>
              <div className="flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({length: 20}).map((_, i) => {
                    const intensity = Math.random();
                    let bgClass = "bg-[#1c1c1e]";
                    if (intensity > 0.8) bgClass = "bg-blue-400";
                    else if (intensity > 0.5) bgClass = "bg-blue-600";
                    else if (intensity > 0.2) bgClass = "bg-blue-900";
                    
                    return (
                      <div key={i} className={`h-8 rounded-md ${bgClass} border border-[#222225]`}></div>
                    )
                  })}
                </div>
                <div className="flex justify-between items-center mt-6">
                  <div>
                    <div className="text-xs text-gray-500">Today</div>
                    <div className="text-sm font-bold text-white">{totalTrades} signals</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">This Week</div>
                    <div className="text-sm font-bold text-white">{totalTrades * 4 + 12} signals</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(currentView === 'performance' || currentView === 'history') && (
          <div className={`grid grid-cols-1 ${currentView === 'performance' ? 'lg:grid-cols-3' : ''} gap-6 h-auto lg:h-[350px] mb-8 flex-1`}>
            
            {/* Performance Chart */}
            <div className={`${currentView === 'performance' ? 'lg:col-span-2' : ''} glass-card p-6 flex flex-col min-h-[300px] lg:min-h-0`}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-lg font-semibold text-white">Performance</h2>
                <button className="text-gray-500 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 -ml-4 -mr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#333" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141416', border: '1px solid #222225', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorBlue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* System Logs */}
            {currentView === 'performance' && (
              <div className="glass-card p-6 flex flex-col min-h-[300px] lg:min-h-0">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 shrink-0">
                  <TerminalSquare className="w-5 h-5 text-gray-400" /> System Logs
                </h2>
                <div className="flex-1 bg-[#141416] border border-[#222225] rounded-xl p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] text-gray-400 space-y-2 min-h-0">
                  <div className="text-blue-400">[09:15:00] Engine booted successfully.</div>
                  <div className="text-blue-400">[09:15:02] Connected to Fyers Data Servers.</div>
                  <div className="text-gray-500">[09:16:45] Subscribed ATM options...</div>
                  {history.map((h, i) => (
                    <div key={i} className="text-gray-300">
                      [{format(new Date(h.exitTimestamp), 'HH:mm:ss')}] Closed {h.symbol} at ₹{h.pnl}
                    </div>
                  ))}
                  <div className="text-gray-500 mt-2 flex items-center gap-2 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Awaiting signals...
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailsModal 
            trade={selectedTrade} 
            livePnl={livePnlUpdates[selectedTrade.symbol]}
            onClose={() => setSelectedTrade(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
