/* Een PDF in de browser omzetten naar regels met posities, zodat lezen-pdf.js
   er hetzelfde mee kan als in node. pdf.js draait in een worker die uit de
   pagina zelf komt; lukt dat niet, dan valt hij terug op de hoofddraad.     */
(function (root) {
  'use strict';

  var pdfjs = null, klaar = null;

  function laad() {
    if (klaar) return klaar;
    klaar = new Promise(function (gelukt, mislukt) {
      if (!root.pdfjsLib) { mislukt(new Error('pdf.js ontbreekt in dit bestand.')); return; }
      pdfjs = root.pdfjsLib;
      try {
        var bron = document.getElementById('pdf-worker');
        if (bron && root.Blob && root.URL && root.URL.createObjectURL) {
          // De worker zit in dit bestand zelf. Hij is een module, dus moet hij
          // ook als module gestart worden.
          var blob = new Blob([bron.textContent], { type: 'text/javascript' });
          pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
        }
      } catch (e) { /* dan maar zonder worker */ }
      gelukt(pdfjs);
    });
    return klaar;
  }

  // Zelfde vorm als de node-kant: {paginas:[{nummer, regels:[{y, items:[{x,b,s}]}]}]}
  function naarPaginas(doc) {
    var taken = [];
    for (var p = 1; p <= doc.numPages; p++) taken.push(pagina(doc, p));
    return Promise.all(taken).then(function (paginas) { return paginas; });
  }

  function pagina(doc, nummer) {
    return doc.getPage(nummer).then(function (blad) {
      return blad.getTextContent().then(function (inhoud) {
        var regels = new Map();
        inhoud.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var y = Math.round(it.transform[5] * 2) / 2;
          if (!regels.has(y)) regels.set(y, []);
          regels.get(y).push({
            x: Math.round(it.transform[4] * 10) / 10,
            b: Math.round((it.width || 0) * 10) / 10,
            s: it.str
          });
        });
        var uit = Array.from(regels.entries())
          .sort(function (a, b) { return b[0] - a[0]; })
          .map(function (paar) {
            return { y: paar[0], items: paar[1].sort(function (a, b) { return a.x - b.x; }) };
          });
        return { nummer: nummer, regels: uit };
      });
    });
  }

  // Blijft het hangen, dan liever een duidelijke melding dan een eeuwig
  // draaiend rondje.
  function metTijdslimiet(belofte, seconden, bericht) {
    return new Promise(function (gelukt, mislukt) {
      var klok = setTimeout(function () { mislukt(new Error(bericht)); }, seconden * 1000);
      belofte.then(function (v) { clearTimeout(klok); gelukt(v); },
        function (e) { clearTimeout(klok); mislukt(e); });
    });
  }

  function lees(bestand) {
    return metTijdslimiet(leesEcht(bestand), 90,
      'Het lezen van deze PDF duurde te lang. Probeer een CSV-export van deze rekening.');
  }

  function leesEcht(bestand) {
    return laad().then(function () {
      return bestand.arrayBuffer();
    }).then(function (buffer) {
      return pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    }).then(function (doc) {
      return naarPaginas(doc).then(function (paginas) { return { paginas: paginas }; });
    });
  }

  root.PdfInlezen = { lees: lees };
})(window);
