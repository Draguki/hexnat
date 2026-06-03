/**
 * HexNeedle Analytics — Tracking Script v3.1
 * ===========================================
 * NEW: utm_content (ad.name) capture, enhanced Add-to-Cart with product URL/image,
 *      full UTM attribution on every event
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
     UTM CAPTURE (v3.1: Now includes utm_content)
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
     EVENT BUILDER (v3.1: Full UTM on every event)
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
     1. PURCHASE
  ───────────────────────────────────────────── */
  function trackPurchase() {
    if (!win.location.href.includes("thank-you")) return;
    if (sessionStorage.getItem("hxa_purchased") === "true") return;

    IDENTITY.get();

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

  /* ─────────────────────────────────────────────
     2. PAGE VIEW + nav_dest tracking
  ───────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────
     3. CLICK HEATMAP
  ───────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────
     4. ADD TO CART (v3.1: Enhanced with URL, image, utm_content)
  ───────────────────────────────────────────── */
  var CART_SELECTORS = [
    ".add-to-cart", "[data-action='add-to-cart']", ".btn-add-to-cart",
    ".shop-product-buy", "button[class*='cart']", "a[class*='add-to-cart']",
    ".btn-buy-now", ".orderButtonPopup", "[aria-label='Add To Cart']",
  ].join(", ");

  function onClickCart(e) {
    var btn = e.target && e.target.closest && e.target.closest(CART_SELECTORS);
    if (!btn) return;

    var container = btn.closest(".shop-product-item") || btn.closest("[class*='product-item']") || btn.closest("[class*='product']") || btn.parentElement;
    var name = "", price = "", productUrl = "", productImage = "";
    
    if (container) {
      var nameEl  = container.querySelector("[class*='name'], [class*='title'], h2, h3");
      var priceEl = doc.querySelector(".price-container #productPrice [data-type='price']");
      var linkEl  = container.querySelector("a[href*='/product'], a[href*='/store']");
      var imgEl   = container.querySelector("img[alt*='product'], img[class*='product']");
      
      name  = nameEl  ? (nameEl.innerText  || "").trim().slice(0, 100) : "";
      price = priceEl ? priceEl.textContent.trim() : "";
      productUrl = linkEl ? linkEl.href : win.location.href;
      productImage = imgEl ? imgEl.src : "";
    }

    var numPrice = parseFloat(price) || 0;
    var eventID  = makeEventID("atc");

    QUEUE.push(buildEvent("add_to_cart", {
      product_name:   name,
      product_price:  numPrice,
      product_url:    productUrl,
      product_image:  productImage,
      button_text:    (btn.innerText || "").trim().slice(0, 60),
      pixel_event_id: eventID,
      utm_content:    UTM.utm_content || null,  // v3.1: Ad name
    }));

    firePixel("AddToCart", { content_name: name, currency: "INR", value: numPrice }, eventID);
  }

  /* ─────────────────────────────────────────────
     5. FORM SUBMIT
  ───────────────────────────────────────────── */
  function onFormSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;

    var hasEmail = false, hasPhone = false, leadScore = "partial";
    var inputs = form.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.type === "email" && inp.value) hasEmail = true;
      if ((inp.type === "tel" || inp.name.includes("phone")) && inp.value) hasPhone = true;
    }
    if (hasEmail && hasPhone) leadScore = "full";

    var eventID = makeEventID("form");
    QUEUE.push(buildEvent("form_submit", {
      has_email:  hasEmail,
      has_phone:  hasPhone,
      form_id:    form.id || null,
      lead_score: leadScore,
      pixel_event_id: eventID,
    }));

    firePixel("Lead", {}, eventID);
  }

  /* ─────────────────────────────────────────────
     6. SESSION TIME
  ───────────────────────────────────────────── */
  var SESSION_START = Date.now();
  function onPageHide() {
    var duration_s = Math.round((Date.now() - SESSION_START) / 1000);
    if (duration_s > 0) {
      QUEUE.push(buildEvent("session_time", { duration_s: duration_s }));
      QUEUE.flushSync();
    }
  }

  /* ─────────────────────────────────────────────
     7. SCROLL DEPTH
  ───────────────────────────────────────────── */
  var maxDepth = 0;
  var onScroll = throttle(function () {
    var scrollHeight = doc.documentElement.scrollHeight - win.innerHeight;
    if (scrollHeight <= 0) return;
    var depth_pct = Math.round((win.scrollY / scrollHeight) * 100);
    if (depth_pct > maxDepth) {
      maxDepth = depth_pct;
      if (depth_pct >= 25 && depth_pct % 25 === 0) {
        QUEUE.push(buildEvent("scroll_depth", { depth_pct: depth_pct }));
      }
    }
  }, 500);

  /* ─────────────────────────────────────────────
     8. DYNAMIC CONTENT LOAD
  ───────────────────────────────────────────── */
  function onDynamicLoad() {
    QUEUE.push(buildEvent("dynamic_load", {}));
  }

  var observer = new MutationObserver(debounce(onDynamicLoad, 1000));
  observer.observe(doc.body, { childList: true, subtree: true });

  /* ─────────────────────────────────────────────
     BOOTSTRAP
  ───────────────────────────────────────────── */
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () {
      trackPageView();
      doc.addEventListener("click", onClickHeatmap, true);
      doc.addEventListener("click", onClickCart, true);
      doc.addEventListener("submit", onFormSubmit, true);
      win.addEventListener("scroll", onScroll, true);
      win.addEventListener("pagehide", onPageHide);
      trackPurchase();
    });
  } else {
    trackPageView();
    doc.addEventListener("click", onClickHeatmap, true);
    doc.addEventListener("click", onClickCart, true);
    doc.addEventListener("submit", onFormSubmit, true);
    win.addEventListener("scroll", onScroll, true);
    win.addEventListener("pagehide", onPageHide);
    trackPurchase();
  }

  // Public API
  win.HexAnalytics = {
    trackEvent: function(type, props) {
      QUEUE.push(buildEvent(type, props));
    },
    setIdentity: function(data) {
      IDENTITY.update(data);
    },
    getSession: function() {
      return { id: SESSION.id(), age: SESSION.age() };
    },
  };

})(window, document);
