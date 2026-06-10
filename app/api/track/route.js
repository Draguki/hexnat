
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

const META_PIXEL_ID   = process.env.META_PIXEL_ID || "4415595052018024";
const META_CAPI_URL   = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`;

// ─────────────────────────────────────────────────────────────────────────
// NORMALIZATION & HASHING (Meta Standards)
// ─────────────────────────────────────────────────────────────────────────

function normalizeEmail(em) {
  if (!em) return null;
  return em.toLowerCase().trim();
}

function normalizePhone(ph) {
  if (!ph) return null;
  let clean = ph.replace(/[^\d]/g, ""); // Remove symbols
  clean = clean.replace(/^0+/, "");     // Remove leading zeros
  if (clean.length === 10) clean = "91" + clean; // Default to India if 10 digits
  return clean;
}

function normalizeString(str) {
  if (!str) return null;
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
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

  try {
    const { data, error } = await supabase
      .from("customers")
      .upsert(customerData, { onConflict: email ? "email" : "phone" })
      .select("id")
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (e) {
    console.error("[Supabase] Error upserting customer:", e.message);
    return null;
  }
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
    fn: sha256(normalizeString(pii.name?.split(" ")[0])) ? [sha256(normalizeString(pii.name?.split(" ")[0]))] : undefined,
    ln: sha256(normalizeString(pii.name?.split(" ").slice(1).join(""))) ? [sha256(normalizeString(pii.name?.split(" ").slice(1).join("")))] : undefined,
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
    }).catch((e) => console.error("[Supabase] Error logging CAPI event:", e.message));

  } catch (e) {
    console.error("[CAPI Error]", e.message);
  }
}

export async function OPTIONS(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return new Response(null, { headers });
}

export async function POST(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  let processedCount = 0;

  try {
    const body = await req.json();
    const events = Array.isArray(body.events) ? body.events : [body];
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const ua = req.headers.get("user-agent") || "";

    for (const event of events) {
      try {
        // 1. Deduplication Check (for Purchase)
        if (event.type === "purchase" && event.order_id) {
          const { data: existing, error: capiError } = await supabase
            .from("capi_events_sent")
            .select("event_id")
            .eq("event_name", "Purchase")
            .eq("event_id", sha256(event.order_id))
            .limit(1);
          if (capiError) console.error("[Supabase] Error checking CAPI deduplication:", capiError.message);
          if (existing?.length) {
            console.log(`[Track API] Skipping duplicate purchase event for order_id: ${event.order_id}`);
            continue; // Skip duplicate revenue
          }
        }

        // 2. Customer & Timeline
        const cid = await upsertCustomer(event, event.session_id);
        if (cid) {
          try {
            await supabase.from("customer_timeline").insert({
              customer_id: cid,
              event_type: event.type,
              event_label: event.type === "purchase" ? `Purchase ₹${event.revenue}` : event.type,
              path: event.path,
              ts: new Date(event.ts).toISOString(),
              props: event.props || event
            });
          } catch (e) {
            console.error("[Supabase] Error inserting into customer_timeline:", e.message);
          }
        }

        // 3. Log Event
        try {
          await supabase.from("events").insert({
            session_id: event.session_id,
            site_id: event.site_id,
            type: event.type,
            path: event.path,
            title: event.title,
            url: event.url,
            ts: new Date(event.ts).toISOString(),
            props: event.props || event
          });
        } catch (e) {
          console.error("[Supabase] Error inserting into events table:", e.message);
        }

        // 4. Upsert Session for Pageviews
        if (event.type === "pageview") {
          try {
            const { error: sessionUpsertError } = await supabase
              .from("sessions")
              .upsert(
                {
                  session_id: event.session_id,
                  site_id: event.site_id,
                  last_seen: new Date(event.ts).toISOString(),
                  utm_source: event.utm?.utm_source,
                  utm_medium: event.utm?.utm_medium,
                  utm_campaign: event.utm?.utm_campaign,
                  referrer: event.referrer || event.utm?.referrer,
                  entry_path: event.path,
                  user_agent: ua,
                  ip_address: ip,
                },
                { onConflict: "session_id", ignoreDuplicates: false }
              );
            if (sessionUpsertError) console.error("[Supabase] Error upserting session:", sessionUpsertError.message);
          } catch (e) {
            console.error("[Supabase] Error upserting session (catch):", e.message);
          }
        }

        // 5. Meta CAPI (non-blocking)
        sendCAPI(event, ip, ua, body.test_event_code);
        processedCount++;
      } catch (eventProcessError) {
        console.error("[Track API] Error processing single event:", eventProcessError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), { headers });
  } catch (e) {
    console.error("[Track API] POST error:", e.message);
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers });
  }
}
