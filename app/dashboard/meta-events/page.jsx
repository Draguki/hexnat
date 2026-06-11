"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Search,
  RefreshCw,
  ShieldCheck,
  Eye,
  ShoppingCart,
  MousePointer2,
  Navigation,
  Globe,
  Zap,
  ChevronRight,
  Terminal,
  ExternalLink
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MetaEventsLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [stats, setStats] = useState({ total: 0, add_to_cart: 0, pageview: 0, purchase: 0 });

  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("ts", { ascending: false })
      .limit(100);

    if (error) console.error("Error fetching events:", error);
    else {
      setEvents(data || []);
      // Quick stats
      const s = (data || []).reduce((acc, e) => {
        acc.total++;
        if (e.type === 'add_to_cart') acc.add_to_cart++;
        if (e.type === 'pageview') acc.pageview++;
        if (e.type === 'purchase') acc.purchase++;
        return acc;
      }, { total: 0, add_to_cart: 0, pageview: 0, purchase: 0 });
      setStats(s);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("all-events-live")
      .on("postgres_changes", { event: "INSERT", table: "events" }, (payload) => {
        setEvents((prev) => [payload.new, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getEventIcon = (type) => {
    switch(type) {
      case 'pageview': return <Navigation className="w-4 h-4 text-blue-400" />;
      case 'add_to_cart': return <ShoppingCart className="w-4 h-4 text-amber-400" />;
      case 'purchase': return <Zap className="w-4 h-4 text-green-400" />;
      case 'click': return <MousePointer2 className="w-4 h-4 text-purple-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredEvents = events.filter(e => 
    e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.props?.product_name && e.props.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest">Live Engine</div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
              META ACTIVITY STREAM
            </h1>
            <p className="text-gray-500 font-medium mt-2 max-w-xl">
              Real-time synchronization between your website and Meta's Conversion Dataset. 
              Monitoring every interaction from initial landing to final checkout.
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#111] p-1.5 rounded-xl border border-white/5 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filter stream..." 
                className="bg-black border-none rounded-lg py-2 pl-10 pr-4 focus:ring-1 focus:ring-blue-500/50 w-48 md:w-64 text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchEvents}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Events', val: stats.total, icon: Activity, color: 'text-blue-400' },
            { label: 'Page Views', val: stats.pageview, icon: Globe, color: 'text-purple-400' },
            { label: 'Add To Carts', val: stats.add_to_cart, icon: ShoppingCart, color: 'text-amber-400' },
            { label: 'Purchases', val: stats.purchase, icon: Zap, color: 'text-green-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#111] border border-white/5 p-5 rounded-2xl hover:border-white/10 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`w-5 h-5 ${s.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Last 100</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{s.val.toLocaleString()}</div>
              <div className="text-xs text-gray-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Main Log Section */}
        <div className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
          
          <div className="overflow-x-auto relative">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Timestamp</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Event Type</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Content Data</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Session ID</th>
                  <th className="px-8 py-5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">Syncing with Meta...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-24 text-center text-gray-600 font-medium italic">
                      No matching events found in the current stream.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-white/[0.03] transition-all group">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                          <Clock className="w-3 h-3" />
                          {new Date(event.ts).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })} · {new Date(event.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform">
                            {getEventIcon(event.type)}
                          </div>
                          <span className="font-black text-xs text-white uppercase tracking-tighter">
                            {event.type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="max-w-md">
                          <div className="text-sm font-bold text-gray-300 truncate">
                            {event.type === 'pageview' ? event.path : 
                             event.type === 'add_to_cart' ? event.props?.product_name :
                             event.type === 'purchase' ? `Order Total: ₹${event.props?.revenue}` : 
                             event.type === 'click' ? `Element: ${event.props?.text || event.props?.selector}` : '—'}
                          </div>
                          {event.type === 'add_to_cart' && (
                            <div className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                              Value: ₹{event.props?.product_price}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-600 bg-white/5 px-2 py-1 rounded w-fit">
                          <Terminal className="w-3 h-3" />
                          {event.session_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => setSelectedEvent(event)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all flex items-center gap-2 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 w-full max-w-3xl rounded-[2.5rem] flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                  {getEventIcon(selectedEvent.type)}
                  {selectedEvent.type} Payload
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Full JSON Object for Meta CAPI</p>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="p-3 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-all active:scale-90"
              >
                <XCircle className="w-7 h-7" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="bg-black p-6 rounded-3xl border border-white/5 font-mono text-sm leading-relaxed text-blue-400/90 relative group">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[10px] font-bold uppercase tracking-widest"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>
            </div>
            <div className="p-8 bg-white/[0.02] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="px-8 py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}
