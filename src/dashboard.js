/* Het dashboard. Grote getallen, weinig tekst, alles gemeten. */
(function (root) {
  'use strict';
  var M = root.Model, U = root.UI;

  function potKaart(naam, bedrag, doel, kleur, extra) {
    var h = '<div class="pot"><div class="naam"><span class="label">' + U.esc(naam) + '</span>' +
      (extra ? '<span class="zachter" style="font-size:.8rem">' + extra + '</span>' : '') + '</div>' +
      '<div class="bedrag groot" style="color:' + kleur + '">' + U.euro(bedrag) + '</div>';
    if (doel && doel > 0) {
      var deel = bedrag / doel;
      h += U.balk(deel, kleur) +
        '<div class="doel">' + (bedrag >= doel
          ? 'Doel gehaald &middot; ' + U.euro(doel)
          : U.esc(Math.round(deel * 100)) + '% van ' + U.euro(doel) + ' &middot; nog ' + U.euro(doel - bedrag)) +
        '</div>';
    }
    return h + '</div>';
  }

  // ------------------------------------------------------------------ ladder
  function ladderBlok(a, instellingen) {
    var heeft = a.heeftData;
    var over12 = heeft ? M.autopotOverMaanden(a, 12) : null;
    var pos = M.ladderPositie(heeft ? over12 : -1, instellingen.autoLadder);

    var h = '<section class="blok"><div class="hero">';
    h += '<div class="hero-boven"><div>' +
      '<div class="label">Autopot over 12 maanden &middot; op jouw gemeten tempo</div>';

    if (!heeft) {
      h += '<div class="trede-naam zachter">Nog niets gemeten</div>' +
        '</div></div>' +
        '<div class="regel-werk zacht" style="margin-top:1.1rem">Vul bij <b>Invoer</b> je eerste maand in. ' +
        'Zolang er niets staat reken ik nergens mee &mdash; ik verzin geen voorbeeldcijfers.</div>';
    } else {
      h += '<div class="mega">' + U.euro(over12) + '</div>' +
        '<div class="trede-naam">' + U.esc(pos.huidige ? pos.huidige.naam : 'nog onder de eerste trede') + '</div>' +
        '</div>' +
        '<div style="text-align:right"><div class="label">Autopot nu</div>' +
        '<div class="groot">' + U.euro(a.standen.autopot) + '</div>' +
        '<div class="zachter" style="font-size:.85rem;margin-top:.3rem">' +
        U.euro(a.gemiddelden.autopot) + ' per maand gemeten<br>over ' + a.maanden.length +
        (a.maanden.length === 1 ? ' maand' : ' maanden') + '</div></div></div>';

      if (pos.volgende) {
        h += '<div class="regel-werk">Nog <b>' + U.euro(pos.tekort) + '</b> en je zit in de ' +
          U.esc(pos.volgende.naam) + '.</div>';
        h += '<div style="margin-top:1rem">' + U.balk(pos.voortgang) +
          '<div class="balk-uiteinden"><span>' + U.esc(pos.huidige ? pos.huidige.naam : 'start') + ' &middot; ' +
          U.euro(pos.huidige ? pos.huidige.vanaf : 0) + '</span><span>' +
          U.esc(pos.volgende.naam) + ' &middot; ' + U.euro(pos.volgende.vanaf) + '</span></div></div>';
        var maandenNodig = a.gemiddelden.autopot > 0
          ? Math.ceil((M.getal(pos.volgende.vanaf) - a.standen.autopot) / a.gemiddelden.autopot) : null;
        if (maandenNodig && maandenNodig > 0) {
          h += '<div class="zacht" style="margin-top:.7rem;font-size:.9rem">Op dit tempo sta je daar in ' +
            maandenNodig + (maandenNodig === 1 ? ' maand' : ' maanden') + ': ' +
            U.esc(U.datumLabel(M.datumOverMaanden(maandenNodig))) + '.</div>';
        }
      } else {
        h += '<div class="regel-werk">Bovenste trede. Alles daarboven is een keuze, geen doel meer.</div>';
      }
    }

    // de ladder zelf
    h += '<div class="ladder">';
    pos.tredes.forEach(function (t, i) {
      var klas = 'trede';
      if (heeft) {
        if (i === pos.index) klas += ' nu';
        else if (pos.volgende && i === pos.index + 1) klas += ' volgend';
        else if (i < pos.index) klas += ' bereikt';
      }
      h += '<div class="' + klas + '"><span class="nr">' + (i + 1) + '</span>' +
        '<span>' + U.esc(t.naam) + '</span>' +
        '<span class="num">' + U.euro(t.vanaf) + '</span></div>';
    });
    h += '</div></div></section>';
    return h;
  }

  // ------------------------------------------------------- sturing deze maand
  function maandBlok(a, state) {
    var nu = M.maandSleutel();
    var r = null;
    for (var i = 0; i < a.maanden.length; i++) if (a.maanden[i].maand === nu) r = a.maanden[i];

    var h = '<section class="blok"><h2 class="kop">Deze maand &middot; ' + U.esc(U.maandLabel(nu)) + '</h2>';

    if (!r) {
      var vorige = a.laatste;
      h += '<div class="leeg">Deze maand is nog niet ingevuld. Zet je salaris erin bij <b>Invoer</b>, dan weet je ' +
        'binnen tien seconden wat je te besteden hebt.' +
        (vorige ? '<br><br><span class="zacht">Vorige ingevulde maand (' + U.esc(U.maandLabel(vorige.maand)) +
          '): besteedbaar ' + U.euro(vorige.besteedbaar) + ', uitgegeven ' + U.euro(vorige.uitgaven) + '.</span>' : '') +
        '</div></section>';
      return h;
    }

    var tempo = M.maandTempo(r.besteedbaar, r.uitgaven, new Date());
    var kleur = tempo.opSchema ? 'var(--groen)' : 'var(--rood)';

    h += '<div class="kaart maandkaart">';

    // links: het bedrag
    h += '<div><div class="label">Dit mag je deze maand uitgeven</div>' +
      '<div class="mega" style="margin:.3rem 0 .1rem">' + U.euro(r.besteedbaar) + '</div>' +
      '<div class="middel zacht">' + U.euro(r.weekbedrag) + ' per week</div>';
    h += '<div class="zachter" style="font-size:.86rem;margin-top:.9rem;line-height:1.5">' +
      'Surplus ' + U.euro(r.surplus) + ' &middot; ' + U.pct(state.instellingen.surplusInvesterenPct) +
      ' investeren (' + U.euro(r.investeren) + ') / ' +
      U.pct(100 - M.getal(state.instellingen.surplusInvesterenPct)) + ' besteedbaar.</div>';
    h += '</div>';

    // rechts: hoe het loopt
    h += '<div>';
    h += '<div style="display:flex;justify-content:space-between;gap:1rem">' +
      '<div><div class="label">Al op</div><div class="groot">' + U.euro(r.uitgaven) + '</div></div>' +
      '<div style="text-align:right"><div class="label">Nog over</div><div class="groot" style="color:' + kleur + '">' +
      U.euro(r.besteedbaar - r.uitgaven) + '</div></div></div>';

    var deel = Math.max(0, Math.min(1, tempo.aandeelOp));
    var schema = r.besteedbaar > 0 ? Math.max(0, Math.min(1, tempo.verwachtOpSchema / r.besteedbaar)) : 0;
    h += '<div class="tempo-balk"><i style="width:' + (deel * 100).toFixed(1) + '%;background:' + kleur + '"></i>' +
      '<span class="marker" style="left:' + (schema * 100).toFixed(1) + '%"></span></div>';
    h += '<div class="tempo-legenda"><span>dag ' + tempo.dag + ' van ' + tempo.dagenInMaand + '</span>' +
      '<span>streepje = op schema</span></div>';

    if (r.overschrijding > 0) {
      h += '<div class="statuslijn niet" style="margin-top:1rem">' + U.euro(r.overschrijding, true) +
        ' over je maandbedrag heen.</div>';
      var d = r.dekking, delen = [];
      if (d.buffer) delen.push('uit je buffer ' + U.euro(d.buffer));
      if (d.autopot) delen.push('<span class="rood">kost je autopot ' + U.euro(d.autopot) + '</span>');
      if (d.jaarruimte) delen.push('kost je jaarruimte ' + U.euro(d.jaarruimte));
      if (d.beleggen) delen.push('kost je beleggen ' + U.euro(d.beleggen));
      if (d.oorlogskas) delen.push('kost je oorlogskas ' + U.euro(d.oorlogskas));
      if (d.ongedekt) delen.push('ongedekt ' + U.euro(d.ongedekt));
      h += '<div class="zacht" style="margin-top:.6rem;font-size:.92rem">' + delen.join(' &middot; ') + '</div>';
      if (d.autopot > 0) {
        var wkn = a.gemiddelden && a.gemiddelden.autopot > 0 ? d.autopot / a.gemiddelden.autopot : null;
        if (wkn) h += '<div class="zachter" style="margin-top:.35rem;font-size:.88rem">Dat is ' +
          (wkn < 1 ? Math.round(wkn * 30) + ' dagen' : (Math.round(wkn * 10) / 10).toString().replace('.', ',') + ' maand') +
          ' autopot-tempo.</div>';
      }
    } else {
      h += '<div class="statuslijn ' + (tempo.opSchema ? 'ok' : 'niet') + '" style="margin-top:1rem">' +
        (tempo.opSchema
          ? U.euro(Math.abs(tempo.verschilMetSchema)) + ' voor op schema'
          : U.euro(Math.abs(tempo.verschilMetSchema)) + ' achter op schema') + '</div>';
      h += '<div class="zacht" style="margin-top:.6rem;font-size:.92rem">' +
        (tempo.dagenRestend > 0
          ? U.euro(tempo.perResterendeDag) + ' per dag voor de resterende ' + tempo.dagenRestend + ' dagen.'
          : 'Laatste dag van de maand.') + '</div>';
    }
    h += '</div></div></section>';
    return h;
  }

  // ------------------------------------------------------------------- potjes
  function potjesBlok(a, instellingen) {
    var posNu = M.ladderPositie(a.standen.autopot, instellingen.autoLadder);
    var jaarruimteAan = M.getal(instellingen.jaarruimteDeelVanBeleggenPct) > 0 ||
      M.getal(instellingen.jaarruimteDoelPerJaar) > 0;

    var h = '<section class="blok"><h2 class="kop">Potjes</h2><div class="rooster k3">';
    h += potKaart('Oorlogskas', a.standen.oorlogskas, a.oorlogskasDoel, 'var(--groen)',
      a.oorlogskasDoelIsSchatting ? 'doel = plan' : M.getal(instellingen.oorlogskasMaanden) + ' mnd burn');
    h += potKaart('Autopot', a.standen.autopot, posNu.volgende ? M.getal(posNu.volgende.vanaf) : 0, 'var(--blauw)',
      posNu.volgende ? 'op weg naar trede ' + (posNu.index + 2) : 'top bereikt');
    h += potKaart('Beleggen', a.standen.beleggen, 0, 'var(--paars)', 'geen doel, alleen tijd');
    h += potKaart('Besteedbaar (buffer)', a.standen.besteedbaar, 0, 'var(--tekst)', 'wat je overhield');
    if (jaarruimteAan) {
      h += potKaart('Jaarruimte', a.standen.jaarruimte, M.getal(instellingen.jaarruimteDoelPerJaar),
        'var(--geel)', 'dit jaar');
    }
    h += potKaart('Gereserveerd', a.standen.reserveringen, 0, 'var(--geel)',
      a.openReserveringen.length + ' open');
    h += potKaart('Voorgeschoten', a.standen.voorgeschoten, 0, 'var(--tekst-zacht)',
      a.openVoorschotten.length + ' open');
    h += '</div>';

    if (a.openReserveringen.length) {
      h += '<div class="kaart" style="margin-top:1rem"><h3>Wat staat er gereserveerd</h3>' +
        '<table class="lijst"><tr><th>Waarvoor</th><th>Verwacht</th><th class="r">Bedrag</th></tr>';
      a.openReserveringen.slice().sort(function (x, y) {
        return (x.verwachteMaand || '') < (y.verwachteMaand || '') ? -1 : 1;
      }).forEach(function (r) {
        h += '<tr><td>' + U.esc(r.naam) + '</td><td class="zacht">' + U.esc(U.maandLabel(r.verwachteMaand)) +
          '</td><td class="r">' + U.euro(r.bedrag) + '</td></tr>';
      });
      h += '</table></div>';
    }
    if (a.openVoorschotten.length) {
      h += '<div class="kaart" style="margin-top:1rem"><h3>Nog terug te krijgen</h3>' +
        '<table class="lijst"><tr><th>Wat</th><th>Voorgeschoten in</th><th class="r">Bedrag</th></tr>';
      a.openVoorschotten.forEach(function (v) {
        h += '<tr><td>' + U.esc(v.naam) + '</td><td class="zacht">' + U.esc(U.maandLabel(v.maand)) +
          '</td><td class="r">' + U.euro(v.bedrag) + '</td></tr>';
      });
      h += '</table></div>';
    }
    return h + '</section>';
  }

  // ---------------------------------------------------------------- projectie
  function projectieBlok(a, instellingen) {
    if (!a.heeftData) {
      return '<section class="blok"><h2 class="kop">Vermogen over ' +
        M.getal(instellingen.projectieJaren) + ' jaar</h2>' +
        '<div class="leeg">Zodra er &eacute;&eacute;n maand ingevuld staat teken ik hier je lijn. ' +
        'Niet eerder &mdash; een grafiek op basis van een aanname is een leugen met assen.</div></section>';
    }

    var jaren = M.getal(instellingen.projectieJaren) || 20;
    var rendement = M.getal(instellingen.rendementPct);
    var extra = M.getal(instellingen.strengerExtraPerMaand);
    var start = a.standen.beleggen + a.standen.jaarruimte;
    var inleg = a.gemiddelden.belegdTotaal;

    var basis = M.projecteer(start, inleg, rendement, jaren);
    var streng = M.projecteer(start, inleg + extra, rendement, jaren);
    var eindBasis = basis[basis.length - 1].waarde;
    var eindStreng = streng[streng.length - 1].waarde;

    var xLabels = [];
    for (var j = 0; j <= jaren; j += Math.max(1, Math.round(jaren / 5))) {
      xLabels.push({ x: j, tekst: j === 0 ? 'nu' : j + ' jr' });
    }

    var reeksen = [
      { punten: streng.map(function (p) { return { x: p.jaar, y: p.waarde }; }), kleur: '#3ddc97', naam: 'strenger', streep: true },
      { punten: basis.map(function (p) { return { x: p.jaar, y: p.waarde }; }), kleur: '#6aa9ff', naam: 'dit tempo', vlak: true }
    ];

    var h = '<section class="blok"><h2 class="kop">Vermogen over ' + jaren + ' jaar</h2><div class="kaart">';
    h += '<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.2rem">' +
      '<div><div class="label">Dit tempo</div><div class="groot" style="color:var(--blauw)">' + U.euro(eindBasis) + '</div>' +
      '<div class="zachter" style="font-size:.85rem">' + U.euro(inleg) + ' p/m gemeten</div></div>' +
      '<div><div class="label">Strenger</div><div class="groot" style="color:var(--groen)">' + U.euro(eindStreng) + '</div>' +
      '<div class="zachter" style="font-size:.85rem">+ ' + U.euro(extra) + ' p/m</div></div>' +
      '<div><div class="label">Verschil</div><div class="groot">' + U.euro(eindStreng - eindBasis) + '</div>' +
      '<div class="zachter" style="font-size:.85rem">dat is wat discipline oplevert</div></div></div>';
    h += U.lijnGrafiek(reeksen, { hoogte: 300, xLabels: xLabels, titel: 'vermogensprojectie' });
    h += '<div class="legenda"><span><i style="background:#6aa9ff"></i>dit tempo</span>' +
      '<span><i style="background:#3ddc97"></i>' + U.euro(extra) + ' p/m strenger</span>' +
      '<span class="zachter">' + U.pct(rendement) + ' rendement, samengesteld per maand</span></div>';

    h += '<div class="grote-regel">Elke &euro; 100 die je nu niet uitgeeft, is over 10 jaar <b>' +
      U.euro(M.honderdEuroOver(10, rendement), true) + '</b> waard.</div>';
    h += '</div>';

    // ---- mijlpalen
    var vrijheid = M.vrijheidsBedrag(instellingen);
    var punten = [
      { naam: 'Oorlogskas vol', doel: a.oorlogskasDoel, start: a.standen.oorlogskas, inleg: a.gemiddelden.oorlogskas, rend: 0 },
      { naam: 'Eerste € 50.000 belegd', doel: 50000, start: start, inleg: inleg, rend: rendement },
      { naam: '€ 100.000', doel: 100000, start: start, inleg: inleg, rend: rendement },
      { naam: '€ 250.000', doel: 250000, start: start, inleg: inleg, rend: rendement },
      { naam: '€ 500.000', doel: 500000, start: start, inleg: inleg, rend: rendement },
      {
        naam: 'Financiële vrijheid', doel: vrijheid, start: start, inleg: inleg, rend: rendement,
        toelichting: U.euro(instellingen.gewenstMaandinkomen) + ' p/m bij ' + U.pct(instellingen.opnamePct) + ' opname'
      }
    ];

    h += '<div class="kaart" style="margin-top:1rem"><h3>Mijlpalen</h3>';
    punten.forEach(function (p) {
      var m = M.maandenTot(p.start, p.inleg, p.rend, p.doel, 12 * 70);
      var wanneer;
      if (m === 0) wanneer = '<span class="groen">gehaald</span>';
      else if (m == null) wanneer = '<span class="zachter">niet op dit tempo</span>';
      else wanneer = U.esc(U.datumLabel(M.datumOverMaanden(m))) +
        ' <span class="zachter" style="font-weight:400">(' +
        (m < 24 ? m + ' mnd' : (Math.round(m / 1.2) / 10).toString().replace('.', ',') + ' jaar') + ')</span>';
      h += '<div class="mijlpaal"><span>' + U.esc(p.naam) +
        (p.toelichting ? ' <span class="zachter" style="font-size:.84rem">&middot; ' + p.toelichting + '</span>' : '') +
        '</span><span class="zacht num">' + U.euro(p.doel) + '</span><span class="wanneer">' + wanneer + '</span></div>';
    });
    h += '</div></section>';
    return h;
  }

  // ------------------------------------------------------------- maandhistorie
  function historieBlok(a) {
    if (!a.heeftData) return '';
    var h = '<section class="blok"><h2 class="kop">Ingevulde maanden</h2><div class="kaart">' +
      '<table class="lijst"><tr><th>Maand</th><th class="r">Salaris</th><th class="r">Besteedbaar</th>' +
      '<th class="r">Uitgegeven</th><th class="r">Autopot</th><th class="r">Beleggen</th><th class="r">Burn</th></tr>';
    a.maanden.slice().reverse().forEach(function (r) {
      var kleur = r.overschrijding > 0 ? 'var(--rood)' : 'var(--groen)';
      h += '<tr><td>' + U.esc(U.maandLabel(r.maand)) +
        (r.notitie ? '<div class="zachter" style="font-size:.82rem">' + U.esc(r.notitie) + '</div>' : '') + '</td>' +
        '<td class="r">' + U.euro(r.salaris) + '</td>' +
        '<td class="r">' + U.euro(r.besteedbaar) + '</td>' +
        '<td class="r" style="color:' + kleur + '">' + U.euro(r.uitgaven) + '</td>' +
        '<td class="r">' + U.euro(r.netto.autopot) + '</td>' +
        '<td class="r">' + U.euro(r.netto.beleggen) + '</td>' +
        '<td class="r zacht">' + U.euro(r.burn) + '</td></tr>';
    });
    h += '</table></div></section>';
    return h;
  }

  function render(state) {
    var a = M.berekenAlles(state);
    return '<div class="wrap">' +
      ladderBlok(a, a.instellingen) +
      maandBlok(a, state) +
      potjesBlok(a, a.instellingen) +
      projectieBlok(a, a.instellingen) +
      historieBlok(a) +
      '</div>';
  }

  root.Dashboard = { render: render };
})(window);
