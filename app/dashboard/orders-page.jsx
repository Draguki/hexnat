// app/dashboard/orders-page.jsx
// ─────────────────────────────────────────────────────────────────────────
// ORDERS MANAGEMENT PAGE
// Features: Manual entry, delete, per-order tabs with 4-checkbox fulfillment
// ─────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const C = {
  purple: "#7F77DD", teal: "#1D9E75", amber: "#EF9F27",
  coral: "#D85A30", blue: "#378ADD", gray: "#888780",
  muted: "#B4B2A9", bg: "#f5f4f0", surface: "#ffffff",
  border: "rgba(0,0,0,0.09)", success: "#22c55e", error: "#ef4444",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      padding: "8px 0", fontSize: 13,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer", width: 18, height: 18 }}
      />
      <span>{label}</span>
    </label>
  );
}

function Button({ children, onClick, variant = "primary", style = {} }) {
  const baseStyle = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: FONT,
  };

  const variants = {
    primary: { background: C.purple, color: "white" },
    secondary: { background: C.bg, color: "#1a1a18", border: `0.5px solid ${C.border}` },
    danger: { background: C.error, color: "white" },
  };

  return (
    <button
      onClick={onClick}
      style={{ ...baseStyle, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function Input({ placeholder, value, onChange, style = {} }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        border: `0.5px solid ${C.border}`,
        fontSize: 13,
        fontFamily: FONT,
        ...style,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    order_number: "",
    customer_id: "",
    revenue: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    notes: "",
  });

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("[ORDERS] Load error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Create order
  const handleCreateOrder = async () => {
    if (!formData.order_number.trim()) {
      alert("Order number is required");
      return;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          revenue: parseFloat(formData.revenue) || 0,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setOrders([result.data, ...orders]);
        setFormData({
          order_number: "",
          customer_id: "",
          revenue: "",
          utm_source: "",
          utm_medium: "",
          utm_campaign: "",
          utm_content: "",
          notes: "",
        });
        setShowForm(false);
      } else {
        alert("Error creating order: " + result.error);
      }
    } catch (err) {
      console.error("[ORDERS] Create error:", err.message);
      alert("Failed to create order");
    }
  };

  // Delete order
  const handleDeleteOrder = async (id) => {
    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
      const response = await fetch(`/api/orders?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        setOrders(orders.filter((o) => o.id !== id));
        if (selectedOrderId === id) setSelectedOrderId(null);
      } else {
        alert("Error deleting order: " + result.error);
      }
    } catch (err) {
      console.error("[ORDERS] Delete error:", err.message);
      alert("Failed to delete order");
    }
  };

  // Update order (checklist, status, notes)
  const handleUpdateOrder = async (id, updates) => {
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      const result = await response.json();
      if (result.success) {
        setOrders(orders.map((o) => (o.id === id ? result.data : o)));
      } else {
        alert("Error updating order: " + result.error);
      }
    } catch (err) {
      console.error("[ORDERS] Update error:", err.message);
      alert("Failed to update order");
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  return (
    <div style={{ padding: "2rem", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <SectionHead
          title="Orders Management"
          sub="Manage orders, track fulfillment status, and view UTM attribution"
        />
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Left: Orders List */}
        <div>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Orders ({orders.length})</h3>
              <Button onClick={() => setShowForm(!showForm)} variant="primary">
                {showForm ? "Cancel" : "+ New Order"}
              </Button>
            </div>

            {/* New Order Form */}
            {showForm && (
              <div style={{
                background: C.bg, padding: "1rem", borderRadius: 8,
                marginBottom: "1rem", border: `0.5px solid ${C.border}`,
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <Input
                    placeholder="Order #"
                    value={formData.order_number}
                    onChange={(v) => setFormData({ ...formData, order_number: v })}
                  />
                  <Input
                    placeholder="Revenue (₹)"
                    value={formData.revenue}
                    onChange={(v) => setFormData({ ...formData, revenue: v })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <Input
                    placeholder="utm_source"
                    value={formData.utm_source}
                    onChange={(v) => setFormData({ ...formData, utm_source: v })}
                  />
                  <Input
                    placeholder="utm_medium (campaign.name)"
                    value={formData.utm_medium}
                    onChange={(v) => setFormData({ ...formData, utm_medium: v })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <Input
                    placeholder="utm_campaign (adset.id)"
                    value={formData.utm_campaign}
                    onChange={(v) => setFormData({ ...formData, utm_campaign: v })}
                  />
                  <Input
                    placeholder="utm_content (ad.name)"
                    value={formData.utm_content}
                    onChange={(v) => setFormData({ ...formData, utm_content: v })}
                  />
                </div>
                <Input
                  placeholder="Notes"
                  value={formData.notes}
                  onChange={(v) => setFormData({ ...formData, notes: v })}
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <Button onClick={handleCreateOrder} variant="primary" style={{ width: "100%" }}>
                  Create Order
                </Button>
              </div>
            )}

            {/* Orders List */}
            {loading ? (
              <p style={{ color: C.gray, fontSize: 13 }}>Loading orders...</p>
            ) : orders.length === 0 ? (
              <p style={{ color: C.gray, fontSize: 13 }}>No orders yet. Create one to get started.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{
                      padding: "12px",
                      borderRadius: 8,
                      border: `0.5px solid ${selectedOrderId === order.id ? C.purple : C.border}`,
                      background: selectedOrderId === order.id ? "#EEEDFE" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>
                          {order.order_number}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: C.gray }}>
                          ₹{order.revenue} • {new Date(order.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 8px",
                        borderRadius: 4, background: C.teal, color: "white",
                      }}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Order Details & Fulfillment Checklist */}
        <div>
          {selectedOrder ? (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {selectedOrder.order_number} Details
                </h3>
                <Button
                  onClick={() => handleDeleteOrder(selectedOrder.id)}
                  variant="danger"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  Delete
                </Button>
              </div>

              {/* Order Info */}
              <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `0.5px solid ${C.border}` }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: C.gray, fontWeight: 600 }}>REVENUE</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>₹{selectedOrder.revenue}</p>
              </div>

              {/* UTM Attribution */}
              <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `0.5px solid ${C.border}` }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: C.gray, fontWeight: 600 }}>UTM ATTRIBUTION</p>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {selectedOrder.utm_source && (
                    <p style={{ margin: "4px 0" }}>
                      <strong>Source:</strong> {selectedOrder.utm_source}
                    </p>
                  )}
                  {selectedOrder.utm_medium && (
                    <p style={{ margin: "4px 0" }}>
                      <strong>Medium:</strong> {selectedOrder.utm_medium}
                    </p>
                  )}
                  {selectedOrder.utm_campaign && (
                    <p style={{ margin: "4px 0" }}>
                      <strong>Campaign:</strong> {selectedOrder.utm_campaign}
                    </p>
                  )}
                  {selectedOrder.utm_content && (
                    <p style={{ margin: "4px 0" }}>
                      <strong>Ad:</strong> {selectedOrder.utm_content}
                    </p>
                  )}
                </div>
              </div>

              {/* Fulfillment Checklist */}
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: C.gray, fontWeight: 600 }}>FULFILLMENT CHECKLIST</p>
                <Checkbox
                  label="Thank You Message Sent"
                  checked={selectedOrder.check_thanks}
                  onChange={(v) => handleUpdateOrder(selectedOrder.id, { check_thanks: v })}
                />
                <Checkbox
                  label="Processing/Production Message Sent"
                  checked={selectedOrder.check_process}
                  onChange={(v) => handleUpdateOrder(selectedOrder.id, { check_process: v })}
                />
                <Checkbox
                  label="Finished Video / Ready to Ship Sent"
                  checked={selectedOrder.check_finished}
                  onChange={(v) => handleUpdateOrder(selectedOrder.id, { check_finished: v })}
                />
                <Checkbox
                  label="Packing + Shipping ID Sent"
                  checked={selectedOrder.check_shipped}
                  onChange={(v) => handleUpdateOrder(selectedOrder.id, { check_shipped: v })}
                />
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `0.5px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: C.gray, fontWeight: 600 }}>NOTES</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#1a1a18" }}>{selectedOrder.notes}</p>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <p style={{ margin: 0, fontSize: 13, color: C.gray, textAlign: "center", padding: "2rem 0" }}>
                Select an order to view details and manage fulfillment
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
