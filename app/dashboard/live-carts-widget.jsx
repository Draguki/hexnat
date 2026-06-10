
// app/dashboard/live-carts-widget.jsx (V3.2 Optimized)
// ─────────────────────────────────────────────────────────────────────────
// Live Add-to-Carts Widget
// Shows real-time cart contents with full specifications
// ─────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";

const C = {
  purple: "#7F77DD",
  teal: "#1D9E75",
  amber: "#EF9F27",
  gray: "#888780",
  muted: "#B4B2A9",
  border: "rgba(0,0,0,0.09)",
  surface: "#ffffff",
};

export default function LiveCartsWidget({ recentCarts }) {
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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Recent Add-to-Carts</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>
          Latest add-to-cart events
        </p>
      </div>

      {recentCarts.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted }}>No recent add-to-cart events yet.</p>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {recentCarts.map((cart, idx) => (
            <div
              key={cart.ts + idx} // Using ts + idx for unique key as multiple carts can have same ts
              style={{
                padding: "12px 0",
                borderTop: idx > 0 ? `0.5px solid ${C.border}` : "none",
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#1a1a18" }}>
                    {cart.props?.product_name || "Product"}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    Session: {cart.session_id?.slice(0, 8)}...
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: C.teal, fontWeight: 600 }}>
                    ₹{Number(cart.props?.product_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    {new Date(cart.ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
