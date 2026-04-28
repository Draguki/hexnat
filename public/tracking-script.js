/**
 * HexNeedle Analytics — Tracking Script v1.1
 * ===========================================
 * Served as a static file from /public/tracking-script.js
 * Accessible at: https://hexneedle-analytics.vercel.app/tracking-script.js
 *
 * HOW TO INJECT INTO SITE123:
 *   Settings → Advanced → Header/Footer Code → Header:
 *
 *   <script src="https://hexneedle-analytics.vercel.app/tracking-script.js" async defer></script>
 *
 * WHAT IT TRACKS:
 *   pageview · click (heatmap) · add_to_cart · form_submit · scroll_depth · session_time
 *
 * CONFLICT GUARANTEE:
 *   Full IIFE — zero global variables. Storage keys prefixed "hxa_".
 *   Does NOT call preventDefault on any form. Does NOT touch fbq, gtag, or localStorage
 *   keys used by existing plugins (orderData, hexneedle_amount, purchase_tracked).
 */

(function (win, doc) {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG
     ─────────────────────────────────────────────
     *** CHANGE THIS LINE before deploying ***
     Replace with your actual Vercel project URL.
  ───────────────────────────────────────────── */
  var API_ENDPOINT = "https://hexnat.vercel.app/api/track";
  var SITE_ID      = "hexneedle";

  /* Batching — send after this many events OR after this many ms (whichever comes first) */
  var BATCH_SIZE     = 10;
  var BATCH_INTERVAL = 5000;   // 5 seconds

  /* Session expiry — a new session starts after this many ms of inactivity */
  var SESSION_TTL = 30 * 60 * 1000;  // 30 minutes

  /* Storage key prefix — keeps us from clashing with any existing keys */
  var PREFIX = "hxa_";

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */

  function log() {
    // Flip to true during local testing
    if (false) {
      var a = Array.prototype.slice.call(arguments);
      a.unshift("[HXA]");
      Function.prototype.apply.call(console.log, console, a);
    }
  }

  /** Throttle — fire fn at most once every `ms` milliseconds */
  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }

  /** Debounce — fire fn only after `ms` ms of quiet */
  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /** Safe JSON.parse — returns null instead of throwing */
  function safeJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  /** UUID v4 — no crypto required */
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* ─────────────────────────────────────────────
     SESSION MANAGER
     Persists in localStorage (survives page reloads
     within the same session). Expires after SESSION_TTL
     of inactivity.
  ───────────────────────────────────────────── */
  var SESSION = (function () {
    var KEY = PREFIX + "sid";

    function load() {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = safeJSON(raw);
      if (!s) return null;
      if (Date.now() - s.last > SESSION_TTL) return null; // expired
      return s;
    }

    function create() {
      return { id: uuid(), start: Date.now(), last: Date.now() };
    }

    function persist(s) {
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* quota full */ }
    }

    var current = load() || create();
    persist(current);

    return {
      id:    function ()  { return current.id; },
      age:   function ()  { return Math.round((Date.now() - current.start) / 1000); },
      touch: function ()  { current.last = Date.now(); persist(current); },
    };
  })();

  /* ─────────────────────────────────────────────
     UTM CAPTURE
     Read once from the URL on first load of this
     session; stored in sessionStorage so it survives
     navigation within the site but resets when the
     session ends.
  ───────────────────────────────────────────── */
  var UTM = (function () {
    var KEY    = PREFIX + "utm";
    var PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

    function fromURL() {
      var p = new URLSearchParams(win.location.search);
      var obj = {};
      PARAMS.forEach(function (k) { if (p.get(k)) obj[k] = p.get(k); });
      if (doc.referrer) obj.referrer = doc.referrer;
      return obj;
    }

    var fresh   = fromURL();
    var stored  = safeJSON(sessionStorage.getItem(KEY)) || {};

    // First-touch within the session wins
    if (Object.keys(fresh).length) {
      try { sessionStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) {}
      return fresh;
    }
    return stored;
  })();

  /* ─────────────────────────────────────────────
     EVENT QUEUE + SENDER
     Events accumulate in memory. The queue flushes:
       • When it reaches BATCH_SIZE events
       • After BATCH_INTERVAL ms (debounced timer)
       • On page hide / unload (synchronous sendBeacon)
  ───────────────────────────────────────────── */
  var QUEUE = (function () {
    var queue = [];
    var timer = null;

    function flush(sync) {
      if (!queue.length) return;
      var batch = queue.splice(0, queue.length); // drain
      var body  = JSON.stringify({ events: batch });

      log("Flushing", batch.length, "events to", API_ENDPOINT);

      if (sync && navigator.sendBeacon) {
        /*
         * sendBeacon is the ONLY reliable way to send data on page unload.
         * It does NOT support custom headers or credentials.
         * The API therefore also accepts beacon requests that lack an Origin
         * header by checking the body's site_id instead.
         */
        navigator.sendBeacon(API_ENDPOINT, new Blob([body], { type: "application/json" }));
        return;
      }

      /*
       * Normal async flush — fetch with credentials: "include" so that any
       * cookies the API may set (future feature) are sent back automatically.
       * The API must respond with Access-Control-Allow-Credentials: true and
       * an explicit (non-wildcard) Access-Control-Allow-Origin header.
       */
      fetch(API_ENDPOINT, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        body,
        // keepalive: true also keeps the request alive past page navigation
        keepalive:   true,
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        log("Flush OK");
      }).catch(function (err) {
        log("Flush error:", err.message);
        // Re-queue on network failure (best effort)
        Array.prototype.push.apply(queue, batch);
      });
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(flush, BATCH_INTERVAL);
    }

    return {
      push: function (event) {
        queue.push(event);
        SESSION.touch();
        if (queue.length >= BATCH_SIZE) flush(false);
        else schedule();
      },
      flushSync: function () { flush(true); },
    };
  })();

  /* ─────────────────────────────────────────────
     EVENT BUILDER
     Attaches common metadata to every event.
  ───────────────────────────────────────────── */
  function buildEvent(type, props) {
    return Object.assign(
      {
        type:        type,
        site_id:     SITE_ID,
        session_id:  SESSION.id(),
        url:         win.location.href,
        path:        win.location.pathname,
        title:       doc.title,
        ts:          Date.now(),
        session_age: SESSION.age(),
        screen_w:    win.innerWidth || (win.screen && win.screen.width) || 0,
        locale:      navigator.language || "",
        utm:         UTM,
      },
      props || {}
    );
  }

  /* ─────────────────────────────────────────────
     TRACKER MODULES
  ───────────────────────────────────────────── */

  // 1. Page view — fires once on init (+ on SPA navigation if relevant)
  function trackPageView() {
    QUEUE.push(buildEvent("pageview", { referrer: doc.referrer }));
    log("pageview", win.location.pathname);
  }

  // 2. Click / heatmap — throttled to avoid event spam on rapid clicks
  var onClickHeatmap = throttle(function (e) {
    var el = e.target;
    if (!el) return;

    var tag  = el.tagName ? el.tagName.toLowerCase() : "";
    var id   = el.id ? "#" + el.id : "";
    var cls  = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";

    QUEUE.push(buildEvent("click", {
      selector: tag + id + cls,
      text:     (el.innerText || "").trim().slice(0, 40),
      href:     el.href || (el.closest && el.closest("a") ? el.closest("a").href : "") || "",
      x_pct:   win.innerWidth  > 0 ? Math.round((e.clientX / win.innerWidth)  * 100) : 0,
      y_pct:   doc.documentElement.scrollHeight > 0
                 ? Math.round((e.clientY / doc.documentElement.scrollHeight) * 100)
                 : 0,
    }));
  }, 200);

  // 3. Add to cart — event delegation matches SITE123's dynamic cart buttons
  var CART_SELECTORS = [
    ".add-to-cart",
    "[data-action='add-to-cart']",
    ".btn-add-to-cart",
    ".shop-product-buy",
    "button[class*='cart']",
    "a[class*='add-to-cart']",
    ".btn-buy-now",           // ← SITE123 exact class
    ".orderButtonPopup",      // ← SITE123 exact class
    "[aria-label='Add To Cart']",
  ].join(", ");

  function onClickCart(e) {
    var btn = e.target && e.target.closest && e.target.closest(CART_SELECTORS);
    if (!btn) return;

    var container = btn.closest(".shop-product-item") || 
                    btn.closest("[class*='product-item']") || 
                    btn.closest("[class*='product']") || 
                    btn.parentElement;
    var name = "", price = "";
    if (container) {
      var nameEl  = container.querySelector("[class*='name'], [class*='title'], h2, h3");
      var priceEl = container.querySelector(".shop-product-price, .product-price,[class*='price'], [data-type='price']");
      name  = nameEl  ? (nameEl.innerText  || "").trim().slice(0, 100) : "";
      price = priceEl ? (priceEl.innerText || "").replace(/[^0-9.]/g, "")     : "";
    }

    QUEUE.push(buildEvent("add_to_cart", {
      product_name:  name,
      product_price: parseFloat(price) || 0,
      button_text:   (btn.innerText || "").trim().slice(0, 60),
    }));
    log("add_to_cart", name, price);
  }

  // 4. Form submit — capture phase (fires BEFORE SITE123's handlers)
  //    We never call preventDefault — SITE123's order flow must proceed normally.
  function onFormSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;

    var get = function (sel) {
      var el = form.querySelector(sel);
      return el ? (el.value || "").trim() : "";
    };

    var email = get('[name="email"], [type="email"]');
    var phone = get('[name="phone"], [type="tel"]');

    // Only track forms that look like checkout / contact forms
    if (!email && !phone) return;

    QUEUE.push(buildEvent("form_submit", {
      has_email:  Boolean(email),
      has_phone:  Boolean(phone),
      form_id:    form.id || (form.className || "").split(" ")[0] || "unknown",
      lead_score: email && phone ? "full" : email ? "email_only" : "phone_only",
    }));
    log("form_submit");
  }

  // 5. Scroll depth — fires at 25 / 50 / 75 / 100 %
  var maxScrollPct = 0;
  var onScroll = throttle(function () {
    var scrolled = win.scrollY + win.innerHeight;
    var total    = doc.documentElement.scrollHeight;
    var pct      = total > 0 ? Math.round((scrolled / total) * 100) : 0;

    if (pct > maxScrollPct) {
      maxScrollPct = pct;
      if (maxScrollPct % 25 === 0 && maxScrollPct > 0) {
        QUEUE.push(buildEvent("scroll_depth", { depth_pct: maxScrollPct }));
        log("scroll_depth", maxScrollPct + "%");
      }
    }
  }, 300);

  // 6. Session time — recorded on page hide (before the browser closes the tab)
  function onPageHide() {
    QUEUE.push(buildEvent("session_time", { duration_s: SESSION.age() }));
    QUEUE.flushSync(); // must flush synchronously here — page is about to unload
  }

  /* ─────────────────────────────────────────────
     EVENT DELEGATION
     Single listener on document for all click and
     submit events — safe for SITE123's dynamic DOM.
     passive: true for scroll/click = no jank.
  ───────────────────────────────────────────── */
  function attachListeners() {
    // Heatmap clicks (passive — we never call e.preventDefault())
    doc.addEventListener("click", onClickHeatmap, { passive: true });

    // Add to cart (re-uses the same click event, delegated match happens inside)
    doc.addEventListener("click", onClickCart, { passive: true });

    // Form submits (capture:true = fires before the form's own submit handler)
    doc.addEventListener("submit", onFormSubmit, { capture: true });

    // Scroll depth
    win.addEventListener("scroll", onScroll, { passive: true });

    // Session time on page hide (modern, reliable, doesn't block bfcache)
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "hidden") onPageHide();
    });
    win.addEventListener("pagehide", onPageHide);
    // NOTE: 'beforeunload' is intentionally omitted — it prevents bfcache and
    //       is unreliable. visibilitychange + pagehide cover all real cases.
  }

  /* ─────────────────────────────────────────────
     DYNAMIC DOM WATCHER
     SITE123 renders product sections asynchronously.
     MutationObserver fires once when new product
     nodes appear; auto-disconnects after 15 s.
  ───────────────────────────────────────────── */
  function watchDynamicElements() {
    if (!win.MutationObserver) return;

    var observer = new MutationObserver(
      debounce(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.querySelector && node.querySelector("[class*='product']")) {
              QUEUE.push(buildEvent("dynamic_load", {
                element: node.tagName.toLowerCase() + (node.id ? "#" + node.id : ""),
              }));
              log("dynamic_load");
            }
          });
        });
      }, 400)
    );

    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree:   true,
    });

    // Disconnect after 15 s — page is fully loaded by then
    setTimeout(function () { observer.disconnect(); }, 15_000);
  }

  /* ─────────────────────────────────────────────
     INIT — deferred so it never blocks page render.
     requestIdleCallback is used when available
     (Chrome/Edge/Firefox). Safari falls back to
     setTimeout(fn, 0) which is equally non-blocking.
  ───────────────────────────────────────────── */
  function init() {
    trackPageView();
    attachListeners();
    watchDynamicElements();
    log("Initialized | session:", SESSION.id());
  }

  function boot() {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", function () {
        if (win.requestIdleCallback) {
          win.requestIdleCallback(init, { timeout: 2000 });
        } else {
          setTimeout(init, 0);
        }
      });
    } else {
      if (win.requestIdleCallback) {
        win.requestIdleCallback(init, { timeout: 2000 });
      } else {
        setTimeout(init, 0);
      }
    }
  }

  boot();

})(window, document);
