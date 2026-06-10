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
  Navigation
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

  async function fetchEvents() {
    setLoading(true);
    // Fetch all events from the 'events' table that were processed
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("ts", { ascending: false })
      .limit(100);

    if (error) console.error("Error fetching events:", error);
    else setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("all-events")
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
      case 'purchase': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'click': return <MousePointer2 className="w-4 h-4 text-purple-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredEvents = events.filter(e => 
    e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.props?.product_name && e.props.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="text-blue-500 w-8 h-8" />
              Full Meta Events Log
            </h1>
            <p className="text-gray-400 mt-1">Real-time view of every event tracked and sent to Meta (PageView to Purchase).</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by event or product..." 
                className="bg-[#1a1a1a] border border-[#333] rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchEvents}
              className="p-2 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a] border-b border-[#222]">
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Event Type</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Details</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Session ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">View Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Loading event stream...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No events captured in this range.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-[#151515] transition-colors group">
                    <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(event.ts).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.type)}
                        <span className="font-bold uppercase text-xs tracking-widest">
                          {event.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {event.type === 'pageview' ? event.path : 
                       event.type === 'add_to_cart' ? `${event.props?.product_name} (₹${event.props?.product_price})` :
                       event.type === 'purchase' ? `Order Total: ₹${event.props?.revenue}` : 
                       event.type === 'click' ? `Clicked: ${event.props?.text || event.props?.selector}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">
                      {event.session_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedEvent(event)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#333] w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#333] flex items-center justify-between bg-[#1a1a1a]">
              <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
                {getEventIcon(selectedEvent.type)}
                {selectedEvent.type} Event Data
              </h2>
              <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-white/10 rounded-full">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="bg-[#0a0a0a] p-4 rounded-xl border border-[#222] font-mono text-xs text-blue-300">
                <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
