/* =====================================================================
   js/comune/stato.js
   Cosa fa:   Lo stato condiviso del sito (utente, campagna, dati caricati,
              filtri) e la memoria di dove eri, per ritrovare la stessa
              pagina dopo un aggiornamento.
   Contiene:  S, isMaster, campId, ULTIMA, leggiUltima, salvaUltima,
              scordaUltima
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- stato
var S = {
  user: null, me: null, tab: null,
  ogg: [], oggOk: false, serv: [], pngAll: [], gioc: [], png: [], inv: [], notif: [], trasf: [], sch: [], inc: [], si: [], incOk: false, schedaAperta: null,
  filtro: { cat: "", q: "", tip: "", n: 100, qs: "" }, nuove: {}, timer: null,
  auto: true, ripristino: null        // auto: al caricamento della pagina si rientra nell'ultima campagna
};
var isMaster = function () { return !!S.me && S.me.ruolo === "master"; };
var campId = function () { return S.me.campagna_id; };

// ---------------------------------------------------------------- ricordare dove eri
// Ricaricando la pagina (F5, Aggiorna) si ritrova la stessa campagna, la stessa sezione e la stessa scheda aperta,
// invece di tornare all'elenco delle campagne. Si salva nel browser, solo su questo dispositivo.
var ULTIMA = "gdr_ultima";
function leggiUltima() { try { return JSON.parse(localStorage.getItem(ULTIMA) || "null"); } catch (e) { return null; } }
function salvaUltima() {
  if (!S.me || !S.user) return;
  try { localStorage.setItem(ULTIMA, JSON.stringify({ utente: S.user.id, mem: S.me.id, tab: S.tab, scheda: S.schedaAperta || null })); } catch (e) {}
}
function scordaUltima() { try { localStorage.removeItem(ULTIMA); } catch (e) {} }
