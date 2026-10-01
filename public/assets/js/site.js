(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
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
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';

  function render(c) {
    // simple text bindings
    $$("[data-bind]").forEach(function (n) {
      var v = get(c, n.getAttribute("data-bind"));
      if (typeof v === "string") n.textContent = v;
    });
    if (c.site.seoTitle) document.title = c.site.seoTitle;
    var md = $('meta[name="description"]');
    if (md && c.site.seoDescription) md.setAttribute("content", c.site.seoDescription);

    // links
    var mail = "mailto:" + (c.site.email || "");
    $("#heroMail").href = mail; $("#contactMail").href = mail;
    $("#heroInsta").href = c.site.instagramUrl || "#"; $("#contactInsta").href = c.site.instagramUrl || "#";
    $("#heroMail").hidden = $("#contactMail").hidden = !c.site.email;
    $("#heroInsta").hidden = $("#contactInsta").hidden = !c.site.instagramHandle;
    $(".intro").hidden = !c.site.intro;

    // hero + about photos
    var hero = $("#heroImg");
    if (c.hero.image && hero.getAttribute("src") !== c.hero.image) hero.src = c.hero.image;
    hero.alt = c.hero.imageAlt || "";
    hero.style.objectPosition = c.hero.focus || "50% 40%";
    var about = $("#aboutImg");
    if (c.about.image) about.src = c.about.image;
    about.alt = c.about.imageAlt || "";
    $(".about-photo").hidden = !c.about.image;

    var ul = $("#aboutBullets"); ul.innerHTML = "";
    (c.about.bullets || []).filter(Boolean).forEach(function (b) { ul.appendChild(el("li", {}, [el("span", { text: b })])); });

    // brands
    var brands = (c.brands.items || []).filter(Boolean);
    $("#brands").hidden = brands.length === 0;
    var bl = $("#brandList"); bl.innerHTML = "";
    brands.forEach(function (b) { bl.appendChild(el("span", { text: b })); });

    renderPortfolio(c.portfolio);
    renderGallery("#photography", "#photoGallery", c.photography.items || []);
    renderGallery("#ugc-photo", "#ugcGallery", c.ugcPhotos.items || []);
    var hasPhotos = (c.photography.items || []).length || (c.ugcPhotos.items || []).length;
    $$('[data-section-link="photography"]').forEach(function (a) {
      a.hidden = !hasPhotos;
      a.setAttribute("href", (c.photography.items || []).length ? "#photography" : "#ugc-photo");
    });

    // contact
    var cp = $("#contactPhoto");
    if (c.contact.image) {
      cp.hidden = false; $("img", cp).src = c.contact.image; $("img", cp).alt = c.contact.imageAlt || "";
      $("#contactGrid").classList.add("with-photo");
    } else {
      cp.hidden = true; $("#contactGrid").classList.remove("with-photo");
    }
    observeReveals();
  }

  // ---------- portfolio ----------
  var portfolioState = { items: [], filter: null };

  function renderPortfolio(p) {
    portfolioState.items = p.items || [];
    var used = (p.categories || []).filter(function (cat) {
      return portfolioState.items.some(function (it) { return it.category === cat; });
    });
    var filters = $("#filters"); filters.innerHTML = "";
    filters.hidden = used.length < 2;
    if (used.indexOf(portfolioState.filter) === -1) portfolioState.filter = used[0] || null;
    used.forEach(function (cat) {
      var b = el("button", { class: "filter-btn", role: "tab", type: "button", "aria-selected": String(cat === portfolioState.filter), text: cat });
      b.addEventListener("click", function () {
        portfolioState.filter = cat;
        $$(".filter-btn", filters).forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        drawRail(p);
      });
      filters.appendChild(b);
    });
    drawRail(p);
  }

  function drawRail(p) {
    var rail = $("#videoRail"); rail.innerHTML = "";
    var old = $(".empty-note"); if (old) old.remove();
    var list = portfolioState.items.filter(function (it) { return !portfolioState.filter || it.category === portfolioState.filter; });

    if (!list.length) {
      ["Coming", "soon", "✦"].forEach(function (word) {
        rail.appendChild(el("div", { class: "v-card placeholder", "aria-hidden": "true" }, [
          el("div", { class: "v-frame" }, [el("span", { class: "placeholder-mark", text: word })])
        ]));
      });
      rail.classList.add("centered");
      rail.parentNode.appendChild(el("p", { class: "empty-note", text: p.emptyText || "" }));
      $("#railControls").hidden = true;
      return;
    }

    list.forEach(function (it) {
      var video = el("video", { src: it.poster ? it.src : it.src + "#t=0.1", preload: "metadata", playsinline: "", loop: "" });
      if (it.poster) video.setAttribute("poster", it.poster);
      video.muted = false;
      var btn = el("button", { class: "v-play", type: "button", "aria-label": "Play video: " + (it.title || ""), html: PLAY });
      var frame = el("div", { class: "v-frame" }, [video, btn]);
      frame.addEventListener("click", function () { toggle(video, frame, btn); });
      video.addEventListener("ended", function () { frame.classList.remove("playing"); btn.innerHTML = PLAY; });
      rail.appendChild(el("article", { class: "v-card" }, [
        frame,
        el("div", { class: "v-info" }, [
          it.title ? el("h3", { class: "v-title", text: it.title }) : null,
          it.brand ? el("span", { class: "v-brand", text: it.brand }) : null
        ])
      ]));
    });
    var fits = window.innerWidth < 900 ? 1 : 3;
    rail.classList.toggle("centered", list.length <= fits);
    $("#railControls").hidden = list.length <= fits;
    rail.scrollLeft = 0;
  }

  function toggle(video, frame, btn) {
    if (video.paused) {
      $$("#videoRail video").forEach(function (v) {
        if (v !== video && !v.paused) {
          v.pause(); var f = v.parentNode; f.classList.remove("playing"); $(".v-play", f).innerHTML = PLAY;
        }
      });
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () { video.muted = true; video.play(); });
      frame.classList.add("playing"); btn.innerHTML = PAUSE; btn.setAttribute("aria-label", "Pause video");
    } else {
      video.pause(); frame.classList.remove("playing"); btn.innerHTML = PLAY; btn.setAttribute("aria-label", "Play video");
    }
  }

  $$("#railControls .round-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var rail = $("#videoRail");
      rail.scrollBy({ left: Number(b.getAttribute("data-dir")) * Math.max(rail.clientWidth * 0.8, 260), behavior: "smooth" });
    });
  });

  // ---------- galleries + lightbox ----------
  var lb = { list: [], i: 0 };
  function renderGallery(sectionSel, gridSel, items) {
    var section = $(sectionSel), grid = $(gridSel);
    grid.innerHTML = "";
    section.hidden = items.length === 0;
    var cols = Math.min(3, Math.max(1, items.length));
    grid.style.columnCount = window.innerWidth < 480 ? Math.min(2, cols) : cols;
    grid.style.maxWidth = cols < 3 ? (cols * 380) + "px" : "";
    items.forEach(function (it, i) {
      var b = el("button", { type: "button", "aria-label": "Open photo" + (it.alt ? ": " + it.alt : "") }, [
        el("img", { src: it.src, alt: it.alt || "", loading: "lazy" })
      ]);
      b.addEventListener("click", function () { openLb(items, i); });
      grid.appendChild(b);
    });
  }
  var box = $("#lightbox");
  function showLb() { var it = lb.list[lb.i]; $("img", box).src = it.src; $("img", box).alt = it.alt || ""; $$(".lb-nav", box).forEach(function (n) { n.hidden = lb.list.length < 2; }); }
  function openLb(list, i) { lb.list = list; lb.i = i; showLb(); box.hidden = false; document.body.style.overflow = "hidden"; $(".lb-close", box).focus(); }
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

  // ---------- nav ----------
  var nav = $("#nav"), burger = $("#burger"), menu = $("#mobileMenu");
  window.addEventListener("scroll", function () { nav.classList.toggle("scrolled", window.scrollY > 30); }, { passive: true });
  function setMenu(open) {
    menu.hidden = !open; burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", function () { setMenu(menu.hidden); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });

  // ---------- reveal on scroll ----------
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function observeReveals() {
    $$(".reveal:not(.visible)").forEach(function (n) { if (io) io.observe(n); else n.classList.add("visible"); });
  }

  $("#year").textContent = new Date().getFullYear();

  fetch("/api/content", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function () { observeReveals(); $(".intro").hidden = true; renderPortfolio({ items: [], categories: [] }); });
})();
