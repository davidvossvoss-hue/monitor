/* Van losse transacties naar een beeld: ontdubbelen, eigen geld heen en weer
   eruit halen, vaste lasten herkennen, en alles per maand optellen.        */
(function (root) {
  'use strict';
  var C = root.Categorie || (typeof require === 'function' ? require('./categorie.js') : null);

  function mediaan(getallen) {
    if (!getallen.length) return 0;
    var s = getallen.slice().sort(function (a, b) { return a - b; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  function dagenTussen(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  function rond(n) { return Math.round(n * 100) / 100; }
  function getalOf(x, standaard) {
    var n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x;
    return typeof n === 'number' && isFinite(n) ? n : standaard;
  }

  // -------------------------------------------------------------- ontdubbelen
  // Dezelfde uitdraai twee keer inladen mag niets veranderen; overlappende
  // periodes evenmin.
  function ontdubbel(lijsten, aandelen) {
    var gezien = {}, uit = [], dubbel = 0;
    [].concat.apply([], lijsten).forEach(function (t) {
      if (gezien[t.id]) { dubbel++; return; }
      gezien[t.id] = true;
      // Deel je een rekening met iemand, dan telt maar jouw deel mee.
      var opgegeven = aandelen && t.rekening != null ? aandelen[t.rekening] : null;
      if (opgegeven != null) t.aandeel = getalOf(opgegeven, 100) / 100;
      if (t.aandeel != null && t.aandeel !== 1 && t.bedragVol == null) {
        t.bedragVol = t.bedrag;
        t.bedrag = Math.round(t.bedrag * t.aandeel * 100) / 100;
      }
      uit.push(t);
    });
    uit.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
    return { transacties: uit, dubbel: dubbel };
  }

  // ---------------------------------------------------- eigen geld heen en weer
  // Geld van je ABN naar je Revolut is geen uitgave. Zulke paren vind je aan
  // twee regels met hetzelfde bedrag, tegengesteld teken, op verschillende
  // rekeningen, binnen een paar dagen.
  function koppelIntern(transacties, opties) {
    opties = opties || {};
    var venster = opties.dagen || 4;
    var drempel = opties.drempel || 25;
    var perBedrag = {};
    transacties.forEach(function (t) {
      // Wat jij of een rekeningregel al heeft vastgelegd, blijft staan: een
      // toevallig gelijk bedrag mag dat niet omgooien.
      if (t.toegekendDoor === 'handmatig' || t.toegekendDoor === 'rekening') return;
      var sleutel = Math.abs(t.bedrag).toFixed(2);
      (perBedrag[sleutel] = perBedrag[sleutel] || []).push(t);
    });

    var paren = [];
    Object.keys(perBedrag).forEach(function (sleutel) {
      if (parseFloat(sleutel) < drempel) return;
      var groep = perBedrag[sleutel];
      var uit = groep.filter(function (t) { return t.bedrag < 0 && !t.internPartner; });
      var in_ = groep.filter(function (t) { return t.bedrag > 0 && !t.internPartner; });
      uit.forEach(function (a) {
        for (var i = 0; i < in_.length; i++) {
          var b = in_[i];
          if (b.internPartner || a.internPartner) continue;
          if ((b.rekening || b.bron) === (a.rekening || a.bron)) continue;
          if (Math.abs(dagenTussen(a.datum, b.datum)) > venster) continue;
          a.internPartner = b.id; b.internPartner = a.id;
          a.categorie = a.categorie === 'creditcard' || b.categorie === 'creditcard' ? 'creditcard' : 'intern';
          b.categorie = a.categorie;
          a.toegekendDoor = b.toegekendDoor = 'gekoppeld';
          paren.push({ uit: a, in: b, bedrag: Math.abs(a.bedrag) });
          break;
        }
      });
    });
    return paren;
  }

  // ------------------------------------------------------------ vaste lasten
  // Wat elke maand terugkomt bij dezelfde partij is een vaste last, ook als je
  // hem zelf nooit als zodanig hebt opgeschreven.
  function terugkerend(transacties, opties) {
    opties = opties || {};
    var minAantal = opties.minAantal || 3;
    var groepen = {};
    transacties.forEach(function (t) {
      if (t.bedrag >= 0) return;
      if (C.soortVan(t.categorie) === 'intern') return;
      if (!t.sleutel) return;
      (groepen[t.sleutel] = groepen[t.sleutel] || []).push(t);
    });

    var gevonden = [];
    Object.keys(groepen).forEach(function (sleutel) {
      var g = groepen[sleutel].slice().sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
      var maanden = {};
      g.forEach(function (t) { maanden[t.maand] = (maanden[t.maand] || 0) + t.bedrag; });
      var aantalMaanden = Object.keys(maanden).length;
      if (g.length < minAantal || aantalMaanden < minAantal) return;

      var gaten = [];
      for (var i = 1; i < g.length; i++) gaten.push(dagenTussen(g[i - 1].datum, g[i].datum));
      var gat = mediaan(gaten);
      var bedragen = g.map(function (t) { return Math.abs(t.bedrag); });
      var typisch = mediaan(bedragen);
      var spreiding = typisch ? (Math.max.apply(null, bedragen) - Math.min.apply(null, bedragen)) / typisch : 1;

      var ritme = null, perMaand = 0;
      if (gat >= 25 && gat <= 36) { ritme = 'maandelijks'; perMaand = typisch; }
      else if (gat >= 80 && gat <= 100) { ritme = 'per kwartaal'; perMaand = typisch / 3; }
      else if (gat >= 170 && gat <= 195) { ritme = 'half jaar'; perMaand = typisch / 6; }
      else if (gat >= 350 && gat <= 380) { ritme = 'jaarlijks'; perMaand = typisch / 12; }
      if (!ritme) return;

      // Een abonnement schrijft op ongeveer dezelfde dag van de maand af.
      // Een winkel waar je toevallig elke maand komt, niet.
      var dagen = g.map(function (t) { return parseInt(t.datum.slice(8), 10); });
      var dagMediaan = mediaan(dagen);
      var dagAfwijking = Math.max.apply(null, dagen.map(function (d) {
        var v = Math.abs(d - dagMediaan);
        return Math.min(v, 31 - v); // rond de maandgrens
      }));

      // Uitgaven in een stuurbare categorie moeten strenger bewijzen dat ze
      // vast zijn: bijna hetzelfde bedrag, bijna dezelfde dag.
      var stuurbaar = C.soortVan(g[0].categorie) === 'variabel';
      if (stuurbaar && (spreiding > 0.2 || dagAfwijking > 4)) return;
      if (!stuurbaar && spreiding > 0.75) return;

      gevonden.push({
        sleutel: sleutel,
        naam: g[g.length - 1].tegenpartij,
        categorie: g[g.length - 1].categorie,
        ritme: ritme,
        aantal: g.length,
        maanden: aantalMaanden,
        typischBedrag: rond(typisch),
        perMaand: rond(perMaand),
        laatste: g[g.length - 1].datum,
        rondDeDag: Math.round(dagMediaan),
        spreiding: rond(spreiding)
      });
    });
    gevonden.sort(function (a, b) { return b.perMaand - a.perMaand; });
    return gevonden;
  }

  // ---------------------------------------------------------------- per maand
  function perMaand(transacties) {
    var maanden = {};
    transacties.forEach(function (t) {
      var soort = C.soortVan(t.categorie);
      var m = maanden[t.maand] || (maanden[t.maand] = {
        maand: t.maand, inkomen: 0, uitgaven: 0, vast: 0, variabel: 0, sparen: 0,
        intern: 0, netto: 0, perCategorie: {}, perBron: {}, aantal: 0
      });
      m.aantal++;
      m.perBron[t.bron] = rond((m.perBron[t.bron] || 0) + t.bedrag);
      if (soort === 'intern') { m.intern = rond(m.intern + Math.abs(t.bedrag)); return; }
      m.perCategorie[t.categorie] = rond((m.perCategorie[t.categorie] || 0) + t.bedrag);
      // Geld naar je eigen spaar- of beleggingspot is geen uitgave, en geld
      // dat je er weer uithaalt is geen inkomen. Het staat apart.
      if (soort === 'sparen') { m.sparen = rond(m.sparen - t.bedrag); return; }
      if (t.bedrag > 0) m.inkomen = rond(m.inkomen + t.bedrag);
      else {
        m.uitgaven = rond(m.uitgaven + Math.abs(t.bedrag));
        if (soort === 'vast') m.vast = rond(m.vast + Math.abs(t.bedrag));
        else m.variabel = rond(m.variabel + Math.abs(t.bedrag));
      }
    });
    var lijst = Object.keys(maanden).sort().map(function (k) {
      var m = maanden[k];
      m.netto = rond(m.inkomen - m.uitgaven);
      return m;
    });
    return lijst;
  }

  // De grootste losse uitgaven van een maand. Vaste lasten horen daar niet
  // bij: die zijn geen verrassing, ook al zijn ze groot.
  function uitschieters(transacties, maand, aantal) {
    return transacties
      .filter(function (t) {
        if (maand && t.maand !== maand) return false;
        if (t.bedrag >= 0) return false;
        var soort = C.soortVan(t.categorie);
        // Sparen is geen uitgave en een vaste last is geen verrassing.
        return soort !== 'intern' && soort !== 'vast' && soort !== 'sparen' && !t.isVasteLast;
      })
      .sort(function (a, b) { return a.bedrag - b.bedrag; })
      .slice(0, aantal || 5);
  }

  // ------------------------------------------------------------- alles samen
  function analyseer(lijsten, opties) {
    opties = opties || {};
    var ontdubbeld = ontdubbel(lijsten, opties.aandelen);
    var transacties = ontdubbeld.transacties;

    C.categoriseer(transacties, opties);
    var paren = koppelIntern(transacties, opties.intern);

    var vaste = terugkerend(transacties, opties.terugkerend);
    var vasteSleutels = {};
    vaste.forEach(function (v) { vasteSleutels[v.sleutel] = v; });
    transacties.forEach(function (t) { t.isVasteLast = !!vasteSleutels[t.sleutel]; });

    var maanden = perMaand(transacties);
    var volledig = maanden.filter(function (m) { return !opties.negeerMaanden || opties.negeerMaanden.indexOf(m.maand) < 0; });

    function gem(veld) {
      if (!volledig.length) return 0;
      return rond(volledig.reduce(function (t, m) { return t + m[veld]; }, 0) / volledig.length);
    }

    // Categorie-totalen over de hele periode plus gemiddelde per maand.
    var perCategorie = {};
    transacties.forEach(function (t) {
      if (C.soortVan(t.categorie) === 'intern') return;
      var c = perCategorie[t.categorie] || (perCategorie[t.categorie] = {
        id: t.categorie, naam: C.categorieVan(t.categorie).naam,
        soort: C.soortVan(t.categorie), kleur: C.categorieVan(t.categorie).kleur,
        totaal: 0, aantal: 0, maanden: {}
      });
      c.totaal = rond(c.totaal + t.bedrag);
      c.aantal++;
      c.maanden[t.maand] = rond((c.maanden[t.maand] || 0) + t.bedrag);
    });
    var categorieLijst = Object.keys(perCategorie).map(function (k) {
      var c = perCategorie[k];
      c.perMaand = maanden.length ? rond(c.totaal / maanden.length) : 0;
      return c;
    }).sort(function (a, b) { return a.totaal - b.totaal; });

    var onbekend = transacties.filter(function (t) {
      return !t.toegekendDoor && C.soortVan(t.categorie) !== 'intern';
    });

    return {
      transacties: transacties,
      dubbelOvergeslagen: ontdubbeld.dubbel,
      interneParen: paren,
      maanden: maanden,
      categorieen: categorieLijst,
      vasteLasten: vaste,
      vasteLastenPerMaand: rond(vaste.reduce(function (t, v) { return t + v.perMaand; }, 0)),
      gemiddeld: {
        inkomen: gem('inkomen'), uitgaven: gem('uitgaven'), vast: gem('vast'),
        variabel: gem('variabel'), sparen: gem('sparen'), netto: gem('netto')
      },
      onbekend: onbekend,
      periode: transacties.length
        ? { van: transacties[0].datum, tot: transacties[transacties.length - 1].datum }
        : null
    };
  }

  var Analyse = {
    ontdubbel: ontdubbel, koppelIntern: koppelIntern, terugkerend: terugkerend,
    perMaand: perMaand, uitschieters: uitschieters, analyseer: analyseer,
    mediaan: mediaan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Analyse;
  root.Analyse = Analyse;
})(typeof globalThis !== 'undefined' ? globalThis : this);
