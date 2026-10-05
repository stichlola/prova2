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

  // Contact form: tabs + validation + mailto
  var form = document.getElementById("contact-form");
  if (form) {
    var tabs = document.querySelectorAll(".tabs button");
    var tipo = form.querySelector("[name=tipo]");
    var extra = form.querySelectorAll("[data-for]");
    function setTab(t) {
      tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b === t)); });
      tipo.value = t.getAttribute("data-tipo");
      extra.forEach(function (el) {
        var on = el.getAttribute("data-for").split(" ").indexOf(tipo.value) !== -1;
        el.hidden = !on;
        el.querySelectorAll("input,textarea,select").forEach(function (i) { i.disabled = !on; });
      });
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { setTab(t); }); });
    var pre = new URLSearchParams(location.search).get("tipo");
    var start = Array.prototype.find.call(tabs, function (t) { return t.getAttribute("data-tipo") === pre; }) || tabs[0];
    setTab(start);

    function validate(field) {
      var input = field.querySelector("input,textarea,select");
      if (!input || input.disabled) return true;
      var ok = input.checkValidity();
      field.classList.toggle("invalid", !ok);
      return ok;
    }
    form.querySelectorAll(".field").forEach(function (f) {
      f.addEventListener("input", function () { if (f.classList.contains("invalid")) validate(f); });
      f.addEventListener("focusout", function () { validate(f); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll(".field").forEach(function (f) { if (!validate(f)) ok = false; });
      var privacy = form.querySelector("#privacy");
      if (!privacy.checked) { ok = false; privacy.focus(); }
      if (!ok) { var first = form.querySelector(".invalid input, .invalid textarea, .invalid select"); if (first) first.focus(); return; }

      var data = new FormData(form), lines = [];
      var labels = { tipo: "Richiesta", nome: "Nome", azienda: "Azienda / Ente", email: "Email", telefono: "Telefono", progetto: "Nome progetto", periodo: "Periodo", indirizzo: "Indirizzo immobile", mq: "Superficie (mq)", messaggio: "Messaggio" };
      data.forEach(function (v, k) { if (labels[k] && v) lines.push(labels[k] + ": " + v); });
      var subject = "[Plutone] " + data.get("tipo") + " - " + data.get("nome");
      window.location.href = "mailto:plutone.treviso@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      form.hidden = true;
      document.querySelector(".tabs").hidden = true;
      document.querySelector(".form-ok").classList.add("show");
    });
  }

  // Year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
