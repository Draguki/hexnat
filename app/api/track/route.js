// app/api/track/route.js (V3.2 Optimized)
// ─────────────────────────────────────────────────────────────────────────
// ANALYTICS INGEST + CUSTOMER PROFILING + META CONVERSIONS API (CAPI)
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const META_PIXEL_ID   = "4415595052018024";
const META_CAPI_URL   = `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events`;

// ─────────────────────────────────────────────────────────────────────────
// NORMALIZATION & HASHING (Meta Standards)
// ─────────────────────────────────────────────────────────────────────────

function normalizeEmail(em) {
  if (!em) return null;
  return em.toLowerCase().trim();
}

function normalizePhone(ph) {
  if (!ph) return null;
  let clean = ph.replace(/[^\d]/g, ''); // Remove symbols
  clean = clean.replace(/^0+/, '');     // Remove leading zeros
  if (clean.length === 10) clean = "91" + clean; // Default to India if 10 digits
  return clean;
}

function normalizeString(str) {
  if (!str) return null;
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function sha256(str) {
  if (!str) return null;
  return createHash("sha256").update(str).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function deriveSource(utm, referrer) {
  if (utm?.utm_source) return "utm:" + utm.utm_source;
  if (referrer) {
    if (referrer.includes("instagram")) return "instagram";
    if (referrer.includes("facebook")) return "facebook";
    if (referrer.includes("google")) return "google";
    return "referrer";
  }
  return "direct";
}

// ─────────────────────────────────────────────────────────────────────────
// CORE LOGIC
// ─────────────────────────────────────────────────────────────────────────

async function upsertCustomer(event, sessionId) {
  const pii = event.pii || {};
  const email = normalizeEmail(pii.email);
  const phone = normalizePhone(pii.phone);
  
  if (!email && !phone) return null;

  const customerData = {
    site_id: "hexneedle",
    email,
    phone,
    name: pii.name || null,
    city: pii.city || null,
    state: pii.state || null,
    last_session_id: sessionId,
    last_visit: new Date(event.ts).toISOString(),
    fbclid: pii.fbclid || event.utm?.fbclid || null,
    data_version: "V3.2"
  };

  const { data, error } = await supabase
    .from("customers")
    .upsert(customerData, { onConflict: email ? "email" : "phone" })
    .select("id")
    .single();

  return data?.id || null;
}

async function sendCAPI(event, ip, userAgent, testCode) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;

  const pii = event.pii || {};
  const userData = {
    client_ip_address: ip,
    client_user_agent: userAgent,
    em: sha256(normalizeEmail(pii.email)) ? [sha256(normalizeEmail(pii.email))] : undefined,
    ph: sha256(normalizePhone(pii.phone)) ? [sha256(normalizePhone(pii.phone))] : undefined,
    fn: sha256(normalizeString(pii.name?.split(' ')[0])) ? [sha256(normalizeString(pii.name?.split(' ')[0]))] : undefined,
    ln: sha256(normalizeString(pii.name?.split(' ').slice(1).join(''))) ? [sha256(normalizeString(pii.name?.split(' ').slice(1).join('')))] : undefined,
    ct: sha256(normalizeString(pii.city)) ? [sha256(normalizeString(pii.city))] : undefined,
    st: sha256(normalizeString(pii.state)) ? [sha256(normalizeString(pii.state))] : undefined,
    country: [sha256("in")], // Default to India
    fbc: pii.fbc || null,
    fbp: pii.fbp || null,
    external_id: sha256(event.order_id || event.props?.order_id) || undefined
  };

  let metaEventName = null;
  let customData = { currency: "INR" };

  switch (event.type) {
    case "purchase":
      metaEventName = "Purchase";
      customData.value = parseFloat(event.revenue || event.props?.revenue || 0);
      break;
    case "add_to_cart":
      metaEventName = "AddToCart";
      customData.value = parseFloat(event.product_price || event.props?.product_price || 0);
      customData.content_name = event.product_name || event.props?.product_name || "";
      break;
    case "pageview":
      if (event.path?.includes("/store/") || event.path?.includes("/product")) {
        metaEventName = "ViewContent";
        customData.content_name = event.title || "";
      } else {
        metaEventName = "PageView";
      }
      break;
    default: return;
  }

  const payload = {
    data: [{
      event_name: metaEventName,
      event_time: Math.floor(event.ts / 1000),
      event_id: event.pixel_event_id || event.props?.pixel_event_id || `ev_${Date.now()}`,
      event_source_url: event.url,
      action_source: "website",
      user_data: userData,
      custom_data: customData
    }],
    test_event_code: testCode || undefined
  };

  try {
    const res = await fetch(`${META_CAPI_URL}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    
    // Log for audit
    await supabase.from("capi_events_sent").insert({
      event_name: metaEventName,
      event_id: payload.data[0].event_id,
      payload,
      meta_response: result,
      http_status: res.status
    }).catch(() => {});

  } catch (e) {
    console.error("[CAPI Error]", e.message);
  }
}

export async function POST(req) {
  const headers = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const body = await req.json();
    const events = Array.isArray(body.events) ? body.events : [body];
    const ip = req.headers.get("x-forwarded-for")?.split(',')[0] || "127.0.0.1";
    const ua = req.headers.get("user-agent") || "";

    for (const event of events) {
      // 1. Deduplication Check (for Purchase)
      if (event.type === "purchase" && event.order_id) {
        const { data: existing } = await supabase
          .from("events")
          .select("id")
          .eq("type", "purchase")
          .filter("props->>order_id", "eq", event.order_id)
          .limit(1);
        if (existing?.length) continue; // Skip duplicate revenue
      }

      // 2. Customer & Timeline
      const cid = await upsertCustomer(event, event.session_id);
      if (cid) {
        await supabase.from("customer_timeline").insert({
          customer_id: cid,
          event_type: event.type,
          event_label: event.type === "purchase" ? `Purchase ₹${event.revenue}` : event.type,
          path: event.path,
          ts: new Date(event.ts).toISOString(),
          props: event.props || event
        }).catch(() => {});
      }

      // 3. Log Event
      await supabase.from("events").insert({
        session_id: event.session_id,
        site_id: event.site_id,
        type: event.type,
        path: event.path,
        url: event.url,
        ts: new Date(event.ts).toISOString(),
        props: event.props || event
      }).catch(() => {});

      // 4. Meta CAPI
      sendCAPI(event, ip, ua, body.test_event_code);
    }

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
