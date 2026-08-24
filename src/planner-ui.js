/* Plannerscherm en instellingen. */
(function (root) {
  'use strict';
  var U = root.UI, C = root.Categorie, R = root.Rekenen, P = root.Planner, S = root.Schermen;

  function balkje(deel, kleur) {
    var p = Math.max(0, Math.min(1, deel || 0)) * 100;
    return '<div class="balk"><i style="width:' + p.toFixed(1) + '%;background:' + (kleur || 'var(--amber)') + '"></i></div>';
  }

  function pot(naam, bedrag, doel, kleur, bij) {
    var h = '<div class="pot"><div class="naam"><span class="label">' + U.esc(naam) + '</span>' +
      (bij ? '<span class="zachter" style="font-size:.78rem">' + bij + '</span>' : '') + '</div>' +
      '<div class="bedrag groot" style="color:' + kleur + '">' + U.euro(bedrag) + '</div>';
    if (doel > 0) {
      var deel = bedrag / doel;
      h += balkje(deel, kleur) + '<div class="doel">' + (bedrag >= doel
        ? 'Doel gehaald &middot; ' + U.euro(doel)
        : Math.round(deel * 100) + '% van ' + U.euro(doel) + ' &middot; nog ' + U.euro(doel - bedrag)) + '</div>';
    }
    return h + '</div>';
  }

  // ==========================================================  PLANNER
  function plannerScherm(staat, werk) {
    var a = werk.analyse;
    var h = '<div class="wrap">';
    if (!a || !a.maanden.length) {
      return h + '<section class="blok"><div class="leeg">Nog niets ingelezen, dus valt er niets te plannen. ' +
        'Begin bij <b>Inlezen</b> &mdash; ik reken nergens mee tot jouw cijfers erin staan.</div></section></div>';
    }
    var p = P.plan(a, staat.instellingen);
    if (p.leeg) return h + '<section class="blok"><div class="leeg">' + U.esc(p.reden) + '</div></section></div>';
    var i = staat.instellingen;

    // ---- de ladder bovenaan
    var lad = p.ladderNu;
    h += '<section class="blok"><div class="hero">';
    h += '<div class="hero-boven"><div>' +
      '<div class="label">Autopot over 12 maanden &middot; op je gemeten tempo</div>' +
      '<div class="mega">' + U.euro(p.autopot12Nu) + '</div>' +
      '<div class="trede-naam">' + U.esc(lad.huidige ? lad.huidige.naam : 'nog onder de eerste trede') + '</div></div>' +
      '<div style="text-align:right"><div class="label">Autopot nu</div>' +
      '<div class="groot">' + U.euro(p.standen.autopot) + '</div>' +
      '<div class="zachter" style="font-size:.84rem;margin-top:.3rem">' + U.euro(p.verdelingNu.autopot) +
      ' per maand<br>op ' + p.maandenGebruikt + ' gemeten maanden</div></div></div>';

    if (lad.volgende) {
      h += '<div class="regel-werk">Nog <b>' + U.euro(lad.tekort) + '</b> en je zit in de ' + U.esc(lad.volgende.naam) + '.</div>';
      h += '<div style="margin-top:1rem">' + balkje(lad.voortgang) +
        '<div class="balk-uiteinden"><span>' + U.esc(lad.huidige ? lad.huidige.naam : 'start') + '</span>' +
        '<span>' + U.esc(lad.volgende.naam) + ' &middot; ' + U.euro(lad.volgende.vanaf) + '</span></div></div>';
    }

    // de klem: oorlogskas eerst betekent voorlopig geen auto
    if (p.verdelingNu.autopot <= 0 && p.standen.oorlogskas < p.oorlogskasDoel) {
      var mnd = R.maandenTot(p.standen.oorlogskas, p.verdelingNu.oorlogskas, 0, p.oorlogskasDoel, 12 * 70);
      h += '<div class="statuslijn niet" style="margin-top:1.2rem">Er gaat nu niets naar de auto. ' +
        'Eerst moet je oorlogskas vol: ' + U.euro(p.standen.oorlogskas) + ' van ' + U.euro(p.oorlogskasDoel) +
        (mnd ? ', dat duurt tot ' + U.esc(U.datumLabel(R.datumOverMaanden(mnd))) : '') + '.</div>' +
        '<div class="knoppen" style="margin-top:.8rem">' +
        '<button class="knop zacht mini" data-actie="naast-aan">Laat ' + U.pct(i.autopotDeelNaast) +
        ' meteen naar de auto gaan</button>' +
        '<span class="zachter" style="font-size:.85rem">of verlaag je oorlogskas bij Instellingen</span></div>';
    }
    h += '</section>';

    // ---- ruimte
    h += '<section class="blok"><h2 class="kop">Je maand</h2><div class="kaart maandkaart">';
    h += '<div><div class="label">Wat er per maand overblijft</div>' +
      '<div class="mega" style="margin:.3rem 0 .1rem;color:' + (p.ruimteNu >= 0 ? 'var(--goed)' : 'var(--fout)') + '">' +
      U.euro(p.ruimteNu) + '</div>';
    if (p.inkomenWisselt) {
      h += '<div class="zacht" style="margin-top:.7rem;font-size:.92rem">Je inkomen wisselt: ' +
        U.euro(p.inkomenLaagste) + ' tot ' + U.euro(p.inkomenHoogste) + ' per maand. ' +
        'Hierboven staat het gemiddelde; in een doorsnee maand verdien je ' + U.euro(p.inkomenMediaan) + '.</div>';
    }
    h += '</div>';
    h += '<div>' + S.tabel(
      '<tr><td>Inkomen</td><td class="r">' + U.euro(p.inkomen) + '</td></tr>' +
      '<tr><td class="zacht">Vaste lasten</td><td class="r zacht">&minus; ' + U.euro(p.vasteLasten) + '</td></tr>' +
      '<tr><td class="zacht">Stuurbare uitgaven</td><td class="r zacht">&minus; ' + U.euro(p.variabelGemeten) + '</td></tr>' +
      '<tr><td><b>Ruimte</b></td><td class="r"><b>' + U.euro(p.ruimteNu) + '</b></td></tr>' +
      '<tr><td class="zachter">Burn rate (alles bij elkaar)</td><td class="r zachter">' + U.euro(p.burnNu) + '</td></tr>' +
      '<tr><td class="zachter">Feitelijk opzij gezet</td><td class="r zachter">' + U.euro(p.sparenGemeten) + '</td></tr>'
    ) + '</div></div></section>';

    // ---- streefbedragen
    h += '<section class="blok"><h2 class="kop">De enige knop: wat wil je dat het wordt</h2><div class="kaart">';
    var rijen = '<tr><th>Categorie</th><th class="r">Gemeten</th><th class="r">Streef</th><th class="r">Scheelt</th></tr>';
    p.stuurbaar.forEach(function (c) {
      rijen += '<tr><td>' + U.esc(c.naam) + '</td>' +
        '<td class="r zacht">' + U.euro(c.gemeten) + '</td>' +
        '<td class="r"><input type="number" step="10" style="width:110px;text-align:right" ' +
        'data-actie="streef" data-categorie="' + c.id + '" value="' + Math.round(c.streef) + '"></td>' +
        '<td class="r" style="color:' + (c.verschil > 0 ? 'var(--goed)' : 'var(--zachter)') + '">' +
        (c.verschil ? U.euro(c.verschil) : '&mdash;') + '</td></tr>';
    });
    rijen += '<tr><td><b>Samen</b></td><td class="r"><b>' + U.euro(p.variabelGemeten) + '</b></td>' +
      '<td class="r"><b>' + U.euro(p.variabelStreef) + '</b></td>' +
      '<td class="r"><b class="groen">' + U.euro(p.winstPerMaand) + '</b></td></tr>';
    h += S.tabel(rijen);
    if (p.winstPerMaand > 0) {
      h += '<div class="statuslijn ok" style="margin-top:1rem">' + U.euro(p.winstPerMaand) + ' per maand vrij, ' +
        U.euro(p.winstPerJaar) + ' per jaar. Autopot over 12 maanden: ' + U.euro(p.autopot12Nu) + ' &rarr; ' +
        U.euro(p.autopot12Plan) + '.</div>';
    } else {
      h += '<div class="zachter" style="margin-top:.8rem;font-size:.9rem">Zet hierboven een streefbedrag neer, ' +
        'dan zie je meteen wat het je oplevert. Het verschil met wat je nu uitgeeft gaat rechtstreeks naar je potjes.</div>';
    }
    h += '<div class="knoppen" style="margin-top:1rem">' +
      '<button class="knop zacht mini" data-actie="streef-wis">Streefbedragen wissen</button></div>';
    h += '</div></section>';

    // ---- potjes
    h += '<section class="blok"><h2 class="kop">Potjes</h2><div class="rooster k3">';
    h += pot('Oorlogskas', p.standen.oorlogskas, p.oorlogskasDoel, 'var(--goed)',
      R.getal(i.oorlogskasMaanden) + ' mnd burn');
    h += pot('Autopot', p.standen.autopot, lad.volgende ? R.getal(lad.volgende.vanaf) : 0, 'var(--amber)',
      lad.volgende ? 'tot trede ' + (lad.index + 2) : 'top');
    h += pot('Beleggen', p.standen.beleggen, 0, 'var(--koel)', 'geen doel, alleen tijd');
    h += '</div><div class="zachter" style="margin-top:.7rem;font-size:.86rem">' +
      'Verdeling van je ruimte deze maand: oorlogskas ' + U.euro(p.verdelingNu.oorlogskas) +
      ' &middot; autopot ' + U.euro(p.verdelingNu.autopot) + ' &middot; beleggen ' + U.euro(p.verdelingNu.beleggen) +
      '</div></section>';

    // ---- projectie
    var jaren = R.getal(i.projectieJaren);
    var xLabels = [];
    var stap = Math.max(1, Math.round(jaren / ((window.innerWidth || 1000) < 700 ? 3 : 5)));
    for (var j = 0; j <= jaren; j += stap) xLabels.push({ x: j, tekst: j === 0 ? 'nu' : j + ' jr' });
    var reeksen = [
      { punten: p.lijnPlan.map(function (q) { return { x: q.jaar, y: q.waarde }; }), kleur: '#f5a524', streep: true },
      { punten: p.lijnNu.map(function (q) { return { x: q.jaar, y: q.waarde }; }), kleur: '#5ea8e0', vlak: true }
    ];
    h += '<section class="blok"><h2 class="kop">Vermogen over ' + jaren + ' jaar</h2><div class="kaart">' +
      '<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.1rem">' +
      '<div><div class="label">Dit tempo</div><div class="groot" style="color:var(--koel)">' + U.euro(p.eindNu) + '</div>' +
      '<div class="zachter" style="font-size:.84rem">' + U.euro(p.beleggenNu) + ' p/m</div></div>' +
      '<div><div class="label">Met je streef</div><div class="groot" style="color:var(--amber)">' + U.euro(p.eindPlan) + '</div>' +
      '<div class="zachter" style="font-size:.84rem">' + U.euro(p.beleggenPlan) + ' p/m</div></div>' +
      '<div><div class="label">Verschil</div><div class="groot">' + U.euro(p.verschilEind) + '</div>' +
      '<div class="zachter" style="font-size:.84rem">dat is wat discipline oplevert</div></div></div>' +
      U.lijnGrafiek(reeksen, { hoogte: 300, xLabels: xLabels, titel: 'vermogen over ' + jaren + ' jaar' }) +
      '<div class="legenda"><span><i style="background:#5ea8e0"></i>dit tempo</span>' +
      '<span><i style="background:#f5a524"></i>met je streef</span>' +
      '<span class="zachter">' + U.pct(i.rendementPct) + ' rendement, samengesteld per maand</span></div>' +
      '<div class="grote-regel">Elke &euro; 100 die je nu niet uitgeeft, is over 10 jaar <b>' +
      U.euro(R.honderdEuroOver(10, i.rendementPct), true) + '</b> waard.</div></div>';

    // mijlpalen
    var r7 = '<tr><th>Mijlpaal</th><th class="r">Doel</th><th class="r">Dit tempo</th><th class="r">Met streef</th></tr>';
    p.mijlpalen.forEach(function (m) {
      function wanneer(n, d) {
        if (n === 0) return '<span class="groen">gehaald</span>';
        if (n == null) return '<span class="zachter">niet op dit tempo</span>';
        return U.esc(U.datumLabel(d));
      }
      r7 += '<tr><td>' + U.esc(m.naam) + '</td><td class="r zacht">' + U.euro(m.doel) + '</td>' +
        '<td class="r">' + wanneer(m.maanden, m.datum) + '</td>' +
        '<td class="r">' + wanneer(m.maandenPlan, m.datumPlan) +
        (m.sneller > 0 ? ' <span class="groen" style="font-size:.82rem">' +
          (m.sneller < 24 ? m.sneller + ' mnd' : Math.round(m.sneller / 1.2) / 10 + ' jaar') + ' eerder</span>' : '') +
        '</td></tr>';
    });
    h += '<div style="margin-top:1rem">' + S.kaart('Mijlpalen', S.tabel(r7)) + '</div></section>';
    return h + '</div>';
  }

  // ==========================================================  INSTELLINGEN
  function veld(label, pad, waarde, opties) {
    opties = opties || {};
    return '<label class="veld"><span class="t">' + label + '</span>' +
      '<input type="' + (opties.type || 'number') + '" step="' + (opties.step || '0.01') + '"' +
      (opties.min != null ? ' min="' + opties.min + '"' : '') +
      ' data-bind="' + pad + '" value="' + U.esc(waarde == null ? '' : waarde) + '"' +
      (opties.plek ? ' placeholder="' + U.esc(opties.plek) + '"' : '') + '>' +
      (opties.uitleg ? '<span class="u">' + opties.uitleg + '</span>' : '') + '</label>';
  }

  function instellingenScherm(staat, werk) {
    var i = staat.instellingen, a = werk.analyse;
    var p = a && a.maanden.length ? P.plan(a, i) : null;
    var h = '<div class="wrap">';

    // rekeningen
    h += '<section class="blok"><h2 class="kop">Rekeningen</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">Geld naar je eigen rekeningen is geen uitgave. Geef hier aan welke ' +
      'rekening wat is; herken je hem aan een IBAN of een naam in de omschrijving, dan is dat genoeg.</p>';
    (i.rekeningen || []).forEach(function (r, k) {
      h += '<div class="rij rij-rek">' +
        '<input type="text" data-bind="instellingen.rekeningen.' + k + '.naam" value="' + U.esc(r.naam || '') + '" placeholder="Naam">' +
        '<input type="text" data-bind="instellingen.rekeningen.' + k + '.patroon" value="' + U.esc(r.patroon || '') + '" placeholder="IBAN of tekst">' +
        '<select data-bind="instellingen.rekeningen.' + k + '.rol">' +
        ['eigen', 'gezamenlijk', 'zakelijk'].map(function (rol) {
          return '<option value="' + rol + '"' + (r.rol === rol ? ' selected' : '') + '>' + rol + '</option>';
        }).join('') + '</select>' +
        '<button class="weg" data-actie="rekening-regel-weg" data-i="' + k + '">&times;</button></div>';
    });
    h += '<div class="knoppen" style="margin-top:.5rem"><button class="knop zacht mini" data-actie="rekening-regel-erbij">+ rekening</button></div>';
    h += '<div class="zachter" style="margin-top:.7rem;font-size:.85rem">' +
      '<b>eigen</b>: telt helemaal niet mee. <b>gezamenlijk</b>: telt als vaste last, want dat geld gaat echt weg. ' +
      '<b>zakelijk</b>: telt mee als gewone rekening.</div>';
    h += '</div></section>';

    // oorlogskas en volgorde
    h += '<section class="blok"><h2 class="kop">Volgorde en doelen</h2><div class="rooster k2">';
    h += '<div class="kaart"><h3>Oorlogskas</h3>' +
      veld('Aantal maanden burn rate', 'instellingen.oorlogskasMaanden', i.oorlogskasMaanden,
        { step: '0.5', min: 0, uitleg: p ? 'Doel nu ' + U.euro(p.oorlogskasDoel) + ' bij een burn van ' +
          U.euro(p.burnNu) + ' per maand.' : 'Doel = dit aantal × je hele maandlasten.' }) +
      veld('Vast doelbedrag (leeg = berekenen)', 'instellingen.oorlogskasDoelHandmatig', i.oorlogskasDoelHandmatig,
        { plek: 'leeg laten' }) + '</div>';

    h += '<div class="kaart"><h3>Auto naast of na de oorlogskas</h3>' +
      '<label class="veld" style="display:flex;gap:.6rem;align-items:flex-start">' +
      '<input type="checkbox" data-bind="instellingen.autopotNaastOorlogskas"' +
      (i.autopotNaastOorlogskas ? ' checked' : '') + ' style="margin-top:.3rem">' +
      '<span><span class="t" style="margin:0">Laat de autopot meteen meelopen</span>' +
      '<span class="u">Streng gezien komt de auto pas als je oorlogskas vol is. Zet dit aan als je niet ' +
      'zo lang wilt wachten &mdash; je bent dan later veilig, maar eerder onderweg.</span></span></label>' +
      veld('Deel dat meteen naar de auto gaat', 'instellingen.autopotDeelNaast', i.autopotDeelNaast,
        { step: '5', min: 0, uitleg: 'Percentage van je ruimte, vóór de oorlogskas.' }) +
      veld('Naar autopot ná de oorlogskas', 'instellingen.autopotPctNaOorlogskas', i.autopotPctNaOorlogskas,
        { step: '5', min: 0, uitleg: 'De rest gaat naar beleggen.' }) + '</div>';

    h += '<div class="kaart"><h3>Beginstanden</h3>' +
      '<p class="notitie" style="margin-top:0">Wat er al staat. Uit je afschriften kan ik dit niet altijd zien.</p>' +
      veld('Oorlogskas / spaargeld', 'instellingen.startSaldi.oorlogskas', i.startSaldi.oorlogskas) +
      veld('Autopot', 'instellingen.startSaldi.autopot', i.startSaldi.autopot) +
      veld('Belegd', 'instellingen.startSaldi.beleggen', i.startSaldi.beleggen) + '</div>';

    h += '<div class="kaart"><h3>Projectie</h3>' +
      veld('Rendement per jaar', 'instellingen.rendementPct', i.rendementPct, { step: '0.1' }) +
      veld('Aantal jaren', 'instellingen.projectieJaren', i.projectieJaren, { step: '1', min: 1 }) +
      veld('Gewenst maandinkomen', 'instellingen.gewenstMaandinkomen', i.gewenstMaandinkomen) +
      veld('Opnamepercentage', 'instellingen.opnamePct', i.opnamePct,
        { step: '0.1', uitleg: 'Financiële vrijheid = ' + U.euro(R.vrijheidsBedrag(i.gewenstMaandinkomen, i.opnamePct)) + '.' }) +
      '</div></div></section>';

    // ladder
    h += '<section class="blok"><h2 class="kop">Auto-ladder</h2><div class="kaart">';
    (i.autoLadder || []).forEach(function (t, k) {
      h += '<div class="rij"><input type="text" data-bind="instellingen.autoLadder.' + k + '.naam" value="' + U.esc(t.naam) + '">' +
        '<input type="number" step="100" data-bind="instellingen.autoLadder.' + k + '.vanaf" value="' + R.getal(t.vanaf) + '">' +
        '<button class="weg" data-actie="trede-weg" data-i="' + k + '">&times;</button></div>';
    });
    h += '<div class="knoppen" style="margin-top:.5rem"><button class="knop zacht mini" data-actie="trede-erbij">+ trede</button></div>';
    h += '</div></section>';

    // gegevens
    h += '<section class="blok"><h2 class="kop">Gegevens</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">' + (root.GEDEELDE_OPSLAG
        ? 'Je gegevens staan in deze link zelf, plus een kopie op dit toestel. De nieuwste van de twee wint.'
        : 'Alles staat lokaal in deze browser.') + ' Geen account, geen bankkoppeling.</p>' +
      '<div class="knoppen"><button class="knop" data-actie="export">Exporteren</button>' +
      '<button class="knop zacht" data-actie="import">Importeren</button>' +
      '<input type="file" id="import-bestand" accept="application/json" style="display:none">' +
      '<button class="knop gevaar" data-actie="reset" style="margin-left:auto">Alles wissen</button></div>' +
      '<div class="zachter" style="margin-top:.8rem;font-size:.85rem">' + staat.transacties.length +
      ' transacties opgeslagen.</div></div></section>';

    return h + '</div>';
  }

  root.PlannerUI = { plannerScherm: plannerScherm, instellingenScherm: instellingenScherm };
})(window);
