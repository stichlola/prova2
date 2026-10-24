// Server del sito Plutone: pubblica le pagine in docs/ e offre il pannello /admin.
// Avvio:  npm install  &&  npm start   (la password admin va nel file .env)
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

// ---------------------------------------------------------------- .env
(function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_ON = PASSWORD.length >= 10;
const SITE = path.join(__dirname, "docs");
// DATA_DIR: cartella dei dati (messaggi, locali, foto caricate). In hosting va su un disco persistente.
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const UPLOADS = path.join(DATA, "uploads");
const SESSION_HOURS = 8;

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
// al primo avvio su un disco vuoto copia i locali di partenza presenti nel repository
const SEED = path.join(__dirname, "data", "locali.json");
if (!fs.existsSync(path.join(DATA, "locali.json")) && fs.existsSync(SEED)) fs.copyFileSync(SEED, path.join(DATA, "locali.json"));

// ---------------------------------------------------------------- dati (file JSON)
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8")); }
  catch { return fallback; }
}
function writeJson(name, value) {
  const file = path.join(DATA, name);
  fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 2));
  fs.renameSync(file + ".tmp", file);
}
const DEFAULT_SETTINGS = {
  email: "plutone.treviso@gmail.com",
  indirizzo: "Via Montello, 7A\n31100 Treviso (TV)",
  instagram: "https://www.instagram.com/plutone.treviso/",
  facebook: "",
  linkedin: "",
  partner: "",
};
const settings = () => ({ ...DEFAULT_SETTINGS, ...readJson("impostazioni.json", {}) });
const id = () => crypto.randomBytes(8).toString("hex");

// ---------------------------------------------------------------- validazione
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isUrl = (v) => v === "" || /^https?:\/\/[^\s<>"]+$/i.test(v);
const isEmail = (v) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);

function cleanLocale(b) {
  const tipo = b.tipo === "vetrina" ? "vetrina" : "spazio";
  const foto = str(b.foto, 300);
  return {
    nome: str(b.nome, 120),
    tipo,
    indirizzo: str(b.indirizzo, 160),
    mq: str(b.mq, 20),
    descrizione: str(b.descrizione, 600),
    // solo immagini del sito, niente URL esterni o percorsi strani
    foto: /^assets\/img\/[\w\-./% ]+\.(jpe?g|png|webp)$/i.test(foto) && !foto.includes("..") ? foto : "",
    ai: Boolean(b.ai),
    visibile: b.visibile !== false,
  };
}

// ---------------------------------------------------------------- sessioni admin
const sessions = new Map(); // token -> scadenza
const attempts = new Map(); // ip -> { n, until }

function hash(s) { return crypto.createHash("sha256").update(String(s)).digest(); }
function passwordOk(p) { return ADMIN_ON && crypto.timingSafeEqual(hash(p), hash(PASSWORD)); }

function cookieToken(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)plutone_admin=([a-f0-9]{64})/);
  return m ? m[1] : null;
}
function isAdmin(req) {
  const t = cookieToken(req);
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function requireAdmin(req, res, next) {
  if (!ADMIN_ON) return res.status(503).json({ error: "Pannello disattivato: imposta ADMIN_PASSWORD nel file .env" });
  if (!isAdmin(req)) return res.status(401).json({ error: "Accesso richiesto" });
  // protezione CSRF: le modifiche arrivano solo dal pannello (header personalizzato)
  if (req.method !== "GET" && req.get("X-Plutone-Admin") !== "1") return res.status(403).json({ error: "Richiesta non valida" });
  next();
}
function setCookie(req, res, token, maxAge) {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `plutone_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

// limite semplice per i moduli pubblici (anti-spam)
const formHits = new Map();
function formLimit(req, res, next) {
  const now = Date.now(), ip = req.ip;
  const list = (formHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 8) return res.status(429).json({ error: "Troppi invii, riprova più tardi" });
  list.push(now); formHits.set(ip, list); next();
}

// ---------------------------------------------------------------- app
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/admin") || req.path.startsWith("/api/admin")) {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

// ---------- API pubbliche
app.get("/api/locali", (req, res) => {
  res.json(readJson("locali.json", []).filter((l) => l.visibile));
});
app.get("/api/impostazioni", (req, res) => res.json(settings()));

app.post("/api/messaggi", formLimit, (req, res) => {
  const b = req.body || {};
  if (str(b.sito_web, 100)) return res.json({ ok: true }); // campo trappola per i bot
  const tipo = str(b.tipo, 60) || "Messaggio";
  const campi = {};
  if (b.campi && typeof b.campi === "object") {
    for (const [k, v] of Object.entries(b.campi).slice(0, 15)) {
      const key = str(k, 60), val = str(v, 3000);
      if (key && val) campi[key] = val;
    }
  }
  const email = campi["E-mail"] || "";
  if (!isEmail(email)) return res.status(400).json({ error: "E-mail non valida" });
  const list = readJson("messaggi.json", []);
  list.unshift({ id: id(), tipo, data: new Date().toISOString(), campi, letto: false });
  writeJson("messaggi.json", list.slice(0, 5000));
  res.json({ ok: true });
});

// ---------- login / logout
app.get("/api/admin/stato", (req, res) => res.json({ attivo: ADMIN_ON, autenticato: ADMIN_ON && isAdmin(req) }));

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_ON) return res.status(503).json({ error: "Pannello disattivato: imposta ADMIN_PASSWORD (almeno 10 caratteri) nel file .env" });
  const ip = req.ip, now = Date.now();
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > now) return res.status(429).json({ error: "Troppi tentativi. Riprova tra qualche minuto." });
  if (!passwordOk(str(req.body && req.body.password, 200))) {
    a.n += 1;
    if (a.n >= 5) { a.n = 0; a.until = now + 15 * 60 * 1000; }
    attempts.set(ip, a);
    return res.status(401).json({ error: "Password errata" });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, now + SESSION_HOURS * 3600 * 1000);
  setCookie(req, res, token, SESSION_HOURS * 3600);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const t = cookieToken(req);
  if (t) sessions.delete(t);
  setCookie(req, res, "", 0);
  res.json({ ok: true });
});

// ---------- messaggi e newsletter
app.get("/api/admin/messaggi", requireAdmin, (req, res) => res.json(readJson("messaggi.json", [])));

app.patch("/api/admin/messaggi/:id", requireAdmin, (req, res) => {
  const list = readJson("messaggi.json", []);
  const m = list.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: "Messaggio non trovato" });
  m.letto = Boolean(req.body && req.body.letto);
  writeJson("messaggi.json", list);
  res.json(m);
});

app.delete("/api/admin/messaggi/:id", requireAdmin, (req, res) => {
  const list = readJson("messaggi.json", []);
  writeJson("messaggi.json", list.filter((x) => x.id !== req.params.id));
  res.json({ ok: true });
});

function iscritti() {
  const seen = new Map();
  for (const m of readJson("messaggi.json", []).slice().reverse()) {
    const email = (m.campi["E-mail"] || "").toLowerCase();
    const vuole = /newsletter/i.test(m.tipo) || m.campi["Iscrizione newsletter"] === "Sì";
    if (email && vuole && !seen.has(email)) seen.set(email, { email, nome: m.campi["Nome"] || m.campi["Nome e Cognome"] || m.campi["Nome / Azienda"] || m.campi["Azienda / Brand"] || "", data: m.data, origine: m.tipo });
  }
  return [...seen.values()];
}
app.get("/api/admin/newsletter", requireAdmin, (req, res) => res.json(iscritti()));
app.get("/api/admin/newsletter.csv", requireAdmin, (req, res) => {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [["email", "nome", "data", "origine"], ...iscritti().map((s) => [s.email, s.nome, s.data, s.origine])];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="iscritti-newsletter.csv"');
  res.send("﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n"));
});

// ---------- locali
app.get("/api/admin/locali", requireAdmin, (req, res) => res.json(readJson("locali.json", [])));

app.post("/api/admin/locali", requireAdmin, (req, res) => {
  const l = cleanLocale(req.body || {});
  if (!l.nome) return res.status(400).json({ error: "Il nome è obbligatorio" });
  const list = readJson("locali.json", []);
  const nuovo = { id: id(), ...l };
  list.push(nuovo);
  writeJson("locali.json", list);
  res.json(nuovo);
});

app.put("/api/admin/locali/:id", requireAdmin, (req, res) => {
  const list = readJson("locali.json", []);
  const i = list.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Locale non trovato" });
  const l = cleanLocale(req.body || {});
  if (!l.nome) return res.status(400).json({ error: "Il nome è obbligatorio" });
  list[i] = { id: list[i].id, ...l };
  writeJson("locali.json", list);
  res.json(list[i]);
});

app.delete("/api/admin/locali/:id", requireAdmin, (req, res) => {
  writeJson("locali.json", readJson("locali.json", []).filter((x) => x.id !== req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/locali/ordine", requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  const list = readJson("locali.json", []);
  list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  writeJson("locali.json", list);
  res.json(list);
});

// ---------- caricamento foto
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype];
      cb(null, Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});
app.post("/api/admin/foto", requireAdmin, (req, res) => {
  upload.single("foto")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "La foto supera i 5 MB" : "Caricamento non riuscito" });
    if (!req.file) return res.status(400).json({ error: "Formato non supportato (usa JPG, PNG o WebP)" });
    res.json({ foto: "assets/img/uploads/" + req.file.filename });
  });
});

// ---------- impostazioni
app.get("/api/admin/impostazioni", requireAdmin, (req, res) => res.json(settings()));
app.put("/api/admin/impostazioni", requireAdmin, (req, res) => {
  const b = req.body || {};
  const s = {
    email: str(b.email, 120),
    indirizzo: str(b.indirizzo, 200),
    instagram: str(b.instagram, 300),
    facebook: str(b.facebook, 300),
    linkedin: str(b.linkedin, 300),
    partner: str(b.partner, 300),
  };
  if (!isEmail(s.email)) return res.status(400).json({ error: "E-mail non valida" });
  for (const k of ["instagram", "facebook", "linkedin", "partner"]) {
    if (!isUrl(s[k])) return res.status(400).json({ error: `Il link "${k}" deve iniziare con https://` });
  }
  writeJson("impostazioni.json", s);
  res.json(s);
});

app.use("/api", (req, res) => res.status(404).json({ error: "Non trovato" }));

// ---------- pagine
app.use("/assets/img/uploads", express.static(UPLOADS));
app.use("/admin", express.static(path.join(__dirname, "admin"), { index: "index.html" }));
app.use(express.static(SITE, { extensions: ["html"] }));
app.use((req, res) => res.status(404).sendFile(path.join(SITE, "404.html")));

app.listen(PORT, () => {
  console.log(`Sito Plutone: http://localhost:${PORT}`);
  console.log(ADMIN_ON
    ? `Pannello admin:  http://localhost:${PORT}/admin`
    : "ATTENZIONE: pannello admin disattivato. Imposta ADMIN_PASSWORD (almeno 10 caratteri) nel file .env");
});
