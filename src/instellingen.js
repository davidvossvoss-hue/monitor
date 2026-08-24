/* Instellingen. Alles wat het model gebruikt staat hier. Niets is hardcoded. */
(function (root) {
  'use strict';
  var M = root.Model, U = root.UI;

  function veld(label, pad, waarde, opties) {
    opties = opties || {};
    return '<label class="veld"><span class="t">' + label + '</span>' +
      '<input type="' + (opties.type || 'number') + '" step="' + (opties.step || '0.01') + '"' +
      (opties.min != null ? ' min="' + opties.min + '"' : '') +
      (opties.max != null ? ' max="' + opties.max + '"' : '') +
      ' data-bind="' + pad + '" value="' + U.esc(waarde == null ? '' : waarde) + '"' +
      (opties.placeholder ? ' placeholder="' + U.esc(opties.placeholder) + '"' : '') + '>' +
      (opties.uitleg ? '<span class="u">' + opties.uitleg + '</span>' : '') + '</label>';
  }

  function render(state) {
    var i = state.instellingen;
    var a = M.berekenAlles(state);
    var h = '<div class="wrap">';

    // ---- vaste lasten
    h += '<section class="blok"><h2 class="kop">Vaste lasten</h2><div class="rooster k2">';
    h += '<div class="kaart"><h3>Wonen &amp; eten (gezamenlijke pas)</h3>' +
      veld('Mijn deel van de gezamenlijke pas', 'instellingen.gezamenlijkePasMijnDeelPct', i.gezamenlijkePasMijnDeelPct,
        { step: '1', min: 0, max: 100, uitleg: 'Percentage van het totaal dat van de gezamenlijke rekening afgaat. 50% = eerlijk delen met je partner.' }) +
      veld('Gepland maandbedrag', 'instellingen.gezamenlijkePasPlan', i.gezamenlijkePasPlan,
        { uitleg: 'Alleen gebruikt zolang er nog geen maand is ingevuld. Daarna reken ik met wat je echt invulde.' }) +
      '</div>';

    h += '<div class="kaart"><h3>Overig</h3>';
    (i.vasteLastenOverig || []).forEach(function (v, k) {
      h += '<div class="rij"><input type="text" data-bind="instellingen.vasteLastenOverig.' + k + '.naam" value="' + U.esc(v.naam) + '">' +
        '<input type="number" step="0.01" data-bind="instellingen.vasteLastenOverig.' + k + '.bedrag" value="' + M.getal(v.bedrag) + '">' +
        '<button class="weg" data-actie="vastelast-weg" data-i="' + k + '">&times;</button></div>';
    });
    h += '<div class="knoppen" style="margin-top:.5rem"><button class="knop zacht mini" data-actie="vastelast-erbij">+ regel</button>' +
      '<span class="zacht num" style="margin-left:auto">totaal ' + U.euro(M.vasteLastenOverigTotaal(i), true) + ' p/m</span></div></div>';
    h += '</div></section>';

    // ---- verdeling
    h += '<section class="blok"><h2 class="kop">Verdeling</h2><div class="rooster k2">';
    h += '<div class="kaart"><h3>Surplus splitsen</h3>' +
      veld('Naar investeren', 'instellingen.surplusInvesterenPct', i.surplusInvesterenPct,
        { step: '1', min: 0, max: 100, uitleg: 'De rest, ' + U.pct(100 - M.getal(i.surplusInvesterenPct)) + ', is je besteedbare geld.' }) +
      veld('Naar autopot, na de oorlogskas', 'instellingen.autopotPctNaOorlogskas', i.autopotPctNaOorlogskas,
        { step: '1', min: 0, max: 100, uitleg: 'Van wat er na de oorlogskas overblijft. De rest (' + U.pct(100 - M.getal(i.autopotPctNaOorlogskas)) + ') gaat naar beleggen.' }) +
      '</div>';

    h += '<div class="kaart"><h3>Oorlogskas</h3>' +
      veld('Aantal maanden burn rate', 'instellingen.oorlogskasMaanden', i.oorlogskasMaanden,
        { step: '0.5', min: 0, uitleg: 'Doel = dit aantal &times; je totale maandelijkse burn rate, dus inclusief de gezamenlijke pas en je dagelijkse uitgaven.' }) +
      veld('Vast doelbedrag (leeg = berekenen)', 'instellingen.oorlogskasDoelHandmatig', i.oorlogskasDoelHandmatig,
        { placeholder: 'leeg laten', uitleg: 'Nu: doel ' + U.euro(a.oorlogskasDoel) + (a.oorlogskasDoelIsSchatting ? ' (schatting, nog geen maand ingevuld)' : ' op basis van gemeten burn ' + U.euro(a.gemiddeldeBurn) + ' p/m') }) +
      '</div>';

    h += '<div class="kaart"><h3>Jaarruimte</h3>' +
      veld('Deel van de beleggingsinleg', 'instellingen.jaarruimteDeelVanBeleggenPct', i.jaarruimteDeelVanBeleggenPct,
        { step: '1', min: 0, max: 100, uitleg: '0 = uit. Zet je dit hoger, dan gaat dat deel van je beleggingsinleg naar een apart jaarruimte-potje.' }) +
      veld('Doel per jaar', 'instellingen.jaarruimteDoelPerJaar', i.jaarruimteDoelPerJaar, { uitleg: '0 = geen doel.' }) +
      '</div>';

    h += '<div class="kaart"><h3>Beginstanden</h3>' +
      '<p class="notitie" style="margin-top:0">Wat er al stond voordat je begon te loggen.</p>' +
      veld('Oorlogskas', 'instellingen.startSaldi.oorlogskas', i.startSaldi.oorlogskas) +
      veld('Autopot', 'instellingen.startSaldi.autopot', i.startSaldi.autopot) +
      veld('Beleggen', 'instellingen.startSaldi.beleggen', i.startSaldi.beleggen) +
      veld('Jaarruimte', 'instellingen.startSaldi.jaarruimte', i.startSaldi.jaarruimte) +
      veld('Besteedbaar (buffer)', 'instellingen.startSaldi.besteedbaar', i.startSaldi.besteedbaar) +
      '</div>';
    h += '</div></section>';

    // ---- auto-ladder
    h += '<section class="blok"><h2 class="kop">Auto-ladder</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">Tredes en bedragen. Alles aanpasbaar; de volgorde bepaalt het bedrag, niet de regel.</p>';
    (i.autoLadder || []).forEach(function (t, k) {
      h += '<div class="rij"><input type="text" data-bind="instellingen.autoLadder.' + k + '.naam" value="' + U.esc(t.naam) + '">' +
        '<input type="number" step="100" data-bind="instellingen.autoLadder.' + k + '.vanaf" value="' + M.getal(t.vanaf) + '">' +
        '<button class="weg" data-actie="trede-weg" data-i="' + k + '">&times;</button></div>';
    });
    h += '<div class="knoppen" style="margin-top:.5rem"><button class="knop zacht mini" data-actie="trede-erbij">+ trede</button></div>';
    h += '</div></section>';

    // ---- projectie
    h += '<section class="blok"><h2 class="kop">Projectie</h2><div class="rooster k2"><div class="kaart">' +
      veld('Rendement per jaar', 'instellingen.rendementPct', i.rendementPct,
        { step: '0.1', uitleg: 'Wordt maandelijks samengesteld. Elke &euro; 100 nu = ' + U.euro(M.honderdEuroOver(10, i.rendementPct), true) + ' over 10 jaar.' }) +
      veld('Aantal jaren', 'instellingen.projectieJaren', i.projectieJaren, { step: '1', min: 1 }) +
      veld('&quot;Strenger&quot;: extra per maand', 'instellingen.strengerExtraPerMaand', i.strengerExtraPerMaand,
        { uitleg: 'De tweede lijn in de grafiek.' }) +
      '</div><div class="kaart">' +
      veld('Gewenst maandinkomen', 'instellingen.gewenstMaandinkomen', i.gewenstMaandinkomen) +
      veld('Opnamepercentage', 'instellingen.opnamePct', i.opnamePct,
        { step: '0.1', uitleg: 'Financi&euml;le vrijheid = ' + U.euro(M.vrijheidsBedrag(i)) + '.' }) +
      veld('Weken per maand', 'instellingen.wekenPerMaand', i.wekenPerMaand,
        { step: '0.01', uitleg: 'Voor het weekbedrag. Standaard 4,33.' }) +
      '</div></div></section>';

    // ---- data
    h += '<section class="blok"><h2 class="kop">Gegevens</h2><div class="kaart">' +
      '<p class="notitie" style="margin-top:0">Alles staat lokaal in deze browser. Geen account, geen cloud, geen bankkoppeling. ' +
      'Wis je je browsergegevens, dan is het weg &mdash; exporteer af en toe.</p>' +
      '<div class="knoppen">' +
      '<button class="knop" data-actie="export">Exporteren (JSON)</button>' +
      '<button class="knop zacht" data-actie="import">Importeren</button>' +
      '<input type="file" id="import-bestand" accept="application/json" style="display:none">' +
      '<button class="knop gevaar" data-actie="reset" style="margin-left:auto">Alles wissen</button>' +
      '</div></div></section></div>';
    return h;
  }

  root.Instellingen = { render: render };
})(window);
