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
      var lines = [];
      form.querySelectorAll("[data-label]").forEach(function (el) {
        var v = el.type === "checkbox" ? (el.checked ? "Sì" : "No") : el.value;
        if (el.tagName === "SELECT" && el.selectedIndex > 0) v = el.options[el.selectedIndex].text;
        if (v) lines.push(el.getAttribute("data-label") + ": " + v);
      });
      var who = form.querySelector("[data-subject]");
      var subject = "[Plutone] " + form.getAttribute("data-subject") + (who && who.value ? " - " + who.value : "");
      window.location.href = "mailto:plutone.treviso@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      form.hidden = true;
      var done = form.parentNode.querySelector(".form-done");
      if (done) done.classList.add("show");
    });
  });

  // Preselezione da link (es. ?motivo=ho_spazio)
  var params = new URLSearchParams(location.search);
  params.forEach(function (v, k) {
    var el = document.querySelector('form.js-mail select[name="' + k + '"]');
    if (el) el.value = v;
  });

  // "Vedi Dettagli": porta al modulo con il locale già indicato
  document.querySelectorAll("[data-spazio]").forEach(function (a) {
    a.addEventListener("click", function () {
      var hidden = document.getElementById("c-spazio"), sel = document.getElementById("c-formato"), msg = document.getElementById("c-msg");
      if (hidden) hidden.value = a.getAttribute("data-spazio");
      if (sel) sel.value = a.getAttribute("data-formato");
      if (msg && !msg.value) msg.value = "Vorrei maggiori dettagli su: " + a.getAttribute("data-spazio") + ".";
    });
  });

  // Year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
