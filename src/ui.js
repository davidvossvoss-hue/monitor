/* Kleine hulpjes voor opmaak, DOM en grafieken. */
(function (root) {
  'use strict';

  var nfEuro0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var nfEuro2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function euro(n, decimalen) {
    n = root.Rekenen.getal(n);
    return (decimalen ? nfEuro2 : nfEuro0).format(n);
  }
  function euroKort(n) {
    n = root.Rekenen.getal(n);
    var a = Math.abs(n);
    if (a >= 1000000) return (n / 1000000).toFixed(a >= 10000000 ? 0 : 1).replace('.', ',') + ' mln';
    if (a >= 1000) return '€ ' + Math.round(n / 1000) + 'k';
    return euro(n);
  }
  function pct(n) { return Math.round(root.Rekenen.getal(n)) + '%'; }

  var MAANDNAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];

  function maandLabel(sleutel) {
    if (!sleutel) return '—';
    var p = String(sleutel).split('-');
    var m = parseInt(p[1], 10) - 1;
    return (MAANDNAMEN[m] || '?') + ' ' + p[0];
  }
  function maandKort(sleutel) {
    var p = String(sleutel).split('-');
    var m = parseInt(p[1], 10) - 1;
    return (MAANDNAMEN[m] || '?').slice(0, 3) + " '" + String(p[0]).slice(2);
  }
  function datumLabel(d) {
    if (!d) return '—';
    return MAANDNAMEN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Waarde op een pad zetten: 'instellingen.autoLadder.2.vanaf'
  function zetPad(obj, pad, waarde) {
    var d = pad.split('.'), o = obj;
    for (var i = 0; i < d.length - 1; i++) o = o[d[i]];
    o[d[d.length - 1]] = waarde;
  }
  function leesPad(obj, pad) {
    return pad.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }

  function balk(deel, kleur) {
    var p = Math.max(0, Math.min(1, deel || 0)) * 100;
    return '<div class="balk"><i style="width:' + p.toFixed(1) + '%' +
      (kleur ? ';background:' + kleur : '') + '"></i></div>';
  }

  // ---------------------------------------------------------------------
  // Lijngrafiek in SVG. Geen bibliotheken.
  // reeksen: [{punten:[{x,y}], kleur, naam, vlak:bool}]
  // ---------------------------------------------------------------------
  function lijnGrafiek(reeksen, opties) {
    opties = opties || {};
    // Op een telefoon een smaller assenstelsel, anders worden de labels
    // mee-geschaald tot ze onleesbaar zijn.
    var smal = (root.innerWidth || 1000) < 700;
    var B = smal ? 420 : 820, H = opties.hoogte || (smal ? 260 : 300);
    var tekstgrootte = smal ? 13 : 11;
    var mL = smal ? 52 : 58, mR = 14, mT = 14, mB = smal ? 26 : 30;
    var alle = reeksen.reduce(function (a, r) { return a.concat(r.punten); }, []);
    if (!alle.length) return '';
    var xMin = Math.min.apply(null, alle.map(function (p) { return p.x; }));
    var xMax = Math.max.apply(null, alle.map(function (p) { return p.x; }));
    var yMax = Math.max.apply(null, alle.map(function (p) { return p.y; }));
    var yMin = Math.min(0, Math.min.apply(null, alle.map(function (p) { return p.y; })));
    if (yMax === yMin) yMax = yMin + 1;
    // afgeronde bovengrens
    var stap = Math.pow(10, Math.floor(Math.log10(yMax || 1)));
    yMax = Math.ceil(yMax / (stap / 2)) * (stap / 2);

    var sx = function (x) { return mL + (x - xMin) / (xMax - xMin || 1) * (B - mL - mR); };
    var sy = function (y) { return H - mB - (y - yMin) / (yMax - yMin || 1) * (H - mT - mB); };

    var s = '<svg class="grafiek" viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="' +
      esc(opties.titel || 'grafiek') + '">';

    // rasterlijnen
    var lijnen = smal ? 3 : 4;
    for (var i = 0; i <= lijnen; i++) {
      var w = yMin + (yMax - yMin) * i / lijnen;
      var y = sy(w);
      s += '<line x1="' + mL + '" y1="' + y.toFixed(1) + '" x2="' + (B - mR) + '" y2="' + y.toFixed(1) +
        '" stroke="#24323e" stroke-width="1"/>';
      s += '<text x="' + (mL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="' + tekstgrootte + '" fill="#6e8291">' +
        esc(euroKort(w)) + '</text>';
    }
    // x-labels
    var xLabels = opties.xLabels || [];
    xLabels.forEach(function (l) {
      s += '<text x="' + sx(l.x).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + tekstgrootte + '" fill="#6e8291">' +
        esc(l.tekst) + '</text>';
    });

    reeksen.forEach(function (r, idx) {
      var d = r.punten.map(function (p, k) {
        return (k ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1);
      }).join(' ');
      if (r.vlak) {
        s += '<path d="' + d + ' L' + sx(r.punten[r.punten.length - 1].x).toFixed(1) + ' ' + sy(yMin).toFixed(1) +
          ' L' + sx(r.punten[0].x).toFixed(1) + ' ' + sy(yMin).toFixed(1) + ' Z" fill="' + r.kleur + '" opacity=".08"/>';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + r.kleur + '" stroke-width="' + (r.dik || 2.5) +
        '" stroke-linejoin="round" stroke-linecap="round"' + (r.streep ? ' stroke-dasharray="6 5"' : '') + '/>';
      var laatste = r.punten[r.punten.length - 1];
      s += '<circle cx="' + sx(laatste.x).toFixed(1) + '" cy="' + sy(laatste.y).toFixed(1) + '" r="3.5" fill="' + r.kleur + '"/>';
    });

    s += '</svg>';
    return s;
  }

  root.UI = {
    euro: euro, euroKort: euroKort, pct: pct, esc: esc,
    maandLabel: maandLabel, maandKort: maandKort, datumLabel: datumLabel,
    zetPad: zetPad, leesPad: leesPad, balk: balk, lijnGrafiek: lijnGrafiek,
    MAANDNAMEN: MAANDNAMEN
  };
})(window);
