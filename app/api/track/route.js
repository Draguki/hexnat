// app/api/track/route.js (V3.3)
// ─────────────────────────────────────────────────────────────────────────
// ANALYTICS INGEST + CUSTOMER PROFILING + META CONVERSIONS API (CAPI)
//
// v3.3 Features:
//   1. Full Meta CAPI Advanced Matching (fn, ln, ct, st, zp, country, external_id)
//   2. Deduplication support with pixel_event_id
//   3. Support for fbp, fbc parameters
//   4. Enhanced custom_data for Purchase, AddToCart, ViewContent
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const META_PIXEL_ID   = "4415595052018024";
const META_CAPI_URL   = `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events`;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.hexneedle.com";

// ─────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────

// SHA256 hashing for Meta CAPI
function sha256(str) {
  if (!str) return null;
  try {
    return createHmac("sha256", "")
      .update(str.toLowerCase().trim())
      .digest("hex");
  } catch (e) {
    console.error("[HXA] SHA256 error:", e.message);
    return null;
  }
}

// Async SHA256 hashing (modern approach)
async function sha256Hash(str) {
  if (!str) return null;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => ("0" + b.toString(16)).slice(-2)).join("");
  } catch (e) {
    console.error("[HXA] Async SHA256 error:", e.message);
    return sha256(str);
  }
}

// Derive traffic source from UTM or referrer
function deriveSource(utm, referrer) {
  if (utm?.utm_source) {
    if (utm.utm_source.includes("meta") || utm.utm_source.includes("facebook")) return "meta";
    if (utm.utm_source.includes("google")) return "google";
    return "utm:" + utm.utm_source;
  }
  if (referrer) {
    if (referrer.includes("instagram") || referrer.includes("facebook")) return "meta";
    if (referrer.includes("google")) return "google";
    if (referrer.includes("whatsapp")) return "whatsapp";
    return "referrer";
  }
  return "direct";
}

function isString(v, max = 500) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function isNumber(v) {
  return typeof v === "number" && isFinite(v);
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

async function upsertCustomer(event, ip, sessionId) {
  const pii = event.pii || {};
  const utm = event.utm || {};
  
  if (!pii.email && !pii.phone) return null;

  const customerEmail = pii.email ? pii.email.toLowerCase().trim() : null;
  const customerPhone = pii.phone ? pii.phone.trim() : null;

  let customerId = null;
  if (customerEmail) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customerEmail)
      .limit(1)
      .single();
    if (data) customerId = data.id;
  } else if (customerPhone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", customerPhone)
      .limit(1)
      .single();
    if (data) customerId = data.id;
  }

  const source = deriveSource(utm, event.referrer);
  const customerData = {
    site_id:              "hexneedle",
    email:                customerEmail,
    phone:                customerPhone,
    name:                 pii.name || null,
    city:                 pii.city || null,
    state:                pii.state || null,
    first_session_id:     sessionId,
    last_session_id:      sessionId,
    last_visit:           new Date(event.ts).toISOString(),
    last_visit_path:      event.path || null,
    utm_source:           utm.utm_source || null,
    utm_medium:           utm.utm_medium || null,
    utm_campaign:         utm.utm_campaign || null,
    referrer:             event.referrer || null,
    source:               source,
    fbclid:               pii.fbclid || utm.fbclid || null,
    data_version:         "V3.3",
  };

  if (customerId) {
    const { data, error } = await supabase
      .from("customers")
      .update({
        ...customerData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select("id")
      .single();

    if (error) {
      console.error("[HXA] Customer update error:", error.message);
      return null;
    }
    return data?.id || customerId;
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert({
        ...customerData,
        first_visit: new Date(event.ts).toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[HXA] Customer insert error:", error.message);
      return null;
    }
    return data?.id || null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER TIMELINE
// ─────────────────────────────────────────────────────────────────────────

async function insertCustomerTimeline(customerId, event) {
  if (!customerId || !event.type) return null;

  let eventLabel = null;
  switch (event.type) {
    case "pageview":
      eventLabel = `Viewed ${event.title || event.path || "page"}`;
      break;
    case "view_content":
      eventLabel = `Viewed Content: ${event.title || event.path || "page"}`;
      break;
    case "add_to_cart":
      const prodName = event.product_name || event.props?.product_name || "Unknown product";
      const price = event.product_price || event.props?.product_price;
      eventLabel = `Added to Cart: ${prodName}${price ? " (₹" + price + ")" : ""}`;
      break;
    case "form_submit":
      eventLabel = event.props?.lead_score === "full" ? "Initiated Checkout" : "Submitted Lead Form";
      break;
    case "purchase":
      const rev = event.revenue || event.props?.revenue;
      eventLabel = `Purchase ₹${rev || 0}`;
      break;
    default:
      eventLabel = event.type.toUpperCase();
  }

  const { error } = await supabase
    .from("customer_timeline")
    .insert({
      site_id:      "hexneedle",
      customer_id:  customerId,
      session_id:   event.session_id,
      event_type:   event.type,
      event_label:  eventLabel,
      path:         event.path || null,
      title:        event.title || null,
      page_destination: event.props?.nav_dest || null,
      props:        event.props || null,
      ts:           new Date(event.ts).toISOString(),
      data_version: "V3.3",
    });

  if (error) {
    console.error("[HXA] Timeline insert error:", error.message);
    return null;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// META CAPI (v3.3)
// ─────────────────────────────────────────────────────────────────────────

async function sendCAPI(event, ip, userAgent) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;

  let metaEventName = null;
  let customData    = {};
  let userData      = {
    client_ip_address: ip || null,
    client_user_agent: userAgent || null,
  };

  const pii = event.pii || {};

  // Hashing helper for CAPI
  const hashField = async (val) => {
    if (!val) return null;
    return await sha256Hash(val.toString().toLowerCase().trim());
  };

  // User Data (Advanced Matching)
  if (pii.email) userData.em = [await hashField(pii.email)];
  if (pii.phone) userData.ph = [await hashField(pii.phone)];
  if (pii.fn)    userData.fn = [await hashField(pii.fn)];
  if (pii.ln)    userData.ln = [await hashField(pii.ln)];
  if (pii.city)  userData.ct = [await hashField(pii.city)];
  if (pii.state) userData.st = [await hashField(pii.state)];
  if (pii.zip)   userData.zp = [await hashField(pii.zip)];
  if (pii.country) userData.country = [await hashField(pii.country)];
  
  if (pii.external_id) userData.external_id = pii.external_id;
  if (pii.fbp) userData.fbp = pii.fbp;
  if (pii.fbc) userData.fbc = pii.fbc;

  switch (event.type) {
    case "purchase":
      metaEventName = "Purchase";
      customData = {
        currency: "INR",
        value:    isNumber(event.revenue) ? event.revenue : (event.props?.revenue || 0),
        order_id: event.order_id || event.props?.order_id || null,
      };
      break;

    case "add_to_cart":
      metaEventName = "AddToCart";
      const atcName = event.product_name || event.props?.product_name || "";
      customData = {
        currency:     "INR",
        value:        isNumber(event.product_price) ? event.product_price : (event.props?.product_price || 0),
        content_ids:  atcName ? [atcName] : [],
        content_type: "product",
        content_name: atcName,
      };
      break;

    case "form_submit":
      metaEventName = event.props?.lead_score === "full" ? "InitiateCheckout" : "Lead";
      break;

    case "view_content":
    case "pageview":
      if (event.type === "view_content" || (event.path && (event.path.includes("/store/") || event.path.includes("/product")))) {
        metaEventName = "ViewContent";
        customData = {
          content_ids:  [event.path || ""],
          content_type: "product",
          content_name: isString(event.title, 200) ? event.title : "",
        };
      }
      break;

    default:
      return;
  }

  if (!metaEventName) return;

  const eventID = event.pixel_event_id || event.props?.pixel_event_id ||
                  `${event.type}_${event.ts}_${event.session_id?.slice(0, 8)}`;

  const payload = {
    data: [{
      event_name:       metaEventName,
      event_time:       Math.floor(event.ts / 1000),
      event_id:         eventID,
      event_source_url: isString(event.url, 2000) ? event.url : null,
      referrer_url:     event.utm?.referrer || event.referrer || null,
      action_source:    "website",
      user_data:        Object.keys(userData).length ? userData : undefined,
      custom_data:      Object.keys(customData).length ? customData : undefined,
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

    await supabase
      .from("capi_events_sent")
      .insert({
        site_id:             "hexneedle",
        event_name:          metaEventName,
        event_id:            eventID,
        customer_email_hash: userData.em?.[0] || null,
        customer_phone_hash: userData.ph?.[0] || null,
        payload:             payload,
        meta_response:       result,
        http_status:         res.status,
        error_msg:           !res.ok ? JSON.stringify(result).slice(0, 500) : null,
      })
      .catch((e) => console.error("[HXA CAPI Log] Error:", e.message));

    if (!res.ok) {
      console.error("[HXA CAPI] Meta error:", JSON.stringify(result).slice(0, 200));
    } else {
      console.log(`[HXA CAPI] ✅ ${metaEventName} sent | eventID: ${eventID}`);
    }
  } catch (err) {
    console.error("[HXA CAPI] Fetch failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CORE HANDLERS
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = new Set([
  "pageview", "click", "add_to_cart", "form_submit",
  "session_time", "scroll_depth", "dynamic_load", "purchase", "view_content"
]);

function validateEvent(e) {
  if (!e || typeof e !== "object")       return false;
  if (!ALLOWED_EVENT_TYPES.has(e.type)) return false;
  if (!isString(e.session_id, 64))      return false;
  if (!isString(e.site_id, 64))         return false;
  if (!isString(e.url, 2000))           return false;
  if (!isNumber(e.ts))                  return false;
  return true;
}

function buildProps(e) {
  switch (e.type) {
    case "click":
      return {
        selector: isString(e.selector, 200) ? e.selector : null,
        text:     isString(e.text,     100) ? e.text     : null,
        href:     isString(e.href,     500) ? e.href     : null,
        nav_dest: isString(e.nav_dest, 500) ? e.nav_dest : null,
        x_pct:    isNumber(e.x_pct)         ? e.x_pct   : null,
        y_pct:    isNumber(e.y_pct)         ? e.y_pct   : null,
      };
    case "add_to_cart":
      return {
        product_name:  isString(e.product_name || e.props?.product_name, 200) ? (e.product_name || e.props?.product_name) : null,
        product_price: isNumber(e.product_price || e.props?.product_price) ? (e.product_price || e.props?.product_price) : null,
        button_text:   isString(e.button_text || e.props?.button_text, 100) ? (e.button_text || e.props?.button_text) : null,
        pixel_event_id: isString(e.pixel_event_id || e.props?.pixel_event_id, 100) ? (e.pixel_event_id || e.props?.pixel_event_id) : null,
      };
    case "form_submit":
      return {
        has_email:  Boolean(e.has_email),
        has_phone:  Boolean(e.has_phone),
        form_id:    isString(e.form_id,    100) ? e.form_id    : null,
        lead_score: isString(e.lead_score,  20) ? e.lead_score : null,
        pixel_event_id: isString(e.pixel_event_id, 100) ? e.pixel_event_id : null,
      };
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
      return e.props || null;
  }
}

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
    props:        buildProps(e),
    data_version: "V3.3",
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
      data_version: "V3.3",
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

// ─────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// POST HANDLER (v3.3)
// ─────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  const headers = corsHeaders();

  const origin = request.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const userAgent = request.headers.get("user-agent") || "";

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

      const customerId = await upsertCustomer(event, ip, event.session_id);

      if (customerId) {
        await insertCustomerTimeline(customerId, event);
      }

      let cartPromise = Promise.resolve();
      if (event.type === "add_to_cart") {
        cartPromise = (async () => {
          try {
            const { data: existingCart } = await supabase
              .from("active_carts")
              .select("items, total_items, total_revenue")
              .eq("session_id", event.session_id)
              .single();

            const newItem = {
              name: event.product_name || event.props?.product_name || "Unknown",
              price: parseFloat(event.product_price || event.props?.product_price || 0),
              qty: 1,
              added_at: new Date(event.ts).toISOString()
            };

            const items = existingCart?.items ? [...existingCart.items, newItem] : [newItem];
            const total_items = (existingCart?.total_items || 0) + 1;
            const total_revenue = (parseFloat(existingCart?.total_revenue || 0)) + newItem.price;

            await supabase.from("active_carts").upsert({
              session_id: event.session_id,
              customer_id: customerId,
              items,
              total_items,
              total_revenue,
              utm_source: event.utm?.utm_source || null,
              utm_medium: event.utm?.utm_medium || null,
              utm_campaign: event.utm?.utm_campaign || null,
              last_updated: new Date(event.ts).toISOString(),
            }, { onConflict: "session_id" });
          } catch (e) {
            console.error("[HXA API] Cart update error:", e.message);
          }
        })();
      }

      const [evtErr, sesErr] = await Promise.all([
        insertEvent(event),
        upsertSession(event),
        cartPromise,
        sendCAPI(event, ip, userAgent).catch((e) =>
          console.error("[HXA CAPI] Unhandled:", e.message)
        ),
      ]);

      if (evtErr || sesErr) {
        results.rejected++;
        if (evtErr) results.db_errors.push(`event: ${evtErr}`);
        if (sesErr) results.db_errors.push(`session: ${sesErr}`);
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
