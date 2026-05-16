/**
 * HexNeedle Analytics — Tracking Script v2.0
 * ===========================================
 * Dual purpose: Analytics → Supabase + Meta Pixel standard events
 *
 * META PIXEL EVENTS:
 *   Product page visit  → ViewContent
 *   Add to cart         → AddToCart     (value + currency)
 *   Order form submit   → InitiateCheckout
 *   Contact/lead form   → Lead
 *   Thank-you page      → Purchase      (value + currency)
 *
 * CONFLICT GUARANTEE:
 *   Full IIFE — zero globals. Storage keys prefixed hxa_.
 *   No preventDefault on any form. fbq calls guarded by typeof check.
 *   Does not touch orderData, hexneedle_amount, or purchase_tracked keys.
 */

(function (win, doc) {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  var API_ENDPOINT   = "https://hexnat.vercel.app/api/track";
  var SITE_ID        = "hexneedle";
  var BATCH_SIZE     = 10;
  var BATCH_INTERVAL = 5000;
  var SESSION_TTL    = 30 * 60 * 1000;
  var PREFIX         = "hxa_";

  /* ─────────────────────────────────────────────
     META PIXEL HELPER
     Single function for all fbq calls.
     - Guards against fbq not loaded yet
     - Generates unique eventID for each event
       (used for browser pixel ↔ CAPI deduplication)
  ───────────────────────────────────────────── */
  function firePixel(eventName, params, eventID) {
    if (typeof win.fbq !== "function") return;
    var options = eventID ? { eventID: eventID } : {};
    try {
      win.fbq("track", eventName, params || {}, options);
      log("Meta Pixel:", eventName, params);
    } catch (e) {
      log("Meta Pixel error:", e.message);
    }
  }

  function makeEventID(prefix) {
    return (prefix || "ev") + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function log() {
    if (false) { // set to true to debug
      var a = Array.prototype.slice.call(arguments);
      a.unshift("[HXA]");
      Function.prototype.apply.call(console.log, console, a);
    }
  }

  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
    };
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function safeJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* ─────────────────────────────────────────────
     SESSION MANAGER
  ───────────────────────────────────────────── */
  var SESSION = (function () {
    var KEY = PREFIX + "sid";

    function load() {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = safeJSON(raw);
      if (!s) return null;
      if (Date.now() - s.last > SESSION_TTL) return null;
      return s;
    }

    function create() {
      return { id: uuid(), start: Date.now(), last: Date.now() };
    }

    function persist(s) {
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    }

    var current = load() || create();
    persist(current);

    return {
      id:    function () { return current.id; },
      age:   function () { return Math.round((Date.now() - current.start) / 1000); },
      touch: function () { current.last = Date.now(); persist(current); },
    };
  })();

  /* ─────────────────────────────────────────────
     UTM CAPTURE
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

    var fresh  = fromURL();
    var stored = safeJSON(sessionStorage.getItem(KEY)) || {};

    if (Object.keys(fresh).length) {
      try { sessionStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) {}
      return fresh;
    }
    return stored;
  })();

  /* ─────────────────────────────────────────────
     EVENT QUEUE + SENDER
  ───────────────────────────────────────────── */
  var QUEUE = (function () {
    var queue = [];
    var timer = null;

    function flush(sync) {
      if (!queue.length) return;
      var batch = queue.splice(0, queue.length);
      var body  = JSON.stringify({ events: batch });

      if (sync && navigator.sendBeacon) {
        navigator.sendBeacon(API_ENDPOINT, new Blob([body], { type: "application/json" }));
        return;
      }

      fetch(API_ENDPOINT, {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: body,
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        log("Flush OK");
      }).catch(function (err) {
        log("Flush error:", err.message);
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
  ───────────────────────────────────────────── */
  function buildEvent(type, props) {
    return Object.assign({
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
    }, props || {});
  }

  /* ─────────────────────────────────────────────
     1. PURCHASE — runs first on thank-you page
        Analytics → Supabase
        Meta     → Purchase (value + currency)
  ───────────────────────────────────────────── */
  function trackPurchase() {
    if (!win.location.href.includes("thank-you")) return;
    if (sessionStorage.getItem("hxa_purchased") === "true") return;

    var amount    = parseFloat(localStorage.getItem("hexneedle_amount")) || 0;
    var orderRaw  = localStorage.getItem("orderData");
    var orderData = orderRaw ? safeJSON(orderRaw) : {};

    if (amount <= 0) return;

    var eventID = makeEventID("purchase");

    // Analytics
    QUEUE.push(buildEvent("purchase", {
      revenue:        amount,
      currency:       "INR",
      order_id:       orderData.orderID   || null,
      customer_city:  orderData.city      || null,
      customer_state: orderData.state     || null,
      cart:           orderData.cart      || null,
      items_count:    orderData.cart ? orderData.cart.split("|").length : 1,
      pixel_event_id: eventID,
    }));
    QUEUE.flushSync();

    // Meta Pixel
    firePixel("Purchase", { value: amount, currency: "INR" }, eventID);

    sessionStorage.setItem("hxa_purchased", "true");
    log("Purchase tracked ₹" + amount);
  }

  /* ─────────────────────────────────────────────
     2. PAGE VIEW
        Analytics → Supabase (always)
        Meta     → ViewContent (product pages only)
        Note: base pixel already fires PageView on
        every page — we don't duplicate that here.
  ───────────────────────────────────────────── */
  function trackPageView() {
    QUEUE.push(buildEvent("pageview", { referrer: doc.referrer }));

    var path = win.location.pathname;
    if (path.includes("/store/") || path.includes("/product")) {
      firePixel("ViewContent", {
        content_name:     doc.title || "",
        content_category: "Product",
        currency:         "INR",
      }, makeEventID("vc"));
    }

    log("pageview", path);
  }

  /* ─────────────────────────────────────────────
     3. CLICK HEATMAP
        Analytics only — no Meta standard event
  ───────────────────────────────────────────── */
  var onClickHeatmap = throttle(function (e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    var id  = el.id ? "#" + el.id : "";
    var cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";

    QUEUE.push(buildEvent("click", {
      selector: tag + id + cls,
      text:     (el.innerText || "").trim().slice(0, 40),
      href:     el.href || (el.closest && el.closest("a") ? el.closest("a").href : "") || "",
      x_pct:    win.innerWidth > 0
                  ? Math.round((e.clientX / win.innerWidth) * 100) : 0,
      y_pct:    doc.documentElement.scrollHeight > 0
                  ? Math.round((e.clientY / doc.documentElement.scrollHeight) * 100) : 0,
    }));
  }, 200);

  /* ─────────────────────────────────────────────
     4. ADD TO CART
        Analytics → Supabase
        Meta     → AddToCart (value + currency + name)
  ───────────────────────────────────────────── */
  var CART_SELECTORS = [
    ".add-to-cart",
    "[data-action='add-to-cart']",
    ".btn-add-to-cart",
    ".shop-product-buy",
    "button[class*='cart']",
    "a[class*='add-to-cart']",
    ".btn-buy-now",
    ".orderButtonPopup",
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
      var priceEl = doc.querySelector(".price-container #productPrice [data-type='price']");
      name  = nameEl  ? (nameEl.innerText  || "").trim().slice(0, 100) : "";
      price = priceEl ? priceEl.textContent.trim() : "";
    }

    var numPrice = parseFloat(price) || 0;
    var eventID  = makeEventID("atc");

    // Analytics
    QUEUE.push(buildEvent("add_to_cart", {
      product_name:   name,
      product_price:  numPrice,
      button_text:    (btn.innerText || "").trim().slice(0, 60),
      pixel_event_id: eventID,
    }));

    // Meta Pixel
    firePixel("AddToCart", {
      content_name: name,
      currency:     "INR",
      value:        numPrice,
    }, eventID);

    log("AddToCart", name, numPrice);
  }

  /* ─────────────────────────────────────────────
     5. FORM SUBMIT
        Analytics → Supabase
        Meta     → InitiateCheckout (email + phone forms)
                   Lead             (email-only forms)
  ───────────────────────────────────────────── */
  function onFormSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;

    var get = function (sel) {
      var el = form.querySelector(sel);
      return el ? (el.value || "").trim() : "";
    };

    var email = get('[name="email"], [type="email"]');
    var phone = get('[name="phone"], [type="tel"]');
    if (!email && !phone) return;

    var isCheckout = email && phone;
    var eventID    = makeEventID(isCheckout ? "ic" : "lead");

    // Analytics
    QUEUE.push(buildEvent("form_submit", {
      has_email:      Boolean(email),
      has_phone:      Boolean(phone),
      form_id:        form.id || (form.className || "").split(" ")[0] || "unknown",
      lead_score:     isCheckout ? "full" : email ? "email_only" : "phone_only",
      pixel_event_id: eventID,
    }));

    // Meta Pixel
    if (isCheckout) {
      firePixel("InitiateCheckout", {}, eventID);
      log("InitiateCheckout");
    } else {
      firePixel("Lead", {}, eventID);
      log("Lead");
    }
  }

  /* ─────────────────────────────────────────────
     6. SCROLL DEPTH — analytics only
  ───────────────────────────────────────────── */
  var maxScrollPct = 0;
  var onScroll = throttle(function () {
    var scrolled = win.scrollY + win.innerHeight;
    var total    = doc.documentElement.scrollHeight;
    var pct      = total > 0 ? Math.round((scrolled / total) * 100) : 0;

    if (pct > maxScrollPct) {
      maxScrollPct = pct;
      if (maxScrollPct % 25 === 0 && maxScrollPct > 0) {
        QUEUE.push(buildEvent("scroll_depth", { depth_pct: maxScrollPct }));
      }
    }
  }, 300);

  /* ─────────────────────────────────────────────
     7. SESSION TIME — analytics only
  ───────────────────────────────────────────── */
  function onPageHide() {
    QUEUE.push(buildEvent("session_time", { duration_s: SESSION.age() }));
    QUEUE.flushSync();
  }

  /* ─────────────────────────────────────────────
     EVENT DELEGATION
  ───────────────────────────────────────────── */
  function attachListeners() {
    doc.addEventListener("click",  onClickHeatmap, { passive: true });
    doc.addEventListener("click",  onClickCart,    { passive: true });
    doc.addEventListener("submit", onFormSubmit,   { capture: true });
    win.addEventListener("scroll", onScroll,       { passive: true });

    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "hidden") onPageHide();
    });
    win.addEventListener("pagehide", onPageHide);
  }

  /* ─────────────────────────────────────────────
     DYNAMIC DOM WATCHER
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
            }
          });
        });
      }, 400)
    );

    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); }, 15000);
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    trackPurchase();        // thank-you page: analytics + Meta Purchase
    trackPageView();        // all pages: analytics + Meta ViewContent (product pages)
    attachListeners();      // AddToCart, InitiateCheckout, Lead, heatmap, scroll, session
    watchDynamicElements(); // SITE123 late-loaded product sections
    log("HXA v2.0 initialized | session:", SESSION.id());
  }

  function boot() {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", function () {
        win.requestIdleCallback
          ? win.requestIdleCallback(init, { timeout: 2000 })
          : setTimeout(init, 0);
      });
    } else {
      win.requestIdleCallback
        ? win.requestIdleCallback(init, { timeout: 2000 })
        : setTimeout(init, 0);
    }
  }

  boot();

})(window, document);
