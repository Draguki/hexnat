// app/api/orders/route.js
// ─────────────────────────────────────────────────────────────────────────
// ORDERS CRUD API
// Handles: GET (list), POST (create), PUT (update), DELETE
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.hexneedle.com";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

// ─────────────────────────────────────────────────────────────────────────
// GET: List orders with optional filters
// ─────────────────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customer_id");
    const limit = parseInt(url.searchParams.get("limit")) || 50;
    const offset = parseInt(url.searchParams.get("offset")) || 0;

    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data, total: count }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ORDERS API] GET error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST: Create new order (manual entry)
// ─────────────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      order_number,
      customer_id,
      revenue,
      currency = "INR",
      items_json = [],
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      session_id,
      notes,
    } = body;

    // Validate required fields
    if (!order_number) {
      return new Response(
        JSON.stringify({ success: false, error: "order_number is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        site_id: "hexneedle",
        order_number,
        customer_id: customer_id || null,
        revenue: parseFloat(revenue) || 0,
        currency,
        items_json,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
        session_id: session_id || null,
        notes: notes || null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ORDERS API] POST error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PUT: Update order (checklist, status, notes)
// ─────────────────────────────────────────────────────────────────────────
export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: "id is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ORDERS API] PUT error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE: Remove order
// ─────────────────────────────────────────────────────────────────────────
export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: "id is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, message: "Order deleted" }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ORDERS API] DELETE error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
}
