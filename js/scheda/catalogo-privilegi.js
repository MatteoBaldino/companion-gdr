/* =====================================================================
   js/scheda/catalogo-privilegi.js
   Cosa fa:   Il catalogo dei privilegi e dei tratti che la scheda mette da sola
              in «Privilegi e tratti», in base a classe, livello e specie, più
              le azioni che hanno tutti (l'attacco di opportunità) e quanti
              trucchetti si conoscono. Le voci con un costo (azione, azione
              bonus o reazione) hanno il pulsante «Usa», che in combattimento
              segna la cella del turno.
   Contiene:  CAT_AZIONI, CAT_CLASSI, CAT_SPECIE, TRUCCHETTI_CLASSE,
              privilegiAuto, trucchettiAttesi
   Fonte:     le regole 2024 (SRD 5.2, licenza Creative Commons CC-BY 4.0),
              riassunte con parole nostre. I nomi italiani sono una nostra
              traduzione: controllali con il manuale.
   Come aggiungere una classe o una specie: copia una voce esistente. Ogni voce:
              l = livello da cui c'è, n = nome, t = descrizione breve,
              a = costo: "azione", "bonus" o "reazione" (se non c'è, è passiva).
   Non c'è niente da salvare: si calcola ogni volta dalla scheda.
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// Le azioni che hanno tutti.
var CAT_AZIONI = [
  { n: "Attacco di opportunità", a: "reazione", t: "Quando una creatura che vedi lascia il tuo raggio d’azione senza disimpegnarsi, fai un attacco in mischia contro di lei. Usa la reazione." }
];

// Classi: l'elenco dei privilegi per livello. La chiave è il nome della classe come lo scrive il sito.
var CAT_CLASSI = {
  Ladro: [
    { l: 1, n: "Maestria", t: "Doppio bonus di competenza in due abilità a tua scelta (altre due al livello 6)." },
    { l: 1, n: "Attacco furtivo", furtivo: true, t: "Danni extra una volta per turno con un’arma accurata o a distanza, se hai vantaggio o un alleato è vicino al bersaglio." },
    { l: 1, n: "Gergo ladresco", t: "Conosci il gergo segreto dei ladri e puoi passare messaggi nascosti." },
    { l: 2, n: "Azione scaltra", a: "bonus", t: "Con l’azione bonus puoi fare Scatto, Disimpegno o Nascondersi." },
    { l: 3, n: "Mira costante", a: "bonus", t: "Se non ti sei mosso in questo turno, hai vantaggio al prossimo attacco; la velocità è 0 fino a fine turno." },
    { l: 5, n: "Colpo scaltro", t: "Rinunci a dadi dell’attacco furtivo per aggiungere un effetto (veleno, inciampo, ritirata)." },
    { l: 5, n: "Schivata prodigiosa", a: "reazione", t: "Dimezzi il danno di un attacco che ti colpisce e che vedi." },
    { l: 7, n: "Evasione", t: "Nei tiri salvezza su Destrezza: nessun danno se riesci, metà se fallisci." },
    { l: 7, n: "Talento affidabile", t: "Nelle prove di abilità in cui sei competente, un d20 sotto 10 vale 10." },
    { l: 11, n: "Colpo scaltro migliorato", t: "Puoi usare due effetti del colpo scaltro insieme." },
    { l: 14, n: "Colpi subdoli", t: "Nuovi effetti del colpo scaltro, più potenti." },
    { l: 15, n: "Mente sfuggente", t: "Competenza nei tiri salvezza su Saggezza e Carisma." },
    { l: 18, n: "Elusivo", t: "Nessun tiro per colpire contro di te ha vantaggio, se non sei incapace di agire." },
    { l: 20, n: "Colpo di fortuna", t: "Se fallisci una prova o un attacco, puoi trasformare il d20 in un 20 (una volta per riposo)." }
  ]
};

// Specie: si riconosce dal nome scritto nella scheda (Elfo, Elfa, Elfi…).
var CAT_SPECIE = [
  { re: /^elf/i, n: "Elfo", f: [
    { n: "Scurovisione", t: "Vedi al buio fino a 18 m." },
    { n: "Retaggio elfico", t: "Scegli un retaggio (Drow, Alto elfo o Elfo dei boschi): dà un trucchetto e, ad alcuni livelli, incantesimi." },
    { n: "Ascendenza fatata", t: "Vantaggio ai tiri salvezza per evitare o terminare lo stato di affascinato." },
    { n: "Sensi acuti", t: "Competenza in una tra Intuizione, Percezione e Sopravvivenza." },
    { n: "Trance", t: "Il riposo lungo dura 4 ore e resti cosciente." }
  ] }
];

// Trucchetti conosciuti per classe: [livello, quanti] (da quel livello in poi). La chiave «Ladro:arcano» vale per il Ladro Mistificatore Arcano.
var TRUCCHETTI_CLASSE = {
  Bardo: [[1, 2], [4, 3], [10, 4]], Chierico: [[1, 3], [4, 4], [10, 5]], Druido: [[1, 2], [4, 3], [10, 4]],
  Stregone: [[1, 4], [4, 5], [10, 6]], Warlock: [[1, 2], [4, 3], [10, 4]], Mago: [[1, 3], [4, 4], [10, 5]],
  "Ladro:arcano": [[3, 3], [10, 4]], "Guerriero:mistico": [[3, 2], [10, 3]]
};
function trucchettiAttesi(s) {
  var tot = 0;
  classiDi(s).forEach(function (c) {
    var t = String(c.sub || s.sottoclasse || "").toLowerCase();
    var tab = TRUCCHETTI_CLASSE[c.n] || (c.n === "Ladro" && t.indexOf("arcan") >= 0 ? TRUCCHETTI_CLASSE["Ladro:arcano"] : null) || (c.n === "Guerriero" && t.indexOf("mistic") >= 0 ? TRUCCHETTI_CLASSE["Guerriero:mistico"] : null);
    if (!tab) return;
    var q = 0; tab.forEach(function (r) { if ((c.lv || 0) >= r[0]) q = r[1]; });
    tot += q;
  });
  return tot;
}

// I privilegi e i tratti automatici della scheda, in gruppi: [{ titolo, voci: [{ n, t, a, l, furtivo }] }].
function privilegiAuto(s) {
  var g = [];
  if (s.tipo === "completa") g.push({ titolo: "Azioni di tutti", voci: CAT_AZIONI });
  classiDi(s).forEach(function (c) {
    var lista = CAT_CLASSI[c.n]; if (!lista) return;
    g.push({ titolo: c.n + ", livello " + (c.lv || 1), voci: lista.filter(function (v) { return v.l <= (c.lv || 1); }) });
  });
  var sp = CAT_SPECIE.filter(function (x) { return x.re.test(String(s.specie || "").trim()); })[0];
  if (sp) g.push({ titolo: sp.n, voci: sp.f });
  return g;
}
