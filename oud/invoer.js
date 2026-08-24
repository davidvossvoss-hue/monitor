/* Invoerscherm. Vier getallen per maand, meer niet. */
(function (root) {
  'use strict';
  var M = root.Model, U = root.UI;

  function maandIndex(state, sleutel) {
    for (var i = 0; i < state.maanden.length; i++) if (state.maanden[i].maand === sleutel) return i;
    return -1;
  }

  function zorgVoorMaand(state, sleutel) {
    var i = maandIndex(state, sleutel);
    if (i >= 0) return i;
    state.maanden.push({
      maand: sleutel, salaris: 0, gezamenlijkePasTotaal: M.getal(state.instellingen.gezamenlijkePasPlan) * 2,
      eigenUitgaven: [{ omschrijving: 'Revolut', bedrag: 0 }, { omschrijving: 'ABN AMRO', bedrag: 0 }, { omschrijving: 'Amex', bedrag: 0 }],
      notitie: ''
    });
    state.maanden.sort(function (a, b) { return a.maand < b.maand ? -1 : 1; });
    return maandIndex(state, sleutel);
  }

  // ------------------------------------------------------------- live uitkomst
  function liveHTML(state, sleutel) {
    var a = M.berekenAlles(state);
    var r = null;
    for (var i = 0; i < a.maanden.length; i++) if (a.maanden[i].maand === sleutel) r = a.maanden[i];
    if (!r) {
      return '<div class="leeg">Vul een salaris in, dan reken ik deze maand meteen door.</div>';
    }
    function rij(label, bedrag, klas, teken) {
      if (Object.is(bedrag, -0)) bedrag = 0; // geen "-€ 0,00"
      return '<tr class="' + (klas || '') + '"><td>' + label + '</td><td class="r">' +
        (teken || '') + U.euro(bedrag, true) + '</td></tr>';
    }
    var h = '<table class="lijst">';
    h += rij('Salaris', r.salaris);
    h += rij('Gezamenlijke pas &mdash; mijn deel (' + U.pct(state.instellingen.gezamenlijkePasMijnDeelPct) + ')', -r.mijnDeelGezamenlijk || 0, 'zacht');
    h += rij('Vaste lasten overig', -r.vasteLastenOverig || 0, 'zacht');
    h += rij('Inleg reserveringen deze maand', -r.reserveringInleg || 0, 'zacht');
    h += '<tr><td><b>Surplus</b></td><td class="r"><b>' + U.euro(r.surplus, true) + '</b></td></tr>';
    h += rij('&rarr; investeren (' + U.pct(state.instellingen.surplusInvesterenPct) + ')', r.investeren);
    h += rij('&nbsp;&nbsp;&nbsp;1. oorlogskas', r.naarOorlogskas, 'zacht');
    h += rij('&nbsp;&nbsp;&nbsp;2. autopot', r.naarAutopot, 'zacht');
    h += rij('&nbsp;&nbsp;&nbsp;3. beleggen', r.naarBeleggen, 'zacht');
    if (r.naarJaarruimte) h += rij('&nbsp;&nbsp;&nbsp;3b. jaarruimte', r.naarJaarruimte, 'zacht');
    h += '<tr><td><b>&rarr; besteedbaar</b></td><td class="r"><b>' + U.euro(r.besteedbaar, true) + '</b></td></tr>';
    h += rij('Eigen uitgaven ingevoerd', r.uitgavenBruto, 'zacht');
    if (r.voorgeschoten) h += rij('af: voorgeschoten', -r.voorgeschoten, 'zacht');
    if (r.reserveringVrijgevallen) h += rij('af: gereserveerd, valt vrij', -r.reserveringVrijgevallen, 'zacht');
    h += '<tr><td><b>Telt mee als uitgave</b></td><td class="r"><b>' + U.euro(r.uitgaven, true) + '</b></td></tr>';
    h += '</table>';

    if (r.overschrijding > 0) {
      h += '<div class="statuslijn niet" style="margin-top:1rem">' + U.euro(r.overschrijding, true) + ' eroverheen' +
        (r.dekking.autopot ? ' &middot; kost je ' + U.euro(r.dekking.autopot, true) + ' autopot' : '') + '</div>';
    } else {
      h += '<div class="statuslijn ok" style="margin-top:1rem">' + U.euro(r.onderschrijding, true) + ' over</div>';
    }
    h += '<div class="zachter" style="font-size:.85rem;margin-top:.8rem">Burn rate deze maand ' +
      U.euro(r.burn) + ' &middot; weekbedrag ' + U.euro(r.weekbedrag) + '</div>';
    return h;
  }

  // ---------------------------------------------------------------- het scherm
  function render(state, sleutel) {
    var idx = maandIndex(state, sleutel);
    var m = idx >= 0 ? state.maanden[idx] : null;
    var p = 'maanden.' + idx + '.';

    var h = '<div class="wrap"><section class="blok">';

    // maandkiezer
    h += '<div class="kaart" style="margin-bottom:1rem"><div class="knoppen">' +
      '<span class="label" style="margin-right:.4rem">Maand</span><select data-actie="kies-maand" style="width:auto;min-width:180px">';
    var sleutels = state.maanden.map(function (x) { return x.maand; });
    if (sleutels.indexOf(sleutel) < 0) sleutels.push(sleutel);
    sleutels.sort().reverse().forEach(function (s) {
      h += '<option value="' + U.esc(s) + '"' + (s === sleutel ? ' selected' : '') + '>' + U.esc(U.maandLabel(s)) + '</option>';
    });
    h += '</select>';
    h += '<input type="month" id="nieuwe-maand-veld" value="' + U.esc(sleutel) + '" style="width:auto">' +
      '<button class="knop zacht" data-actie="nieuwe-maand">Naar deze maand</button>';
    if (idx >= 0) h += '<button class="knop gevaar mini" data-actie="maand-weg" style="margin-left:auto">Maand verwijderen</button>';
    h += '</div></div>';

    h += '<div class="rooster k-invoer">';

    // ---- linkerkolom: invoer
    h += '<div class="kaart"><h3>' + U.esc(U.maandLabel(sleutel)) + '</h3>';

    if (idx < 0) {
      h += '<div class="leeg" style="margin-bottom:1rem">Deze maand bestaat nog niet. ' +
        '<button class="knop mini" data-actie="maand-aanmaken" data-maand="' + U.esc(sleutel) + '">Maand aanmaken</button></div>';
    } else {
      h += '<label class="veld"><span class="t">Salaris</span>' +
        '<input type="number" step="0.01" data-bind="' + p + 'salaris" value="' + M.getal(m.salaris) + '"></label>';

      var mijnDeel = M.getal(m.gezamenlijkePasTotaal) * M.getal(state.instellingen.gezamenlijkePasMijnDeelPct) / 100;
      h += '<label class="veld"><span class="t">Gezamenlijke pas &mdash; totaal deze maand</span>' +
        '<input type="number" step="0.01" data-bind="' + p + 'gezamenlijkePasTotaal" value="' + M.getal(m.gezamenlijkePasTotaal) + '">' +
        '<span class="u">Mijn deel (' + U.pct(state.instellingen.gezamenlijkePasMijnDeelPct) + '): ' +
        U.euro(mijnDeel, true) + ' &middot; dit is je vaste last wonen &amp; eten.</span></label>';

      h += '<div class="veld"><span class="t">Mijn eigen uitgaven &mdash; alle kaarten bij elkaar</span>';
      (m.eigenUitgaven || []).forEach(function (u, i) {
        h += '<div class="rij">' +
          '<input type="text" data-bind="' + p + 'eigenUitgaven.' + i + '.omschrijving" value="' + U.esc(u.omschrijving) + '" placeholder="Revolut / ABN / Amex">' +
          '<input type="number" step="0.01" data-bind="' + p + 'eigenUitgaven.' + i + '.bedrag" value="' + M.getal(u.bedrag) + '">' +
          '<button class="weg" data-actie="uitgave-weg" data-i="' + i + '" title="regel weg">&times;</button></div>';
      });
      h += '<div class="knoppen" style="margin-top:.4rem">' +
        '<button class="knop zacht mini" data-actie="uitgave-erbij">+ regel</button>' +
        '<span class="zacht num" style="margin-left:auto">totaal ' + U.euro(M.eigenUitgavenTotaal(m), true) + '</span></div>';
      h += '<span class="u" style="margin-bottom:1rem">Het model ziet hier &eacute;&eacute;n getal in. Welke kaart het was maakt niet uit.</span></div>';

      h += '<label class="veld"><span class="t">Notitie &mdash; de uitschieter van deze maand</span>' +
        '<textarea data-bind="' + p + 'notitie" placeholder="Nieuwe laptop, bruiloft, tandarts...">' + U.esc(m.notitie || '') + '</textarea></label>';
    }
    h += '</div>';

    // ---- rechterkolom: uitkomst
    h += '<div class="kaart"><h3>Wat het model ervan maakt</h3><div id="live">' + liveHTML(state, sleutel) + '</div></div>';
    h += '</div></section>';

    // ---- reserveringen
    h += '<section class="blok"><h2 class="kop">Reserveringen</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">Geld dat binnen is maar al vergeven. Het gaat er v&oacute;&oacute;r de ' +
      'surplusberekening af, en op de maand dat je het betaalt telt het niet n&oacute;g een keer als uitgave.</p>' +
      '<div class="rij rij-res">' +
      '<input type="text" id="res-naam" placeholder="Waarvoor?">' +
      '<input type="number" step="0.01" id="res-bedrag" placeholder="Bedrag">' +
      '<input type="month" id="res-inleg" value="' + U.esc(sleutel) + '" title="inleg in deze maand">' +
      '<input type="month" id="res-verwacht" value="' + U.esc(M.maandPlus(sleutel, 3)) + '" title="verwachte betaalmaand">' +
      '<button class="knop mini" data-actie="reservering-erbij">+</button></div>' +
      '<div class="zachter" style="font-size:.8rem;margin-bottom:1rem">naam &middot; bedrag &middot; inlegmaand &middot; verwachte betaalmaand</div>';

    if (!state.reserveringen.length) {
      h += '<div class="zacht">Nog niets gereserveerd.</div>';
    } else {
      h += '<div class="tabel-scroll"><table class="lijst"><tr><th>Waarvoor</th><th>Inleg</th><th>Verwacht</th><th class="r">Bedrag</th><th></th><th></th></tr>';
      state.reserveringen.slice().sort(function (a, b) { return (a.verwachteMaand || '') < (b.verwachteMaand || '') ? -1 : 1; })
        .forEach(function (r) {
          h += '<tr><td>' + U.esc(r.naam) + ' ' +
            (r.betaaldMaand ? '<span class="chip klaar">betaald ' + U.esc(U.maandKort(r.betaaldMaand)) + '</span>'
              : '<span class="chip open">open</span>') + '</td>' +
            '<td class="zacht">' + U.esc(U.maandKort(r.inlegMaand)) + '</td>' +
            '<td class="zacht">' + U.esc(U.maandKort(r.verwachteMaand)) + '</td>' +
            '<td class="r">' + U.euro(r.bedrag) + '</td>' +
            '<td class="r">' + (r.betaaldMaand
              ? '<button class="knop zacht mini" data-actie="reservering-open" data-id="' + r.id + '">terugzetten</button>'
              : '<button class="knop zacht mini" data-actie="reservering-afvinken" data-id="' + r.id + '">afvinken in ' + U.esc(U.maandKort(sleutel)) + '</button>') + '</td>' +
            '<td class="r"><button class="weg" data-actie="reservering-weg" data-id="' + r.id + '">&times;</button></td></tr>';
        });
      h += '</table></div>';
    }
    h += '</div></section>';

    // ---- voorgeschoten
    h += '<section class="blok"><h2 class="kop">Voorgeschoten</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">Geld dat je voorschiet en terugkrijgt. Telt voor nul mee in je budget.</p>' +
      '<div class="rij rij-vs">' +
      '<input type="text" id="vs-naam" placeholder="Werkdeclaratie, uitje met mijn broer...">' +
      '<input type="number" step="0.01" id="vs-bedrag" placeholder="Bedrag">' +
      '<input type="month" id="vs-maand" value="' + U.esc(sleutel) + '">' +
      '<button class="knop mini" data-actie="voorschot-erbij">+</button></div>';
    if (!state.voorschotten.length) {
      h += '<div class="zacht">Niets openstaand.</div>';
    } else {
      h += '<div class="tabel-scroll"><table class="lijst"><tr><th>Wat</th><th>Maand</th><th class="r">Bedrag</th><th></th><th></th></tr>';
      state.voorschotten.slice().reverse().forEach(function (v) {
        h += '<tr><td>' + U.esc(v.naam) + ' ' +
          (v.terugbetaaldMaand ? '<span class="chip klaar">terug</span>' : '<span class="chip open">open</span>') + '</td>' +
          '<td class="zacht">' + U.esc(U.maandKort(v.maand)) + '</td>' +
          '<td class="r">' + U.euro(v.bedrag) + '</td>' +
          '<td class="r">' + (v.terugbetaaldMaand
            ? '<button class="knop zacht mini" data-actie="voorschot-open" data-id="' + v.id + '">terugzetten</button>'
            : '<button class="knop zacht mini" data-actie="voorschot-terug" data-id="' + v.id + '">terugbetaald</button>') + '</td>' +
          '<td class="r"><button class="weg" data-actie="voorschot-weg" data-id="' + v.id + '">&times;</button></td></tr>';
      });
      h += '</table></div>';
    }
    h += '</div></section></div>';
    return h;
  }

  root.Invoer = {
    render: render, liveHTML: liveHTML, maandIndex: maandIndex, zorgVoorMaand: zorgVoorMaand
  };
})(window);
