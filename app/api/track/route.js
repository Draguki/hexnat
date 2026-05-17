// app/api/track/route.js
// ---------------------------------------------------------------------------
// ANALYTICS INGEST ENDPOINT + META CONVERSIONS API
//
// Every event is:
//   1. Written to Supabase (analytics)
//   2. Forwarded to Meta CAPI for pixel 4415595052018024 (server-side signal)
//
// CAPI gives Meta a server-side signal that survives ad blockers and iOS 14+
// restrictions. The eventID links it to the browser pixel event for
// deduplication — Meta sees both and counts it only once.
//
// Environment variables required (Vercel dashboard):
//   SUPABASE_URL          — https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  — service_role key
//   ALLOWED_ORIGIN        — https://www.hexneedle.com
//   META_CAPI_TOKEN       — your Conversions API access token
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// SUPABASE
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------------------
// META CAPI CONFIG
// ---------------------------------------------------------------------------
const META_PIXEL_ID   = "4415595052018024";
const META_CAPI_URL   = `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events`;
const META_API_VERSION = "v20.0";

// Maps our analytics event types → Meta standard event names
const CAPI_EVENT_MAP = {
  pageview:     null,          // handled specially — only product pages → ViewContent
  add_to_cart:  "AddToCart",
  form_submit:  null,          // handled specially — checkout vs lead
  purchase:     "Purchase",
  scroll_depth: null,          // no Meta event
  session_time: null,          // no Meta event
  click:        null,          // no Meta event
  dynamic_load: null,          // no Meta event
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.hexneedle.com";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":      ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":     "POST, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age":           "600",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------
const ALLOWED_EVENT_TYPES = new Set([
  "pageview", "click", "add_to_cart", "form_submit",
  "session_time", "scroll_depth", "dynamic_load", "purchase",
]);

function isString(v, max = 500) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function isNumber(v) {
  return typeof v === "number" && isFinite(v);
}
function validateEvent(e) {
  if (!e || typeof e !== "object")       return false;
  if (!ALLOWED_EVENT_TYPES.has(e.type)) return false;
  if (!isString(e.session_id, 64))      return false;
  if (!isString(e.site_id, 64))         return false;
  if (!isString(e.url, 2000))           return false;
  if (!isNumber(e.ts))                  return false;
  return true;
}

// ---------------------------------------------------------------------------
// PROPS BUILDER
// ---------------------------------------------------------------------------
function buildProps(e) {
  switch (e.type) {
    case "click":
      return {
        selector: isString(e.selector, 200) ? e.selector : null,
        text:     isString(e.text,     100) ? e.text     : null,
        href:     isString(e.href,     500) ? e.href     : null,
        x_pct:    isNumber(e.x_pct)         ? e.x_pct   : null,
        y_pct:    isNumber(e.y_pct)         ? e.y_pct   : null,
      };
    case "add_to_cart":
      return {
        product_name:  isString(e.product_name,  200) ? e.product_name  : null,
        product_price: isNumber(e.product_price)       ? e.product_price : null,
        button_text:   isString(e.button_text,   100) ? e.button_text   : null,
        pixel_event_id: isString(e.pixel_event_id, 100) ? e.pixel_event_id : null,
      };
    case "form_submit":
      return {
        has_email:  Boolean(e.has_email),
        has_phone:  Boolean(e.has_phone),
        form_id:    isString(e.form_id,    100) ? e.form_id    : null,
        lead_score: isString(e.lead_score,  20) ? e.lead_score : null,
        pixel_event_id: isString(e.pixel_event_id, 100) ? e.pixel_event_id : null,
      };
    case "session_time":
      return { duration_s: isNumber(e.duration_s) ? Math.round(e.duration_s) : null };
    case "scroll_depth":
      return { depth_pct: isNumber(e.depth_pct) ? e.depth_pct : null };
    case "purchase":
      return {
        revenue:        isNumber(e.revenue)                ? e.revenue        : null,
        currency:       isString(e.currency,          10)  ? e.currency       : "INR",
        order_id:       isString(e.order_id,         100)  ? e.order_id       : null,
        customer_city:  isString(e.customer_city,    100)  ? e.customer_city  : null,
        customer_state: isString(e.customer_state,   100)  ? e.customer_state : null,
        cart:           isString(e.cart,            2000)  ? e.cart           : null,
        items_count:    isNumber(e.items_count)             ? e.items_count    : null,
        pixel_event_id: isString(e.pixel_event_id,  100)   ? e.pixel_event_id : null,
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SUPABASE WRITERS
// ---------------------------------------------------------------------------
async function insertEvent(e) {
  const { error } = await supabase.from("events").insert({
    session_id:   e.session_id,
    site_id:      e.site_id,
    type:         e.type,
    url:          e.url?.slice(0, 2000),
    path:         isString(e.path,  500) ? e.path  : null,
    title:        isString(e.title, 500) ? e.title : null,
    ts:           new Date(e.ts).toISOString(),
    screen_w:     isNumber(e.screen_w)    ? e.screen_w    : null,
    session_age:  isNumber(e.session_age) ? e.session_age : null,
    locale:       isString(e.locale,  20) ? e.locale      : null,
    utm_source:   isString(e.utm?.utm_source,   100) ? e.utm.utm_source   : null,
    utm_medium:   isString(e.utm?.utm_medium,   100) ? e.utm.utm_medium   : null,
    utm_campaign: isString(e.utm?.utm_campaign, 100) ? e.utm.utm_campaign : null,
    referrer:     isString(e.referrer || e.utm?.referrer, 500)
                    ? (e.referrer || e.utm?.referrer) : null,
    props: buildProps(e),
  });
  return error ? error.message : null;
}

async function upsertSession(e) {
  const { error } = await supabase.from("sessions").upsert(
    {
      id:           e.session_id,
      site_id:      e.site_id,
      first_seen:   new Date(e.ts).toISOString(),
      last_seen:    new Date(e.ts).toISOString(),
      utm_source:   isString(e.utm?.utm_source,   100) ? e.utm.utm_source   : null,
      utm_medium:   isString(e.utm?.utm_medium,   100) ? e.utm.utm_medium   : null,
      utm_campaign: isString(e.utm?.utm_campaign, 100) ? e.utm.utm_campaign : null,
      referrer:     isString(e.utm?.referrer,     500) ? e.utm.referrer      : null,
      locale:       isString(e.locale,             20) ? e.locale            : null,
      screen_w:     isNumber(e.screen_w)               ? e.screen_w          : null,
    },
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (error && error.code !== "23505") return error.message;
  await supabase
    .from("sessions")
    .update({ last_seen: new Date(e.ts).toISOString() })
    .eq("id", e.session_id)
    .lt("last_seen", new Date(e.ts).toISOString());
  return null;
}

// ---------------------------------------------------------------------------
// META CAPI WRITER
// Sends server-side signal to pixel 4415595052018024.
// Runs in parallel with Supabase writes — never blocks the response.
// ---------------------------------------------------------------------------
async function sendCAPI(e, ip, userAgent) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return; // skip if token not configured

  // Determine Meta event name
  let metaEventName = null;
  let customData    = {};

  switch (e.type) {
    case "purchase":
      metaEventName = "Purchase";
      customData    = {
        currency: "INR",
        value:    isNumber(e.revenue) ? e.revenue : (e.props?.revenue || 0),
      };
      break;

    case "add_to_cart":
      metaEventName = "AddToCart";
      customData    = {
        currency:     "INR",
        value:        isNumber(e.product_price) ? e.product_price : 0,
        content_name: isString(e.product_name, 200) ? e.product_name : "",
      };
      break;

    case "form_submit":
      // Checkout form (has both email + phone) → InitiateCheckout
      // Lead form (email only) → Lead
      metaEventName = e.lead_score === "full" ? "InitiateCheckout" : "Lead";
      break;

    case "pageview":
      // Only product pages → ViewContent
      if (e.path && (e.path.includes("/store/") || e.path.includes("/product"))) {
        metaEventName = "ViewContent";
        customData    = { content_name: isString(e.title, 200) ? e.title : "" };
      }
      break;

    default:
      return; // no CAPI event for this type
  }

  if (!metaEventName) return;

  // Use the pixel_event_id stored in props for deduplication with browser pixel
  const eventID = e.props?.pixel_event_id ||
                  e.pixel_event_id        ||
                  `${e.type}_${e.ts}_${e.session_id?.slice(0, 8)}`;

  const payload = {
    data: [{
      event_name:       metaEventName,
      event_time:       Math.floor(e.ts / 1000),
      event_id:         eventID,
      event_source_url: isString(e.url, 2000) ? e.url : null,
      action_source:    "website",
      user_data: {
        // IP and user agent improve match quality without requiring PII
        client_ip_address: ip    || null,
        client_user_agent: userAgent || null,
      },
      custom_data: Object.keys(customData).length ? customData : undefined,
    }],
    access_token: token,
  };

  try {
    const res = await fetch(META_CAPI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[HXA CAPI] Meta error:", JSON.stringify(result).slice(0, 200));
    } else {
      console.log(`[HXA CAPI] ✅ ${metaEventName} sent | eventID: ${eventID}`);
    }
  } catch (err) {
    console.error("[HXA CAPI] Fetch failed:", err.message);
  }
}

// ---------------------------------------------------------------------------
// RATE LIMITING
// ---------------------------------------------------------------------------
const rateMap = new Map();
const RATE_LIMIT     = 300;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  let r = rateMap.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > r.reset) r = { count: 0, reset: now + RATE_WINDOW_MS };
  r.count++;
  rateMap.set(ip, r);
  if (rateMap.size > 10_000) {
    for (const [k, v] of rateMap) { if (now > v.reset) rateMap.delete(k); }
  }
  return r.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// POST HANDLER
// ---------------------------------------------------------------------------
export async function POST(request) {
  const headers = corsHeaders();

  // Origin check
  const origin = request.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // Capture user agent for CAPI match quality
  const userAgent = request.headers.get("user-agent") || "";

  // Parse body
  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body?.events) || !body.events.length) {
    return new Response(JSON.stringify({ error: "events[] array required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const batch   = body.events.slice(0, 50);
  const results = { accepted: 0, rejected: 0, db_errors: [] };

  await Promise.allSettled(
    batch.map(async (event) => {
      if (!validateEvent(event)) { results.rejected++; return; }

      // Run Supabase writes + CAPI in parallel — CAPI failure never blocks analytics
      const [evtErr, sesErr] = await Promise.all([
        insertEvent(event),
        upsertSession(event),
        sendCAPI(event, ip, userAgent).catch((e) =>
          console.error("[HXA CAPI] Unhandled:", e.message)
        ),
      ]);

      if (evtErr || sesErr) {
        results.rejected++;
        if (evtErr) results.db_errors.push(`event: ${evtErr}`);
        if (sesErr) results.db_errors.push(`session: ${sesErr}`);
        console.error("[HXA API] DB error:", { evtErr, sesErr, type: event.type });
      } else {
        results.accepted++;
      }
    })
  );

  return new Response(
    JSON.stringify({
      ok:       true,
      accepted: results.accepted,
      rejected: results.rejected,
      ...(process.env.NODE_ENV !== "production" && results.db_errors.length
        ? { db_errors: results.db_errors.slice(0, 5) } : {}),
    }),
    { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
  );
}
