/* =====================================================================
   js/scheda/slot-turno.js
   Cosa fa:   Turno (azione, bonus, reazione, movimento), riposi,
              concentrazione, slot incantesimo e risorse.
   Contiene:  htmlTurno, htmlMorte, htmlSlotNumeri, htmlSlot, htmlRisorse
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- turno, concentrazione, riposi
function htmlTurno(s) {
  if (!S.incOk) return "";
  var t = s.turno || {}, fight = inCombattimento(s);
  // Una cella del turno: verde se libera, tratteggiata se usata (con scritto cosa l'ha usata).
  var cella = function (k, l) {
    var u = t[k], det = typeof u === "string" ? u : (u ? "segnata a mano" : "");
    return '<button class="cella ' + (u ? "usata" : "libera") + '" data-act="turno" data-id="' + s.id + '" data-k="' + k + '" aria-pressed="' + !!u + '">' +
      '<span class="lbl">' + l + "</span><strong>" + (u ? "Usata" : "Disponibile") + "</strong>" + (det ? "<small>" + esc(det) + "</small>" : "") + "</button>";
  };
  // Movimento: metri rimasti, con un campo per scrivere quanti ne togli o ne ridai.
  var tot = Number(s.velocita) || 0, usati = Math.min(tot, Number(t.mov) || 0), resta = Math.max(0, tot - usati);
  var mov = '<div class="cella cmov ' + (resta > 0 ? "libera" : "usata") + '"><span class="lbl">Movimento</span><strong>' + fmtVel(resta) + "</strong><small>su " + fmtVel(tot) + "</small>" +
    '<div class="mv"><button class="small" data-act="mov" data-id="' + s.id + '" data-d="-" aria-label="Togli distanza">−</button>' +
    '<input type="text" inputmode="decimal" id="mv_' + s.id + '" value="' + dec(distShow(1.5)) + '" aria-label="Distanza da togliere o ridare">' +
    '<button class="small" data-act="mov" data-id="' + s.id + '" data-d="+" aria-label="Ridai distanza">+</button></div></div>';
  return '<div class="gioco"><div class="turnocelle' + (fight ? "" : " fuori") + '" role="group" aria-label="Turno">' + cella("azione", "Azione") + cella("bonus", "Azione bonus") + cella("reazione", "Reazione") + mov + "</div>" +
    '<div class="row"><button class="small tg-fight' + (fight ? " on" : "") + '" data-act="combat" data-id="' + s.id + '" aria-pressed="' + fight + '">Combattimento: ' + (fight ? "sì" : "no") + "</button>" +
    '<button class="small" data-act="nuovo-turno" data-id="' + s.id + '">Nuovo turno</button>' +
    '<button class="small" data-act="riposo-breve" data-id="' + s.id + '">Riposo breve</button><button class="small" data-act="riposo-lungo" data-id="' + s.id + '">Riposo lungo</button></div>' +
    (s.concentrazione ? '<p class="conc"><strong>In concentrazione:</strong> ' + esc(s.concentrazione) + ' <button class="link" data-act="conc-fine" data-id="' + s.id + '">Termina</button></p>' : "") + "</div>";
}

// ---------------------------------------------------------------- tiri contro morte
// Sempre visibile (più chiaro quando i PF sono sopra 0). I cerchietti si toccano per correggere a mano, «Azzera» li svuota, il pulsante tira il dado e segna da solo.
function htmlMorte(s) {
  if (s.tipo !== "completa") return "";
  var m = morteDi(s), morto = m.f >= 3, stab = !morto && m.s >= 3;
  var pips = function (k, tot) {
    var h = "";
    for (var n = 1; n <= 3; n++)
      h += '<button class="pip morte-' + k + (n <= tot ? "" : " usato") + '" data-act="morte-pip" data-id="' + s.id + '" data-k="' + k + '" data-n="' + n + '" aria-pressed="' + (n <= tot) +
        '" aria-label="' + (k === "s" ? "Successo " : "Fallimento ") + n + (n <= tot ? ", segnato" : ", vuoto") + '"></button>';
    return h;
  };
  // Una sola riga: a sinistra i fallimenti (rossi), al centro il pulsante, a destra i successi (verdi).
  return '<div class="morte' + (Number(s.pf_attuali) > 0 ? " spento" : "") + '"><div class="morte-testa"><h3>Tiri contro morte</h3>' +
    (m.s || m.f ? '<button class="small" data-act="morte-azzera" data-id="' + s.id + '">Azzera</button>' : "") + "</div>" +
    '<div class="morte-riga">' +
    '<div class="morte-lato"><span class="lbl">Fallimenti</span><span class="pips">' + pips("f", m.f) + "</span></div>" +
    '<button class="small primary" data-act="dado" data-k="morte" data-id="' + s.id + '"' + (morto || stab ? " disabled" : "") + '>Tira contro morte</button>' +
    '<div class="morte-lato"><span class="lbl">Successi</span><span class="pips">' + pips("s", m.s) + "</span></div></div>" +
    (morto ? '<p class="avviso">Tre fallimenti: il personaggio è morto.</p>' : stab ? '<p class="hint">Tre successi: sei stabilizzato. Resti a 0 PF finché qualcuno non ti cura.</p>' : "") +
    "</div>";
}

// ---------------------------------------------------------------- slot e risorse
// Solo i numeri (per la sezione Scheda): per ogni livello, quanti slot restano. Gli slot si segnano nella sezione Incantesimi.
function htmlSlotNumeri(s) {
  var tot = s.slot_totali || [], us = s.slot_usati || [], p = [];
  tot.forEach(function (n, lv) { if (n > 0) p.push((lv + 1) + "° livello: " + (n - (us[lv] || 0)) + " di " + n); });
  return p.length ? '<h3>Slot incantesimo</h3><p class="slotnum">' + p.join(" · ") + "</p>" : "";
}
function htmlSlot(s) {
  var tot = s.slot_totali || [], us = s.slot_usati || [];
  if (!tot.some(function (n) { return n > 0; })) return "";
  var h = "<h3>Slot incantesimo" + (s.slot_riposo === "breve" ? " (si recuperano con il riposo breve)" : "") + '</h3><div class="slots">';
  tot.forEach(function (n, lv) {
    if (n <= 0) return;
    var pips = "";
    for (var i = 0; i < n; i++) {
      var u = i < (us[lv] || 0);
      pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="slot" data-id="' + s.id + '" data-lv="' + lv + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="Slot di livello ' + (lv + 1) + ", numero " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
    }
    h += '<div class="slotriga"><span class="slotlv">' + (lv + 1) + '°</span><span class="pips">' + pips + "</span><small>" + (n - (us[lv] || 0)) + " di " + n + "</small></div>";
  });
  return h + "</div>";
}
// I cerchietti degli slot di un livello (lv da 1 a 9), con «x di y». Vuoto se a quel livello non hai slot.
function htmlPipsLivello(s, lv) {
  var n = (s.slot_totali || [])[lv - 1] || 0, us = (s.slot_usati || [])[lv - 1] || 0;
  if (n <= 0) return "";
  var pips = "";
  for (var i = 0; i < n; i++) {
    var u = i < us;
    pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="slot" data-id="' + s.id + '" data-lv="' + (lv - 1) + '" data-i="' + i + '" aria-pressed="' + u +
      '" aria-label="Slot di livello ' + lv + ", numero " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
  }
  return '<span class="pips">' + pips + "</span><small>" + (n - us) + " di " + n + "</small>";
}
function htmlRisorse(s) {
  var r = s.risorse || [];
  if (!r.length) return "";
  return "<h3>Risorse</h3><div class=\"slots\">" + r.map(function (x, k) {
    var pips = "";
    if (x.max <= 10) for (var i = 0; i < x.max; i++) {
      var u = i < x.usati;
      pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="risorsa" data-id="' + s.id + '" data-k="' + k + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="' + esc(x.nome) + ", uso " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
    }
    else pips = '<button class="small" data-act="risorsa-meno" data-id="' + s.id + '" data-k="' + k + '">−</button> <strong>' + (x.max - x.usati) + "</strong> " +
      '<button class="small" data-act="risorsa-piu" data-id="' + s.id + '" data-k="' + k + '">+</button>';
    return '<div class="slotriga"><span class="slotlv nome">' + esc(x.nome) + '</span><span class="pips">' + pips + "</span><small>" + (x.max - x.usati) + " di " + x.max + ", riposo " + (x.recupero === "breve" ? "breve" : "lungo") + "</small></div>";
  }).join("") + "</div>";
}
