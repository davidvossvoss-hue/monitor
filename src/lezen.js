/* Bankbestanden inlezen.
   Herkent het scheidingsteken, de kop, de kolommen en het tekengebruik zelf.
   Kent daarnaast de eigenaardigheden van ABN AMRO, Revolut en Amex.
   Werkt in de browser (window.Lezen) en in node (module.exports).           */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ tekst
  function splitsRegels(tekst) {
    return String(tekst).replace(/^﻿/, '').split(/\r\n|\n|\r/)
      .filter(function (r) { return r.trim() !== ''; });
  }

  // Eén regel opdelen, met respect voor aanhalingstekens.
  function splitsRegel(regel, teken) {
    var velden = [], huidig = '', inCitaat = false;
    for (var i = 0; i < regel.length; i++) {
      var c = regel[i];
      if (c === '"') {
        if (inCitaat && regel[i + 1] === '"') { huidig += '"'; i++; }
        else inCitaat = !inCitaat;
      } else if (c === teken && !inCitaat) {
        velden.push(huidig); huidig = '';
      } else huidig += c;
    }
    velden.push(huidig);
    return velden.map(function (v) { return v.trim(); });
  }

  // Het scheidingsteken is dat teken dat op elke regel even vaak voorkomt.
  function raadScheidingsteken(regels) {
    var kandidaten = ['\t', ';', ',', '|'];
    var beste = ',', besteScore = -1;
    kandidaten.forEach(function (t) {
      var aantallen = regels.slice(0, 12).map(function (r) { return splitsRegel(r, t).length; });
      var eerste = aantallen[0];
      if (eerste < 2) return;
      var gelijk = aantallen.every(function (a) { return a === eerste; });
      var score = (gelijk ? 1000 : 0) + eerste;
      if (score > besteScore) { besteScore = score; beste = t; }
    });
    return beste;
  }

  // ------------------------------------------------------------------ datum
  var DATUMVORMEN = [
    { p: /^(\d{4})(\d{2})(\d{2})$/, j: 1, m: 2, d: 3 },
    { p: /^(\d{4})-(\d{2})-(\d{2})/, j: 1, m: 2, d: 3 },
    { p: /^(\d{4})\/(\d{2})\/(\d{2})/, j: 1, m: 2, d: 3 },
    { p: /^(\d{1,2})-(\d{1,2})-(\d{4})/, j: 3, m: 2, d: 1 },
    { p: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, j: 3, m: 2, d: 1 },
    { p: /^(\d{1,2})\.(\d{1,2})\.(\d{4})/, j: 3, m: 2, d: 1 }
  ];

  function leesDatum(waarde) {
    var s = String(waarde || '').trim();
    for (var i = 0; i < DATUMVORMEN.length; i++) {
      var v = DATUMVORMEN[i], m = s.match(v.p);
      if (m) {
        var jaar = m[v.j], maand = String(m[v.m]).padStart(2, '0'), dag = String(m[v.d]).padStart(2, '0');
        if (+maand < 1 || +maand > 12 || +dag < 1 || +dag > 31) return null;
        return jaar + '-' + maand + '-' + dag;
      }
    }
    return null;
  }
  function ziterDatumUit(w) { return leesDatum(w) !== null; }

  // ----------------------------------------------------------------- bedrag
  function leesBedrag(waarde) {
    var s = String(waarde == null ? '' : waarde).trim();
    if (!s) return null;
    var negatief = /^-/.test(s) || /^\(.*\)$/.test(s);
    s = s.replace(/[()]/g, '').replace(/[^\d.,-]/g, '').replace(/-/g, '');
    if (!s) return null;
    var laatstePunt = s.lastIndexOf('.'), laatsteKomma = s.lastIndexOf(',');
    if (laatstePunt > -1 && laatsteKomma > -1) {
      // Het laatste van de twee is de decimaalscheiding.
      if (laatsteKomma > laatstePunt) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (laatsteKomma > -1) {
      // Duizendtallen of decimalen? "1,234" met 3 cijfers erachter is duizendtal.
      s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (laatstePunt > -1) {
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return negatief ? -n : n;
  }
  function ziterBedragUit(w) {
    var s = String(w || '').trim();
    return /^-?\(?\s*[€$]?\s*-?[\d.,]+\s*\)?$/.test(s) && /\d/.test(s) && leesBedrag(s) !== null;
  }

  // --------------------------------------------------------------- kolommen
  var KOPPEN = {
    datum: ['datum', 'date', 'transactiedatum', 'transactiondate', 'boekingsdatum', 'completed date',
            'started date', 'valuedate', 'rentedatum', 'interestdate'],
    bedrag: ['bedrag', 'amount', 'mutatie', 'bedrag (eur)', 'transactiebedrag'],
    omschrijving: ['omschrijving', 'description', 'mededelingen', 'naam / omschrijving', 'details',
                   'uitgebreide omschrijving', 'narrative'],
    afbij: ['af bij', 'af/bij', 'debit/credit', 'debit credit', 'bij/af', 'type mutatie'],
    munt: ['currency', 'muntsoort', 'valuta'],
    status: ['state', 'status']
  };

  function rolVanKop(kop) {
    var k = String(kop).toLowerCase().replace(/["']/g, '').trim();
    for (var rol in KOPPEN) {
      if (KOPPEN[rol].indexOf(k) > -1) return rol;
    }
    return null;
  }

  // Zonder bruikbare kop: kies op basis van de inhoud.
  function kolommenUitInhoud(rijen) {
    var breedte = rijen[0].length, kandidaten = { datum: [], bedrag: [], tekst: [] };
    for (var k = 0; k < breedte; k++) {
      var kolom = rijen.map(function (r) { return r[k]; });
      var datums = kolom.filter(ziterDatumUit).length;
      var bedragen = kolom.filter(ziterBedragUit).length;
      var lengte = kolom.reduce(function (t, v) { return t + String(v || '').length; }, 0) / kolom.length;
      if (datums / kolom.length > 0.8) kandidaten.datum.push({ k: k, score: datums });
      else if (bedragen / kolom.length > 0.8) kandidaten.bedrag.push({ k: k, score: lengte });
      else kandidaten.tekst.push({ k: k, score: lengte });
    }
    kandidaten.tekst.sort(function (a, b) { return b.score - a.score; });
    // Van de bedragkolommen is die met de meeste verschillende waarden meestal
    // het mutatiebedrag; saldokolommen lopen op.
    var bedrag = kandidaten.bedrag.length ? kiesMutatieKolom(rijen, kandidaten.bedrag) : null;
    return {
      datum: kandidaten.datum.length ? kandidaten.datum[0].k : null,
      bedrag: bedrag,
      omschrijving: kandidaten.tekst.length ? kandidaten.tekst[0].k : null
    };
  }

  // Een saldokolom verandert weinig per regel; een mutatiekolom springt.
  function kiesMutatieKolom(rijen, kandidaten) {
    var beste = kandidaten[0].k, besteScore = -1;
    kandidaten.forEach(function (c) {
      var waarden = rijen.map(function (r) { return leesBedrag(r[c.k]); })
        .filter(function (v) { return v !== null; });
      if (!waarden.length) return;
      var negatieven = waarden.filter(function (v) { return v < 0; }).length / waarden.length;
      var gemiddelde = waarden.reduce(function (a, b) { return a + Math.abs(b); }, 0) / waarden.length;
      // Mutaties zijn klein en vaak negatief; saldi zijn groot en bijna altijd positief.
      var score = negatieven * 2 + (gemiddelde > 0 ? 1 / Math.log10(gemiddelde + 10) : 0);
      if (score > besteScore) { besteScore = score; beste = c.k; }
    });
    return beste;
  }

  // ------------------------------------------------------------- tegenpartij
  function schoon(tekst) {
    return String(tekst || '').replace(/\s+/g, ' ').trim();
  }

  function tegenpartijUit(omschrijving, bron) {
    var s = schoon(omschrijving);
    if (bron === 'abnamro') {
      var m;
      if ((m = s.match(/INCASSANT:\s*(.+?)(?:\s+(?:OMSCHRIJVING|MACHTIGING|KENMERK|IBAN|BIC|REK):|$)/i))) return schoon(m[1]);
      if ((m = s.match(/NAAM:\s*(.+?)(?:\s+(?:OMSCHRIJVING|IBAN|BIC|KENMERK):|$)/i))) return schoon(m[1]);
      if ((m = s.match(/^BEA,?\s*Betaalpas\s+(.+?)(?:,\s*PAS\d*|\s+NR:|$)/i))) return schoon(m[1]);
      if ((m = s.match(/^GEA,?\s*Betaalpas\s+(.+?)(?:,\s*PAS\d*|\s+NR:|$)/i))) return 'Geldautomaat ' + schoon(m[1]);
      if ((m = s.match(/^(?:SEPA\s+\w+\s*)+(.+)$/i))) return schoon(m[1]).slice(0, 60);
    }
    return s.slice(0, 60);
  }

  // Voor het groeperen: hoofdletters, filiaalnummers en ruis eraf.
  function sleutelVan(tegenpartij) {
    return String(tegenpartij || '')
      .toUpperCase()
      .replace(/\bNR:?\s*\S+/g, ' ')
      .replace(/\bPAS\s*\d+/g, ' ')
      .replace(/\b\d{2}[.\/]\d{2}[.\/]\d{2,4}\b/g, ' ')
      .replace(/\b\d{2}:\d{2}\b/g, ' ')
      .replace(/[*#]+\d+/g, ' ')
      .replace(/\b\d{3,}\b/g, ' ')
      .replace(/\b(B\.?V\.?|N\.?V\.?|UAB|LTD|GMBH|INC|SA|AG|EUROPE|NEDERLAND|NETHERLANDS|AMSTERDAM|ROTTERDAM|UTRECHT|DEN HAAG)\b/g, ' ')
      .replace(/[^A-Z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ------------------------------------------------------------------- hash
  function hash(tekst) {
    var h = 5381;
    for (var i = 0; i < tekst.length; i++) h = ((h << 5) + h + tekst.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // ------------------------------------------------------------------ bronnen
  function raadBron(kop, rijen, teken) {
    var kopTekst = (kop || []).join('|').toLowerCase();
    if (/started date/.test(kopTekst) && /completed date/.test(kopTekst)) return 'revolut';
    if (/accountnumber/.test(kopTekst) || /rekeningnummer/.test(kopTekst)) return 'abnamro';
    if (/card member/.test(kopTekst) || /kaarthouder/.test(kopTekst)) return 'amex';
    var eerste = rijen[0] || [];
    if (teken === '\t' && eerste.length >= 7 && /^[A-Z]{2}\d{2}[A-Z]{4}|^\d{9,10}$/.test(eerste[0] || '') &&
        /^[A-Z]{3}$/.test(eerste[1] || '') && /^\d{8}$/.test(eerste[2] || '')) return 'abnamro';
    if (kop && /^datum$/i.test(String(kop[0]).replace(/"/g, '')) && kop.length <= 12 &&
        /omschrijving/i.test(kopTekst) && /bedrag/i.test(kopTekst)) return 'amex';
    return 'onbekend';
  }

  // ABN levert zonder kop: vaste kolomvolgorde.
  var ABN_KOLOMMEN = { datum: 2, bedrag: 6, omschrijving: 7 };

  // ---------------------------------------------------------------- inlezen
  function lees(tekst, opties) {
    opties = opties || {};
    var waarschuwingen = [];
    var regels = splitsRegels(tekst);
    if (regels.length < 2) return { fout: 'Dit bestand bevat geen regels om te lezen.' };

    var teken = opties.scheidingsteken || raadScheidingsteken(regels);
    var alles = regels.map(function (r) { return splitsRegel(r, teken); });

    // Kop of niet?
    var eerste = alles[0];
    var heeftKop = !eerste.some(ziterDatumUit) &&
      eerste.filter(function (c) { return c && !ziterBedragUit(c); }).length >= Math.max(2, eerste.length - 2);
    var kop = heeftKop ? eerste : null;
    var rijen = heeftKop ? alles.slice(1) : alles;
    if (!rijen.length) return { fout: 'Alleen een kopregel gevonden, geen transacties.' };

    // Rijen met een afwijkend aantal kolommen overslaan (voet- of subtotaalregels).
    var breedte = rijen[0].length;
    var overgeslagen = 0;
    rijen = rijen.filter(function (r) {
      if (r.length === breedte) return true;
      overgeslagen++; return false;
    });
    if (overgeslagen) waarschuwingen.push(overgeslagen + ' regel(s) overgeslagen met een afwijkend aantal kolommen.');

    var bron = opties.bron || raadBron(kop, rijen, teken);

    // Kolommen bepalen: eerst de kop, dan de inhoud, dan het bronprofiel.
    var kolom = { datum: null, bedrag: null, omschrijving: null, afbij: null, status: null };
    if (kop) {
      kop.forEach(function (naam, i) {
        var rol = rolVanKop(naam);
        if (rol && kolom[rol] == null) kolom[rol] = i;
        else if (rol === 'datum' && kolom.datum != null && /completed/i.test(naam)) kolom.datum = i;
      });
    }
    if (bron === 'abnamro' && !kop) kolom = Object.assign({}, kolom, ABN_KOLOMMEN);
    if (kolom.datum == null || kolom.bedrag == null || kolom.omschrijving == null) {
      var geraden = kolommenUitInhoud(rijen);
      if (kolom.datum == null) kolom.datum = geraden.datum;
      if (kolom.bedrag == null) kolom.bedrag = geraden.bedrag;
      if (kolom.omschrijving == null) kolom.omschrijving = geraden.omschrijving;
    }
    if (opties.kolommen) kolom = Object.assign(kolom, opties.kolommen);

    if (kolom.datum == null || kolom.bedrag == null) {
      return {
        fout: 'Ik vind geen datum- en bedragkolom in dit bestand.',
        kop: kop, voorbeeldrijen: rijen.slice(0, 5), scheidingsteken: teken
      };
    }

    // Regels omzetten.
    var ruw = [];
    rijen.forEach(function (r, i) {
      var datum = leesDatum(r[kolom.datum]);
      var bedrag = leesBedrag(r[kolom.bedrag]);
      if (datum === null || bedrag === null) { overgeslagen++; return; }
      if (kolom.afbij != null && /^af$|debit|^d$/i.test(r[kolom.afbij])) bedrag = -Math.abs(bedrag);
      if (kolom.afbij != null && /^bij$|credit|^c$/i.test(r[kolom.afbij])) bedrag = Math.abs(bedrag);
      if (kolom.status != null && r[kolom.status] && !/completed|voltooid|gereed/i.test(r[kolom.status])) return;
      ruw.push({
        datum: datum, bedrag: bedrag,
        omschrijving: schoon(r[kolom.omschrijving != null ? kolom.omschrijving : 0]),
        regel: r
      });
    });
    if (!ruw.length) return { fout: 'Geen bruikbare transactieregels gevonden.', kop: kop };

    // Tekengebruik. Creditcarduitdraaien zetten uitgaven vaak positief neer.
    var positief = ruw.filter(function (t) { return t.bedrag > 0; }).length / ruw.length;
    var draaien = opties.tekenOmdraaien;
    if (draaien == null) {
      draaien = positief > 0.75;
      if (draaien) waarschuwingen.push(
        'In dit bestand staat ' + Math.round(positief * 100) + '% van de bedragen positief. ' +
        'Ik lees ze daarom als uitgaven (creditcard-stijl). Klopt dat niet, draai het teken dan om.');
    }
    if (draaien) ruw.forEach(function (t) { t.bedrag = -t.bedrag; });

    // Identiteit: hetzelfde bestand twee keer inlezen levert dezelfde regels op.
    var teller = {};
    var transacties = ruw.map(function (t) {
      var basis = bron + '|' + t.datum + '|' + t.bedrag.toFixed(2) + '|' + t.omschrijving;
      teller[basis] = (teller[basis] || 0) + 1;
      var tegenpartij = tegenpartijUit(t.omschrijving, bron);
      return {
        id: hash(basis + '#' + teller[basis]),
        bron: bron,
        datum: t.datum,
        maand: t.datum.slice(0, 7),
        bedrag: Math.round(t.bedrag * 100) / 100,
        omschrijving: t.omschrijving,
        tegenpartij: tegenpartij,
        sleutel: sleutelVan(tegenpartij)
      };
    });

    transacties.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });

    return {
      bron: bron,
      scheidingsteken: teken === '\t' ? 'tab' : teken,
      heeftKop: heeftKop,
      kolommen: kolom,
      kop: kop,
      tekenOmgedraaid: !!draaien,
      overgeslagen: overgeslagen,
      waarschuwingen: waarschuwingen,
      transacties: transacties,
      periode: transacties.length
        ? { van: transacties[0].datum, tot: transacties[transacties.length - 1].datum }
        : null
    };
  }

  var Lezen = {
    lees: lees,
    leesDatum: leesDatum,
    leesBedrag: leesBedrag,
    tegenpartijUit: tegenpartijUit,
    sleutelVan: sleutelVan,
    raadScheidingsteken: raadScheidingsteken,
    splitsRegel: splitsRegel,
    hash: hash
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Lezen;
  root.Lezen = Lezen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
