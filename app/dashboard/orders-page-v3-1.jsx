
// app/dashboard/orders-page-v3-1.jsx (V3.2 Optimized)
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
    <div style={{ background: C.surface, borderRadius: 12, border: `0.5px solid ${C.border}`, padding: "1.25rem 1.5rem", ...style }}>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    test_event_code: "",
  });

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel("orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        // Realtime update logic
        if (payload.eventType === "INSERT") {
          setOrders((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setOrders((prev) => prev.map((order) => (order.id === payload.old.id ? payload.new : order)));
        } else if (payload.eventType === "DELETE") {
          setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
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
    setIsSubmitting(true);

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
          test_event_code: "",
        });
        alert("Order created successfully!");
        // No need to call loadOrders() here, realtime subscription will handle it
      } else {
        alert("Error: " + result.error);
      }
    } catch (err) {
      alert("Error creating order: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCheckpoint = async (orderId, checkpoint) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const { data, error } = await supabase
        .from("orders")
        .update({ [checkpoint]: !order[checkpoint], updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .select()
        .single();

      if (!error && data) {
        // Realtime subscription will update the state, no need to manually map
      }
    } catch (err) {
      alert("Error updating order: " + err.message);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const response = await fetch(`/api/orders?id=${orderId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        // Realtime subscription will update the state, no need to manually filter
        setSelectedOrder(null);
        alert("Order deleted successfully!");
      } else {
        alert("Error deleting order: " + result.error);
      }
    } catch (err) {
      alert("Error deleting order: " + err.message);
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.revenue) || 0), 0);

  return (
    <div>
      {/* Revenue Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card style={{ textAlign: "center", background: C.teal, color: "white" }}>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>Total Revenue</p>
          <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Total Orders</p>
          <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>{orders.length}</p>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Avg. Order Value</p>
          <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>₹{(orders.length > 0 ? totalRevenue / orders.length : 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        {/* Left: List */}
        <Card style={{ maxHeight: "80vh", overflowY: "auto" }}>
          <SectionHead title="Orders" sub={`${orders.length} latest`} />
          {loading ? <p style={{ fontSize: 13, color: C.muted }}>Loading...</p> : orders.map((order) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} style={{
              padding: 12, marginBottom: 8, borderRadius: 8, cursor: "pointer",
              background: selectedOrder?.id === order.id ? C.bg : "transparent",
              border: `0.5px solid ${selectedOrder?.id === order.id ? C.purple : C.border}`,
              transition: "all 0.15s"
            }}>
              <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 13 }}>#{order.order_number}</p>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted }}>{order.customer_name || order.customer_email || "Manual Entry"}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.teal, fontWeight: 700 }}>₹{Number(order.revenue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                {["check_payment", "check_processing", "check_ready", "check_shipped"].map((k) => (
                  <div key={k} style={{ width: 16, height: 16, borderRadius: 4, background: order[k] ? C.success : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>
                    {order[k] ? "✓" : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>

        {/* Right: Details/Form */}
        <Card>
          {selectedOrder ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <SectionHead title={`Order #${selectedOrder.order_number}`} sub={new Date(selectedOrder.created_at).toLocaleString("en-IN")} />
                <button onClick={() => handleDeleteOrder(selectedOrder.id)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, fontSize: 13 }}>
                <div><p style={{ color: C.muted, margin: "0 0 4px" }}>Customer</p><p style={{ fontWeight: 600, margin: 0 }}>{selectedOrder.customer_name || "—"}</p></div>
                <div><p style={{ color: C.muted, margin: "0 0 4px" }}>Email</p><p style={{ fontWeight: 600, margin: 0 }}>{selectedOrder.customer_email || "—"}</p></div>
                <div><p style={{ color: C.muted, margin: "0 0 4px" }}>Phone</p><p style={{ fontWeight: 600, margin: 0 }}>{selectedOrder.customer_phone || "—"}</p></div>
                <div><p style={{ color: C.muted, margin: "0 0 4px" }}>Location</p><p style={{ fontWeight: 600, margin: 0 }}>{selectedOrder.customer_city}, {selectedOrder.customer_state}</p></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
                {[
                  { k: "check_payment", l: "💳 Payment Done" },
                  { k: "check_processing", l: "⚙️ Processing" },
                  { k: "check_ready", l: "📦 Ready to Ship" },
                  { k: "check_shipped", l: "🚚 Shipped" }
                ].map((cp) => (
                  <button key={cp.k} onClick={() => handleToggleCheckpoint(selectedOrder.id, cp.k)} style={{
                    padding: 12, borderRadius: 8, border: `0.5px solid ${C.border}`, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: selectedOrder[cp.k] ? C.success : "white", color: selectedOrder[cp.k] ? "white" : C.gray
                  }}>{cp.l}</button>
                ))}
              </div>

              <div style={{ padding: 16, background: C.bg, borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Revenue</p>
                <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.teal }}>₹{Number(selectedOrder.revenue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          ) : (
            <div>
              <SectionHead title="New Order" sub="Manual entry with Meta tracking" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input placeholder="Order Number *" value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
                <input placeholder="Revenue (₹) *" type="number" value={formData.revenue} onChange={(e) => setFormData({ ...formData, revenue: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input placeholder="Customer Name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
                <input placeholder="Email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input placeholder="Phone" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
                <input placeholder="City" value={formData.customer_city} onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })} style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }} />
              </div>
              <textarea placeholder="Address" value={formData.customer_address} onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 12, height: 60 }} />
              <input placeholder="Meta Test Event Code (Optional)" value={formData.test_event_code} onChange={(e) => setFormData({ ...formData, test_event_code: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }} />
              <button onClick={handleCreateOrder} disabled={isSubmitting} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: C.purple, color: "white", fontWeight: 700, cursor: "pointer" }}>
                {isSubmitting ? "Creating..." : "Create & Track Order"}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
