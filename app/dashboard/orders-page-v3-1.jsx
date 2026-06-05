// app/dashboard/orders-page-v3-1.jsx (V3.1)
// ─────────────────────────────────────────────────────────────────────────
// Orders Management Page
// Features: Dynamic feed, 4 checkpoints, full customer PII, order customizations
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
  coral: "#D85A30",
  gray: "#888780",
  muted: "#B4B2A9",
  border: "rgba(0,0,0,0.09)",
  surface: "#ffffff",
  bg: "#f5f4f0",
  success: "#22c55e",
};

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

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{title}</h2>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gray }}>{sub}</p>}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    order_number: "",
    customer_email: "",
    customer_phone: "",
    customer_name: "",
    customer_address: "",
    customer_city: "",
    customer_state: "",
    customer_zip: "",
    revenue: "",
  });

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!formData.order_number) {
      alert("Order number is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          order_number: formData.order_number,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          customer_name: formData.customer_name || null,
          customer_address: formData.customer_address || null,
          customer_city: formData.customer_city || null,
          customer_state: formData.customer_state || null,
          customer_zip: formData.customer_zip || null,
          revenue: parseFloat(formData.revenue) || 0,
          items: [],
          check_payment: false,
          check_processing: false,
          check_ready: false,
          check_shipped: false,
        })
        .select()
        .single();

      if (!error && data) {
        setOrders([data, ...orders]);
        setFormData({
          order_number: "",
          customer_email: "",
          customer_phone: "",
          customer_name: "",
          customer_address: "",
          customer_city: "",
          customer_state: "",
          customer_zip: "",
          revenue: "",
        });
        alert("Order created successfully!");
      }
    } catch (err) {
      alert("Error creating order: " + err.message);
    }
  };

  const handleToggleCheckpoint = async (orderId, checkpoint) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const updateData = {
        [checkpoint]: !order[checkpoint],
      };

      const { data, error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .select()
        .single();

      if (!error && data) {
        setOrders(orders.map((o) => (o.id === orderId ? data : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data);
        }
      }
    } catch (err) {
      alert("Error updating order: " + err.message);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);

      if (!error) {
        setOrders(orders.filter((o) => o.id !== orderId));
        setSelectedOrder(null);
        alert("Order deleted successfully!");
      }
    } catch (err) {
      alert("Error deleting order: " + err.message);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
      {/* Left: Order List */}
      <div>
        <Card>
          <SectionHead title="Orders" sub={`${orders.length} total`} />

          {loading ? (
            <p style={{ color: C.muted }}>Loading orders...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: C.muted }}>No orders yet.</p>
          ) : (
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {orders.map((order, idx) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  style={{
                    padding: "12px",
                    marginBottom: 8,
                    borderRadius: 8,
                    background: selectedOrder?.id === order.id ? C.bg : "transparent",
                    border: `0.5px solid ${selectedOrder?.id === order.id ? C.purple : C.border}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedOrder?.id !== order.id) {
                      e.currentTarget.style.background = C.bg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedOrder?.id !== order.id) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 13 }}>
                    #{order.order_number}
                  </p>
                  <p style={{ margin: "0 0 2px", fontSize: 11, color: C.muted }}>
                    {order.customer_name || order.customer_email || "Unknown"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: C.teal, fontWeight: 600 }}>
                    ₹{Number(order.revenue).toLocaleString("en-IN")}
                  </p>
                  <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                    {[
                      { key: "check_payment", label: "💳" },
                      { key: "check_processing", label: "⚙️" },
                      { key: "check_ready", label: "📦" },
                      { key: "check_shipped", label: "🚚" },
                    ].map((cp) => (
                      <div
                        key={cp.key}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: order[cp.key] ? C.success : C.border,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                        }}
                      >
                        {order[cp.key] ? "✓" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right: Order Detail or Create Form */}
      <div>
        {selectedOrder ? (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionHead title={`Order #${selectedOrder.order_number}`} />
              <button
                onClick={() => handleDeleteOrder(selectedOrder.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#dc3545",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Delete
              </button>
            </div>

            {/* Customer Info */}
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `0.5px solid ${C.border}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: C.gray }}>
                Customer Information
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <div>
                  <p style={{ margin: "0 0 2px", color: C.muted }}>Name</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{selectedOrder.customer_name || "—"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", color: C.muted }}>Email</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{selectedOrder.customer_email || "—"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", color: C.muted }}>Phone</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{selectedOrder.customer_phone || "—"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", color: C.muted }}>City</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{selectedOrder.customer_city || "—"}</p>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ margin: "0 0 2px", color: C.muted }}>Address</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{selectedOrder.customer_address || "—"}</p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `0.5px solid ${C.border}` }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: C.gray }}>
                  Items & Customizations
                </p>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 8, padding: 8, background: C.bg, borderRadius: 6 }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{item.name}</p>
                    {item.specifications && Object.keys(item.specifications).length > 0 && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {Object.entries(item.specifications).map(([key, val]) => (
                          <p key={key} style={{ margin: "2px 0" }}>
                            <strong>{key}:</strong> {val}
                          </p>
                        ))}
                      </div>
                    )}
                    <p style={{ margin: "4px 0 0", color: C.teal, fontWeight: 600 }}>
                      ₹{Number(item.price).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 4 Checkpoints */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, color: C.gray }}>
                Fulfillment Checkpoints
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { key: "check_payment", label: "💳 Payment Done / Thank You Sent" },
                  { key: "check_processing", label: "⚙️ Processing / Order Being Made" },
                  { key: "check_ready", label: "📦 Video/Photo Ready to Ship" },
                  { key: "check_shipped", label: "🚚 Shipping ID Sent" },
                ].map((cp) => (
                  <button
                    key={cp.key}
                    onClick={() => handleToggleCheckpoint(selectedOrder.id, cp.key)}
                    style={{
                      padding: "10px",
                      borderRadius: 8,
                      border: `0.5px solid ${C.border}`,
                      background: selectedOrder[cp.key] ? C.success : "transparent",
                      color: selectedOrder[cp.key] ? "white" : C.gray,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                      transition: "all 0.15s",
                    }}
                  >
                    {selectedOrder[cp.key] ? "✓ " : ""}{cp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue */}
            <div style={{ padding: 12, background: C.bg, borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Total Revenue</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, color: C.teal }}>
                ₹{Number(selectedOrder.revenue).toLocaleString("en-IN")}
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <SectionHead title="Create New Order" sub="Manual entry" />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Order Number *"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <input
                type="text"
                placeholder="Customer Name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <input
                type="email"
                placeholder="Customer Email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <input
                type="tel"
                placeholder="Customer Phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <input
                type="text"
                placeholder="Address"
                value={formData.customer_address}
                onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="text"
                  placeholder="City"
                  value={formData.customer_city}
                  onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })}
                  style={{
                    padding: "10px",
                    borderRadius: 6,
                    border: `0.5px solid ${C.border}`,
                    fontSize: 13,
                  }}
                />
                <input
                  type="text"
                  placeholder="State"
                  value={formData.customer_state}
                  onChange={(e) => setFormData({ ...formData, customer_state: e.target.value })}
                  style={{
                    padding: "10px",
                    borderRadius: 6,
                    border: `0.5px solid ${C.border}`,
                    fontSize: 13,
                  }}
                />
              </div>
              <input
                type="number"
                placeholder="Revenue (₹)"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  border: `0.5px solid ${C.border}`,
                  fontSize: 13,
                }}
              />
              <button
                onClick={handleCreateOrder}
                style={{
                  padding: "12px",
                  borderRadius: 6,
                  border: "none",
                  background: C.purple,
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Create Order
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
