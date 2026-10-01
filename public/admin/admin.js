(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var content = null;
  var saveTimer = null, saving = false, pendingSave = false;

  // ---------- helpers ----------
  function get(path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, content); }
  function set(path, value) {
    var keys = path.split("."), last = keys.pop();
    var obj = keys.reduce(function (o, k) { if (o[k] == null) o[k] = {}; return o[k]; }, content);
    obj[last] = value;
  }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(msg, isError) {
    var t = $("#toast"); t.textContent = msg; t.className = "toast" + (isError ? " error" : ""); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, isError ? 6000 : 2500);
  }
  function api(method, url, body) {
    return fetch(url, {
      method: method, credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && url !== "/api/session") { showLogin(); throw new Error("Сессия истекла, войдите снова"); }
        if (!r.ok) throw new Error(data.error || ("Ошибка " + r.status));
        return data;
      });
    });
  }

  // ---------- save ----------
  function setState(text, cls) { var s = $("#saveState"); s.textContent = text; s.className = "save-state" + (cls ? " " + cls : ""); }
  function scheduleSave() {
    setState("Есть несохранённые изменения…", "saving");
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (saving) { pendingSave = true; return Promise.resolve(); }
    saving = true; setState("Сохраняю…", "saving");
    return api("PUT", "/api/content", content).then(function (saved) {
      content.updatedAt = saved.updatedAt;
      setState("Сохранено " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    }).catch(function (e) {
      setState("Не сохранено: " + e.message, "error");
    }).then(function () {
      saving = false;
      if (pendingSave) { pendingSave = false; saveNow(); }
    });
  }
  window.addEventListener("beforeunload", function (e) {
    if (saveTimer && $("#saveState").classList.contains("saving")) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- media ----------
  function isStored(url) { return typeof url === "string" && url.indexOf("/media/") === 0; }
  function deleteMedia(url) {
    if (!isStored(url)) return Promise.resolve();
    return api("DELETE", "/api/media?key=" + encodeURIComponent(url.slice(7))).catch(function () {});
  }

  function uploadBlob(blob, name, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media");
      xhr.setRequestHeader("content-type", blob.type);
      xhr.setRequestHeader("x-file-name", encodeURIComponent(name).replace(/%/g, ""));
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = function () {
        var data = {}; try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status === 401) { showLogin(); return reject(new Error("Сессия истекла")); }
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error || ("Ошибка " + xhr.status)));
      };
      xhr.onerror = function () { reject(new Error("Сеть недоступна")); };
      xhr.send(blob);
    });
  }

  // Resize big photos in the browser before upload (keeps the site fast).
  function prepareImage(file) {
    var type = (file.type || "").toLowerCase();
    if (!/^image\/(jpeg|png|webp|avif)$/.test(type)) {
      return Promise.reject(new Error(file.name + ": формат не поддерживается. Нужен JPG, PNG или WebP"));
    }
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      var max = 2200, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.86); });
    }).catch(function () { return file; });
  }

  // Grab a frame from the video to use as its poster.
  function makePoster(file) {
    return new Promise(function (resolve) {
      var v = document.createElement("video"), url = URL.createObjectURL(file), done = false;
      function finish(b) { if (done) return; done = true; URL.revokeObjectURL(url); resolve(b); }
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      v.addEventListener("loadeddata", function () { v.currentTime = Math.min(0.8, (v.duration || 1) / 3); });
      v.addEventListener("seeked", function () {
        var w = Math.min(720, v.videoWidth || 720), h = Math.round(w * (v.videoHeight / v.videoWidth || 16 / 9));
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        try { c.getContext("2d").drawImage(v, 0, 0, w, h); c.toBlob(finish, "image/jpeg", 0.82); } catch (e) { finish(null); }
      });
      v.addEventListener("error", function () { finish(null); });
      setTimeout(function () { finish(null); }, 15000);
    });
  }

  function progressRow(container, name) {
    var bar = el("i"), row = el("div", { class: "upload-row" }, [el("span", { class: "name", text: name }), el("div", { class: "bar" }, [bar])]);
    container.appendChild(row);
    return {
      set: function (p) { bar.style.width = Math.round(p * 100) + "%"; },
      fail: function (msg) { row.classList.add("failed"); row.firstChild.textContent = name + " — " + msg; setTimeout(function () { row.remove(); }, 8000); },
      done: function () { row.remove(); }
    };
  }

  function uploadImageFile(file, rowsEl) {
    var row = progressRow(rowsEl, file.name);
    return prepareImage(file).then(function (blob) {
      return uploadBlob(blob, file.name, row.set);
    }).then(function (res) { row.done(); return res.url; }, function (e) { row.fail(e.message); throw e; });
  }

  // ---------- simple bindings ----------
  function bindFields() {
    $$("[data-field]").forEach(function (n) {
      var path = n.getAttribute("data-field");
      n.value = get(path) == null ? "" : get(path);
      n.oninput = function () { set(path, n.value); scheduleSave(); };
    });
    $$("[data-lines]").forEach(function (n) {
      var path = n.getAttribute("data-lines");
      n.value = (get(path) || []).join("\n");
      n.oninput = function () { set(path, n.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean)); scheduleSave(); };
    });
    var pcats = $("#photoCategoriesInput");
    pcats.value = (content.photography.categories || []).join(", ");
    pcats.onchange = function () {
      var list = pcats.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      content.photography.categories = list.filter(function (c, i) { return list.indexOf(c) === i; });
      pcats.value = content.photography.categories.join(", ");
      renderAllGalleries(); scheduleSave();
    };
    var cats = $("#categoriesInput");
    cats.value = (content.portfolio.categories || []).join(", ");
    cats.onchange = function () {
      var list = cats.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      content.portfolio.categories = list.filter(function (c, i) { return list.indexOf(c) === i; });
      cats.value = content.portfolio.categories.join(", ");
      renderVideos(); scheduleSave();
    };
  }

  // ---------- single image fields ----------
  function renderImageFields() {
    $$(".image-field").forEach(function (box) {
      var path = box.getAttribute("data-image"), altPath = box.getAttribute("data-alt");
      var optional = box.hasAttribute("data-optional");
      box.classList.toggle("wide", box.hasAttribute("data-wide"));
      box.innerHTML = "";
      var src = get(path);
      var thumb = el("div", { class: "thumb" }, [src ? el("img", { src: src, alt: "" }) : el("span", { text: "Фото не выбрано" })]);
      var rows = el("div", { class: "uploads" });
      var input = el("input", { type: "file", accept: "image/*", hidden: "" });
      input.onchange = function () {
        var f = input.files[0]; input.value = ""; if (!f) return;
        uploadImageFile(f, rows).then(function (url) {
          var old = get(path); set(path, url); deleteMedia(old); renderImageFields(); saveNow(); toast("Фото заменено");
        }).catch(function (e) { toast(e.message, true); });
      };
      var alt = el("input", { value: get(altPath) || "", placeholder: "Например: Даша в бежевом кардигане" });
      alt.oninput = function () { set(altPath, alt.value); scheduleSave(); };
      var actions = el("div", { class: "row" }, [
        el("label", { class: "btn primary" }, [document.createTextNode(src ? "Заменить фото" : "Загрузить фото"), input]),
        optional && src ? el("button", { class: "btn danger", type: "button", text: "Убрать", onclick: function () {
          if (!confirm("Убрать фото из этого блока?")) return;
          var old = get(path); set(path, ""); deleteMedia(old); renderImageFields(); saveNow();
        } }) : null
      ]);
      box.appendChild(thumb);
      box.appendChild(el("div", { class: "image-actions" }, [
        actions, rows,
        el("label", { class: "field" }, [el("span", { text: "Описание фото (для незрячих и поисковиков)" }), alt])
      ]));
    });
  }

  // ---------- list tools ----------
  function moveTools(list, i, rerender) {
    function move(d) {
      var j = i + d; if (j < 0 || j >= list.length) return;
      var t = list[i]; list[i] = list[j]; list[j] = t; rerender(); scheduleSave();
    }
    return [
      el("button", { class: "btn icon", type: "button", title: "Выше", "aria-label": "Переместить выше", text: "↑", onclick: function () { move(-1); } }),
      el("button", { class: "btn icon", type: "button", title: "Ниже", "aria-label": "Переместить ниже", text: "↓", onclick: function () { move(1); } })
    ];
  }

  // ---------- videos ----------
  function renderVideos() {
    var listEl = $("#videoList"), items = content.portfolio.items;
    listEl.innerHTML = "";
    if (!items.length) { listEl.appendChild(el("div", { class: "empty", text: "Видео пока нет. Нажмите «Добавить видео»." })); return; }
    items.forEach(function (it, i) {
      var video = el("video", { src: it.poster ? it.src : it.src + "#t=0.1", preload: "metadata", muted: "", playsinline: "" });
      if (it.poster) video.setAttribute("poster", it.poster);
      video.onmouseenter = function () { video.muted = true; video.play().catch(function () {}); };
      video.onmouseleave = function () { video.pause(); };

      function input(field, ph) {
        var n = el("input", { value: it[field] || "", placeholder: ph });
        n.oninput = function () { it[field] = n.value; scheduleSave(); };
        return n;
      }
      var cat = el("select");
      var cats = content.portfolio.categories.slice();
      if (it.category && cats.indexOf(it.category) === -1) cats.push(it.category);
      cats.forEach(function (c) { cat.appendChild(el("option", { value: c, text: c })); });
      cat.value = it.category || cats[0] || "";
      cat.onchange = function () { it.category = cat.value; scheduleSave(); };

      var posterInput = el("input", { type: "file", accept: "image/*", hidden: "" });
      var rows = el("div", { class: "uploads" });
      posterInput.onchange = function () {
        var f = posterInput.files[0]; posterInput.value = ""; if (!f) return;
        uploadImageFile(f, rows).then(function (url) { var old = it.poster; it.poster = url; deleteMedia(old); renderVideos(); saveNow(); })
          .catch(function (e) { toast(e.message, true); });
      };

      listEl.appendChild(el("div", { class: "item" }, [
        el("div", { class: "thumb" }, [video]),
        el("div", { class: "item-fields" }, [
          el("div", { class: "grid3" }, [
            el("label", { class: "field" }, [el("span", { text: "Название" }), input("title", "Например: Product demo")]),
            el("label", { class: "field" }, [el("span", { text: "Бренд" }), input("brand", "Например: L'Oréal")]),
            el("label", { class: "field" }, [el("span", { text: "Категория" }), cat])
          ]),
          el("div", { class: "row" }, [el("label", { class: "btn ghost" }, [document.createTextNode("Сменить обложку"), posterInput])]),
          rows
        ]),
        el("div", { class: "item-tools" }, moveTools(items, i, renderVideos).concat([
          el("button", { class: "btn icon danger", type: "button", title: "Удалить", "aria-label": "Удалить видео", text: "✕", onclick: function () {
            if (!confirm("Удалить это видео с сайта и из хранилища?")) return;
            items.splice(i, 1); deleteMedia(it.src); deleteMedia(it.poster); renderVideos(); saveNow(); toast("Видео удалено");
          } })
        ]))
      ]));
    });
  }

  $("#videoInput").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files); e.target.value = "";
    var rowsEl = $("#videoUploads");
    files.reduce(function (chain, file) {
      return chain.then(function () {
        if (file.size > 95 * 1024 * 1024) { toast(file.name + ": больше 95 МБ — сожмите видео", true); return; }
        var row = progressRow(rowsEl, file.name);
        var type = file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4");
        var blob = file.type ? file : new Blob([file], { type: type });
        return makePoster(file).then(function (posterBlob) {
          return uploadBlob(blob, file.name, function (p) { row.set(p * 0.95); }).then(function (vid) {
            var posterUp = posterBlob ? uploadBlob(posterBlob, file.name + "-poster").then(function (r) { return r.url; }).catch(function () { return ""; }) : Promise.resolve("");
            return posterUp.then(function (posterUrl) {
              content.portfolio.items.unshift({
                id: uid(), type: "video", src: vid.url, poster: posterUrl,
                title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), brand: "",
                category: content.portfolio.categories[0] || ""
              });
              row.done(); renderVideos(); return saveNow();
            });
          });
        }).catch(function (err) { row.fail(err.message); });
      });
    }, Promise.resolve()).then(function () { if (files.length) toast("Загрузка завершена"); });
  });

  // ---------- photo gallery ----------
  function categorySelect(it, cats, onchange) {
    var list = cats.slice();
    if (it.category && list.indexOf(it.category) === -1) list.push(it.category);
    var sel = el("select");
    list.forEach(function (c) { sel.appendChild(el("option", { value: c, text: c })); });
    if (!it.category && list[0]) it.category = list[0];
    sel.value = it.category || "";
    sel.onchange = function () { it.category = sel.value; onchange(); };
    return sel;
  }

  function renderGallery(card) {
    var key = card.getAttribute("data-gallery"), items = content[key].items, listEl = $(".items", card);
    listEl.innerHTML = "";
    if (!items.length) { listEl.appendChild(el("div", { class: "empty", text: "Фото пока нет. На сайте показываются заглушки." })); return; }
    items.forEach(function (it, i) {
      var alt = el("input", { value: it.alt || "", placeholder: "Что на фото" });
      alt.oninput = function () { it.alt = alt.value; scheduleSave(); };
      listEl.appendChild(el("div", { class: "item" }, [
        el("div", { class: "thumb" }, [el("img", { src: it.src, alt: "", loading: "lazy" })]),
        el("div", { class: "item-fields" }, [
          el("div", { class: "grid2" }, [
            el("label", { class: "field" }, [el("span", { text: "Описание" }), alt]),
            el("label", { class: "field" }, [el("span", { text: "Категория" }), categorySelect(it, content[key].categories || [], scheduleSave)])
          ])
        ]),
        el("div", { class: "item-tools" }, moveTools(items, i, function () { renderGallery(card); }).concat([
          el("button", { class: "btn icon danger", type: "button", title: "Удалить", "aria-label": "Удалить фото", text: "✕", onclick: function () {
            if (!confirm("Удалить это фото?")) return;
            items.splice(i, 1); deleteMedia(it.src); renderGallery(card); saveNow(); toast("Фото удалено");
          } })
        ]))
      ]));
    });
  }
  function renderAllGalleries() { $$("[data-gallery]").forEach(renderGallery); }

  $$("[data-gallery]").forEach(function (card) {
    var input = $('input[type="file"]', card), rowsEl = $(".uploads", card);
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files); input.value = "";
      var key = card.getAttribute("data-gallery");
      files.reduce(function (chain, f) {
        return chain.then(function () {
          return uploadImageFile(f, rowsEl).then(function (url) {
            content[key].items.push({ id: uid(), src: url, alt: "", category: (content[key].categories || [])[0] || "" }); renderGallery(card); return saveNow();
          }).catch(function (e) { toast(e.message, true); });
        });
      }, Promise.resolve());
    });
  });

  // ---------- tabs ----------
  $$(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      $$(".panel").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
      try { localStorage.setItem("ugc-admin-tab", b.getAttribute("data-tab")); } catch (e) {}
    });
  });

  // ---------- auth + boot ----------
  function showLogin() { $("#appView").hidden = true; $("#loginView").hidden = false; $("#password").focus(); }
  function showApp() {
    $("#loginView").hidden = true; $("#appView").hidden = false;
    return fetch("/api/content", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (c) {
      content = c;
      ["brands", "photography"].forEach(function (k) { content[k] = content[k] || {}; content[k].items = content[k].items || []; });
      content.photography.categories = content.photography.categories || [];
      content.portfolio.items = content.portfolio.items || [];
      content.portfolio.categories = content.portfolio.categories || [];
      bindFields(); renderImageFields(); renderVideos(); renderAllGalleries();
      var tab = null; try { tab = localStorage.getItem("ugc-admin-tab"); } catch (e) {}
      var btn = tab && $('.tabs button[data-tab="' + tab + '"]'); if (btn) btn.click();
    });
  }

  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("#loginError").textContent = "";
    api("POST", "/api/session", { password: $("#password").value }).then(function () {
      $("#password").value = ""; showApp();
    }).catch(function (err) { $("#loginError").textContent = err.message === "Wrong password" ? "Неверный пароль" : err.message; });
  });
  $("#logoutBtn").addEventListener("click", function () {
    var go = function () { api("DELETE", "/api/session").then(showLogin, showLogin); };
    saveTimer ? saveNow().then(go) : go();
  });

  fetch("/api/session", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) {
    $("#storageWarn").hidden = s.storage;
    if (!s.configured) { showLogin(); $("#loginError").textContent = "В Cloudflare не задан пароль ADMIN_PASSWORD"; return; }
    s.authed ? showApp() : showLogin();
  }).catch(function () { showLogin(); $("#loginError").textContent = "Сервер недоступен"; });
})();
