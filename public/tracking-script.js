/**
 * HexNeedle Analytics — Tracking Script v3.2 (Optimized)
 * ===========================================
 * Features: 
 *   - Site123 orderData synchronization
 *   - Meta Click ID (_fbc) and Browser ID (_fbp) capture
 *   - Robust Add-to-Cart tracking for Site123
 *   - Non-blocking server-side event dispatch
 */

(function (win, doc) {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  var API_ENDPOINT   = "/api/track"; // Use relative path for stability
  var SITE_ID        = "hexneedle";
  var BATCH_SIZE     = 10;
  var BATCH_INTERVAL = 5000;
  var SESSION_TTL    = 30 * 60 * 1000;
  var PREFIX         = "hxa_";
  var PIXEL_ID       = "4415595052018024";

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function getCookie(name) {
    var value = "; " + doc.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  function safeJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function makeEventID(prefix) {
    return (prefix || "ev") + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
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
     IDENTITY MANAGER (Site123 Integration)
  ───────────────────────────────────────────── */
  var IDENTITY = (function () {
    var KEY = PREFIX + "pii";
    var pii = safeJSON(localStorage.getItem(KEY)) || {};

    function update(newData) {
      var changed = false;
      ['email', 'phone', 'name', 'city', 'state', 'fbclid', 'fbc', 'fbp'].forEach(function(k) {
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
      // Pull from Site123's orderData if available
      var orderData = safeJSON(localStorage.getItem("orderData")) || {};
      var fbclid = new URLSearchParams(win.location.search).get("fbclid");
      
      update({
        email: orderData.email || pii.email,
        phone: orderData.phone || pii.phone,
        name:  orderData.name || orderData.firstName || pii.name,
        city:  orderData.city || pii.city,
        state: orderData.state || pii.state,
        fbclid: fbclid || pii.fbclid,
        fbc:   getCookie("_fbc") || pii.fbc,
        fbp:   getCookie("_fbp") || pii.fbp
      });
    }

    return { 
      get: function() { extractFromStorage(); return pii; }, 
      update: update,
      clear: function() { pii = {}; try { localStorage.removeItem(KEY); } catch (e) {} }
    };
  })();

  /* ─────────────────────────────────────────────
     UTM CAPTURE
  ───────────────────────────────────────────── */
  var UTM = (function () {
    var KEY    = PREFIX + "utm";
    var PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"];

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
      if (fresh.fbclid) IDENTITY.update({ fbclid: fresh.fbclid });
      return fresh;
    }
    return stored;
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
      }).catch(function () {});
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

  /* ─────────────────────────────────────────────
     TRACKING LOGIC
  ───────────────────────────────────────────── */
  function buildEvent(type, props) {
    var identity = IDENTITY.get();
    return Object.assign({
      type:        type,
      site_id:     SITE_ID,
      session_id:  SESSION.id(),
      url:         win.location.href,
      path:        win.location.pathname,
      title:       doc.title,
      ts:          Date.now(),
      utm:         UTM,
      pii:         identity
    }, props || {});
  }

  function trackPageView() {
    QUEUE.push(buildEvent("pageview", { referrer: doc.referrer }));
  }

  function trackPurchase() {
    if (!win.location.href.includes("thank-you") && !win.location.href.includes("confirmation")) return;
    if (sessionStorage.getItem(PREFIX + "purchased") === "true") return;

    var amount    = parseFloat(localStorage.getItem("hexneedle_amount")) || 0;
    var orderRaw  = localStorage.getItem("orderData");
    var orderData = orderRaw ? safeJSON(orderRaw) : {};

    if (amount <= 0 && !orderData.orderID) return;

    var eventID = makeEventID("purchase");
    QUEUE.push(buildEvent("purchase", {
      revenue:        amount,
      currency:       "INR",
      order_id:       orderData.orderID || "order_" + Date.now(),
      pixel_event_id: eventID
    }));
    QUEUE.flushSync();
    sessionStorage.setItem(PREFIX + "purchased", "true");
  }

  var CART_SELECTORS = [
    ".add-to-cart", "[data-action='add-to-cart']", ".btn-add-to-cart",
    ".shop-product-buy", "button[class*='cart']", "a[class*='add-to-cart']",
    ".btn-buy-now", ".orderButtonPopup", "[aria-label='Add To Cart']"
  ].join(", ");

  function onClickCart(e) {
    var btn = e.target && e.target.closest && e.target.closest(CART_SELECTORS);
    if (!btn) return;

    var container = btn.closest(".shop-product-item") || btn.closest("[class*='product-item']") || btn.closest("[class*='product']") || doc;
    var name = "", price = "";
    
    var nameEl  = container.querySelector("[class*='name'], [class*='title'], h2, h3");
    var priceEl = container.querySelector("[data-type='price'], .price, .product-price");
    
    name  = nameEl  ? (nameEl.innerText || "").trim().slice(0, 100) : "Product";
    price = priceEl ? priceEl.innerText.replace(/[^\d.]/g, '') : "0";

    var numPrice = parseFloat(price) || 0;
    var eventID  = makeEventID("atc");

    QUEUE.push(buildEvent("add_to_cart", {
      product_name:   name,
      product_price:  numPrice,
      pixel_event_id: eventID
    }));
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
