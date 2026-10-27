/* =====================================================================
   js/battle/stato.js
   Cosa fa:   Stato della pagina Battle (mappe, segnalini, PF, scena),
              caricamento da Supabase e regole su chi può muovere cosa.
   Contiene:  B, bMaster, bCamp, mappaScena, mappaVista, segnaliniDi,
              segnalinoPerId, possoMuovere, ordineIniziativa, caricaBattle,
              urlMappa
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- stato della pagina Battle
var B = {
  user: null, me: null, mems: [],            // me: la tua iscrizione alla campagna (ruolo, nome, id)
  stato: null, mappe: [], seg: [], pf: {},   // pf: { idSegnalino: { pf_att, pf_max, visibile_giocatori } }
  pg: [], npc: [],                           // solo master: personaggi che si possono mettere sulla mappa
  vista: null,                               // la mappa che il master sta guardando (non per forza quella in scena)
  url: {},                                   // indirizzi temporanei delle immagini { percorso: { url, scade } }
  sel: null,                                 // segnalino scelto
  righello: false, calibra: false, linea: null,
  drag: null, rinvia: false, coda: null, canale: null, tRicarica: null
};
var bMaster = function () { return !!B.me && B.me.ruolo === "master"; };
var bCamp = function () { return B.me.campagna_id; };

// La mappa in scena, se esiste (per i giocatori conta anche che sia visibile: lo decide il database).
function mappaScena() {
  var s = B.stato;
  if (!s || !s.mappa_id) return null;
  return B.mappe.filter(function (m) { return m.id === s.mappa_id; })[0] || null;
}
// La mappa mostrata sullo schermo: il master guarda quella che sceglie, un giocatore solo quella in scena e visibile.
function mappaVista() {
  if (!bMaster()) return B.stato && B.stato.visibile ? mappaScena() : null;
  var v = B.mappe.filter(function (m) { return m.id === B.vista; })[0];
  return v || mappaScena() || B.mappe[0] || null;
}
function segnaliniDi(m) { return m ? B.seg.filter(function (s) { return s.mappa_id === m.id; }) : []; }
function segnalinoPerId(id) { return B.seg.filter(function (s) { return s.id === Number(id); })[0] || null; }
// [REGOLA] Il master sposta tutti i segnalini, un giocatore solo il proprio (lo ricontrolla comunque il database).
function possoMuovere(s) { return bMaster() || (s.giocatore_id != null && s.giocatore_id === B.me.id); }
// Dall'iniziativa più alta alla più bassa, a parità l'ultimo arrivato dopo (come nel database).
function ordineIniziativa(lista) {
  return lista.filter(function (s) { return s.iniziativa != null; })
    .sort(function (a, b) { return b.iniziativa - a.iniziativa || a.id - b.id; });
}

// Legge tutto da Supabase. Un giocatore riceve solo ciò che le regole del database gli permettono di vedere.
function caricaBattle() {
  var c = bCamp(), q = [
    sb.from("battle_stato").select("*").eq("campagna_id", c).maybeSingle(),
    sb.from("mappe").select("*").eq("campagna_id", c).order("id"),
    sb.from("segnalini").select("*").eq("campagna_id", c).order("id"),
    sb.from("segnalini_pf").select("*").eq("campagna_id", c)
  ];
  if (bMaster()) {
    q.push(sb.from("giocatori").select("id, nome").eq("campagna_id", c).eq("ruolo", "giocatore").order("nome"));
    q.push(sb.from("png").select("id, nome").eq("campagna_id", c).eq("archiviato", false).order("nome"));
  }
  return Promise.all(q).then(function (rs) {
    for (var i = 0; i < rs.length; i++) if (rs[i].error) throw rs[i].error;
    B.stato = rs[0].data || null;
    B.mappe = rs[1].data || [];
    B.seg = rs[2].data || [];
    B.pf = {};
    (rs[3].data || []).forEach(function (p) { B.pf[p.segnalino_id] = p; });
    if (bMaster()) { B.pg = rs[4].data || []; B.npc = rs[5].data || []; }
  });
}

// L'immagine di una mappa sta in un archivio privato: si chiede un indirizzo temporaneo (valido un'ora).
function urlMappa(m) {
  var v = B.url[m.percorso];
  if (v && v.scade > Date.now()) return Promise.resolve(v.url);
  return sb.storage.from("mappe").createSignedUrl(m.percorso, 3600).then(function (r) {
    if (r.error) throw r.error;
    B.url[m.percorso] = { url: r.data.signedUrl, scade: Date.now() + 50 * 60 * 1000 };
    return r.data.signedUrl;
  });
}
