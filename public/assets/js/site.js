(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  var ICON_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/></svg>';
  var ICON_INSTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="3.8"/><circle class="dot" cx="16.9" cy="7.1" r="1.05"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M6 3.5v17l15-8.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  function pills(c) {
    var out = [];
    if (c.site.email) out.push(el("a", { class: "pill", href: "mailto:" + c.site.email }, [
      el("span", { class: "pill-icon", html: ICON_MAIL }), el("span", { text: c.site.email })
    ]));
    if (c.site.instagramHandle) out.push(el("a", { class: "pill", href: c.site.instagramUrl || "#", target: "_blank", rel: "noopener" }, [
      el("span", { class: "pill-icon", html: ICON_INSTA }), el("span", { text: c.site.instagramHandle })
    ]));
    return out;
  }
  function fill(node, children) { node.innerHTML = ""; children.forEach(function (c) { node.appendChild(c); }); }

  function render(c) {
    $$("[data-bind]").forEach(function (n) {
      var v = get(c, n.getAttribute("data-bind"));
      if (typeof v === "string") n.textContent = v;
    });
    if (c.site.seoTitle) document.title = c.site.seoTitle;
    var md = $('meta[name="description"]');
    if (md && c.site.seoDescription) md.setAttribute("content", c.site.seoDescription);

    var hero = $("#heroImg");
    if (c.hero.image && hero.getAttribute("src") !== c.hero.image) hero.src = c.hero.image;
    hero.alt = c.hero.imageAlt || "";
    hero.style.objectPosition = c.hero.focus || "40% 30%";

    fill($("#aboutBullets"), (c.about.bullets || []).filter(Boolean).map(function (b) { return el("li", {}, [el("span", { text: b })]); }));
    fill($("#heroPills"), pills(c));
    fill($("#contactPills"), pills(c));

    var brands = ((c.brands && c.brands.items) || []).filter(Boolean);
    $("#brands").hidden = !brands.length;
    fill($("#brandList"), brands.map(function (b) { return el("span", { text: b }); }));

    videos.setup(c.portfolio);
    photos.setup(c.photography);

    var cp = $("#contactPhoto");
    cp.hidden = !c.contact.image;
    $(".contact-card").classList.toggle("no-photo", !c.contact.image);
    if (c.contact.image) { $("img", cp).src = c.contact.image; $("img", cp).alt = c.contact.imageAlt || ""; }
  }

  // ---------- filtered sections (videos + photos share the same logic) ----------
  function FilteredSection(opts) {
    var state = { data: null, filter: null };
    function setup(data) {
      state.data = data;
      var items = data.items || [];
      var cats = (data.categories || []).filter(function (cat) { return items.some(function (it) { return it.category === cat; }); });
      var filters = $(opts.filters);
      var showAll = !items.length; // nothing uploaded yet: show categories as in the mockup
      var list = showAll ? (data.categories || []) : cats;
      if (list.indexOf(state.filter) === -1) state.filter = showAll ? null : list[0] || null;
      filters.classList.toggle("static", showAll);
      filters.hidden = !list.length;
      fill(filters, list.map(function (cat) {
        var b = el("button", { class: "filter-btn", type: "button", role: "tab", "aria-selected": String(cat === state.filter), text: cat });
        if (!showAll) b.addEventListener("click", function () {
          state.filter = cat;
          $$(".filter-btn", filters).forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
          draw();
        });
        else b.setAttribute("tabindex", "-1");
        return b;
      }));
      draw();
    }
    function draw() {
      var items = (state.data.items || []).filter(function (it) { return !state.filter || it.category === state.filter; });
      var grid = $(opts.grid), note = $(opts.empty);
      if (!(state.data.items || []).length) {
        fill(grid, opts.placeholders());
        note.textContent = state.data.emptyText || ""; note.hidden = !state.data.emptyText;
        return;
      }
      note.hidden = true;
      fill(grid, items.map(opts.card));
    }
    return { setup: setup, items: function () { return (state.data.items || []).filter(function (it) { return !state.filter || it.category === state.filter; }); } };
  }

  var videos = FilteredSection({
    filters: "#videoFilters", grid: "#videoGrid", empty: "#videoEmpty",
    placeholders: function () {
      return ["Coming", "soon", "", ""].map(function (w) {
        return el("div", { class: "v-card placeholder", "aria-hidden": "true" }, [el("div", { class: "v-frame" }, [w ? el("span", { class: "placeholder-mark", text: w }) : null])]);
      });
    },
    card: function (it) {
      var video = el("video", { src: it.poster ? it.src : it.src + "#t=0.1", preload: "metadata", playsinline: "", loop: "" });
      if (it.poster) video.setAttribute("poster", it.poster);
      var btn = el("button", { class: "v-play", type: "button", "aria-label": "Play video" + (it.title ? ": " + it.title : ""), html: PLAY });
      var frame = el("div", { class: "v-frame" }, [video, btn]);
      frame.addEventListener("click", function () { toggle(video, frame, btn); });
      video.addEventListener("ended", function () { frame.classList.remove("playing"); btn.innerHTML = PLAY; });
      return el("article", { class: "v-card" }, [frame, (it.title || it.brand) ? el("div", { class: "v-info" }, [
        it.title ? el("h3", { class: "v-title", text: it.title }) : null,
        it.brand ? el("span", { class: "v-brand", text: it.brand }) : null
      ]) : null]);
    }
  });

  function toggle(video, frame, btn) {
    if (video.paused) {
      $$("#videoGrid video").forEach(function (v) {
        if (v !== video && !v.paused) { v.pause(); v.parentNode.classList.remove("playing"); $(".v-play", v.parentNode).innerHTML = PLAY; }
      });
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () { video.muted = true; video.play(); });
      frame.classList.add("playing"); btn.innerHTML = PAUSE; btn.setAttribute("aria-label", "Pause video");
    } else {
      video.pause(); frame.classList.remove("playing"); btn.innerHTML = PLAY; btn.setAttribute("aria-label", "Play video");
    }
  }

  var photos = FilteredSection({
    filters: "#photoFilters", grid: "#photoGrid", empty: "#photoEmpty",
    placeholders: function () {
      return ["", "", "soon", "", ""].map(function (w) {
        return el("div", { class: "photo-tile placeholder", "aria-hidden": "true" }, [w ? el("span", { text: w }) : null]);
      });
    },
    card: function (it) {
      var b = el("button", { class: "photo-tile", type: "button", "aria-label": "Open photo" + (it.alt ? ": " + it.alt : "") }, [
        el("img", { src: it.src, alt: it.alt || "", loading: "lazy" })
      ]);
      b.addEventListener("click", function () { var list = photos.items(); openLb(list, list.indexOf(it)); });
      return b;
    }
  });

  // ---------- lightbox ----------
  var lb = { list: [], i: 0 }, box = $("#lightbox");
  function showLb() { var it = lb.list[lb.i]; $("img", box).src = it.src; $("img", box).alt = it.alt || ""; $$(".lb-nav", box).forEach(function (n) { n.hidden = lb.list.length < 2; }); }
  function openLb(list, i) { lb.list = list; lb.i = Math.max(0, i); showLb(); box.hidden = false; document.body.style.overflow = "hidden"; $(".lb-close", box).focus(); }
  function closeLb() { box.hidden = true; document.body.style.overflow = ""; }
  function stepLb(d) { lb.i = (lb.i + d + lb.list.length) % lb.list.length; showLb(); }
  $(".lb-close", box).addEventListener("click", closeLb);
  $(".lb-nav.prev", box).addEventListener("click", function () { stepLb(-1); });
  $(".lb-nav.next", box).addEventListener("click", function () { stepLb(1); });
  box.addEventListener("click", function (e) { if (e.target === box) closeLb(); });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") stepLb(-1);
    if (e.key === "ArrowRight") stepLb(1);
  });

  // ---------- mobile menu ----------
  var burger = $("#burger"), menu = $("#mobileMenu");
  function setMenu(open) {
    menu.hidden = !open; burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", function () { setMenu(menu.hidden); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });

  $("#year").textContent = new Date().getFullYear();

  fetch("/api/content", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function () { /* API unreachable: the static markup stays visible */ });
})();
