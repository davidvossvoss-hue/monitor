/* Lijm: staat, schermen, acties, bestanden inlezen. */
(function (root) {
  'use strict';
  var U = root.UI, C = root.Categorie, A = root.Analyse, R = root.Rekenen, O = root.Opslag;

  var staat = O.laden();
  var ui = root.beginUI || { tab: 'inlezen' };
  var werk = { analyse: null, resultaten: [], bezig: null, nieuw: 0, dubbel: 0, openCategorie: null };
  var el = {};

  // ---------------------------------------------------------------- rekenen
  function opties() {
    var eigen = [], gemerkt = [];
    (staat.instellingen.rekeningen || []).forEach(function (r) {
      if (!r.patroon) return;
      if (r.rol === 'gezamenlijk') gemerkt.push({ patroon: r.patroon, categorie: 'gezamenlijk' });
      else if (r.rol === 'eigen') eigen.push(r.patroon);
    });
    return {
      handmatig: staat.handmatig,
      geleerd: staat.geleerd,
      eigenRekeningen: eigen,
      rekeningen: gemerkt,
      negeerMaanden: staat.instellingen.negeerMaanden || []
    };
  }

  function herbereken() {
    werk.analyse = staat.transacties.length
      ? A.analyseer([staat.transacties.map(function (t) { return Object.assign({}, t); })], opties())
      : null;
  }

  function bewaar() { O.bewaren(staat); }

  // ---------------------------------------------------------------- tekenen
  function render() {
    var h;
    if (ui.tab === 'indelen') h = root.Schermen.indelenScherm(staat, werk);
    else if (ui.tab === 'analyse') h = root.Schermen.analyseScherm(staat, werk);
    else if (ui.tab === 'planner') h = root.PlannerUI.plannerScherm(staat, werk);
    else if (ui.tab === 'instellingen') h = root.PlannerUI.instellingenScherm(staat, werk);
    else h = root.Schermen.importScherm(staat, werk);
    el.app.innerHTML = h;
    Array.prototype.forEach.call(el.tabs.querySelectorAll('button'), function (b) {
      b.classList.toggle('actief', b.dataset.tab === ui.tab);
    });
    var teller = el.tabs.querySelector('[data-tab="indelen"] .teller');
    if (teller) {
      var open = werk.analyse ? werk.analyse.onbekend.filter(function (t) { return t.bedrag < 0; }).length : 0;
      teller.textContent = open ? open : '';
      teller.style.display = open ? '' : 'none';
    }
  }

  var klok = null, wachten = false;
  function inVeld() {
    var a = document.activeElement;
    return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && el.app.contains(a);
  }
  function herteken() {
    clearTimeout(klok);
    klok = setTimeout(function () {
      if (inVeld()) { wachten = true; return; }
      wachten = false; render();
    }, 0);
  }
  document.addEventListener('focusout', function () {
    setTimeout(function () { if (wachten && !inVeld()) { wachten = false; render(); } }, 0);
  });

  // ------------------------------------------------------------- databinding
  function pakWaarde(inp) {
    if (inp.type === 'checkbox') return inp.checked;
    if (inp.type === 'number') {
      if (inp.value.trim() === '') return inp.dataset.bind.indexOf('Handmatig') > -1 ? null : 0;
      var n = parseFloat(inp.value.replace(',', '.'));
      return isFinite(n) ? n : 0;
    }
    return inp.value;
  }

  document.addEventListener('input', function (e) {
    var inp = e.target;
    if (!inp.dataset || !inp.dataset.bind) return;
    U.zetPad({ instellingen: staat.instellingen, staat: staat }, inp.dataset.bind, pakWaarde(inp));
    bewaar();
  });

  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (inp.dataset && inp.dataset.actie === 'streef') {
      var v = parseFloat(String(inp.value).replace(',', '.'));
      staat.instellingen.streef[inp.dataset.categorie] = isFinite(v) ? v : 0;
      bewaar(); herteken(); return;
    }
    if (inp.dataset && inp.dataset.actie === 'leer') {
      if (inp.value) staat.geleerd[inp.dataset.sleutel] = inp.value;
      else delete staat.geleerd[inp.dataset.sleutel];
      bewaar(); herbereken(); herteken(); return;
    }
    if (inp.id === 'bestanden' && inp.files && inp.files.length) { verwerkBestanden(inp.files); return; }
    if (inp.id === 'import-bestand' && inp.files && inp.files[0]) {
      var lezer = new FileReader();
      lezer.onload = function () {
        try {
          var d = JSON.parse(lezer.result);
          staat = Object.assign(O.leeg(), d);
          staat.instellingen = Object.assign(O.leeg().instellingen, d.instellingen || {});
          bewaar(); herbereken(); render();
        } catch (err) { alert('Kon dit bestand niet lezen: ' + err.message); }
      };
      lezer.readAsText(inp.files[0]);
      return;
    }
    if (inp.dataset && inp.dataset.bind) {
      U.zetPad({ instellingen: staat.instellingen, staat: staat }, inp.dataset.bind, pakWaarde(inp));
      bewaar(); herbereken(); herteken();
    }
  });

  // -------------------------------------------------------- bestanden lezen
  function isPdf(bestand) {
    return /\.pdf$/i.test(bestand.name) || bestand.type === 'application/pdf';
  }

  function leesEen(bestand) {
    if (isPdf(bestand)) {
      if (!root.PdfInlezen) {
        return Promise.resolve({ naam: bestand.name, fout: 'PDF lezen kan hier niet. Exporteer als CSV.' });
      }
      return root.PdfInlezen.lees(bestand).then(function (doc) {
        var r = root.LezenPdf.lees(doc.paginas);
        return Object.assign({ naam: bestand.name }, r);
      }).catch(function (e) {
        return { naam: bestand.name, fout: 'Kon deze PDF niet lezen: ' + (e && e.message ? e.message : e) };
      });
    }
    return bestand.text().then(function (tekst) {
      var r = root.Lezen.lees(tekst);
      return Object.assign({ naam: bestand.name }, r);
    }).catch(function (e) {
      return { naam: bestand.name, fout: 'Kon dit bestand niet lezen: ' + (e && e.message ? e.message : e) };
    });
  }

  function verwerkBestanden(bestanden) {
    var lijst = Array.prototype.slice.call(bestanden);
    werk.resultaten = []; werk.nieuw = 0; werk.dubbel = 0;
    werk.bezig = lijst.length + (lijst.length === 1 ? ' bestand' : ' bestanden') + '…';
    render();

    var gedaan = Promise.resolve();
    lijst.forEach(function (b) {
      gedaan = gedaan.then(function () {
        werk.bezig = b.name;
        render();
        return leesEen(b).then(function (r) {
          werk.resultaten.push({
            naam: r.naam, bron: r.bron, fout: r.fout,
            periode: r.periode, aantal: r.transacties ? r.transacties.length : null,
            controle: r.controle
          });
          if (r.fout || !r.transacties) return;
          // Rekeningen die uit het bestand zelf komen, meteen bekend maken.
          (r.eigenIbans || []).forEach(function (iban) { onthoudRekening(iban, iban, 'eigen'); });
          (r.rekeningen || []).forEach(function (rek) {
            if (rek.soort === 'spaarpot') onthoudRekening(rek.naam, rek.naam, 'eigen');
          });
          var bestaand = {};
          staat.transacties.forEach(function (t) { bestaand[t.id] = true; });
          r.transacties.forEach(function (t) {
            if (bestaand[t.id]) { werk.dubbel++; return; }
            bestaand[t.id] = true;
            staat.transacties.push(t);
            werk.nieuw++;
          });
        });
      });
    });

    gedaan.then(function () {
      werk.bezig = null;
      staat.transacties.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
      bewaar(); herbereken(); render();
    });
  }

  function onthoudRekening(naam, patroon, rol) {
    staat.instellingen.rekeningen = staat.instellingen.rekeningen || [];
    var bestaat = staat.instellingen.rekeningen.some(function (r) { return r.patroon === patroon; });
    if (!bestaat) staat.instellingen.rekeningen.push({ naam: naam, patroon: patroon, rol: rol });
  }

  // ------------------------------------------------------------------ acties
  var acties = {
    tab: function (d) { ui.tab = d.tab; werk.openCategorie = null; render(); window.scrollTo({ top: 0 }); },
    'kies-bestanden': function () { document.getElementById('bestanden').click(); },

    'rekening-weg': function (d) {
      if (!confirm('Alle transacties van ' + d.rekening + ' verwijderen?')) return;
      staat.transacties = staat.transacties.filter(function (t) { return (t.rekening || t.bron) !== d.rekening; });
      bewaar(); herbereken(); render();
    },
    'maand-tellen': function (d) {
      var lijst = staat.instellingen.negeerMaanden || (staat.instellingen.negeerMaanden = []);
      var k = lijst.indexOf(d.maand);
      if (k > -1) lijst.splice(k, 1); else lijst.push(d.maand);
      bewaar(); herbereken(); render();
    },
    'categorie-open': function (d) {
      werk.openCategorie = werk.openCategorie === d.categorie ? null : d.categorie;
      render();
    },
    vergeet: function (d) { delete staat.geleerd[d.sleutel]; bewaar(); herbereken(); render(); },
    'streef-wis': function () { staat.instellingen.streef = {}; bewaar(); render(); },
    'naast-aan': function () {
      staat.instellingen.autopotNaastOorlogskas = true;
      bewaar(); render();
    },
    'rekening-regel-erbij': function () {
      staat.instellingen.rekeningen.push({ naam: '', patroon: '', rol: 'eigen' });
      bewaar(); render();
    },
    'rekening-regel-weg': function (d) {
      staat.instellingen.rekeningen.splice(parseInt(d.i, 10), 1);
      bewaar(); herbereken(); render();
    },
    'trede-erbij': function () {
      var l = staat.instellingen.autoLadder;
      l.push({ naam: 'Nieuwe trede', vanaf: (l.length ? R.getal(l[l.length - 1].vanaf) : 0) + 10000 });
      bewaar(); render();
    },
    'trede-weg': function (d) { staat.instellingen.autoLadder.splice(parseInt(d.i, 10), 1); bewaar(); render(); },

    export: function () {
      var naam = 'monitor-' + R.maandSleutel() + '.json';
      var json = JSON.stringify(staat, null, 2);
      if (root.bewaarBestand) { root.bewaarBestand(naam, json); return; }
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = naam; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    },
    import: function () { document.getElementById('import-bestand').click(); },
    reset: function () {
      if (!confirm('Alles wissen? Alle ingelezen transacties en instellingen verdwijnen.')) return;
      O.wissen(); staat = O.leeg(); herbereken(); render();
    }
  };

  document.addEventListener('click', function (e) {
    var knop = e.target.closest ? e.target.closest('[data-actie]') : null;
    if (!knop) return;
    if (/^(SELECT|INPUT|TEXTAREA)$/.test(knop.tagName)) return;
    var fn = acties[knop.dataset.actie];
    if (fn) { e.preventDefault(); fn(knop.dataset); }
  });

  // slepen
  ['dragenter', 'dragover'].forEach(function (naam) {
    document.addEventListener(naam, function (e) {
      if (ui.tab !== 'inlezen') return;
      e.preventDefault();
      var vak = document.getElementById('sleepvak');
      if (vak) vak.classList.add('over');
    });
  });
  document.addEventListener('dragleave', function () {
    var vak = document.getElementById('sleepvak');
    if (vak) vak.classList.remove('over');
  });
  document.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    var vak = document.getElementById('sleepvak');
    if (vak) vak.classList.remove('over');
    ui.tab = 'inlezen';
    verwerkBestanden(e.dataTransfer.files);
  });

  root.App = { ui: ui, render: function () { render(); }, state: function () { return staat; } };

  document.addEventListener('DOMContentLoaded', function () {
    el.app = document.getElementById('app');
    el.tabs = document.querySelector('nav.tabs');
    herbereken();
    render();
  });
})(window);
