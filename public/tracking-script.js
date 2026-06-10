/**
 * HexNeedle Analytics — Tracking Script v3.1 (Multi-page Fix)
 * ==========================================================
 * Features:
 *   - Enhanced selector logic for multi-page support
 *   - Robust product name extraction for all shirt types
 *   - Customer identity tracking & Meta CAPI integration
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
  var PIXEL_ID       = "4415595052018024";

  /* ─────────────────────────────────────────────
     CRYPTO: SHA256 for Meta CAPI hashing
  ───────────────────────────────────────────── */
  function sha256Hash(str) {
    if (!str) return null;
    if (win.crypto && win.crypto.subtle) {
      var encoder = new TextEncoder();
      return win.crypto.subtle.digest("SHA-256", encoder.encode(str))
        .then(function(hashBuffer) {
          var hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(function(b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        })
        .catch(function() { return null; });
    }
    return Promise.resolve(simpleHash(str));
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /* ─────────────────────────────────────────────
     META PIXEL HELPER
  ───────────────────────────────────────────── */
  function firePixel(eventName, params, eventID) {
    if (typeof win.fbq !== "function") return;
    var options = eventID ? { eventID: eventID } : {};
    try {
      win.fbq("trackSingle", PIXEL_ID, eventName, params || {}, options);
    } catch (e) {}
  }

  function makeEventID(prefix) {
    return (prefix || "ev") + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
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
     IDENTITY MANAGER
  ───────────────────────────────────────────── */
  var IDENTITY = (function () {
    var KEY = PREFIX + "pii";
    var pii = safeJSON(localStorage.getItem(KEY)) || {};

    function update(newData) {
      var changed = false;
      ['email', 'phone', 'name', 'city', 'state', 'fbclid'].forEach(function(k) {
        if (newData[k] && newData[k] !== pii[k]) { 
          pii[k] = newData[k]; 
          changed = true; 
        }
      });
      if (changed) {
        try { localStorage.setItem(KEY, JSON.stringify(pii)); } catch (e) {}
      }
    }

    function extractFromStorage() {
      var orderData = safeJSON(localStorage.getItem("orderData")) || {};
      update({
        email: orderData.email || pii.email,
        phone: orderData.phone || pii.phone,
        name:  orderData.name || orderData.firstName || pii.name,
        city:  orderData.city || pii.city,
        state: orderData.state || pii.state
      });
    }

    return { 
      get: function() { extractFromStorage(); return pii; }, 
      update: update
    };
  })();

  /* ─────────────────────────────────────────────
     EVENT QUEUE
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
      }).catch(function () {
        Array.prototype.push.apply(queue, batch);
      });
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(function() { flush(false); }, BATCH_INTERVAL);
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

  function buildEvent(type, props) {
    return Object.assign({
      type:        type,
      site_id:     SITE_ID,
      session_id:  SESSION.id(),
      url:         win.location.href,
      path:        win.location.pathname,
      title:       doc.title,
      ts:          Date.now(),
      pii:         IDENTITY.get()
    }, props || {});
  }

  /* ─────────────────────────────────────────────
     TRACKING
  ───────────────────────────────────────────── */
  function trackPurchase() {
    if (!win.location.href.includes("thank-you")) return;
    var amount = parseFloat(localStorage.getItem("hexneedle_amount")) || 0;
    if (amount <= 0) return;

    var eventID = makeEventID("purchase");
    QUEUE.push(buildEvent("purchase", { revenue: amount, currency: "INR", pixel_event_id: eventID }));
    firePixel("Purchase", { value: amount, currency: "INR" }, eventID);
  }

  function trackPageView() {
    QUEUE.push(buildEvent("pageview"));
    if (win.location.pathname.includes("/store/")) {
      firePixel("ViewContent", { content_name: doc.title, currency: "INR" }, makeEventID("vc"));
    }
  }

  function onClickCart(e) {
    var btn = e.target.closest(".btn-buy-now, .orderButtonPopup, .add-to-cart, [data-action='add-to-cart']");
    if (!btn) return;

    // 1. Try to find name in the product page H1 first (most reliable for product pages)
    var name = (doc.querySelector("h1") || doc.querySelector(".product-name") || {}).innerText;
    
    // 2. If not found, look in the container (for home page/grid view)
    if (!name) {
      var container = btn.closest(".shop-product-item") || btn.closest("[class*='product']");
      if (container) {
        var nameEl = container.querySelector("[class*='name'], [class*='title'], h2, h3");
        name = nameEl ? nameEl.innerText : "";
      }
    }

    // 3. Fallback
    name = (name || "Product").trim().slice(0, 100);

    // Price extraction
    var priceEl = doc.querySelector(".price-container [data-type='price']") || doc.querySelector("[data-type='price']");
    var price = priceEl ? parseFloat(priceEl.innerText.replace(/[^\d.]/g, "")) : 0;

    var eventID = makeEventID("atc");
    QUEUE.push(buildEvent("add_to_cart", { product_name: name, product_price: price, pixel_event_id: eventID }));
    firePixel("AddToCart", { content_name: name, currency: "INR", value: price }, eventID);
  }

  function init() {
    trackPageView();
    trackPurchase();
    doc.addEventListener("click", onClickCart, true);
    win.addEventListener("beforeunload", function () { QUEUE.flushSync(); });
  }

  if (doc.readyState === "complete") init();
  else win.addEventListener("load", init);

})(window, document);
