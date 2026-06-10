"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  ExternalLink,
  Search,
  RefreshCw,
  ShieldCheck,
  Eye
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
    const { data, error } = await supabase
      .from("capi_events_sent")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) console.error("Error fetching CAPI events:", error);
    else setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("capi-logs")
      .on("postgres_changes", { event: "INSERT", table: "capi_events_sent" }, (payload) => {
        setEvents((prev) => [payload.new, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredEvents = events.filter(e => 
    e.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.event_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="text-blue-500 w-8 h-8" />
              Meta CAPI Events Log
            </h1>
            <p className="text-gray-400 mt-1">Real-time audit trail of all server-side events sent to Meta Conversion API.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search events..." 
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

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">Total Events (Last 100)</div>
            <div className="text-2xl font-bold">{events.length}</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
            <div className="text-green-500 text-sm mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Successful
            </div>
            <div className="text-2xl font-bold">{events.filter(e => e.http_status === 200).length}</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
            <div className="text-red-500 text-sm mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Failed
            </div>
            <div className="text-2xl font-bold">{events.filter(e => e.http_status !== 200).length}</div>
          </div>
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl">
            <div className="text-blue-500 text-sm mb-1 flex items-center gap-1">
              <Database className="w-3 h-3" /> PII Match Rate
            </div>
            <div className="text-2xl font-bold">
              {events.length > 0 
                ? Math.round((events.filter(e => e.customer_email_hash || e.customer_phone_hash).length / events.length) * 100) 
                : 0}%
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a] border-b border-[#222]">
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Timestamp</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Event Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Event ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      Loading events...
                    </div>
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No events found matching your search.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-[#151515] transition-colors group">
                    <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                        {event.event_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">
                      {event.event_id.slice(0, 20)}...
                    </td>
                    <td className="px-6 py-4">
                      {event.http_status === 200 ? (
                        <div className="flex items-center gap-1.5 text-green-500 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>200 OK</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-500 text-sm">
                          <XCircle className="w-4 h-4" />
                          <span>{event.http_status || 'Error'}</span>
                        </div>
                      )}
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
          <div className="bg-[#111] border border-[#333] w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#333] flex items-center justify-between bg-[#1a1a1a]">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Event Details: {selectedEvent.event_name}
              </h2>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
                  <div className="text-gray-500 text-xs uppercase mb-1">Event ID</div>
                  <div className="font-mono text-sm">{selectedEvent.event_id}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
                  <div className="text-gray-500 text-xs uppercase mb-1">HTTP Status</div>
                  <div className="font-mono text-sm">{selectedEvent.http_status}</div>
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm font-semibold mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Payload Sent to Meta
                </div>
                <pre className="bg-[#0a0a0a] p-4 rounded-xl border border-[#222] text-xs font-mono text-blue-300 overflow-x-auto">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-gray-400 text-sm font-semibold mb-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Meta API Response
                </div>
                <pre className="bg-[#0a0a0a] p-4 rounded-xl border border-[#222] text-xs font-mono text-green-300 overflow-x-auto">
                  {JSON.stringify(selectedEvent.meta_response, null, 2)}
                </pre>
              </div>

              {selectedEvent.error_msg && (
                <div>
                  <div className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Error Message
                  </div>
                  <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-xs text-red-300">
                    {selectedEvent.error_msg}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
