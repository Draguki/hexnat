// app/dashboard/live-carts-widget.jsx (V3.1)
// ─────────────────────────────────────────────────────────────────────────
// Live Add-to-Carts Widget
// Shows real-time cart contents with full specifications
// ─────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const C = {
  purple: "#7F77DD",
  teal: "#1D9E75",
  amber: "#EF9F27",
  gray: "#888780",
  muted: "#B4B2A9",
  border: "rgba(0,0,0,0.09)",
  surface: "#ffffff",
};

export default function LiveCartsWidget() {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCarts = async () => {
      try {
        const { data, error } = await supabase
          .from("active_carts")
          .select("*")
          .order("last_updated", { ascending: false })
          .limit(10);

        if (!error && data) {
          setCarts(data);
        }
      } catch (err) {
        console.error("Error loading carts:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCarts();
    const interval = setInterval(loadCarts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        border: `0.5px solid ${C.border}`,
        padding: "1.25rem 1.5rem",
        animation: "fadeInUp 0.4s ease",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Live Add-to-Carts</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>
          Real-time cart contents with specifications
        </p>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: C.muted }}>Loading...</p>
      ) : carts.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted }}>No active carts yet.</p>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {carts.map((cart, idx) => (
            <div
              key={cart.id}
              style={{
                padding: "12px 0",
                borderTop: idx > 0 ? `0.5px solid ${C.border}` : "none",
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#1a1a18" }}>
                    {cart.total_items} item{cart.total_items !== 1 ? "s" : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    Session: {cart.session_id?.slice(0, 8)}...
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: C.teal, fontWeight: 600 }}>
                    ₹{Number(cart.total_revenue).toLocaleString("en-IN")}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    {new Date(cart.last_updated).toLocaleDateString("en-IN", { month: 'short', day: 'numeric' })} {new Date(cart.last_updated).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Items in cart */}
              {cart.items && cart.items.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${C.border}` }}>
                  {cart.items.map((item, i) => (
                    <div key={i} style={{ fontSize: 11, marginBottom: 6, color: C.gray }}>
                      <strong>{item.name}</strong>
                      {item.specifications && Object.keys(item.specifications).length > 0 && (
                        <div style={{ marginTop: 2, paddingLeft: 8, borderLeft: `2px solid ${C.amber}` }}>
                          {Object.entries(item.specifications).map(([key, val]) => (
                            <div key={key} style={{ fontSize: 10, color: C.muted }}>
                              {key}: <strong>{val}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 2, color: C.teal, fontWeight: 600 }}>
                        ₹{Number(item.price).toLocaleString("en-IN")} × {item.qty || 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* UTM Attribution */}
              {cart.utm_source && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${C.border}`, fontSize: 10, color: C.muted }}>
                  <strong>Source:</strong> {cart.utm_source} | {cart.utm_medium} | {cart.utm_campaign}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
