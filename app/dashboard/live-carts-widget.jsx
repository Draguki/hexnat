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
    loadCarts();
    
    // Realtime subscription to active_carts
    const channel = supabase
      .channel("active_carts_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_carts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setCarts((prev) => [payload.new, ...prev].slice(0, 15));
          } else if (payload.eventType === "UPDATE") {
            setCarts((prev) =>
              prev.map((cart) => (cart.id === payload.new.id ? payload.new : cart))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCarts = async () => {
    try {
      const { data, error } = await supabase
        .from("active_carts")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(15);

      if (!error && data) {
        setCarts(data);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading carts:", err);
      setLoading(false);
    }
  };

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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          Recent Add-to-Carts
        </h2>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>
          Latest items added to cart
        </p>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: C.muted }}>Loading...</p>
      ) : carts.length === 0 ? (
        <p style={{ fontSize: 13, color: C.muted }}>No cart events yet.</p>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {carts.map((cart, idx) => {
            const items = cart.items || [];
            return (
              <div
                key={cart.id}
                style={{
                  padding: "12px 0",
                  borderTop: idx > 0 ? `0.5px solid ${C.border}` : "none",
                  fontSize: 13,
                }}
              >
                {/* Cart header with session and total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: "#1a1a18" }}>
                      Session: {cart.session_id?.slice(0, 8)}...
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                      {cart.total_items} item{cart.total_items !== 1 ? "s" : ""} in cart
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: C.teal, fontWeight: 600, fontSize: 14 }}>
                      ₹{Number(cart.total_revenue || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                      {new Date(cart.last_updated).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                  </div>
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `0.5px solid ${C.border}`,
                      fontSize: 12,
                    }}
                  >
                    {items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingBottom: 6,
                          marginBottom: itemIdx < items.length - 1 ? 6 : 0,
                          borderBottom:
                            itemIdx < items.length - 1
                              ? `0.5px solid ${C.border}`
                              : "none",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 500,
                              color: "#1a1a18",
                              wordBreak: "break-word",
                              whiteSpace: "normal",
                            }}
                          >
                            {item.name || "Unknown"}
                          </p>
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: 11,
                              color: C.muted,
                            }}
                          >
                            Qty: {item.qty || 1}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                          <p style={{ margin: 0, color: C.teal, fontWeight: 600 }}>
                            ₹{Number(item.price || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
