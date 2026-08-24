/* PDF-afschriften lezen: Amex maandafrekening, ABN AMRO bij- en
   afschrijvingen, Revolut consolidated statement.
   Werkt op de tekst-met-posities die pdf.js oplevert, dus dezelfde code
   draait in de browser en in node.                                         */
(function (root) {
  'use strict';
  var L = root.Lezen || (typeof require === 'function' ? require('./lezen.js') : null);

  function tekstVan(regel) {
    return regel.items.map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function alleRegels(paginas) {
    var uit = [];
    paginas.forEach(function (p) {
      p.regels.forEach(function (r) {
        uit.push({ pagina: p.nummer, y: r.y, items: r.items, tekst: tekstVan(r) });
      });
    });
    return uit;
  }
  function schoon(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  var BEDRAG_NL = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;      // 1.234,56
  var BEDRAG_EN = /^-?[€$£]?-?\d{1,3}(?:,\d{3})*\.\d{2}$/; // €1,234.56

  // ------------------------------------------------------------ herkennen
  function herken(paginas) {
    var kop = alleRegels(paginas).slice(0, 40).map(function (r) { return r.tekst; }).join(' | ');
    if (/Maandafrekening/i.test(kop) && /American ?express|The Gold Card|Kaartnummer/i.test(kop)) return 'amex';
    if (/Bij- en afschrijvingen/i.test(kop) && /Rekeninghouder/i.test(kop)) return 'abnamro';
    if (/Custom Statement|Account Statement/i.test(kop) && /Revolut|IBAN/i.test(kop)) return 'revolut';
    return null;
  }

  // ----------------------------------------------------------------- AMEX
  var AMEX_STOP = /^(American Express Europe|Is het adres onjuist|U kunt het adres|eenvoudig wijzigen|via uw online|account op|americanexpress|Totaal|Nieuwe transacties|Kaartnummer|Transactie Datum|The Gold Card|Maandafrekening|Pagina|Naam Kaartnummer|Datum volgende|DHR |DOELSTR|NETHERLANDS|Membership Rewards|Zakelijke uitgaven|BELANGRIJKE|Overige Transacties|\d{4} [A-Z]{2} )/i;
  var AMEX_DETAIL = /(Amerikaanse|dollar|pond sterling|Zwitserse|Deense|Zweedse|Noorse|Poolse|Tsjechische|WISSELKOERS|COMMISSIE BEDRAG|^Verhuur:|^Retour:|^Kilometers:|^Aankomst:|^Vertrek:|Aantal nachten|^\d{2}\/\d{2}\/\d{2})/i;

  function leesAmex(paginas, opties) {
    var regels = alleRegels(paginas);
    var transacties = [], waarschuwingen = [];
    var kaart = null, periode = null, samenvatting = null;

    regels.forEach(function (r, n) {
      var m = r.tekst.match(/xxxx-xxxxxx-(\d{4,5})/i);
      if (m && !kaart) kaart = 'Amex ' + m[1];
      var p = r.tekst.match(/Periode:\s*(\d{2}\.\d{2}\.\d{4})\s*tot\s*(\d{2}\.\d{2}\.\d{4})/i);
      if (p && !periode) periode = { van: p[1], tot: p[2] };
      // Het saldovak bovenaan gebruiken we straks als controlesom.
      if (!samenvatting && /Vorig saldo\s+Crediteringen\s+Debiteringen/i.test(r.tekst)) {
        var cijfers = (regels[n + 1] || { tekst: '' }).tekst
          .split(/\s+/).filter(function (w) { return BEDRAG_NL.test(w); });
        if (cijfers.length >= 4) {
          samenvatting = {
            vorigSaldo: L.leesBedrag(cijfers[0]),
            crediteringen: L.leesBedrag(cijfers[1]),
            debiteringen: L.leesBedrag(cijfers[2]),
            nieuwSaldo: L.leesBedrag(cijfers[3])
          };
        }
      }
    });

    // Blokken onder "Uitgaven in behandeling" staan er alleen ter informatie;
    // ze zitten niet in het te betalen bedrag en zijn dus geen uitgave.
    var inBehandeling = {};
    var behandel = false, vorigePagina = null;
    regels.forEach(function (r, n) {
      if (r.pagina !== vorigePagina) { behandel = false; vorigePagina = r.pagina; }
      if (/Uitgaven in behandeling/i.test(r.tekst)) { behandel = true; return; }
      if (/^(Nieuwe transacties voor|Overige Transacties:|Totaal voor|Membership Rewards)/i.test(r.tekst)) behandel = false;
      if (behandel) inBehandeling[n] = true;
    });

    for (var i = 0; i < regels.length; i++) {
      if (inBehandeling[i]) continue;
      var start = regels[i].tekst.match(/^(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s*(.*)$/);
      if (!start) continue;

      var stukken = [start[3]];
      for (var j = i + 1; j < Math.min(i + 7, regels.length); j++) {
        var t = regels[j].tekst;
        if (/^\d{2}\.\d{2}\.\d{2}\s+\d{2}\.\d{2}\.\d{2}\b/.test(t)) break;
        if (AMEX_STOP.test(t)) break;
        // Koersinformatie en huurgegevens horen niet bij de naam van de winkel.
        if (AMEX_DETAIL.test(t)) { stukken.push('\u0000' + t); continue; }
        stukken.push(t);
      }
      var blok = stukken.join(' ').replace(/\s+/g, ' ').trim();
      // Alles vanaf de eerste toelichtingsregel telt niet mee voor de naam,
      // maar het bedrag ervoor wel.
      var kern = blok.split('\u0000')[0].trim();
      blok = blok.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();

      // Het eerste bedrag met komma-decimalen is het bedrag in euro's;
      // vreemde valuta staat met een punt geschreven en telt niet mee.
      var woorden = blok.split(' ');
      var bedrag = null, bedragIndex = -1;
      for (var k = 0; k < woorden.length; k++) {
        if (BEDRAG_NL.test(woorden[k])) { bedrag = L.leesBedrag(woorden[k]); bedragIndex = k; break; }
      }
      if (bedrag === null) continue;

      var credit = /(^|\s)CR(\s|$)/.test(blok.slice(blok.indexOf(woorden[bedragIndex])));
      var omschrijving = schoon(kern.split(' ').filter(function (w) {
        return w !== 'CR' && !BEDRAG_NL.test(w);
      }).join(' '));
      if (!omschrijving) omschrijving = schoon(blok.split(' ').filter(function (w, n) {
        return n !== bedragIndex && w !== 'CR';
      }).join(' '));

      // Boekhoudkundig heen-en-weer rond een betwiste betaling: het uitstel en
      // de terugboeking daarvan heffen elkaar op en zitten niet in het te
      // betalen bedrag. De oorspronkelijke afschrijving staat op een eerder
      // afschrift en telt daar al mee.
      if (/UITSTEL VAN BETALING|TERUGBOEKING UITSTEL|BETWISTE BETALING/i.test(omschrijving)) continue;

      var datum = start[1].split('.');
      transacties.push({
        datum: '20' + datum[2] + '-' + datum[1] + '-' + datum[0],
        // Uitgaven staan positief op een creditcardafrekening; CR is een
        // bijschrijving (betaling of teruggave).
        bedrag: credit ? Math.abs(bedrag) : -Math.abs(bedrag),
        omschrijving: omschrijving,
        rekening: kaart || 'Amex'
      });
    }

    // Controlesom: mijn optelling naast die van Amex zelf.
    var controle = null;
    if (samenvatting) {
      var mijnDebet = transacties.reduce(function (t, x) { return t + (x.bedrag < 0 ? -x.bedrag : 0); }, 0);
      var mijnCredit = transacties.reduce(function (t, x) { return t + (x.bedrag > 0 ? x.bedrag : 0); }, 0);
      controle = {
        debiteringen: { afschrift: samenvatting.debiteringen, gelezen: Math.round(mijnDebet * 100) / 100 },
        crediteringen: { afschrift: samenvatting.crediteringen, gelezen: Math.round(mijnCredit * 100) / 100 }
      };
      controle.klopt = Math.abs(controle.debiteringen.afschrift - controle.debiteringen.gelezen) < 0.02 &&
        Math.abs(controle.crediteringen.afschrift - controle.crediteringen.gelezen) < 0.02;
      if (!controle.klopt) {
        waarschuwingen.push('Mijn optelling wijkt af van het afschrift: uitgaven ' +
          controle.debiteringen.gelezen + ' tegenover ' + controle.debiteringen.afschrift +
          ', bijschrijvingen ' + controle.crediteringen.gelezen + ' tegenover ' +
          controle.crediteringen.afschrift + '. Controleer dit afschrift.');
      }
    }

    return {
      bron: 'amex',
      rekeningen: [{ id: kaart || 'Amex', naam: kaart || 'Amex', soort: 'creditcard', aandeel: 1 }],
      transacties: transacties,
      periode: periode,
      controle: controle,
      waarschuwingen: waarschuwingen
    };
  }

  // -------------------------------------------------------------- ABN AMRO
  function leesAbn(paginas, opties) {
    var regels = alleRegels(paginas);
    var transacties = [], waarschuwingen = [];
    var rekening = null, houder = null;

    regels.slice(0, 30).forEach(function (r) {
      var m = r.tekst.match(/Rekeninghouder\s+(.+?)$/i);
      if (m && !houder) houder = schoon(m[1]);
      var n = r.tekst.match(/(Priverekening|Privérekening|Ondernemersrekenin\s*g?|Ondernemersrekening|Betaalrekening|Spaarrekening)\s*([\d.]{8,})/i);
      if (n && !rekening) {
        rekening = { soort: schoon(n[1]).replace(/\s+/g, ''), nummer: schoon(n[2]) };
      }
    });
    if (!rekening) {
      var alt = regels.slice(0, 30).map(function (r) { return r.tekst; }).join(' ').match(/\b(\d{2}\.\d{2}\.\d{2}\.\d{3})\b/);
      rekening = { soort: 'Rekening', nummer: alt ? alt[1] : 'onbekend' };
    }
    var zakelijk = /ondernemers|zakelijk/i.test(rekening.soort);
    var naam = (zakelijk ? 'ABN zakelijk ' : 'ABN ') + rekening.nummer;

    // Kolomposities van "Bedrag af" en "Bedrag bij".
    var xAf = null, xBij = null;
    regels.forEach(function (r) {
      r.items.forEach(function (it, n) {
        var samen = (it.s + ' ' + ((r.items[n + 1] || {}).s || '')).toLowerCase();
        if (/^bedrag af/.test(samen) && xAf === null) xAf = it.x;
        if (/^bedrag bij/.test(samen) && xBij === null) xBij = it.x;
      });
    });
    if (xAf === null || xBij === null) {
      return { fout: 'Ik kan de kolommen "Bedrag af" en "Bedrag bij" niet vinden in dit ABN-overzicht.' };
    }
    var grens = (xAf + xBij) / 2;

    var huidige = null;
    function sluit() {
      if (huidige && huidige.bedrag !== null) {
        transacties.push({
          datum: huidige.datum,
          bedrag: huidige.bedrag,
          omschrijving: schoon(huidige.tekst),
          rekening: naam
        });
      }
      huidige = null;
    }

    var FURNITUUR = /^(Pagina|Datum\s+Omschrijving|Rekeninghouder|Periode|Saldo|Bij- en afschrijvingen|Aantal|Totaal (afgeschreven|bijgeschreven)|Priverekening|Privérekening|Ondernemersrekenin|Betaalrekening|Volgnummer|IBAN\b|BIC\b|Eerste |Doelstraat|\d{4} [A-Z]{2} )/i;

    regels.forEach(function (r) {
      var eerste = r.items[0];
      if (!eerste) return;
      var datum = L.leesDatum(eerste.s);
      var isStart = datum && /^\d{2}-\d{2}-\d{4}$/.test(eerste.s.trim()) && eerste.x < 60;

      if (isStart) {
        sluit();
        var bedrag = null;
        var rest = [];
        r.items.slice(1).forEach(function (it) {
          if (BEDRAG_NL.test(it.s) && it.x > xAf - 40) {
            var w = L.leesBedrag(it.s);
            bedrag = it.x < grens ? -Math.abs(w) : Math.abs(w);
          } else rest.push(it.s);
        });
        huidige = { datum: datum, bedrag: bedrag, tekst: rest.join(' ') };
        return;
      }
      if (!huidige) return;
      if (FURNITUUR.test(r.tekst)) { sluit(); return; }
      // Vervolgregel van de omschrijving.
      var extra = [];
      r.items.forEach(function (it) {
        if (BEDRAG_NL.test(it.s) && it.x > xAf - 40) {
          if (huidige.bedrag === null) {
            var w = L.leesBedrag(it.s);
            huidige.bedrag = it.x < grens ? -Math.abs(w) : Math.abs(w);
          }
        } else extra.push(it.s);
      });
      huidige.tekst += ' ' + extra.join(' ');
    });
    sluit();

    return {
      bron: 'abnamro',
      rekeningen: [{
        id: naam, naam: naam, soort: zakelijk ? 'zakelijk' : 'betaalrekening',
        houder: houder, aandeel: 1
      }],
      // Het rekeningnummer zonder punten komt terug in de IBAN op andere
      // afschriften; zo herkennen we overboekingen naar onszelf.
      eigenIbans: ['0' + rekening.nummer.replace(/\D/g, '')],
      transacties: transacties,
      waarschuwingen: waarschuwingen
    };
  }

  // --------------------------------------------------------------- REVOLUT
  var MAANDEN_EN = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

  function leesRevolut(paginas, opties) {
    var regels = alleRegels(paginas);
    var transacties = [], rekeningen = {}, saldi = {}, waarschuwingen = [], eigenIbans = [];
    var hoofdstuk = 'samenvatting';   // samenvatting | rekeningen | sparen | beleggen | crypto
    var rekening = null;              // huidige rekening binnen het hoofdstuk
    var tabel = null;                 // 'mutaties' | 'rente' | null
    var huidige = null;

    function sluit() {
      if (huidige && huidige.bedrag !== null) transacties.push(huidige.uit());
      huidige = null;
    }

    function rekeningVan(naam, soort) {
      var id = 'Revolut ' + naam;
      rekeningen[id] = rekeningen[id] || {
        id: id, naam: id, soort: soort,
        // Aandeel is per rekening instelbaar; zet hem op 0.5 als je er een
        // echt met iemand deelt. Standaard reken je alles aan jezelf toe.
        aandeel: (opties.aandelen || {})[id] != null ? opties.aandelen[id] : 1
      };
      return id;
    }

    regels.forEach(function (r) {
      var t = r.tekst;

      // Hoofdstukken van het overzicht.
      if (/^Current Accounts Transaction Statements/i.test(t)) { sluit(); hoofdstuk = 'rekeningen'; rekening = null; tabel = null; return; }
      if (/^(Flexible Cash Funds|Savings) Transaction Statements/i.test(t)) { sluit(); hoofdstuk = 'sparen'; rekening = null; tabel = null; return; }
      if (/^Investment Services Transaction Statements/i.test(t)) { sluit(); hoofdstuk = 'beleggen'; rekening = null; tabel = null; return; }
      if (/^Crypto Transaction Statements/i.test(t)) { sluit(); hoofdstuk = 'crypto'; rekening = null; tabel = null; return; }

      // Rekening- of productkop.
      var kop = t.match(/^([A-Z][A-Za-z ]{0,24}?)\s*(?:Account\s*)?\((EUR|USD|GBP)\)\s*$/);
      if (kop) {
        sluit();
        var naam = schoon(kop[1]);
        rekening = null; tabel = null;
        if (hoofdstuk === 'rekeningen') {
          var soort = /flexible|savings|auto|pocket|vault/i.test(naam) ? 'spaarpot' : 'betaalrekening';
          rekening = rekeningVan(naam.toLowerCase() === 'personal' ? 'privé' : naam.toLowerCase(), soort);
        }
        saldi.laatste = naam;
        return;
      }

      var ib = t.match(/Account Number \((?:NL|LT) IBAN\)\s*([A-Z]{2}\d{2}[A-Z0-9]{10,26})/i);
      if (ib) eigenIbans.push(ib[1].toUpperCase());

      // Saldo's uit de samenvatting, handig als beginstand voor de planner.
      if (hoofdstuk === 'samenvatting' && saldi.laatste) {
        var o = t.match(/^Opening balance\s*€([\d,.]+)/i);
        var c = t.match(/^Closing balance\s*€([\d,.]+)/i);
        if (o || c) {
          var vak = saldi[saldi.laatste] = saldi[saldi.laatste] || {};
          if (o && vak.opening == null) vak.opening = L.leesBedrag(o[1]);
          if (c && vak.sluiting == null) vak.sluiting = L.leesBedrag(c[1]);
        }
      }

      // Welke tabel volgt?
      if (/^Date\s+Description\s+Category/i.test(t)) { sluit(); tabel = 'mutaties'; return; }
      if (/^Date\s+Description\s+Net returns/i.test(t)) { sluit(); tabel = 'rente'; return; }
      if (/^(Custom Statement|Generated on|Report generated|Current Accounts Summaries|Account Statement|Information about)/i.test(t)) { sluit(); return; }

      if (hoofdstuk !== 'rekeningen' || tabel !== 'mutaties' || !rekening) return;

      var m = t.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})\s+(.*)$/);
      if (m) {
        sluit();
        var maand = MAANDEN_EN[m[1].toLowerCase()];
        if (!maand) return;
        var datum = m[3] + '-' + maand + '-' + String(m[2]).padStart(2, '0');
        var rest = m[4].split(' ');
        var woorden = [], bedrag = null, hint = null;
        for (var i = 0; i < rest.length; i++) {
          var w = rest[i];
          var kaal = w.replace(/[€$£]/g, '');
          if (BEDRAG_EN.test(w) || BEDRAG_EN.test(kaal)) {
            if (bedrag === null) {
              bedrag = Math.abs(L.leesBedrag(kaal));
              if (/^-/.test(w) || /^-/.test(kaal)) bedrag = -bedrag;
              hint = woorden.length ? woorden[woorden.length - 1] : null;
              if (hint) woorden.pop();
            }
            continue; // daarna volgen saldo, kosten en belasting
          }
          if (bedrag === null) woorden.push(w);
        }
        var rekeningId = rekening;
        huidige = {
          bedrag: bedrag,
          voegToe: function (extra) { woorden.push(extra); },
          uit: function () {
            return { datum: datum, bedrag: bedrag, omschrijving: schoon(woorden.join(' ')),
              rekening: rekeningId, categorieHint: hint };
          }
        };
        return;
      }
      // Vervolgregel van een omschrijving.
      if (huidige && !/[€$£]\s?-?[\d,]+\.\d{2}/.test(t) && t.length < 60) huidige.voegToe(t);
      else if (huidige) sluit();
    });
    sluit();

    return {
      bron: 'revolut',
      rekeningen: Object.keys(rekeningen).map(function (k) { return rekeningen[k]; }),
      transacties: transacties,
      saldi: saldi,
      eigenIbans: eigenIbans,
      waarschuwingen: waarschuwingen
    };
  }

  // ------------------------------------------------------------------- API
  function lees(paginas, opties) {
    opties = opties || {};
    var soort = opties.bron || herken(paginas);
    var uit;
    if (soort === 'amex') uit = leesAmex(paginas, opties);
    else if (soort === 'abnamro') uit = leesAbn(paginas, opties);
    else if (soort === 'revolut') uit = leesRevolut(paginas, opties);
    else return { fout: 'Ik herken dit PDF-bestand niet als een afschrift van Amex, ABN AMRO of Revolut.' };
    if (uit.fout) return uit;

    // Aankleden tot volwaardige transacties.
    var perRekening = {};
    uit.rekeningen.forEach(function (r) { perRekening[r.id] = r; });
    var teller = {};
    uit.transacties = uit.transacties.filter(function (t) {
      return t.datum && t.bedrag !== null && isFinite(t.bedrag) && t.bedrag !== 0;
    }).map(function (t) {
      var rek = perRekening[t.rekening] || { aandeel: 1 };
      var basis = t.rekening + '|' + t.datum + '|' + t.bedrag.toFixed(2) + '|' + t.omschrijving;
      teller[basis] = (teller[basis] || 0) + 1;
      var tegenpartij = L.tegenpartijUit(t.omschrijving, uit.bron);
      return {
        id: L.hash(basis + '#' + teller[basis]),
        bron: uit.bron,
        rekening: t.rekening,
        aandeel: rek.aandeel == null ? 1 : rek.aandeel,
        datum: t.datum,
        maand: t.datum.slice(0, 7),
        bedrag: Math.round(t.bedrag * 100) / 100,
        omschrijving: t.omschrijving,
        categorieHint: t.categorieHint || null,
        tegenpartij: tegenpartij,
        sleutel: L.sleutelVan(tegenpartij)
      };
    });
    uit.transacties.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
    uit.periode = uit.transacties.length
      ? { van: uit.transacties[0].datum, tot: uit.transacties[uit.transacties.length - 1].datum } : null;
    return uit;
  }

  var LezenPdf = { lees: lees, herken: herken, alleRegels: alleRegels };
  if (typeof module !== 'undefined' && module.exports) module.exports = LezenPdf;
  root.LezenPdf = LezenPdf;
})(typeof globalThis !== 'undefined' ? globalThis : this);
