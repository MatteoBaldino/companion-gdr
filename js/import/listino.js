/* =====================================================================
   js/import/listino.js
   Cosa fa:   legge i listini Excel (armi, armature, cibi, oggetti, servizi)
              e li trasforma negli oggetti che il database sa salvare.
              Non parla con Supabase e non conosce la pagina: riceve le righe
              già lette dal file e restituisce liste e avvisi.
   Usato da:  importa.html (tramite js/import/pagina.js)
   Provato su: i 5 listini in Drakos (1.030 voci).

   Come si riconosce il tipo di file: dalle INTESTAZIONI delle colonne, non dal
   nome del file. Quindi puoi rinominare i file come vuoi.
   ===================================================================== */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.Listino = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // [REGOLA] Stesse conversioni del sito: 1 lb = 0,5 kg ; 1 ft = 0,3 m (5 ft = 1,5 m).
  var KG_PER_LB = 0.5;
  var M_PER_FT = 0.3;

  // [MODIFICA QUI] Categorie in cui un oggetto vario viene considerato "impilabile" (si passa a pile).
  var IMPILABILI = { cibo: true, vario: true, arma: false, armatura: false };

  // ------------------------------------------------------------------ utilità
  function testo(v) { return v == null ? "" : String(v).trim(); }
  // Vero se la cella è vuota o contiene solo un trattino ("—").
  function vuoto(v) { var t = testo(v); return t === "" || t === "—" || t === "-" || t === "–"; }
  function numero(v) { var n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : null; }
  function arrotonda(x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; }
  function kg(lb) { var n = numero(lb); return n == null ? null : arrotonda(n * KG_PER_LB, 3); }
  function metri(ft) { return arrotonda(Number(ft) * M_PER_FT, 1); }

  // "Gladio / Gladius" -> ["Gladio", "Gladius"]. Senza barra: nome solo italiano.
  function dividiNome(s) {
    var t = testo(s), i = t.indexOf(" / ");
    if (i < 0) return [t, null];
    return [t.slice(0, i).trim(), t.slice(i + 3).trim() || null];
  }

  // Nel database il tipo di danno è al plurale (come negli esempi): perforanti, taglienti, contundenti.
  function pluraleDanno(t) {
    return { perforante: "perforanti", tagliente: "taglienti", contundente: "contundenti" }[t.toLowerCase()] || t;
  }

  // ------------------------------------------------------------ lettura foglio
  // Prende le righe di un foglio (lista di liste) e restituisce { intestazioni, righe }.
  // Le righe sono oggetti { "Nome colonna": valore }. Le note in fondo (senza tipologia) si scartano.
  function leggiFoglio(righe2D) {
    var h = -1, i;
    for (i = 0; i < righe2D.length; i++) {
      if (/^Nome/i.test(testo(righe2D[i][0])) && testo(righe2D[i][1]) === "Tipologia") { h = i; break; }
    }
    if (h < 0) return null;
    var intest = righe2D[h].map(testo), out = [];
    for (i = h + 1; i < righe2D.length; i++) {
      var r = righe2D[i], o = {};
      if (testo(r[0]) === "" || testo(r[1]) === "") continue;   // riga vuota o nota
      intest.forEach(function (c, k) { if (c) o[c] = r[k]; });
      o.__riga = i + 1;                                          // numero di riga nel foglio, per i messaggi
      out.push(o);
    }
    return { intestazioni: intest, righe: out };
  }

  // Quale listino è? Lo dicono le colonne.
  function tipoListino(intest) {
    var h = {}; intest.forEach(function (c) { h[c] = 1; });
    if (h["Tiro per colpire"]) return "armi";
    if (h["Classe Armatura (CA)"]) return "armature";
    if (h["Unità"] && h["Peso (lb)"]) return "cibi";
    if (h["Unità"]) return "servizi";
    if (h["Peso (lb)"]) return "oggetti";
    return null;
  }

  // ------------------------------------------------------------------ armi
  // "1d6 perforante", "1d4 + 1 contundente", "1d8 perforante (1d10 a due mani)", "1 perforante"
  function leggiDanno(s) {
    var m = /^(\d+d\d+|\d+)(?:\s*\+\s*(\d+))?\s+(perforante|tagliente|contundente)\b\s*(.*)$/i.exec(testo(s));
    if (!m) return null;
    var resto = m[4].trim(), versatile = null;
    var v = /\((\d+d\d+(?:\s*\+\s*\d+)?)\s+a due mani\)/i.exec(resto);
    if (v) { versatile = v[1].replace(/\s+/g, ""); resto = resto.replace(v[0], "").trim(); }
    return {
      danno: m[1] + (m[2] ? "+" + m[2] : ""),
      tipo: pluraleDanno(m[3]),
      versatile: versatile,
      nota: resto || null                       // per esempio "(area 3 ft)" o "per spada"
    };
  }

  // "d20 + FOR o DES (accurata)", "d20 + DES (gittata 80/320 ft)", "d20 + FOR (portata 10 ft, a due mani)"
  function leggiTiro(s) {
    var m = /^d20\s*\+\s*(FOR o DES|FOR|DES)(?:\s*\+\s*(\d+))?\s*(?:\((.*)\))?\s*$/i.exec(testo(s));
    if (!m) return null;
    var r = { car: m[1].toUpperCase(), bonus: m[2] ? Number(m[2]) : 0, proprieta: [], gittata: null,
              tipoGittata: null, ricarica: false, note: [] };
    (m[3] ? m[3].split(/[;,]/) : []).forEach(function (tok) {
      tok = tok.trim();
      var l = tok.toLowerCase(), g;
      if (!tok) return;
      if (l === "accurata") r.proprieta.push("Accurata");
      else if (l === "a due mani") r.proprieta.push("A due mani");
      else if (l === "una o due mani") r.proprieta.push("Versatile");
      else if (l === "ricarica") { r.ricarica = true; r.proprieta.push("Ricarica"); }
      else if ((g = /^(gittata|lancio)\s+(\d+)\s*\/\s*(\d+)\s*ft$/i.exec(tok))) {
        r.tipoGittata = g[1].toLowerCase();
        r.gittata = [metri(g[2]), metri(g[3])];
        if (r.tipoGittata === "lancio") r.proprieta.push("Lancio");
      }
      else if (/^portata\s+\d+\s*ft$/i.test(tok)) { r.proprieta.push("Portata"); r.note.push(tok); }
      else r.note.push(tok);
    });
    return r;
  }

  function convertiArmi(righe, esce, avviso) {
    righe.forEach(function (r) {
      var nomi = dividiNome(r["Nome (italiano / inglese)"]);
      var tip = testo(r.Tipologia), danno = testo(r["Danno se il colpo va a segno"]);
      var tiroTxt = testo(r["Tiro per colpire"]), req = testo(r.Requisiti);
      var base = {
        nome: nomi[0], nome_en: nomi[1], tipologia: tip, descrizione: testo(r.Descrizione) || null,
        peso: kg(r["Peso (lb)"]), costo_rame: Math.round(Number(r["Costo in Rame (base di calcolo)"]))
      };
      var regole = [];
      ["Vantaggio / svantaggio al colpire", "Vantaggio / svantaggio al danno"].forEach(function (c, k) {
        var t = testo(r[c]);
        if (!vuoto(t) && !/^—\s*\(vale/.test(t)) regole.push((k === 0 ? "Al colpire: " : "Al danno: ") + t);
      });

      // 1) Munizioni (frecce, quadrelli, pietre da fionda...): non sono armi da impugnare.
      if (tip === "Munizioni" || /^Danno (dell'arco|della balestra)/i.test(danno)) {
        base.categoria = "vario"; base.impilabile = true;
        base.dettagli = { effetto: "Munizione" + (vuoto(req) ? "" : " per: " + req) + ". Danno: " + danno + "." };
        base.regole_extra = regole.join("\n") || null;
        avviso("info", base.nome, "Munizione: importata come oggetto vario", r);
        return esce(base, r);
      }
      // 2) Armi senza danno (reti, bolas, scale, torri): oggetti con un effetto.
      if (/^Nessuno/i.test(danno)) {
        base.categoria = "vario"; base.impilabile = false;
        base.dettagli = { effetto: danno + (vuoto(tiroTxt) ? "" : ". Tiro: " + tiroTxt) +
                                   (vuoto(req) ? "" : ". Requisiti: " + req) };
        base.regole_extra = regole.join("\n") || null;
        avviso("info", base.nome, "Senza danno: importata come oggetto vario", r);
        return esce(base, r);
      }

      // 3) Armi vere.
      var d = leggiDanno(danno), t = leggiTiro(tiroTxt), problemi = [];
      if (!d) problemi.push("danno non riconosciuto («" + danno + "»)");
      if (!t && !vuoto(tiroTxt)) problemi.push("tiro per colpire non riconosciuto («" + tiroTxt + "»)");
      var assedio = tip === "Armi d'Assedio";

      var modalita = "mischia";
      if (assedio) modalita = "assedio";
      else if (t && t.gittata && t.tipoGittata === "gittata") modalita = "distanza";
      else if (t && t.gittata && t.tipoGittata === "lancio") modalita = tip === "Armi da Lancio" ? "lancio" : "mischia";

      var munizioni = null;
      if (tip === "Archi") munizioni = "Frecce";
      if (tip === "Balestre") munizioni = "Quadrelli";

      var serventi = /(\d+)\s+serventi/i.exec(req);
      var dett = {
        categoria_arma: "altro",                                  // [MODIFICA QUI] i tuoi listini non distinguono semplici/da guerra
        modalita: modalita,
        danno: d ? d.danno : (danno || "0"), tipo_danno: d ? d.tipo : "da definire",
        danno_versatile: d ? d.versatile : null,
        proprieta: t ? t.proprieta : [],
        gittata_normale: t && t.gittata ? t.gittata[0] : null,
        gittata_massima: t && t.gittata ? t.gittata[1] : null,
        munizioni_tipo: munizioni,
        bonus_attacco: t ? t.bonus : 0,
        equipaggio_richiesto: assedio ? (serventi ? Number(serventi[1]) : null) : null,
        ricarica_turni: t && t.ricarica ? 1 : null,
        requisiti: vuoto(req) ? null : req
      };
      if (d && d.nota) regole.push("Danno: " + d.nota);
      if (t && t.note.length) regole.push("Tiro: " + t.note.join(", "));
      if (!t && !vuoto(tiroTxt)) regole.push("Tiro per colpire (testo originale): " + tiroTxt);

      // Il database richiede una gittata per le armi che non sono di mischia, e i serventi per l'assedio.
      if (assedio && dett.equipaggio_richiesto == null) {
        problemi.push("mancano i serventi: messo 1"); dett.equipaggio_richiesto = 1;
      }
      if (dett.modalita !== "mischia" && dett.gittata_normale == null) {
        if (assedio) {
          // Macchine d'assedio senza gittata (arieti): si usano in mischia da una squadra.
          // Restano armi da mischia e il numero di serventi è salvato nell'arma.
          dett.modalita = "mischia";
          avviso("info", base.nome, "Assedio senza gittata (ariete): importata come arma da mischia con serventi", r);
        } else {
          problemi.push("manca la gittata: importata come arma da mischia");
          dett.modalita = "mischia";
        }
      }
      if (!d) {                                                    // niente dadi riconoscibili
        base.categoria = "vario"; base.impilabile = false;
        base.dettagli = { effetto: "Danno: " + danno + (vuoto(tiroTxt) ? "" : ". Tiro: " + tiroTxt) +
                                   (vuoto(req) ? "" : ". Requisiti: " + req) };
        base.regole_extra = regole.join("\n") || null;
        avviso("attenzione", base.nome, "Danno non riconosciuto: importata come oggetto vario (" + problemi.join("; ") + ")", r);
        return esce(base, r);
      }
      base.categoria = "arma"; base.impilabile = IMPILABILI.arma;
      base.dettagli = dett;
      base.regole_extra = regole.join("\n") || null;
      problemi.forEach(function (p) { avviso("attenzione", base.nome, p, r); });
      esce(base, r);
    });
  }

  // -------------------------------------------------------------- armature
  var CAT_ARMATURA = { Leggera: "leggera", Media: "media", Pesante: "pesante", Scudo: "scudo",
                       Accessorio: "accessorio", Bardatura: "bardatura" };

  function convertiArmature(righe, esce, avviso) {
    righe.forEach(function (r) {
      var nomi = dividiNome(r["Nome (italiano / inglese)"]);
      var cat = CAT_ARMATURA[testo(r.Categoria)], ca = testo(r["Classe Armatura (CA)"]);
      var base = {
        nome: nomi[0], nome_en: nomi[1], tipologia: testo(r.Tipologia), descrizione: testo(r.Descrizione) || null,
        peso: kg(r["Peso (lb)"]), costo_rame: Math.round(Number(r["Costo in Rame (base di calcolo)"])),
        categoria: "armatura", impilabile: IMPILABILI.armatura
      };
      var regole = [], dett = { categoria_armatura: cat, ca_base: null, usa_destrezza: false, max_destrezza: null,
                                forza_minima: null, svantaggio_furtivita: false, gruppo: null, include_elmo: false };
      var m;
      if (!cat) { avviso("attenzione", base.nome, "Categoria «" + testo(r.Categoria) + "» sconosciuta", r); }

      if ((m = /^(\d+)(?:\s*\+\s*DES(?:\s*\(max\s*(\d+)\))?)?$/i.exec(ca))) {            // "14 + DES (max 2)", "16"
        dett.ca_base = Number(m[1]);
        dett.usa_destrezza = /DES/i.test(ca);
        dett.max_destrezza = m[2] ? Number(m[2]) : null;
      } else if ((m = /^\+(\d+)$/.exec(ca))) {                                            // "+2" (scudi, elmi)
        dett.ca_base = Number(m[1]);
      } else if ((m = /^\+0\s*\(\s*3 pezzi\s*=\s*\+1\s*\)$/i.exec(ca))) {                // "+0 (3 pezzi = +1)"
        dett.ca_base = 0; dett.gruppo = "arti";
        regole.push("Tre pezzi indossati insieme (anche di tipo diverso) danno +1 CA in totale.");
      } else if ((m = /^\+(\d+)\s*\((.*)\)$/.exec(ca))) {                                 // "+3 (+5 se piantato a terra)"
        dett.ca_base = Number(m[1]);
        regole.push("CA: " + m[2]);
      } else {
        avviso("attenzione", base.nome, "CA non riconosciuta («" + ca + "»): messa a 0, da correggere", r);
        dett.ca_base = 0; regole.push("CA (testo originale): " + ca);
      }

      var fm = /FOR\s*(\d+)/i.exec(testo(r["Requisito Forza"]));
      if (fm) dett.forza_minima = Number(fm[1]);

      var vs = testo(r["Vantaggio / svantaggio"]);
      if (!vuoto(vs)) {
        regole.push(vs);
        if (/Svantaggio:[^.]*Furtività/i.test(vs)) dett.svantaggio_furtivita = true;
      }
      if (/elmo\s+incluso|include\s+(anche\s+)?l['’]elmo/i.test(testo(r.Descrizione))) dett.include_elmo = true;
      if (cat === "bardatura") regole.push("La CA indicata è quella della cavalcatura, non di chi la monta.");

      base.dettagli = dett;
      base.regole_extra = regole.join("\n") || null;
      esce(base, r);
    });
  }

  // ------------------------------------------------- cibi, oggetti, servizi
  function convertiCibi(righe, esce) {
    righe.forEach(function (r) {
      var nomi = dividiNome(r["Nome (italiano / inglese)"]);
      esce({
        nome: nomi[0], nome_en: nomi[1], tipologia: testo(r.Tipologia), unita: testo(r["Unità"]) || null,
        descrizione: testo(r.Descrizione) || null, categoria: "cibo", impilabile: IMPILABILI.cibo,
        peso: kg(r["Peso (lb)"]), costo_rame: Math.round(Number(r["Costo in Rame (base di calcolo)"])),
        dettagli: { razioni: 1 }
      }, r);
    });
  }

  function convertiOggetti(righe, esce) {
    righe.forEach(function (r) {
      var nomi = dividiNome(r.Nome);
      esce({
        nome: nomi[0], nome_en: nomi[1], tipologia: testo(r.Tipologia), descrizione: testo(r.Descrizione) || null,
        categoria: "vario", impilabile: IMPILABILI.vario,
        peso: kg(r["Peso (lb)"]), costo_rame: Math.round(Number(r["Costo in Rame (base di calcolo)"])),
        dettagli: {}
      }, r);
    });
  }

  function convertiServizi(righe, esce) {
    righe.forEach(function (r) {
      var nomi = dividiNome(r.Nome);
      esce({
        nome: nomi[0], nome_en: nomi[1], tipologia: testo(r.Tipologia), unita: testo(r["Unità"]) || null,
        descrizione: testo(r.Descrizione) || null,
        costo_rame: Math.round(Number(r["Costo in Rame (base di calcolo)"]))
      }, r);
    });
  }

  // ------------------------------------------------------------ punto d'ingresso
  // file = [{ nome: "Listino_200_Armi.xlsx", righe: [[...], [...]] }, ...]
  // (righe = il primo foglio del file, come lista di liste: lo prepara la pagina con SheetJS)
  function converti(files) {
    var ris = { oggetti: [], servizi: [], avvisi: [], file: [] };
    var visti = {};
    files.forEach(function (f) {
      var foglio = leggiFoglio(f.righe), tipo = foglio ? tipoListino(foglio.intestazioni) : null;
      if (!foglio || !tipo) {
        ris.file.push({ nome: f.nome, tipo: null, voci: 0 });
        ris.avvisi.push({ livello: "errore", file: f.nome, nome: "", messaggio: "File non riconosciuto come listino", riga: null });
        return;
      }
      var n = 0;
      var avviso = function (livello, nome, messaggio, r) {
        ris.avvisi.push({ livello: livello, file: f.nome, nome: nome, messaggio: messaggio, riga: r.__riga });
      };
      var esce = function (o, r) {
        // Controlli comuni a tutte le voci
        if (!o.nome) return avviso("errore", "(senza nome)", "Voce senza nome: saltata", r);
        if (!isFinite(o.costo_rame) || o.costo_rame < 0) return avviso("errore", o.nome, "Prezzo non valido: voce saltata", r);
        if (o.peso != null && (o.peso < 0 || o.peso > 999999)) return avviso("errore", o.nome, "Peso non valido: voce saltata", r);
        var chiave = (tipo === "servizi" ? "s:" : "o:") + o.nome.toLowerCase();
        if (visti[chiave]) return avviso("attenzione", o.nome, "Nome già presente in " + visti[chiave] + ": saltata", r);
        visti[chiave] = f.nome;
        (tipo === "servizi" ? ris.servizi : ris.oggetti).push(o);
        n++;
      };
      if (tipo === "armi") convertiArmi(foglio.righe, esce, avviso);
      else if (tipo === "armature") convertiArmature(foglio.righe, esce, avviso);
      else if (tipo === "cibi") convertiCibi(foglio.righe, esce, avviso);
      else if (tipo === "oggetti") convertiOggetti(foglio.righe, esce, avviso);
      else convertiServizi(foglio.righe, esce, avviso);
      ris.file.push({ nome: f.nome, tipo: tipo, voci: n, lette: foglio.righe.length });
    });
    return ris;
  }

  return { converti: converti, leggiFoglio: leggiFoglio, tipoListino: tipoListino,
           leggiDanno: leggiDanno, leggiTiro: leggiTiro };
});
