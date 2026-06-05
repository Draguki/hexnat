// app/dashboard/customers-page.jsx (V3.1)
// ─────────────────────────────────────────────────────────────────────────
// Enhanced Customers Page with Order Customizations
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
  gray: "#888780",
  muted: "#B4B2A9",
  border: "rgba(0,0,0,0.09)",
  surface: "#ffffff",
  bg: "#f5f4f0",
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

export default function CustomersPage({ onSelectCustomer }) {
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

  const filtered = customers.filter(
    (c) =>
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
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: `0.5px solid ${C.border}`,
            fontSize: 13,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>
                  Email
                </th>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>
                  Name
                </th>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600, color: C.muted }}>
                  Phone
                </th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: C.muted }}>
                  Orders
                </th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: C.muted }}>
                  Revenue
                </th>
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
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "8px" }}>{c.email || "—"}</td>
                  <td style={{ padding: "8px" }}>{c.name || "—"}</td>
                  <td style={{ padding: "8px" }}>{c.phone || "—"}</td>
                  <td style={{ textAlign: "right", padding: "8px" }}>{c.orders_count || 0}</td>
                  <td style={{ textAlign: "right", padding: "8px", color: C.teal, fontWeight: 600 }}>
                    ₹{(c.total_revenue || 0).toLocaleString("en-IN")}
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
// CUSTOMER DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────

export function CustomerDetail({ customerId, onBack }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [customerRes, ordersRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase
          .from("orders")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

      if (customerRes.data) setCustomer(customerRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
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
          padding: "5px 14px",
          borderRadius: 6,
          border: `0.5px solid ${C.border}`,
          background: "transparent",
          cursor: "pointer",
          fontSize: 13,
          marginBottom: 16,
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
              <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600 }}>Phone</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{customer.phone || "—"}</p>
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
          </div>
        </Card>
      )}

      <SectionHead title="Order History" sub={`${orders.length} order${orders.length !== 1 ? "s" : ""}`} />

      {orders.length === 0 ? (
        <Card>
          <p style={{ color: C.muted }}>No orders yet.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((order) => (
            <Card key={order.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Order #{order.order_number}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: C.teal, fontWeight: 600, fontSize: 14 }}>
                    ₹{Number(order.revenue).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Order Items & Customizations */}
              {order.items && order.items.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: C.gray }}>
                    Items & Customizations
                  </p>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 10, padding: 8, background: C.bg, borderRadius: 6 }}>
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

              {/* Order Status */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.border}`, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <div style={{ textAlign: "center", padding: 8, background: order.check_payment ? "#d4edda" : C.bg, borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: order.check_payment ? "#155724" : C.muted }}>
                    ✓ Payment
                  </p>
                </div>
                <div style={{ textAlign: "center", padding: 8, background: order.check_processing ? "#d4edda" : C.bg, borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: order.check_processing ? "#155724" : C.muted }}>
                    ✓ Processing
                  </p>
                </div>
                <div style={{ textAlign: "center", padding: 8, background: order.check_ready ? "#d4edda" : C.bg, borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: order.check_ready ? "#155724" : C.muted }}>
                    ✓ Ready
                  </p>
                </div>
                <div style={{ textAlign: "center", padding: 8, background: order.check_shipped ? "#d4edda" : C.bg, borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: order.check_shipped ? "#155724" : C.muted }}>
                    ✓ Shipped
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
