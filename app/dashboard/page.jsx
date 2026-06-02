// app/dashboard/page.jsx (V3 Enhanced)
// ─────────────────────────────────────────────────────────────────────────
// HexNeedle Analytics Dashboard v3.0
// Features: Customers page, timeline, custom date range, CAPI testing,
//           mobile responsive, smooth animations
// ─────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────
const C = {
  purple:  "#7F77DD", teal: "#1D9E75", amber: "#EF9F27",
  coral:   "#D85A30",  blue: "#378ADD", gray: "#888780",
  muted:   "#B4B2A9",  bg: "#f5f4f0",  surface: "#ffffff",
  border:  "rgba(0,0,0,0.09)",
  success: "#22c55e", error: "#ef4444",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ─────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short", day: "numeric", timeZone: "Asia/Kolkata",
  });
}

function fmtDuration(s) {
  if (!s || s <= 0) return "0s";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function fmtCompact(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

// ─────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 12,
      border: `0.5px solid ${C.border}`,
      padding: "1.25rem 1.5rem",
      animation: "fadeInUp 0.4s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{title}</h2>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>{sub}</p>}
    </div>
  );
}

function MetricCard({ label, value, sub, accent = C.purple }) {
  return (
    <Card>
      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.06em", color: C.muted, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 600, lineHeight: 1, color: "#1a1a18" }}>
        {value}
      </p>
      {sub && <p style={{ margin: "6px 0 0", fontSize: 12, color: C.gray }}>{sub}</p>}
      <div style={{ marginTop: 12, height: 3, borderRadius: 2, background: accent, opacity: 0.35 }} />
    </Card>
  );
}

function RangePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 20,
      border: `0.5px solid ${active ? C.purple : C.border}`,
      background: active ? "#EEEDFE" : "transparent",
      color: active ? C.purple : C.gray,
      fontSize: 13, fontWeight: active ? 500 : 400,
      cursor: "pointer", transition: "all 0.15s", fontFamily: FONT,
    }}>
      {label}
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface, border: `0.5px solid ${C.border}`,
      borderRadius: 8, padding: "8px 14px", fontSize: 12,
      fontFamily: FONT, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    }}>
      <p style={{ margin: "0 0 6px", color: C.gray, fontWeight: 500 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: 0, color: p.color }}>
          {p.name}: <strong>{Number(p.value).toLocaleString("en-IN")}</strong>
        </p>
      ))}
    </div>
  );
}

function FunnelRow({ label, value, max, color, convRate }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
        <span>{label}</span>
        <span style={{ color: C.gray }}>
          {value.toLocaleString("en-IN")}
          {convRate !== undefined && (
            <span style={{ marginLeft: 8, color: C.teal, fontWeight: 600, fontSize: 11 }}>
              {convRate}%
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 8, background: "#f0efeb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color,
          borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DATE RANGE PICKER
// ─────────────────────────────────────────────────────────────────────────
function DateRangePicker({ onApply, onCancel }) {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = () => {
    onApply(new Date(startDate).toISOString(), new Date(endDate).toISOString());
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <Card style={{ maxWidth: 400 }}>
        <SectionHead title="Custom date range" />
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>
              Start date
            </label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: "100%", padding: "8px", borderRadius: 6,
                border: `0.5px solid ${C.border}`, fontSize: 13, fontFamily: FONT,
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>
              End date
            </label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: "100%", padding: "8px", borderRadius: 6,
                border: `0.5px solid ${C.border}`, fontSize: 13, fontFamily: FONT,
              }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px", borderRadius: 6, border: `0.5px solid ${C.border}`,
            background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>
            Cancel
          </button>
          <button onClick={handleApply} style={{
            flex: 1, padding: "10px", borderRadius: 6, border: "none",
            background: C.purple, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>
            Apply
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMERS PAGE
// ─────────────────────────────────────────────────────────────────────────
function CustomersPage({ onSelectCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("last_visit", { ascending: false })
        .limit(100);

      if (!error && data) {
        setCustomers(data);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = customers.filter((c) =>
    (c.email?.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone?.includes(search)) ||
    (c.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <SectionHead title="Customers" sub={`${filtered.length} total · Latest first`} />
      
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by email, phone, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: `0.5px solid ${C.border}`, fontSize: 13, fontFamily: FONT,
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: C.muted }}>Loading customers...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: C.muted }}>No customers found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>Email</th>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>Phone</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: C.muted }}>Orders</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: C.muted }}>Revenue</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: C.muted }}>LTV</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelectCustomer(c.id)}
                  style={{
                    borderBottom: `0.5px solid ${C.border}`,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "8px" }}>{c.email || "—"}</td>
                  <td style={{ padding: "8px" }}>{c.name || "—"}</td>
                  <td style={{ padding: "8px" }}>{c.phone || "—"}</td>
                  <td style={{ textAlign: "right", padding: "8px" }}>{c.orders_count || 0}</td>
                  <td style={{ textAlign: "right", padding: "8px", color: C.teal, fontWeight: 600 }}>
                    ₹{(c.total_revenue || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ textAlign: "right", padding: "8px", color: C.purple, fontWeight: 600 }}>
                    ₹{(c.lifetime_value || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER TIMELINE
// ─────────────────────────────────────────────────────────────────────────
function CustomerTimeline({ customerId, onBack }) {
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [customerRes, timelineRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase
          .from("customer_timeline")
          .select("*")
          .eq("customer_id", customerId)
          .order("ts", { ascending: false })
          .limit(50),
      ]);

      if (customerRes.data) setCustomer(customerRes.data);
      if (timelineRes.data) setTimeline(timelineRes.data);
      setLoading(false);
    };
    load();
  }, [customerId]);

  if (loading) return <p style={{ color: C.muted }}>Loading...</p>;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          padding: "5px 14px", borderRadius: 6, border: `0.5px solid ${C.border}`,
          background: "transparent", cursor: "pointer", fontSize: 13, marginBottom: 16,
        }}
      >
        ← Back to Customers
      </button>

      {customer && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600 }}>Email</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{customer.email || "—"}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600 }}>Name</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{customer.name || "—"}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600 }}>Orders</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: C.teal }}>
                {customer.orders_count || 0}
              </p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600 }}>LTV</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: C.purple }}>
                ₹{(customer.lifetime_value || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <SectionHead title="Customer Journey" sub="Chronological event timeline" />
      <Card>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {timeline.length === 0 ? (
            <p style={{ color: C.muted }}>No events recorded.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: 20 }}>
              {timeline.map((event, i) => (
                <div key={`${event.id}`} style={{ marginBottom: 16, paddingLeft: 20 }}>
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: C.purple,
                      border: `3px solid ${C.surface}`,
                      top: 4,
                    }}
                  />
                  
                  {/* Event content */}
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: "#1a1a18", marginBottom: 2 }}>
                      {event.event_label}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                      {fmtTime(event.ts)} · {event.path || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CAPI TESTING PAGE
// ─────────────────────────────────────────────────────────────────────────
function CAPITestingPage() {
  const [capiEvents, setCapiEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const copyRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("capi_events_sent")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(20);

      if (data) setCapiEvents(data);
      setLoading(false);
    };
    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    if (copyRef.current) {
      const orig = copyRef.current.textContent;
      copyRef.current.textContent = "Copied!";
      setTimeout(() => {
        copyRef.current.textContent = orig;
      }, 2000);
    }
  };

  return (
    <div>
      <SectionHead title="Meta CAPI Testing" sub="Debug and monitor Conversions API calls" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        <MetricCard label="Total sent" value={fmtCompact(capiEvents.length)} accent={C.purple} />
        <MetricCard label="Success rate"
          value={`${Math.round((capiEvents.filter((e) => e.http_status === 200).length / (capiEvents.length || 1)) * 100)}%`}
          accent={C.success} />
        <MetricCard label="Errors"
          value={capiEvents.filter((e) => e.http_status !== 200).length}
          accent={C.error} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <SectionHead title="Recent CAPI calls" />
        {loading ? (
          <p style={{ color: C.muted }}>Loading...</p>
        ) : capiEvents.length === 0 ? (
          <p style={{ color: C.muted }}>No CAPI calls yet.</p>
        ) : (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {capiEvents.map((e) => (
              <div
                key={e.id}
                onClick={() => setSelectedEvent(e)}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  marginBottom: 8,
                  background: e.http_status === 200 ? "#f0fdf4" : "#fef2f2",
                  border: `0.5px solid ${e.http_status === 200 ? C.success : C.error}`,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  fontSize: 13,
                }}
                onMouseEnter={(el) => el.currentTarget.style.opacity = "0.8"}
                onMouseLeave={(el) => el.currentTarget.style.opacity = "1"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{e.event_name}</span>
                  <span style={{ fontSize: 11, color: e.http_status === 200 ? C.success : C.error }}>
                    {e.http_status === 200 ? "✓ Success" : `✗ ${e.http_status}`}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {fmtTime(e.sent_at)} · {e.event_id?.slice(0, 16)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedEvent && (
        <Card>
          <SectionHead title="Event details" />
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: C.muted }}>Curl command:</p>
            <pre
              style={{
                background: C.bg,
                padding: 12,
                borderRadius: 6,
                fontSize: 11,
                overflow: "auto",
                marginBottom: 8,
              }}
            >
{`curl -X POST https://graph.facebook.com/v20.0/4415595052018024/events \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(selectedEvent.payload, null, 2)}'`}
            </pre>
            <button
              ref={copyRef}
              onClick={() =>
                copyToClipboard(
                  `curl -X POST https://graph.facebook.com/v20.0/4415595052018024/events -H "Content-Type: application/json" -d '${JSON.stringify(
                    selectedEvent.payload
                  )}'`
                )
              }
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `0.5px solid ${C.border}`,
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Copy curl
            </button>
          </div>

          {selectedEvent.error_msg && (
            <div style={{ padding: 12, background: "#fef2f2", borderRadius: 6, borderLeft: `3px solid ${C.error}` }}>
              <p style={{ margin: 0, fontSize: 12, color: C.error, fontWeight: 600, marginBottom: 4 }}>
                Error:
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.error, whiteSpace: "pre-wrap" }}>
                {selectedEvent.error_msg}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [currentPage, setCurrentPage] = useState("overview");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [range, setRange] = useState(30);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customRange, setCustomRange] = useState(null);

  const renderPage = () => {
    if (currentPage === "customers") {
      return selectedCustomerId ? (
        <CustomerTimeline
          customerId={selectedCustomerId}
          onBack={() => setSelectedCustomerId(null)}
        />
      ) : (
        <CustomersPage onSelectCustomer={setSelectedCustomerId} />
      );
    }

    if (currentPage === "capi") {
      return <CAPITestingPage />;
    }

    return null; // Overview page (placeholder)
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT, color: "#1a1a18" }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        button { font-family: ${FONT}; }
      `}</style>

      {/* NAV */}
      <nav style={{
        background: C.surface, borderBottom: `0.5px solid ${C.border}`,
        padding: "0 1.5rem", height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="https://i.imgur.com/ervX8Sj.png"
              alt="HexNeedle"
              style={{ height: 32, width: "auto", objectFit: "contain" }}
            />
            <span style={{ fontWeight: 500, fontSize: 15 }}>HexNeedle v3</span>
          </div>
          <div style={{ display: "flex", gap: 8, borderLeft: `0.5px solid ${C.border}`, paddingLeft: 16 }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "customers", label: "Customers" },
              { id: "capi", label: "CAPI Testing" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentPage(tab.id)}
                style={{
                  padding: "4px 12px", borderRadius: 6,
                  border: "none", background: "transparent",
                  color: currentPage === tab.id ? C.purple : C.gray,
                  fontSize: 13, fontWeight: currentPage === tab.id ? 600 : 400,
                  cursor: "pointer", transition: "color 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[7, 14, 30, 90].map((d) => (
            <RangePill key={d} label={`${d}d`} active={range === d} onClick={() => setRange(d)} />
          ))}
          <button
            onClick={() => setShowDatePicker(true)}
            style={{
              padding: "5px 14px", borderRadius: 20, border: `0.5px solid ${C.border}`,
              background: "transparent", color: C.gray, fontSize: 13,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            Custom
          </button>
        </div>
      </nav>

      {/* BODY */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem 1.5rem 4rem" }}>
        {renderPage()}
      </div>

      {/* DATE PICKER MODAL */}
      {showDatePicker && (
        <DateRangePicker
          onApply={(start, end) => {
            setCustomRange({ start, end });
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
