(function () {
  "use strict";

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("open", !open);
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) { burger.setAttribute("aria-expanded", "false"); menu.classList.remove("open"); }
    });
  }

  // Reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // Carousel
  document.querySelectorAll(".carousel").forEach(function (car) {
    var track = car.querySelector(".track");
    var slides = Array.prototype.slice.call(track.children);
    var dots = car.querySelector(".dots");
    function step() { return slides[0].getBoundingClientRect().width + 28; }
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Vai alla foto " + (i + 1));
      b.addEventListener("click", function () {
        track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: "smooth" });
      });
      dots.appendChild(b);
    });
    function update() {
      var center = track.scrollLeft + track.clientWidth / 2, best = 0, bestD = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.offsetLeft + s.clientWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      Array.prototype.forEach.call(dots.children, function (d, i) { d.setAttribute("aria-current", String(i === best)); });
    }
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    car.querySelector(".prev").addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    car.querySelector(".next").addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
    update();
  });

  // Lightbox
  var lb = document.querySelector(".lightbox");
  if (lb) {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
    var lbImg = lb.querySelector("img"), lbCap = lb.querySelector("figcaption");
    var current = 0, lastFocus = null;
    function visible() { return items.filter(function (el) { return !el.closest("[hidden]"); }); }
    function show(i) {
      var list = visible();
      current = (i + list.length) % list.length;
      var el = list[current];
      lbImg.src = el.getAttribute("data-full") || el.querySelector("img").src;
      lbImg.alt = el.querySelector("img").alt;
      lbCap.textContent = el.getAttribute("data-caption") || lbImg.alt;
    }
    function open(el) {
      lastFocus = document.activeElement;
      show(visible().indexOf(el));
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
      lb.querySelector(".lb-close").focus();
    }
    function close() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    items.forEach(function (el) { el.addEventListener("click", function () { open(el); }); });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(current - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(current + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });
  }

  // Filters (lavori)
  var filters = document.querySelector(".filters");
  if (filters) {
    filters.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      filters.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var f = b.getAttribute("data-filter");
      document.querySelectorAll(".card-lavoro").forEach(function (c) {
        c.hidden = f !== "tutti" && c.getAttribute("data-cat") !== f;
      });
    });
  }

  var contactEmail = "plutone.treviso@gmail.com";

  // Impostazioni dal pannello admin (solo se il sito gira con il server)
  fetch("api/impostazioni").then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
    if (!s) return;
    if (s.email) contactEmail = s.email;
    document.querySelectorAll("[data-setting]").forEach(function (el) {
      var k = el.getAttribute("data-setting"), v = s[k];
      if (k === "email") { el.textContent = v; el.href = "mailto:" + v; }
      else if (k === "indirizzo") {
        el.textContent = "";
        String(v || "").split("\n").forEach(function (line, i) { if (i) el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(line)); });
      } else if (v) { el.href = v; el.removeAttribute("aria-disabled"); el.closest("li, .partner-wrap") && (el.closest("li, .partner-wrap").hidden = false); }
      else if (el.closest("li")) el.closest("li").hidden = true;
    });
  }).catch(function () {});

  // Locali disponibili dal pannello admin
  var localiBox = document.querySelector("[data-locali]");
  if (localiBox) {
    fetch("api/locali").then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
      if (!list) return;
      var pin = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"/></svg>';
      function card(l) {
        var a = document.createElement("article"); a.className = "space in reveal";
        var ph = document.createElement("div"); ph.className = "ph"; ph.setAttribute("data-label", l.nome);
        if (l.foto) { var im = document.createElement("img"); im.src = l.foto; im.alt = l.nome; im.loading = "lazy"; im.onerror = function () { im.remove(); }; ph.appendChild(im); }
        var body = document.createElement("div"); body.className = "body";
        var h4 = document.createElement("h4"); h4.textContent = l.nome;
        var w = document.createElement("div"); w.className = "where"; w.innerHTML = pin;
        var ws = document.createElement("span"); ws.textContent = l.indirizzo + (l.mq ? " (" + l.mq + " mq)" : ""); w.appendChild(ws);
        var p = document.createElement("p"); p.textContent = l.descrizione;
        if (l.ai) { var sup = document.createElement("sup"); sup.className = "ai"; sup.textContent = "*"; p.appendChild(sup); }
        var b = document.createElement("a"); b.className = "btn btn-navy"; b.href = "#contatti"; b.textContent = "Vedi Dettagli";
        b.setAttribute("data-spazio", l.nome); b.setAttribute("data-formato", l.tipo); bindDettagli(b);
        [h4, w, p, b].forEach(function (x) { body.appendChild(x); });
        a.appendChild(ph); a.appendChild(body); return a;
      }
      [["spazio", "sezione-spazi"], ["vetrina", "sezione-vetrine"]].forEach(function (g) {
        var sec = document.getElementById(g[1]); if (!sec) return;
        var grid = sec.querySelector(".spaces"), items = list.filter(function (l) { return l.tipo === g[0]; });
        grid.textContent = "";
        items.forEach(function (l) { grid.appendChild(card(l)); });
        sec.hidden = !items.length;
      });
    }).catch(function () {});
  }

  // Forms: validation + invio via e-mail (mailto)
  document.querySelectorAll("form.js-mail").forEach(function (form) {
    function validate(field) {
      var input = field.querySelector("input,textarea,select");
      if (!input) return true;
      var ok = input.checkValidity();
      field.classList.toggle("invalid", !ok);
      return ok;
    }
    var fields = form.querySelectorAll(".field");
    fields.forEach(function (f) {
      f.addEventListener("input", function () { if (f.classList.contains("invalid")) validate(f); });
      f.addEventListener("change", function () { if (f.classList.contains("invalid")) validate(f); });
      f.addEventListener("focusout", function () { validate(f); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      fields.forEach(function (f) { if (!validate(f)) ok = false; });
      if (!ok) { var first = form.querySelector(".invalid input, .invalid textarea, .invalid select"); if (first) first.focus(); return; }
      var campi = {}, lines = [];
      form.querySelectorAll("[data-label]").forEach(function (el) {
        var v = el.type === "checkbox" ? (el.checked ? "Sì" : "No") : el.value;
        if (el.tagName === "SELECT" && el.selectedIndex > 0) v = el.options[el.selectedIndex].text;
        if (v) { campi[el.getAttribute("data-label")] = v; lines.push(el.getAttribute("data-label") + ": " + v); }
      });
      var tipo = form.getAttribute("data-subject");
      var trap = form.querySelector("[name=sito_web]");
      var btn = form.querySelector("[type=submit]");
      function done(viaServer) {
        form.hidden = true;
        var box = form.parentNode.querySelector(".form-done");
        if (!box) return;
        if (viaServer) {
          var msg = box.querySelector("[data-server-msg]") || box.querySelector("p:last-child");
          if (msg) msg.textContent = /newsletter/i.test(tipo) ? "Iscrizione registrata: riceverai le prossime novità di Plutone." : "Messaggio inviato! Ti risponderemo al più presto.";
        }
        box.classList.add("show");
      }
      function viaMail() {
        var who = form.querySelector("[data-subject]");
        var subject = "[Plutone] " + tipo + (who && who.value ? " - " + who.value : "");
        window.location.href = "mailto:" + contactEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
        done(false);
      }
      if (btn) btn.disabled = true;
      // Con il server attivo i messaggi arrivano nel pannello admin; su hosting statico si usa l'e-mail.
      fetch("api/messaggi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: tipo, campi: campi, sito_web: trap ? trap.value : "" }) })
        .then(function (r) {
          if (r.ok) return done(true);
          if (r.status === 404 || r.status === 405) return viaMail();
          return r.json().then(function (d) { alert(d.error || "Invio non riuscito, riprova."); });
        })
        .catch(viaMail)
        .finally(function () { if (btn) btn.disabled = false; });
    });
  });

  // Preselezione da link (es. ?motivo=ho_spazio)
  var params = new URLSearchParams(location.search);
  params.forEach(function (v, k) {
    var el = document.querySelector('form.js-mail select[name="' + k + '"]');
    if (el) el.value = v;
  });

  // "Vedi Dettagli": porta al modulo con il locale già indicato
  function bindDettagli(a) {
    a.addEventListener("click", function () {
      var hidden = document.getElementById("c-spazio"), sel = document.getElementById("c-formato"), msg = document.getElementById("c-msg");
      if (hidden) hidden.value = a.getAttribute("data-spazio");
      if (sel) sel.value = a.getAttribute("data-formato");
      if (msg && !msg.value) msg.value = "Vorrei maggiori dettagli su: " + a.getAttribute("data-spazio") + ".";
    });
  }
  document.querySelectorAll("[data-spazio]").forEach(bindDettagli);

  // Year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
