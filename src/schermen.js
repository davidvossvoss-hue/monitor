/* De schermen. Alles wordt uit de staat getekend; er zit geen geheugen in
   het scherm zelf.                                                          */
(function (root) {
  'use strict';
  var U = root.UI, C = root.Categorie, A = root.Analyse, R = root.Rekenen, P = root.Planner;

  function tabel(inhoud) { return '<div class="tabel-scroll"><table class="lijst">' + inhoud + '</table></div>'; }
  function kaart(titel, inhoud, extra) {
    return '<div class="kaart"' + (extra || '') + '>' + (titel ? '<h3>' + titel + '</h3>' : '') + inhoud + '</div>';
  }
  function keuzelijst(gekozen, naam) {
    var h = '<select ' + (naam || '') + '>';
    h += '<option value="">— kies —</option>';
    C.CATEGORIEEN.forEach(function (c) {
      h += '<option value="' + c.id + '"' + (c.id === gekozen ? ' selected' : '') + '>' + U.esc(c.naam) + '</option>';
    });
    return h + '</select>';
  }

  // ==========================================================  IMPORT
  function importScherm(staat, werk) {
    var h = '<div class="wrap"><section class="blok">';
    h += '<div class="kaart">' +
      '<h3>Zet je afschriften erin</h3>' +
      '<p class="notitie" style="margin-top:0">Amex, ABN AMRO en Revolut, als PDF of CSV. Je mag elke maand ' +
      'gewoon je hele jaar opnieuw exporteren: wat er al in staat wordt overgeslagen, dus dubbel inladen ' +
      'verandert niets. De bestanden blijven op dit toestel.</p>' +
      '<div id="sleepvak" class="sleepvak"><input type="file" id="bestanden" multiple ' +
      'accept=".pdf,.csv,.txt,.tab,application/pdf,text/csv,text/plain" hidden>' +
      '<button class="knop" data-actie="kies-bestanden">Bestanden kiezen</button>' +
      '<div class="zacht" style="margin-top:.6rem;font-size:.9rem">of sleep ze hierheen</div></div>';
    h += '</div></section>';

    if (werk && werk.bezig) {
      h += '<section class="blok">' + kaart('Bezig met lezen', '<div class="zacht">' + U.esc(werk.bezig) + '</div>') + '</section>';
    }

    if (werk && werk.resultaten && werk.resultaten.length) {
      var rijen = '<tr><th>Bestand</th><th>Herkend als</th><th>Periode</th><th class="r">Regels</th><th>Controle</th></tr>';
      werk.resultaten.forEach(function (r) {
        var controle = r.fout ? '<span class="rood">' + U.esc(r.fout) + '</span>'
          : r.controle ? (r.controle.klopt ? '<span class="groen">sluit aan</span>'
            : '<span class="rood">wijkt af</span>') : '<span class="zachter">geen controle mogelijk</span>';
        rijen += '<tr><td>' + U.esc(r.naam) + '</td><td>' + U.esc(r.bron || '—') + '</td>' +
          '<td class="zacht">' + (r.periode ? U.esc(r.periode.van + ' t/m ' + r.periode.tot) : '—') + '</td>' +
          '<td class="r">' + (r.aantal == null ? '—' : r.aantal) + '</td><td>' + controle + '</td></tr>';
      });
      var nieuw = werk.nieuw || 0, dubbel = werk.dubbel || 0;
      h += '<section class="blok">' + kaart('Gelezen', tabel(rijen) +
        '<div class="statuslijn ' + (nieuw ? 'ok' : 'niet') + '" style="margin-top:1rem">' +
        nieuw + ' nieuwe transacties toegevoegd' + (dubbel ? ', ' + dubbel + ' stonden er al in' : '') + '.</div>') +
        '</section>';
    }

    // wat er nu in zit
    if (staat.transacties.length) {
      var analyse = werk.analyse;
      var perBron = {};
      staat.transacties.forEach(function (t) {
        var k = t.rekening || t.bron;
        perBron[k] = perBron[k] || { n: 0, van: t.datum, tot: t.datum };
        perBron[k].n++;
        if (t.datum < perBron[k].van) perBron[k].van = t.datum;
        if (t.datum > perBron[k].tot) perBron[k].tot = t.datum;
      });
      var r2 = '<tr><th>Rekening</th><th>Van</th><th>Tot</th><th class="r">Transacties</th><th></th></tr>';
      Object.keys(perBron).sort().forEach(function (k) {
        r2 += '<tr><td>' + U.esc(k) + '</td><td class="zacht">' + U.esc(perBron[k].van) + '</td>' +
          '<td class="zacht">' + U.esc(perBron[k].tot) + '</td><td class="r">' + perBron[k].n + '</td>' +
          '<td class="r"><button class="knop zacht mini" data-actie="rekening-weg" data-rekening="' +
          U.esc(k) + '">verwijderen</button></td></tr>';
      });
      h += '<section class="blok"><h2 class="kop">Wat er nu in zit</h2>' + kaart('', tabel(r2)) + '</section>';

      // gaten in de maanden
      if (analyse && analyse.maanden.length > 1) {
        var gaten = [];
        var eerste = analyse.maanden[0].maand, laatste = analyse.maanden[analyse.maanden.length - 1].maand;
        var loop = eerste;
        while (loop < laatste) {
          loop = R.maandPlus(loop, 1);
          if (!analyse.maanden.some(function (m) { return m.maand === loop; })) gaten.push(loop);
        }
        var dun = analyse.maanden.filter(function (m) { return m.aantal < 5; });
        if (gaten.length || dun.length) {
          var tekst = '';
          if (gaten.length) tekst += '<div>Geen enkele transactie in: <b>' +
            gaten.map(function (g) { return U.esc(U.maandLabel(g)); }).join(', ') + '</b></div>';
          if (dun.length) tekst += '<div style="margin-top:.4rem">Erg weinig transacties in: ' +
            dun.map(function (m) { return U.esc(U.maandLabel(m.maand)) + ' (' + m.aantal + ')'; }).join(', ') + '</div>';
          h += '<section class="blok">' + kaart('Mogelijk mis je hier iets',
            tekst + '<div class="zachter" style="margin-top:.6rem;font-size:.88rem">' +
            'Ontbrekende maanden vertekenen je gemiddelden. Je kunt ze bij Instellingen ook buiten de ' +
            'berekening laten.</div>') + '</section>';
        }
      }
    }
    return h + '</div>';
  }

  // ==========================================================  INDELEN
  function indelenScherm(staat, werk) {
    var analyse = werk.analyse;
    var h = '<div class="wrap"><section class="blok">';
    if (!analyse || !staat.transacties.length) {
      return h + '<div class="leeg">Nog niets ingelezen. Begin bij <b>Inlezen</b>.</div></section></div>';
    }

    var open = analyse.onbekend.filter(function (t) { return t.bedrag < 0; });
    var groepen = {};
    open.forEach(function (t) {
      var g = groepen[t.sleutel] || (groepen[t.sleutel] = { sleutel: t.sleutel, naam: t.tegenpartij, n: 0, som: 0, laatste: t.datum });
      g.n++; g.som += t.bedrag;
      if (t.datum > g.laatste) { g.laatste = t.datum; g.naam = t.tegenpartij; }
    });
    var lijst = Object.keys(groepen).map(function (k) { return groepen[k]; })
      .sort(function (a, b) { return a.som - b.som; });

    var totaal = lijst.reduce(function (t, g) { return t + Math.abs(g.som); }, 0);
    h += '<div class="kaart"><h3>Nog in te delen</h3>' +
      '<p class="notitie" style="margin-top:0">' + lijst.length + ' partijen, samen ' + U.euro(totaal) +
      '. Deel ze één keer in; daarna herkent hij ze vanzelf. Begin bovenaan — daar zit het geld.</p></div>';

    if (!lijst.length) {
      h += '<div class="statuslijn ok" style="margin-top:1rem">Alles is ingedeeld.</div>';
    } else {
      var rijen = '';
      lijst.slice(0, 60).forEach(function (g) {
        rijen += '<div class="indeel-rij">' +
          '<div class="indeel-naam">' + U.esc(g.naam) +
          '<div class="zachter" style="font-size:.8rem">' + g.n + '&times; &middot; laatst ' + U.esc(g.laatste) + '</div></div>' +
          '<div class="indeel-bedrag num">' + U.euro(Math.abs(g.som)) + '</div>' +
          '<div class="indeel-keuze">' + keuzelijst('', 'data-actie="leer" data-sleutel="' + U.esc(g.sleutel) + '"') + '</div>' +
          '</div>';
      });
      h += '<div style="margin-top:1rem">' + kaart('', rijen) + '</div>';
      if (lijst.length > 60) h += '<div class="zachter" style="margin-top:.8rem">' +
        (lijst.length - 60) + ' kleinere partijen niet getoond. Die verschijnen zodra je de bovenste indeelt.</div>';
    }

    // wat je zelf hebt ingedeeld
    var geleerd = Object.keys(staat.geleerd);
    if (geleerd.length) {
      var r3 = '<tr><th>Partij</th><th>Categorie</th><th></th></tr>';
      geleerd.forEach(function (s) {
        r3 += '<tr><td>' + U.esc(s) + '</td><td>' + U.esc(C.categorieVan(staat.geleerd[s]).naam) + '</td>' +
          '<td class="r"><button class="weg" data-actie="vergeet" data-sleutel="' + U.esc(s) + '">&times;</button></td></tr>';
      });
      h += '<div style="margin-top:1.4rem">' + kaart('Wat je zelf hebt ingedeeld (' + geleerd.length + ')', tabel(r3)) + '</div>';
    }
    return h + '</section></div>';
  }

  // ==========================================================  ANALYSE
  function analyseScherm(staat, werk) {
    var a = werk.analyse;
    var h = '<div class="wrap">';
    if (!a || !a.maanden.length) {
      return h + '<section class="blok"><div class="leeg">Nog niets ingelezen. Begin bij <b>Inlezen</b>.</div></section></div>';
    }
    var mee = a.maanden.filter(function (m) { return (staat.instellingen.negeerMaanden || []).indexOf(m.maand) < 0; });
    function gem(v) { return mee.length ? mee.reduce(function (t, m) { return t + m[v]; }, 0) / mee.length : 0; }

    h += '<section class="blok"><h2 class="kop">Per maand &middot; ' +
      U.esc(a.periode.van) + ' t/m ' + U.esc(a.periode.tot) + '</h2>';
    var rijen = '<tr><th>Maand</th><th class="r">Inkomen</th><th class="r">Vast</th><th class="r">Stuurbaar</th>' +
      '<th class="r">Uitgaven</th><th class="r">Gespaard</th><th class="r">Over</th><th></th></tr>';
    a.maanden.slice().reverse().forEach(function (m) {
      var uit = (staat.instellingen.negeerMaanden || []).indexOf(m.maand) > -1;
      rijen += '<tr' + (uit ? ' style="opacity:.42"' : '') + '><td>' + U.esc(U.maandLabel(m.maand)) + '</td>' +
        '<td class="r">' + U.euro(m.inkomen) + '</td><td class="r">' + U.euro(m.vast) + '</td>' +
        '<td class="r">' + U.euro(m.variabel) + '</td><td class="r">' + U.euro(m.uitgaven) + '</td>' +
        '<td class="r zacht">' + U.euro(m.sparen) + '</td>' +
        '<td class="r" style="color:' + (m.netto >= 0 ? 'var(--goed)' : 'var(--fout)') + '">' + U.euro(m.netto) + '</td>' +
        '<td class="r"><button class="knop zacht mini" data-actie="maand-tellen" data-maand="' + m.maand + '">' +
        (uit ? 'meetellen' : 'negeren') + '</button></td></tr>';
    });
    rijen += '<tr><td><b>Gemiddeld</b></td><td class="r"><b>' + U.euro(gem('inkomen')) + '</b></td>' +
      '<td class="r"><b>' + U.euro(gem('vast')) + '</b></td><td class="r"><b>' + U.euro(gem('variabel')) + '</b></td>' +
      '<td class="r"><b>' + U.euro(gem('uitgaven')) + '</b></td><td class="r"><b>' + U.euro(gem('sparen')) + '</b></td>' +
      '<td class="r"><b>' + U.euro(gem('netto')) + '</b></td><td></td></tr>';
    h += kaart('', tabel(rijen)) + '</section>';

    // categorieën
    var uitgaven = a.categorieen.filter(function (c) { return c.totaal < 0; });
    var totaal = uitgaven.reduce(function (t, c) { return t + Math.abs(c.totaal); }, 0);
    h += '<section class="blok"><h2 class="kop">Waar het heen gaat</h2><div class="kaart">';
    uitgaven.forEach(function (c) {
      var deel = totaal ? Math.abs(c.totaal) / totaal : 0;
      h += '<div class="staaf-rij" data-actie="categorie-open" data-categorie="' + c.id + '">' +
        '<div class="staaf-naam">' + U.esc(c.naam) +
        '<span class="zachter" style="font-weight:400"> &middot; ' + U.esc(c.soort) + '</span></div>' +
        '<div class="staaf"><i style="width:' + (deel * 100).toFixed(1) + '%;background:' + c.kleur + '"></i></div>' +
        '<div class="staaf-bedrag num">' + U.euro(Math.abs(c.perMaand)) + '<span class="zachter">/m</span></div>' +
        '</div>';
      if (werk.openCategorie === c.id) {
        var top = a.transacties.filter(function (t) { return t.categorie === c.id && t.bedrag < 0; })
          .sort(function (x, y) { return x.bedrag - y.bedrag; }).slice(0, 12);
        var r4 = '<tr><th>Datum</th><th>Partij</th><th>Rekening</th><th class="r">Bedrag</th><th>Anders indelen</th></tr>';
        top.forEach(function (t) {
          r4 += '<tr><td class="zacht">' + U.esc(t.datum) + '</td><td>' + U.esc(t.tegenpartij) + '</td>' +
            '<td class="zachter">' + U.esc(t.rekening || t.bron) + '</td>' +
            '<td class="r">' + U.euro(Math.abs(t.bedrag)) + '</td>' +
            '<td>' + keuzelijst(t.categorie, 'data-actie="leer" data-sleutel="' + U.esc(t.sleutel) + '"') + '</td></tr>';
        });
        h += '<div style="margin:.4rem 0 1rem">' + tabel(r4) + '</div>';
      }
    });
    h += '</div></section>';

    // vaste lasten
    if (a.vasteLasten.length) {
      var r5 = '<tr><th>Wat</th><th>Categorie</th><th>Ritme</th><th>Wanneer</th><th class="r">Per maand</th></tr>';
      a.vasteLasten.forEach(function (v) {
        r5 += '<tr><td>' + U.esc(v.naam) + '</td><td class="zacht">' + U.esc(C.categorieVan(v.categorie).naam) + '</td>' +
          '<td class="zacht">' + U.esc(v.ritme) + '</td><td class="zachter">rond de ' + v.rondDeDag + 'e</td>' +
          '<td class="r">' + U.euro(v.perMaand, true) + '</td></tr>';
      });
      h += '<section class="blok"><h2 class="kop">Vaste lasten die hij zelf herkende</h2>' +
        kaart('', tabel(r5) + '<div class="zachter" style="margin-top:.8rem;font-size:.88rem">Samen ' +
          U.euro(a.vasteLastenPerMaand, true) + ' per maand. Herkend aan een vast ritme, een vast bedrag ' +
          'én een vaste dag van de maand.</div>') + '</section>';
    }

    // uitschieters
    var r6 = '<tr><th>Maand</th><th class="r">Bedrag</th><th>Wat</th><th>Categorie</th></tr>';
    a.maanden.slice().reverse().forEach(function (m) {
      var top = A.uitschieters(a.transacties, m.maand, 1)[0];
      if (!top) return;
      r6 += '<tr><td>' + U.esc(U.maandLabel(m.maand)) + '</td><td class="r">' + U.euro(Math.abs(top.bedrag)) + '</td>' +
        '<td>' + U.esc(top.tegenpartij) + '</td><td class="zacht">' + U.esc(C.categorieVan(top.categorie).naam) + '</td></tr>';
    });
    h += '<section class="blok"><h2 class="kop">De uitschieter van elke maand</h2>' +
      kaart('', tabel(r6) + '<div class="zachter" style="margin-top:.8rem;font-size:.88rem">' +
        'Vaste lasten en geld naar je eigen spaarpotjes tellen hier niet mee — dat zijn geen verrassingen.</div>') +
      '</section>';

    if (a.interneParen.length) {
      h += '<section class="blok"><h2 class="kop">Eigen geld heen en weer</h2>' +
        kaart('', '<div class="zacht">' + a.interneParen.length + ' overboekingen tussen je eigen rekeningen ' +
          'gevonden, samen ' + U.euro(a.interneParen.reduce(function (t, p) { return t + p.bedrag; }, 0)) +
          '. Die tellen niet als uitgave — anders zou je je Amex-afrekening én je Amex-uitgaven allebei tellen.</div>') +
        '</section>';
    }
    return h + '</div>';
  }

  root.Schermen = {
    importScherm: importScherm,
    indelenScherm: indelenScherm,
    analyseScherm: analyseScherm,
    kaart: kaart, tabel: tabel, keuzelijst: keuzelijst
  };
})(window);
