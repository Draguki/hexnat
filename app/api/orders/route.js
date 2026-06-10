// app/api/orders/route.js (V3.2 Optimized)
// ─────────────────────────────────────────────────────────────────────────
// ORDERS CRUD API with Resilient Insert and Meta Tracking Support
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req) {
  return new Response(null, { headers: corsHeaders(req) });
}

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

    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error, count } = await query;
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data, total: count }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { order_number, revenue, ...rest } = body;

    if (!order_number) {
      return new Response(
        JSON.stringify({ success: false, error: "order_number is required" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // RESILIENT INSERT: Only include fields that have values
    const insertData = { order_number };
    if (revenue !== undefined) insertData.revenue = parseFloat(revenue) || 0;
    
    // Map dashboard fields to DB columns
    const fieldMap = {
      customer_email: "customer_email",
      customer_phone: "customer_phone",
      customer_name: "customer_name",
      customer_address: "customer_address",
      customer_city: "customer_city",
      customer_state: "customer_state",
      customer_zip: "customer_zip",
      notes: "notes",
      utm_source: "utm_source",
      utm_medium: "utm_medium",
      utm_campaign: "utm_campaign",
      session_id: "session_id"
    };

    Object.entries(fieldMap).forEach(([formKey, dbKey]) => {
      if (body[formKey]) insertData[dbKey] = body[formKey];
    });

    const { data, error } = await supabase
      .from("orders")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, error: "This Order Number already exists. Please use a unique number." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ORDERS API] POST error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("id is required");

    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}
