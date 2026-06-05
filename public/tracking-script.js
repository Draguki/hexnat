/**
 * HexNeedle Analytics — Tracking Script v3.1
 * ===========================================
 * NEW: Customer identity tracking, SHA256 hashing for Meta CAPI,
 *      Raw PII for internal Supabase analytics, nav_dest tracking,
 *      Live Add-to-Cart synchronization.
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
     v3 IDENTITY MANAGER (Raw PII for Supabase)
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

  /* ─────────────────────────────────────────────
     EVENT BUILDER
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
      session_age: SESSION.age(),
      screen_w:    win.innerWidth || (win.screen && win.screen.width) || 0,
      locale:      navigator.language || "",
      utm:         UTM,
      pii:         identity
    }, props || {});
  }

  /* ─────────────────────────────────────────────
     TRACKING FUNCTIONS
  ───────────────────────────────────────────── */

  function trackPurchase() {
    if (!win.location.href.includes("thank-you")) return;
    if (sessionStorage.getItem("hxa_purchased") === "true") return;

    var amount    = parseFloat(localStorage.getItem("hexneedle_amount")) || 0;
    var orderRaw  = localStorage.getItem("orderData");
    var orderData = orderRaw ? safeJSON(orderRaw) : {};

    if (amount <= 0) return;

    var eventID = makeEventID("purchase");

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

    firePixel("Purchase", { value: amount, currency: "INR" }, eventID);
    sessionStorage.setItem("hxa_purchased", "true");
  }

  function trackPageView() {
    QUEUE.push(buildEvent("pageview", { 
      referrer: doc.referrer,
      nav_dest: win.location.pathname
    }));

    var path = win.location.pathname;
    if (path.includes("/store/") || path.includes("/product")) {
      firePixel("ViewContent", {
        content_name:     doc.title || "",
        content_category: "Product",
        currency:         "INR",
      }, makeEventID("vc"));
    }
  }

  var onClickHeatmap = throttle(function (e) {
    var el = e.target;
    if (!el) return;
    var tag = el.tagName ? el.tagName.toLowerCase() : "";
    var id  = el.id ? "#" + el.id : "";
    var cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";

    var href = el.href || (el.closest && el.closest("a") ? el.closest("a").href : "") || "";
    
    QUEUE.push(buildEvent("click", {
      selector: tag + id + cls,
      text:     (el.innerText || "").trim().slice(0, 40),
      href:     href,
      nav_dest: href ? new URL(href, win.location).pathname : null,
      x_pct:    win.innerWidth > 0 ? Math.round((e.clientX / win.innerWidth) * 100) : 0,
      y_pct:    doc.documentElement.scrollHeight > 0 ? Math.round((e.clientY / doc.documentElement.scrollHeight) * 100) : 0,
    }));
  }, 200);

  var CART_SELECTORS = [
    ".add-to-cart", "[data-action='add-to-cart']", ".btn-add-to-cart",
    ".shop-product-buy", "button[class*='cart']", "a[class*='add-to-cart']",
    ".btn-buy-now", ".orderButtonPopup", "[aria-label='Add To Cart']",
  ].join(", ");

  function onClickCart(e) {
    var btn = e.target && e.target.closest && e.target.closest(CART_SELECTORS);
    if (!btn) return;

    var container = btn.closest(".shop-product-item") || btn.closest("[class*='product-item']") || btn.closest("[class*='product']") || btn.parentElement;
    var name = "", price = "";
    
    if (container) {
      var nameEl  = container.querySelector("[class*='name'], [class*='title'], h2, h3");
      var priceEl = doc.querySelector(".price-container #productPrice [data-type='price']");
      name  = nameEl  ? (nameEl.innerText  || "").trim().slice(0, 100) : "";
      price = priceEl ? priceEl.textContent.trim() : "";
    }

    var numPrice = parseFloat(price) || 0;
    var eventID  = makeEventID("atc");

    QUEUE.push(buildEvent("add_to_cart", {
      product_name:   name,
      product_price:  numPrice,
      button_text:    (btn.innerText || "").trim().slice(0, 60),
      pixel_event_id: eventID,
    }));

    firePixel("AddToCart", { content_name: name, currency: "INR", value: numPrice }, eventID);
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    trackPageView();
    trackPurchase();
    doc.addEventListener("click", onClickHeatmap, true);
    doc.addEventListener("click", onClickCart, true);
    
    win.addEventListener("beforeunload", function () { QUEUE.flushSync(); });
  }

  if (doc.readyState === "complete") init();
  else win.addEventListener("load", init);

})(window, document);
