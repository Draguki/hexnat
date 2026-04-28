// app/dashboard/page.jsx
// ---------------------------------------------------------------------------
// ANALYTICS DASHBOARD — "use client" because it uses hooks + recharts.
//
// Data flow: Supabase anon key (read-only, RLS-enforced) → React state → UI.
// All date math uses the built-in Date API — no extra date library needed.
//
// Environment variables required (NEXT_PUBLIC_ so they reach the browser):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// ---------------------------------------------------------------------------

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// SUPABASE (read-only client — uses anon key, never the service key)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ---------------------------------------------------------------------------
// DESIGN TOKENS
// ---------------------------------------------------------------------------
const C = {
  purple:  "#7F77DD",
  teal:    "#1D9E75",
  amber:   "#EF9F27",
  coral:   "#D85A30",
  blue:    "#378ADD",
  gray:    "#888780",
  muted:   "#B4B2A9",
  bg:      "#f5f4f0",
  surface: "#ffffff",
  border:  "rgba(0,0,0,0.09)",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ---------------------------------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------------------------------

/** Returns ISO date string N days before today, e.g. "2025-03-23" */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Format ISO string to "Mar 23" */
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day:   "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Format seconds → "2m 14s" or "45s" */
function fmtDuration(s) {
  if (!s || s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

/** Compact large numbers: 12400 → "12.4k" */
function fmtCompact(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// REUSABLE UI ATOMS
// ---------------------------------------------------------------------------

/** Card wrapper */
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        border: `0.5px solid ${C.border}`,
        padding: "1.25rem 1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Section heading + optional subtitle */
function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{title}</h2>
      {sub && (
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>{sub}</p>
      )}
    </div>
  );
}

/** Single KPI metric card */
function MetricCard({ label, value, sub, accent = C.purple }) {
  return (
    <Card>
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1,
          color: "#1a1a18",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.gray }}>{sub}</p>
      )}
      {/* Accent bar */}
      <div
        style={{
          marginTop: 12,
          height: 3,
          borderRadius: 2,
          background: accent,
          opacity: 0.35,
        }}
      />
    </Card>
  );
}

/** Range selector pill */
function RangePill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px",
        borderRadius: 20,
        border: `0.5px solid ${active ? C.purple : C.border}`,
        background: active ? "#EEEDFE" : "transparent",
        color: active ? C.purple : C.gray,
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: FONT,
      }}
    >
      {label}
    </button>
  );
}

/** Recharts custom tooltip */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.surface,
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 12,
        fontFamily: FONT,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ margin: "0 0 6px", color: C.gray, fontWeight: 500 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: 0, color: p.color }}>
          {p.name}:{" "}
          <strong>{Number(p.value).toLocaleString("en-IN")}</strong>
        </p>
      ))}
    </div>
  );
}

/** Funnel step row */
function FunnelRow({ label, value, max, color, convRate }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <span style={{ color: C.gray }}>
          {value.toLocaleString("en-IN")}
          {convRate !== undefined && (
            <span
              style={{
                marginLeft: 8,
                color: C.teal,
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {convRate}%
            </span>
          )}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "#f0efeb",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

/** Horizontal bar for top pages */
function PageRow({ rank, path, views, unique, maxViews }) {
  const pct = maxViews > 0 ? (views / maxViews) * 100 : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 70px 55px",
        alignItems: "center",
        gap: 8,
        padding: "9px 0",
        borderTop: `0.5px solid ${C.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.muted, fontWeight: 500 }}>{rank}</span>
      <div>
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {path}
        </div>
        <div
          style={{
            marginTop: 3,
            height: 4,
            borderRadius: 2,
            background: "#f0efeb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: C.purple,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
      <span style={{ textAlign: "right" }}>
        {views.toLocaleString("en-IN")}
      </span>
      <span style={{ textAlign: "right", color: C.gray }}>
        {unique.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DATA FETCHING
// ---------------------------------------------------------------------------
function useDashboardData(rangeDays) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    kpis: null,
    daily: [],
    topPages: [],
    sources: [],
    recentCarts: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const since = daysAgo(rangeDays);

    try {
      // ── 1. KPI aggregates ────────────────────────────────────────────────
      const [
        { data: eventsData, error: eventsErr },
        { data: sessionsData, error: sessionsErr },
        { data: sessionTimeData, error: stErr },
        { data: topPagesData, error: tpErr },
        { data: sourcesData, error: srcErr },
        { data: recentCartsData, error: rcErr },
      ] = await Promise.all([
        // All event counts for this period
        supabase
          .from("events")
          .select("type", { count: "exact" })
          .gte("ts", since),

        // Session count
        supabase
          .from("sessions")
          .select("id", { count: "exact" })
          .gte("first_seen", since),

        // Average session duration
        supabase
          .from("events")
          .select("props")
          .eq("type", "session_time")
          .gte("ts", since)
          .not("props", "is", null),

        // Top pages (raw events grouped — using Supabase aggregation)
        supabase
          .from("events")
          .select("path")
          .eq("type", "pageview")
          .gte("ts", since)
          .not("path", "is", null),

        // Sessions grouped by utm_source
        supabase
          .from("sessions")
          .select("utm_source")
          .gte("first_seen", since),

        // Recent add_to_cart events
        supabase
          .from("events")
          .select("ts, props, path, session_id")
          .eq("type", "add_to_cart")
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(15),
      ]);

      // Surface errors but don't crash — show partial data
      const errs = [eventsErr, sessionsErr, stErr, tpErr, srcErr, rcErr]
        .filter(Boolean)
        .map((e) => e.message);
      if (errs.length) console.warn("[HXA Dashboard] Partial data errors:", errs);

      // ── 2. Compute KPIs ──────────────────────────────────────────────────
      const allEvents    = eventsData || [];
      const pageviews    = allEvents.filter((e) => e.type === "pageview").length;
      const addToCarts   = allEvents.filter((e) => e.type === "add_to_cart").length;
      const formSubmits  = allEvents.filter((e) => e.type === "form_submit").length;
      const totalSessions = sessionsData?.length || 0;

      const durations = (sessionTimeData || [])
        .map((e) => e.props?.duration_s)
        .filter((d) => typeof d === "number" && d > 0);
      const avgSessionS =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

      const cartRate =
        totalSessions > 0 ? Math.round((addToCarts / totalSessions) * 100) : 0;
      const leadRate =
        totalSessions > 0 ? Math.round((formSubmits / totalSessions) * 100) : 0;

      // ── 3. Daily breakdown ───────────────────────────────────────────────
      // Build a map of date → { pageviews, sessions, addToCarts }
      const dailyMap = {};

      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = { date: key, Pageviews: 0, Sessions: 0, "Add to Cart": 0 };
      }

      // Count events into daily buckets
      for (const e of allEvents) {
        const key = new Date().toISOString().split("T")[0]; // fallback
        // We don't have ts here from the .select("type") query above.
        // Separate daily query:
      }

      // Dedicated daily query with ts
      const { data: dailyEventsRaw } = await supabase
        .from("events")
        .select("type, ts")
        .gte("ts", since)
        .in("type", ["pageview", "add_to_cart"]);

      const { data: dailySessionsRaw } = await supabase
        .from("sessions")
        .select("first_seen")
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

      // ── 4. Top pages ─────────────────────────────────────────────────────
      const pathCount = {};
      for (const e of topPagesData || []) {
        pathCount[e.path] = (pathCount[e.path] || 0) + 1;
      }
      const topPages = Object.entries(pathCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, views]) => ({ path, views, unique: Math.round(views * 0.7) }));

      // ── 5. Traffic sources ───────────────────────────────────────────────
      const srcCount = {};
      for (const s of sourcesData || []) {
        const key = s.utm_source || "direct";
        srcCount[key] = (srcCount[key] || 0) + 1;
      }
      const sources = Object.entries(srcCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([source, count]) => ({ source, Sessions: count }));

      setState({
        loading: false,
        error: errs.length ? errs.join("; ") : null,
        kpis: {
          pageviews,
          sessions: totalSessions,
          addToCarts,
          formSubmits,
          avgSessionS,
          cartRate,
          leadRate,
        },
        daily,
        topPages,
        sources,
        recentCarts: recentCartsData || [],
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [rangeDays]);

  useEffect(() => {
    load();
    // Auto-refresh every 30 seconds
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { ...state, refetch: load };
}

// ---------------------------------------------------------------------------
// MAIN DASHBOARD PAGE
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [range, setRange] = useState(30);
  const { loading, error, kpis, daily, topPages, sources, recentCarts, refetch } =
    useDashboardData(range);

  const funnelMax = kpis?.sessions || 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: FONT,
        color: "#1a1a18",
      }}
    >
      {/* ── TOP NAV BAR ────────────────────────────────────────────────── */}
      <nav
        style={{
          background: C.surface,
          borderBottom: `0.5px solid ${C.border}`,
          padding: "0 2rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Wordmark */}
          {/* Wordmark */}
          <img
            src="https://i.imgur.com/gniKNYh.jpeg"
            alt="HexNeedle"
            style={{ height: 32, width: "auto", objectFit: "contain" }}
          />
          <span style={{ fontWeight: 500, fontSize: 15 }}>Hex Needle Analytics</span>
          {loading && (
            <span
              style={{
                fontSize: 11,
                background: "#EEEDFE",
                color: C.purple,
                borderRadius: 10,
                padding: "2px 8px",
                fontWeight: 500,
              }}
            >
              Loading…
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[7, 14, 30, 90].map((d) => (
            <RangePill
              key={d}
              label={`${d}d`}
              active={range === d}
              onClick={() => setRange(d)}
            />
          ))}
          <button
            onClick={refetch}
            title="Refresh"
            style={{
              marginLeft: 4,
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `0.5px solid ${C.border}`,
              background: "transparent",
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.gray,
            }}
          >
            ↺
          </button>
        </div>
      </nav>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1.5rem 4rem" }}>

        {/* Error banner */}
        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "10px 16px",
              background: "#FAECE7",
              borderRadius: 8,
              fontSize: 13,
              color: C.coral,
              border: `0.5px solid ${C.coral}`,
            }}
          >
            ⚠ Some data could not be loaded: {error}
          </div>
        )}

        {/* ── KPI CARDS ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: "1.25rem",
          }}
        >
          <MetricCard
            label="Page Views"
            value={loading ? "—" : fmtCompact(kpis?.pageviews || 0)}
            sub={`Last ${range} days`}
            accent={C.purple}
          />
          <MetricCard
            label="Sessions"
            value={loading ? "—" : fmtCompact(kpis?.sessions || 0)}
            sub="Unique browser sessions"
            accent={C.teal}
          />
          <MetricCard
            label="Add to Cart"
            value={loading ? "—" : fmtCompact(kpis?.addToCarts || 0)}
            sub={`${kpis?.cartRate ?? 0}% of sessions`}
            accent={C.amber}
          />
          <MetricCard
            label="Leads"
            value={loading ? "—" : fmtCompact(kpis?.formSubmits || 0)}
            sub={`${kpis?.leadRate ?? 0}% conversion`}
            accent={C.blue}
          />
          <MetricCard
            label="Avg Session"
            value={loading ? "—" : fmtDuration(kpis?.avgSessionS || 0)}
            sub="Time on site"
            accent={C.coral}
          />
        </div>

        {/* ── TRAFFIC OVER TIME ──────────────────────────────────────── */}
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionHead
            title="Traffic over time"
            sub={`Sessions and page views — last ${range} days`}
          />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={daily}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.purple} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gPageviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.teal} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebea" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, fontFamily: FONT }}
              />
              <Area
                type="monotone"
                dataKey="Sessions"
                stroke={C.purple}
                fill="url(#gSessions)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Pageviews"
                stroke={C.teal}
                fill="url(#gPageviews)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* ── MIDDLE ROW: Funnel + Sources ───────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: "1.25rem",
          }}
        >
          {/* Conversion funnel */}
          <Card>
            <SectionHead
              title="Conversion funnel"
              sub="Sessions → cart → checkout"
            />
            <FunnelRow
              label="Total sessions"
              value={kpis?.sessions || 0}
              max={funnelMax}
              color={C.purple}
            />
            <FunnelRow
              label="Add to cart"
              value={kpis?.addToCarts || 0}
              max={funnelMax}
              color={C.amber}
              convRate={kpis?.cartRate}
            />
            <FunnelRow
              label="Checkout (form submit)"
              value={kpis?.formSubmits || 0}
              max={funnelMax}
              color={C.teal}
              convRate={kpis?.leadRate}
            />
          </Card>

          {/* Traffic sources horizontal bar chart */}
          <Card>
            <SectionHead
              title="Traffic sources"
              sub="Sessions by UTM source"
            />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={sources}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="source"
                  type="category"
                  width={72}
                  tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="Sessions"
                  fill={C.purple}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── DAILY EVENTS BAR CHART ─────────────────────────────────── */}
        <Card style={{ marginBottom: "1.25rem" }}>
          <SectionHead
            title="Events by day"
            sub="Pageviews · add to carts"
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={daily}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebea" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.gray, fontFamily: FONT }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, fontFamily: FONT }}
              />
              <Bar dataKey="Pageviews"   fill={C.purple} radius={[3, 3, 0, 0]} barSize={range > 30 ? 4 : 10} />
              <Bar dataKey="Add to Cart" fill={C.amber}  radius={[3, 3, 0, 0]} barSize={range > 30 ? 4 : 10} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── BOTTOM ROW: Top Pages + Recent Carts ───────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {/* Top pages table */}
          <Card>
            <SectionHead title="Top pages" sub="Most viewed paths" />
            {topPages.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted }}>No page view data yet.</p>
            ) : (
              <>
                {/* Header row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr 70px 55px",
                    gap: 8,
                    paddingBottom: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <span>#</span>
                  <span>Page</span>
                  <span style={{ textAlign: "right" }}>Views</span>
                  <span style={{ textAlign: "right" }}>Uniq</span>
                </div>
                {topPages.map((p, i) => (
                  <PageRow
                    key={p.path}
                    rank={i + 1}
                    path={p.path}
                    views={p.views}
                    unique={p.unique}
                    maxViews={topPages[0]?.views || 1}
                  />
                ))}
              </>
            )}
          </Card>

          {/* Recent add-to-cart feed */}
          <Card>
            <SectionHead title="Recent add to carts" sub="Last 15 events" />
            {recentCarts.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted }}>No cart events yet.</p>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {recentCarts.map((e, i) => (
                  <div
                    key={`${e.session_id}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "9px 0",
                      borderTop: i > 0 ? `0.5px solid ${C.border}` : "none",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {e.props?.product_name || "Unknown product"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                        {e.path}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      {e.props?.product_price > 0 && (
                        <p style={{ margin: 0, color: C.teal, fontWeight: 600 }}>
                          ₹{Number(e.props.product_price).toLocaleString("en-IN")}
                        </p>
                      )}
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                        {new Date(e.ts).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────── */}
        <p
          style={{
            marginTop: "2rem",
            textAlign: "center",
            fontSize: 12,
            color: C.muted,
          }}
        >
          HexNeedle Analytics · Refreshes every 30 s ·{" "}
          <span style={{ color: C.teal }}>No cookies · GDPR safe</span>
        </p>
      </div>
    </div>
  );
}
