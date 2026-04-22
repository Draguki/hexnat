// app/api/track/route.js
// ---------------------------------------------------------------------------
// ANALYTICS INGEST ENDPOINT
//
// Next.js 14 App Router uses named exports (GET, POST, OPTIONS) instead of
// a default export.  This file lives at app/api/track/route.js and is
// reachable at POST /api/track.
//
// Environment variables required (set in Vercel dashboard):
//   SUPABASE_URL             — https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY     — service_role key (bypasses RLS, never expose client-side)
//   ALLOWED_ORIGIN           — https://www.hexneedle.com
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// SUPABASE — server-side only, using the service role key so RLS is bypassed
// for writes.  Reads on the dashboard use the anon key instead.
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------------------
// CORS HELPERS
// We need credentials:true support which means the Allow-Origin header CANNOT
// be the wildcard "*" — it must be the exact requesting origin.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.hexneedle.com";

/** Returns the shared CORS headers for every response from this route. */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Required when the client uses credentials: 'include'
    "Access-Control-Allow-Credentials": "true",
    // Cache preflight for 10 minutes so browsers don't re-check on every batch
    "Access-Control-Max-Age": "600",
  };
}

// ---------------------------------------------------------------------------
// OPTIONS — browser preflight for cross-origin requests with credentials
// Must return 200 (not 204) to satisfy some older browser implementations.
// ---------------------------------------------------------------------------
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ---------------------------------------------------------------------------
// VALIDATION HELPERS
// ---------------------------------------------------------------------------

const ALLOWED_EVENT_TYPES = new Set([
  "pageview",
  "click",
  "add_to_cart",
  "form_submit",
  "session_time",
  "scroll_depth",
  "dynamic_load",
]);

function isString(v, max = 500) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

function isNumber(v) {
  return typeof v === "number" && isFinite(v);
}

function validateEvent(e) {
  if (!e || typeof e !== "object") return false;
  if (!ALLOWED_EVENT_TYPES.has(e.type)) return false;
  if (!isString(e.session_id, 64)) return false;
  if (!isString(e.site_id, 64)) return false;
  if (!isString(e.url, 2000)) return false;
  if (!isNumber(e.ts)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// PROPS BUILDERS — extract only the relevant fields per event type into JSONB
// ---------------------------------------------------------------------------
function buildProps(e) {
  switch (e.type) {
    case "click":
      return {
        selector: typeof e.selector === "string" ? e.selector.slice(0, 200) : null,
        text:     typeof e.text     === "string" ? e.text.slice(0, 100)     : null,
        href:     typeof e.href     === "string" ? e.href.slice(0, 500)     : null,
        x_pct:    isNumber(e.x_pct) ? e.x_pct : null,
        y_pct:    isNumber(e.y_pct) ? e.y_pct : null,
      };
    case "add_to_cart":
      return {
        product_name:  typeof e.product_name  === "string" ? e.product_name.slice(0, 200)  : null,
        product_price: isNumber(e.product_price) ? e.product_price : null,
        button_text:   typeof e.button_text   === "string" ? e.button_text.slice(0, 100)   : null,
      };
    case "form_submit":
      return {
        has_email:  Boolean(e.has_email),
        has_phone:  Boolean(e.has_phone),
        form_id:    typeof e.form_id    === "string" ? e.form_id.slice(0, 100)    : null,
        lead_score: typeof e.lead_score === "string" ? e.lead_score.slice(0, 20)  : null,
      };
    case "session_time":
      return { duration_s: isNumber(e.duration_s) ? Math.round(e.duration_s) : null };
    case "scroll_depth":
      return { depth_pct: isNumber(e.depth_pct) ? e.depth_pct : null };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// DATABASE WRITERS
// Each write is wrapped in try/catch so one failure doesn't abort the batch.
// ---------------------------------------------------------------------------

/**
 * Insert a single normalised row into the `events` table.
 * Returns an error string on failure, or null on success.
 */
async function insertEvent(e) {
  const { error } = await supabase.from("events").insert({
    session_id:   e.session_id,
    site_id:      e.site_id,
    type:         e.type,
    url:          e.url?.slice(0, 2000),
    path:         typeof e.path  === "string" ? e.path.slice(0, 500)  : null,
    title:        typeof e.title === "string" ? e.title.slice(0, 500) : null,
    ts:           new Date(e.ts).toISOString(),
    screen_w:     isNumber(e.screen_w)   ? e.screen_w   : null,
    session_age:  isNumber(e.session_age) ? e.session_age : null,
    locale:       isString(e.locale, 20) ? e.locale      : null,
    utm_source:   isString(e.utm?.utm_source,   100) ? e.utm.utm_source   : null,
    utm_medium:   isString(e.utm?.utm_medium,   100) ? e.utm.utm_medium   : null,
    utm_campaign: isString(e.utm?.utm_campaign, 100) ? e.utm.utm_campaign : null,
    referrer:     isString(e.referrer || e.utm?.referrer, 500)
                    ? (e.referrer || e.utm?.referrer)
                    : null,
    props: buildProps(e),
  });
  return error ? error.message : null;
}

/**
 * Upsert a session row — idempotent.
 * first_seen is set only on INSERT; last_seen is always updated on conflict.
 */
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
      referrer:     isString(e.utm?.referrer, 500)     ? e.utm.referrer      : null,
      locale:       isString(e.locale, 20)              ? e.locale            : null,
      screen_w:     isNumber(e.screen_w)                ? e.screen_w          : null,
    },
    {
      onConflict: "id",
      // On duplicate session_id, only refresh last_seen
      ignoreDuplicates: false,
    }
  );

  if (error && error.code !== "23505") return error.message; // 23505 = expected duplicate

  // Separately bump last_seen if this event is newer than what's stored
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ last_seen: new Date(e.ts).toISOString() })
    .eq("id", e.session_id)
    .lt("last_seen", new Date(e.ts).toISOString());

  return updateError ? updateError.message : null;
}

// ---------------------------------------------------------------------------
// RATE LIMITING — in-memory sliding window (per IP).
// For production at high volume, replace with Vercel KV or Redis.
// ---------------------------------------------------------------------------
const rateMap = new Map();
const RATE_LIMIT     = 300;        // events per window per IP
const RATE_WINDOW_MS = 60 * 1000;  // 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  let r = rateMap.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > r.reset) r = { count: 0, reset: now + RATE_WINDOW_MS };
  r.count++;
  rateMap.set(ip, r);

  // Prevent unbounded map growth — prune stale entries periodically
  if (rateMap.size > 10_000) {
    for (const [k, v] of rateMap) {
      if (now > v.reset) rateMap.delete(k);
    }
  }
  return r.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// POST HANDLER
// ---------------------------------------------------------------------------
export async function POST(request) {
  const headers = corsHeaders();

  // ── 1. Origin check ───────────────────────────────────────────────────────
  const origin = request.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // ── 2. Rate limit ─────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body?.events) || body.events.length === 0) {
    return new Response(JSON.stringify({ error: "events[] array required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // ── 4. Process batch (cap at 50 events per request) ───────────────────────
  const batch = body.events.slice(0, 50);
  const results = { accepted: 0, rejected: 0, db_errors: [] };

  await Promise.allSettled(
    batch.map(async (event) => {
      // Reject malformed events immediately
      if (!validateEvent(event)) {
        results.rejected++;
        return;
      }

      // Write event row + upsert session in parallel
      const [evtErr, sesErr] = await Promise.all([
        insertEvent(event),
        upsertSession(event),
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

  // ── 5. Respond ────────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      ok: true,
      accepted: results.accepted,
      rejected: results.rejected,
      // Only include db_errors in non-production to avoid leaking internals
      ...(process.env.NODE_ENV !== "production" && results.db_errors.length
        ? { db_errors: results.db_errors.slice(0, 5) }
        : {}),
    }),
    {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    }
  );
}
