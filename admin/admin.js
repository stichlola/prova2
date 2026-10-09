(function () {
  "use strict";

  // ---------- utilità
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function api(method, url, body, isForm) {
    var opt = { method: method, credentials: "same-origin", headers: { "X-Plutone-Admin": "1" } };
    if (body && !isForm) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    if (isForm) opt.body = body;
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && url.indexOf("/login") === -1) { showLogin(); throw new Error("Sessione scaduta: accedi di nuovo"); }
        if (!r.ok) throw new Error(data.error || "Errore " + r.status);
        return data;
      });
    });
  }
  var toastTimer;
  function toast(msg, err) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.className = "a-toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; }
  }

  // ---------- login
  var loginBox = document.getElementById("login"), app = document.getElementById("app");
  function showLogin(msg) {
    app.hidden = true; loginBox.hidden = false;
    if (msg) document.getElementById("login-msg").textContent = msg;
    document.getElementById("pw").focus();
  }
  function showApp() { loginBox.hidden = true; app.hidden = false; route(); }

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("login-err"); err.textContent = "";
    api("POST", "/api/admin/login", { password: document.getElementById("pw").value })
      .then(function () { document.getElementById("pw").value = ""; showApp(); })
      .catch(function (x) { err.textContent = x.message; });
  });
  document.getElementById("logout").addEventListener("click", function (e) {
    e.preventDefault();
    api("POST", "/api/admin/logout").finally(function () { showLogin("Sei uscito dal pannello."); });
  });

  // ---------- navigazione
  function route() {
    var tab = (location.hash || "#messaggi").slice(1);
    if (!document.querySelector('[data-panel="' + tab + '"]')) tab = "messaggi";
    document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab; });
    document.querySelectorAll("[data-tab]").forEach(function (a) {
      if (a.getAttribute("data-tab") === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    ({ messaggi: loadMessages, locali: loadLocali, newsletter: loadNewsletter, impostazioni: loadSettings })[tab]();
  }
  window.addEventListener("hashchange", function () { if (!app.hidden) route(); });

  // ---------- messaggi
  var messages = [], msgFilter = "tutti";
  function loadMessages() {
    api("GET", "/api/admin/messaggi").then(function (list) { messages = list; renderMessages(); }).catch(function (e) { toast(e.message, true); });
  }
  function matches(m) {
    if (msgFilter === "nuovi") return !m.letto;
    if (msgFilter === "spazio") return /spazio|informazioni/i.test(m.tipo);
    if (msgFilter === "immobile") return /immobile/i.test(m.tipo);
    if (msgFilter === "newsletter") return /newsletter/i.test(m.tipo);
    return true;
  }
  function renderMessages() {
    var box = document.getElementById("msg-list"); box.textContent = "";
    var nuovi = messages.filter(function (m) { return !m.letto; }).length;
    var c = document.getElementById("count-new"); c.textContent = nuovi; c.hidden = !nuovi;
    var list = messages.filter(matches);
    if (!list.length) { box.appendChild(h("div", { class: "a-empty", text: messages.length ? "Nessun messaggio in questo filtro." : "Ancora nessun messaggio. Le richieste inviate dai moduli del sito compariranno qui." })); return; }
    list.forEach(function (m) {
      var dl = h("dl");
      Object.keys(m.campi).forEach(function (k) {
        var v = m.campi[k], dd = h("dd");
        if (k === "E-mail") dd.appendChild(h("a", { href: "mailto:" + v + "?subject=" + encodeURIComponent("Re: " + m.tipo), text: v }));
        else dd.textContent = v;
        dl.appendChild(h("dt", { text: k })); dl.appendChild(dd);
      });
      box.appendChild(h("article", { class: "a-msg" + (m.letto ? "" : " nuovo") }, [
        h("header", {}, [h("span", { class: "tag", text: m.tipo }), h("strong", { text: m.campi["Nome / Azienda"] || m.campi["Azienda / Brand"] || m.campi["Nome e Cognome"] || m.campi["Nome"] || m.campi["E-mail"] || "" }), h("time", { datetime: m.data, text: fmtDate(m.data) })]),
        dl,
        h("div", { class: "btn-row" }, [
          m.campi["E-mail"] ? h("a", { class: "btn btn-navy a-btn-sm", href: "mailto:" + m.campi["E-mail"] + "?subject=" + encodeURIComponent("Re: " + m.tipo), text: "Rispondi" }) : null,
          h("button", { class: "btn a-btn-ghost a-btn-sm", type: "button", text: m.letto ? "Segna da leggere" : "Segna come letto", onclick: function () {
            api("PATCH", "/api/admin/messaggi/" + m.id, { letto: !m.letto }).then(function (u) { m.letto = u.letto; renderMessages(); }).catch(function (e) { toast(e.message, true); });
          } }),
          h("button", { class: "btn a-btn-danger a-btn-sm", type: "button", text: "Elimina", onclick: function () {
            if (!confirm("Eliminare definitivamente questo messaggio?")) return;
            api("DELETE", "/api/admin/messaggi/" + m.id).then(function () { messages = messages.filter(function (x) { return x !== m; }); renderMessages(); toast("Messaggio eliminato"); }).catch(function (e) { toast(e.message, true); });
          } }),
        ]),
      ]));
    });
  }
  document.getElementById("msg-filter").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    msgFilter = b.getAttribute("data-f");
    this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    renderMessages();
  });

  // ---------- locali
  var locali = [], editing = null;
  var dlg = document.getElementById("locale-dialog"), form = document.getElementById("locale-form");
  function loadLocali() {
    api("GET", "/api/admin/locali").then(function (list) { locali = list; renderLocali(); }).catch(function (e) { toast(e.message, true); });
  }
  function saveOrder() {
    api("POST", "/api/admin/locali/ordine", { ids: locali.map(function (l) { return l.id; }) }).then(function () { toast("Ordine aggiornato"); }).catch(function (e) { toast(e.message, true); });
  }
  function renderLocali() {
    var box = document.getElementById("locali-list"); box.textContent = "";
    if (!locali.length) { box.appendChild(h("div", { class: "a-empty", text: "Nessun locale. Aggiungine uno con il pulsante in alto." })); return; }
    locali.forEach(function (l, i) {
      var ph = h("div", { class: "ph", "data-label": l.nome });
      if (l.foto) ph.appendChild(h("img", { src: "/" + l.foto, alt: "" }));
      box.appendChild(h("article", { class: "a-loc" + (l.visibile ? "" : " nascosto") }, [
        ph,
        h("div", { class: "body" }, [
          h("span", { class: "tag", text: l.tipo === "vetrina" ? "Vetrina" : "Spazio" + (l.visibile ? "" : " · nascosto") }),
          h("h3", { text: l.nome }),
          h("p", { class: "meta", text: [l.indirizzo, l.mq ? l.mq + " mq" : ""].filter(Boolean).join(" · ") }),
          h("p", { text: l.descrizione }),
          h("div", { class: "btn-row" }, [
            h("button", { class: "btn btn-navy a-btn-sm", type: "button", text: "Modifica", onclick: function () { openLocale(l); } }),
            h("button", { class: "btn a-btn-ghost a-btn-sm", type: "button", text: "↑", title: "Sposta prima", "aria-label": "Sposta prima", disabled: i === 0, onclick: function () { locali.splice(i - 1, 0, locali.splice(i, 1)[0]); renderLocali(); saveOrder(); } }),
            h("button", { class: "btn a-btn-ghost a-btn-sm", type: "button", text: "↓", title: "Sposta dopo", "aria-label": "Sposta dopo", disabled: i === locali.length - 1, onclick: function () { locali.splice(i + 1, 0, locali.splice(i, 1)[0]); renderLocali(); saveOrder(); } }),
            h("button", { class: "btn a-btn-danger a-btn-sm", type: "button", text: "Elimina", onclick: function () {
              if (!confirm("Eliminare “" + l.nome + "”?")) return;
              api("DELETE", "/api/admin/locali/" + l.id).then(function () { loadLocali(); toast("Locale eliminato"); }).catch(function (e) { toast(e.message, true); });
            } }),
          ]),
        ]),
      ]));
    });
  }
  function setPreview(path) {
    var img = document.getElementById("l-preview");
    document.getElementById("l-foto-path").value = path || "";
    img.hidden = !path; if (path) img.src = "/" + path;
  }
  function openLocale(l) {
    editing = l || null;
    form.reset();
    document.getElementById("locale-err").textContent = "";
    document.getElementById("locale-title").textContent = l ? "Modifica locale" : "Nuovo locale";
    form.nome.value = l ? l.nome : "";
    form.tipo.value = l ? l.tipo : "spazio";
    form.indirizzo.value = l ? l.indirizzo : "";
    form.mq.value = l ? l.mq : "";
    form.descrizione.value = l ? l.descrizione : "";
    form.ai.checked = l ? l.ai : false;
    form.visibile.checked = l ? l.visibile : true;
    setPreview(l ? l.foto : "");
    dlg.showModal();
    form.nome.focus();
  }
  document.getElementById("new-locale").addEventListener("click", function () { openLocale(null); });
  document.getElementById("locale-cancel").addEventListener("click", function () { dlg.close(); });
  document.getElementById("l-foto").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    var err = document.getElementById("locale-err"); err.textContent = "Caricamento della foto…";
    var fd = new FormData(); fd.append("foto", f);
    api("POST", "/api/admin/foto", fd, true).then(function (r) { setPreview(r.foto); err.textContent = ""; }).catch(function (e) { err.textContent = e.message; });
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("locale-err");
    if (!form.nome.value.trim()) { err.textContent = "Il nome è obbligatorio."; form.nome.focus(); return; }
    var body = { nome: form.nome.value, tipo: form.tipo.value, indirizzo: form.indirizzo.value, mq: form.mq.value, descrizione: form.descrizione.value, foto: form.foto.value, ai: form.ai.checked, visibile: form.visibile.checked };
    (editing ? api("PUT", "/api/admin/locali/" + editing.id, body) : api("POST", "/api/admin/locali", body))
      .then(function () { dlg.close(); loadLocali(); toast("Locale salvato"); })
      .catch(function (x) { err.textContent = x.message; });
  });

  // ---------- newsletter
  function loadNewsletter() {
    api("GET", "/api/admin/newsletter").then(function (list) {
      var tb = document.getElementById("news-list"); tb.textContent = "";
      if (!list.length) { tb.appendChild(h("tr", {}, [h("td", { colspan: "4", text: "Ancora nessun iscritto." })])); return; }
      list.forEach(function (s) {
        tb.appendChild(h("tr", {}, [h("td", {}, [h("a", { href: "mailto:" + s.email, text: s.email })]), h("td", { text: s.nome }), h("td", { text: fmtDate(s.data) }), h("td", { text: s.origine })]));
      });
    }).catch(function (e) { toast(e.message, true); });
  }

  // ---------- impostazioni
  var sForm = document.getElementById("settings-form");
  function loadSettings() {
    api("GET", "/api/admin/impostazioni").then(function (s) {
      Object.keys(s).forEach(function (k) { if (sForm[k]) sForm[k].value = s[k]; });
    }).catch(function (e) { toast(e.message, true); });
  }
  sForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("settings-err"); err.textContent = "";
    var body = {};
    ["email", "indirizzo", "instagram", "facebook", "linkedin", "partner"].forEach(function (k) { body[k] = sForm[k].value; });
    api("PUT", "/api/admin/impostazioni", body).then(function () { toast("Impostazioni salvate"); }).catch(function (x) { err.textContent = x.message; });
  });

  // ---------- avvio
  fetch("/api/admin/stato", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (s) {
    if (!s.attivo) {
      showLogin("Il pannello è disattivato: crea il file .env con ADMIN_PASSWORD (almeno 10 caratteri) e riavvia il server.");
      document.getElementById("login-form").querySelectorAll("input,button").forEach(function (x) { x.disabled = true; });
    } else if (s.autenticato) showApp();
    else showLogin();
  }).catch(function () {
    showLogin("Il pannello funziona solo quando il sito gira con il server Node (npm start), non su GitHub Pages.");
  });
})();
