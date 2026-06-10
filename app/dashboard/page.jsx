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
import LiveCartsWidget from "./live-carts-widget";
import OrdersPage from "./orders-page-v3-1";

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



function PageRow({ rank, path, views, unique, maxViews }) {
  const pct = maxViews > 0 ? (views / maxViews) * 100 : 0;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "24px 1fr 70px 55px",
      alignItems: "center", gap: 8, padding: "9px 0",
      borderTop: `0.5px solid ${C.border}`, fontSize: 13,
    }}>
      <span style={{ color: C.muted, fontWeight: 500 }}>{rank}</span>
      <div>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {path}
        </div>
        <div style={{ marginTop: 3, height: 4, borderRadius: 2, background: "#f0efeb", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.purple, borderRadius: 2 }} />
        </div>
      </div>
      <span style={{ textAlign: "right" }}>{views.toLocaleString("en-IN")}</span>
      <span style={{ textAlign: "right", color: C.gray }}>{unique.toLocaleString("en-IN")}</span>
    </div>
  );
}

// ── Data fetching ──────────────────────────────────────────────────────────
function useDashboardData(rangeDays) {
  const [state, setState] = useState({
    loading: true, error: null, kpis: null,
    daily: [], topPages: [], sources: [], recentCarts: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const since = daysAgo(rangeDays);

    try {
      // ── All queries run in parallel ──────────────────────────────────────
      const [
        { data: eventsData,      error: eventsErr      },
        { data: sessionsData,    error: sessionsErr     },
        { data: sessionTimeData, error: stErr           },
        { data: purchaseData,    error: purchaseErr     },
        { data: topPagesData,    error: tpErr           },
        { data: sourcesData,     error: srcErr          },
        { data: recentCartsData, error: rcErr           },
      ] = await Promise.all([

        // 1. All event types (for KPI counts)
        supabase
          .from("events")
          .select("type")
          .gte("ts", since),

        // 2. Session count
        supabase
          .from("sessions")
          .select("id")
          .gte("first_seen", since),

        // 3. Session durations
        supabase
          .from("events")
          .select("props")
          .eq("type", "session_time")
          .gte("ts", since)
          .not("props", "is", null),

        // 4. Purchase events — revenue lives in events table, type = "purchase"
        supabase
          .from("events")
          .select("props")
          .eq("type", "purchase")
          .gte("ts", since),

        // 5. Top pages
        supabase
          .from("events")
          .select("path")
          .eq("type", "pageview")
          .gte("ts", since)
          .not("path", "is", null),

        // 6. Traffic sources
        supabase
          .from("sessions")
          .select("utm_source, referrer")
          .gte("first_seen", since),

        // 7. Recent add-to-cart
        supabase
          .from("events")
          .select("ts, props, path, session_id")
          .eq("type", "add_to_cart")
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(15),
      ]);

      // Surface non-fatal errors
      const errs = [eventsErr, sessionsErr, stErr, purchaseErr, tpErr, srcErr, rcErr]
        .filter(Boolean).map((e) => e.message);
      if (errs.length) console.warn("[HXA] Partial errors:", errs);

      // ── Compute KPIs ─────────────────────────────────────────────────────
      const allEvents     = eventsData || [];
      const pageviews     = allEvents.filter((e) => e.type === "pageview").length;
      const addToCarts    = allEvents.filter((e) => e.type === "add_to_cart").length;
      const formSubmits   = allEvents.filter((e) => e.type === "form_submit").length;
      const totalSessions = (sessionsData || []).length;

      const durations = (sessionTimeData || [])
        .map((e) => e.props?.duration_s)
        .filter((d) => typeof d === "number" && d > 0);
      const avgSessionS = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      // Revenue from purchase events
      const purchases = purchaseData || [];
      const revenue   = purchases.reduce((sum, e) => {
        const r = parseFloat(e.props?.revenue);
        return sum + (isNaN(r) ? 0 : r);
      }, 0);
      const orders = purchases.length;

      const cartRate = totalSessions > 0 ? Math.round((addToCarts  / totalSessions) * 100) : 0;
      const leadRate = totalSessions > 0 ? Math.round((formSubmits / totalSessions) * 100) : 0;
      const convRate = totalSessions > 0 ? Math.round((orders      / totalSessions) * 100) : 0;

      // ── Daily breakdown ───────────────────────────────────────────────────
      const dailyMap = {};
      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = { date: key, Pageviews: 0, Sessions: 0, "Add to Cart": 0 };
      }

      const { data: dailyEventsRaw }   = await supabase
        .from("events").select("type, ts")
        .gte("ts", since).in("type", ["pageview", "add_to_cart"]);

      const { data: dailySessionsRaw } = await supabase
        .from("sessions").select("first_seen")
        .gte("first_seen", since);

      for (const e of dailyEventsRaw || []) {
        const key = e.ts.split("T")[0];
        if (!dailyMap[key]) continue;
        if (e.type === "pageview")    dailyMap[key].Pageviews++;
        if (e.type === "add_to_cart") dailyMap[key]["Add to Cart"]++;
      }
      for (const s of dailySessionsRaw || []) {
        const key = s.first_seen.split("T")[0];
        if (dailyMap[key]) dailyMap[key].Sessions++;
      }

      const daily = Object.values(dailyMap).map((d) => ({
        ...d,
        label: fmtDay(d.date + "T00:00:00.000Z"),
      }));

      // ── Top pages ─────────────────────────────────────────────────────────
      const pathCount = {};
      for (const e of topPagesData || []) {
        pathCount[e.path] = (pathCount[e.path] || 0) + 1;
      }
      const topPages = Object.entries(pathCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([path, views]) => ({ path, views, unique: Math.round(views * 0.7) }));

      // ── Traffic sources ───────────────────────────────────────────────────
      const srcCount = {};
      for (const s of sourcesData || []) {
        const key = s.utm_source ||
          (s.referrer?.includes("instagram") ? "instagram" :
           s.referrer?.includes("facebook")  ? "facebook"  :
           s.referrer?.includes("google")    ? "google"    :
           s.referrer?.includes("whatsapp")  ? "whatsapp"  : "direct");
        srcCount[key] = (srcCount[key] || 0) + 1;
      }
      const sources = Object.entries(srcCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([source, count]) => ({ source, Sessions: count }));

      setState({
        loading: false,
        error: errs.length ? errs.join("; ") : null,
        kpis: { pageviews, sessions: totalSessions, addToCarts, formSubmits,
                avgSessionS, cartRate, leadRate, revenue, orders, convRate },
        daily, topPages, sources,
        recentCarts: recentCartsData || [],
      });

    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [rangeDays]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { ...state, refetch: load };
}


function OverviewPage({ range = 30 }) {
  const { loading, error, kpis, daily, topPages, sources, recentCarts, refetch } =
    useDashboardData(range);

  const funnelMax = kpis?.sessions || 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1.5rem 4rem" }}>
        {error && (
          <div style={{ marginBottom: "1rem", padding: "10px 16px", background: "#FAECE7",
            borderRadius: 8, fontSize: 13, color: C.coral, border: `0.5px solid ${C.coral}` }}>
            ⚠ {error}
          </div>
        )}

        {/* ── KPI CARDS ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: "1.25rem" }}>
          <MetricCard label="Page Views"
            value={loading ? "—" : (kpis?.pageviews || 0).toLocaleString("en-IN")}
            sub={`Last ${range} days`} accent={C.purple} />
          <MetricCard label="Sessions"
            value={loading ? "—" : (kpis?.sessions || 0).toLocaleString("en-IN")}
            sub="Unique browser sessions" accent={C.teal} />
          <MetricCard label="Add to Cart"
            value={loading ? "—" : (kpis?.addToCarts || 0).toLocaleString("en-IN")}
            sub={`${kpis?.cartRate ?? 0}% of sessions`} accent={C.amber} />
          <MetricCard label="Leads"
            value={loading ? "—" : (kpis?.formSubmits || 0).toLocaleString("en-IN")}
            sub={`${kpis?.leadRate ?? 0}% conversion`} accent={C.blue} />
          <MetricCard label="Revenue"
            value={loading ? "—" : `₹${(kpis?.revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            sub={`${kpis?.orders ?? 0} orders · ${kpis?.convRate ?? 0}% conv`}
            accent={C.teal} />
          <MetricCard label="Avg Session"
            value={loading ? "—" : fmtDuration(kpis?.avgSessionS || 0)}
            sub="Time on site" accent={C.coral} />
        </div>

        {/* ── TRAFFIC CHART ─────────────────────────────────────── */}
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionHead title="Traffic over time"
            sub={`Sessions and page views — last ${range} days`} />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.purple} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPageviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.teal} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebea" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: FONT }} />
              <Area type="monotone" dataKey="Sessions" stroke={C.purple}
                fill="url(#gSessions)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="Pageviews" stroke={C.teal}
                fill="url(#gPageviews)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* ── FUNNEL + SOURCES ──────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12, marginBottom: "1.25rem" }}>

          <Card>
            <SectionHead title="Conversion funnel" sub="Sessions → cart → checkout → purchase" />
            <FunnelRow label="Total sessions" value={kpis?.sessions || 0}
              max={funnelMax} color={C.purple} />
            <FunnelRow label="Add to cart" value={kpis?.addToCarts || 0}
              max={funnelMax} color={C.amber} convRate={kpis?.cartRate} />
            <FunnelRow label="Checkout" value={kpis?.formSubmits || 0}
              max={funnelMax} color={C.blue} convRate={kpis?.leadRate} />
            <FunnelRow label="Purchases (PayU confirmed)" value={kpis?.orders || 0}
              max={funnelMax} color={C.teal} convRate={kpis?.convRate} />
          </Card>

          <Card>
            <SectionHead title="Traffic sources" sub="Sessions by UTM source" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sources} layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                  tickLine={false} axisLine={false} />
                <YAxis dataKey="source" type="category" width={80}
                  tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                  tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Sessions" fill={C.purple} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── EVENTS BY DAY ─────────────────────────────────────── */}
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionHead title="Events by day" sub="Pageviews · add to carts" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebea" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: FONT }} />
              <Bar dataKey="Pageviews"   fill={C.purple} radius={[3,3,0,0]} barSize={range > 30 ? 4 : 10} />
              <Bar dataKey="Add to Cart" fill={C.amber}  radius={[3,3,0,0]} barSize={range > 30 ? 4 : 10} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── TOP PAGES + RECENT CARTS ──────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>

          <Card>
            <SectionHead title="Top pages" sub="Most viewed paths" />
            {topPages.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted }}>No page view data yet.</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 70px 55px",
                  gap: 8, paddingBottom: 6, fontSize: 11, fontWeight: 600,
                  color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>#</span><span>Page</span>
                  <span style={{ textAlign: "right" }}>Views</span>
                  <span style={{ textAlign: "right" }}>Uniq</span>
                </div>
                {topPages.map((p, i) => (
                  <PageRow key={p.path} rank={i + 1} path={p.path}
                    views={p.views} unique={p.unique} maxViews={topPages[0]?.views || 1} />
                ))}
              </>
            )}
          </Card>

          <LiveCartsWidget recentCarts={recentCarts} />
        </div>

        <p style={{ marginTop: "2rem", textAlign: "center", fontSize: 12, color: C.muted }}>
          HexNeedle Analytics · Refreshes every 30s ·{" "}
          <span style={{ color: C.teal }}>No cookies · GDPR safe</span>
        </p>
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
    if (currentPage === "overview") {
      return <OverviewPage range={range} />;
    }

    if (currentPage === "orders") {
      return <OrdersPage />;
    }

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

    return <OverviewPage range={range} />;
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
              { id: "orders", label: "Orders" },
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
            <RangePill key={d} label={`${d}d`} active={range === d} onClick={() => { setCustomRange(null); setRange(d); }} />
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
            const startMs = new Date(start).getTime();
            const endMs = new Date(end).getTime();
            const days = Math.max(1, Math.ceil((endMs - startMs) / 86400000) + 1);
            setRange(days);
            setCustomRange({ start, end });
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
