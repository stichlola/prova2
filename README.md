# Plutone — Riaccendiamo le vetrine

Sito di Plutone (pagine in `docs/`) con un pannello di amministrazione (`admin/`) e un piccolo server Node.js (`server.js`).

## Cosa fa il pannello `/admin`
- **Messaggi**: tutte le richieste inviate dai moduli del sito (spazi, immobili, contatti, newsletter), da leggere, rispondere o eliminare.
- **Locali**: aggiungi, modifica, nascondi, riordina ed elimina i locali della pagina "Apri uno Spazio", con caricamento foto.
- **Newsletter**: elenco iscritti e download CSV (per Excel, Mailchimp, Brevo…).
- **Impostazioni**: e-mail, indirizzo, link Instagram / Facebook / LinkedIn e del partner, aggiornati in tutte le pagine.

## Avvio sul tuo computer
1. Installa [Node.js](https://nodejs.org) (versione 18 o successiva).
2. Copia `.env.example` in un nuovo file `.env` e scrivi la password:
   ```
   ADMIN_PASSWORD=una-password-lunga-e-sicura
   ```
   Il file `.env` non viene mai caricato su GitHub (è in `.gitignore`).
3. Nel terminale, dalla cartella del progetto:
   ```
   npm install
   npm start
   ```
4. Apri http://localhost:3000 (sito) e http://localhost:3000/admin (pannello).

## Pubblicazione online
GitHub Pages pubblica solo file statici: il sito funziona (i moduli aprono il programma di posta), ma il pannello admin no.
Per avere il pannello serve un hosting che esegua Node.js, per esempio **Render** o **Railway**:
- comando di build: `npm install` — comando di avvio: `npm start`
- nelle **Environment Variables** del servizio aggiungi `ADMIN_PASSWORD` (non serve il file `.env`)
- aggiungi un **disco persistente** e imposta `DATA_DIR` sul suo percorso (es. `/var/data`), altrimenti messaggi, locali e foto caricate si perdono a ogni riavvio.

## Struttura
- `docs/` — pagine pubbliche del sito
- `admin/` — pannello di amministrazione
- `data/locali.json` — locali di partenza (al primo avvio vengono copiati in `DATA_DIR`)
- `server.js` — server e API
