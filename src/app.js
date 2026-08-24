/* Lijm: schermen, binding, acties. */
(function (root) {
  'use strict';
  var M = root.Model, U = root.UI, S = root.Store;

  var state = S.laden();
  var ui = root.beginUI || { tab: 'dashboard', maand: M.maandSleutel() };

  var el = { app: null, tabs: null };

  function bewaar() { S.bewaren(state); }

  function render() {
    var h;
    if (ui.tab === 'invoer') h = root.Invoer.render(state, ui.maand);
    else if (ui.tab === 'instellingen') h = root.Instellingen.render(state);
    else h = root.Dashboard.render(state);
    el.app.innerHTML = h;
    Array.prototype.forEach.call(el.tabs.querySelectorAll('button'), function (b) {
      b.classList.toggle('actief', b.dataset.tab === ui.tab);
    });
  }

  // Nooit hertekenen terwijl je in een veld staat: dat wist je selectie en je
  // cursor. We wachten netjes tot je het formulier verlaat.
  var timer = null, rendernodig = false;

  function inFormulier() {
    var a = document.activeElement;
    return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && el.app.contains(a);
  }

  function herteken() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (inFormulier()) { rendernodig = true; ververLive(); return; }
      rendernodig = false;
      render();
    }, 0);
  }

  document.addEventListener('focusout', function () {
    setTimeout(function () {
      if (rendernodig && !inFormulier()) { rendernodig = false; render(); }
    }, 0);
  });

  function ververLive() {
    var doel = document.getElementById('live');
    if (doel) doel.innerHTML = root.Invoer.liveHTML(state, ui.maand);
  }

  // ------------------------------------------------------------- databinding
  function pakWaarde(inp) {
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
    U.zetPad(state, inp.dataset.bind, pakWaarde(inp));
    bewaar();
    if (ui.tab === 'invoer') ververLive();
  });

  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (inp.dataset && inp.dataset.actie === 'kies-maand') {
      ui.maand = inp.value; render(); return;
    }
    if (inp.id === 'import-bestand' && inp.files && inp.files[0]) {
      var lezer = new FileReader();
      lezer.onload = function () {
        try {
          var d = JSON.parse(lezer.result);
          if (!d || typeof d !== 'object') throw new Error('geen object');
          state = Object.assign(S.leeg(), d);
          state.instellingen = Object.assign(S.leeg().instellingen, d.instellingen || {});
          bewaar(); render();
        } catch (err) { alert('Kon dit bestand niet lezen: ' + err.message); }
      };
      lezer.readAsText(inp.files[0]);
      return;
    }
    if (inp.dataset && inp.dataset.bind) {
      U.zetPad(state, inp.dataset.bind, pakWaarde(inp));
      bewaar(); herteken();
    }
  });

  // ------------------------------------------------------------------ acties
  function waarde(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }
  function nummer(id) {
    var v = waarde(id).replace(',', '.');
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function huidigeMaand() { return root.Invoer.maandIndex(state, ui.maand); }

  var acties = {
    tab: function (d) { ui.tab = d.tab; render(); window.scrollTo({ top: 0 }); },

    'nieuwe-maand': function () {
      var v = waarde('nieuwe-maand-veld');
      if (v) { ui.maand = v; render(); window.scrollTo({ top: 0 }); }
    },
    'maand-aanmaken': function (d) {
      root.Invoer.zorgVoorMaand(state, d.maand || ui.maand);
      bewaar(); render();
    },
    'maand-weg': function () {
      if (!confirm('Maand ' + U.maandLabel(ui.maand) + ' verwijderen?')) return;
      state.maanden = state.maanden.filter(function (m) { return m.maand !== ui.maand; });
      bewaar(); render();
    },
    'uitgave-erbij': function () {
      var i = huidigeMaand(); if (i < 0) return;
      state.maanden[i].eigenUitgaven = state.maanden[i].eigenUitgaven || [];
      state.maanden[i].eigenUitgaven.push({ omschrijving: '', bedrag: 0 });
      bewaar(); render();
    },
    'uitgave-weg': function (d) {
      var i = huidigeMaand(); if (i < 0) return;
      state.maanden[i].eigenUitgaven.splice(parseInt(d.i, 10), 1);
      bewaar(); render();
    },

    'reservering-erbij': function () {
      var naam = waarde('res-naam'), bedrag = nummer('res-bedrag');
      if (!naam || !bedrag) { alert('Naam en bedrag invullen.'); return; }
      state.reserveringen.push({
        id: S.id(), naam: naam, bedrag: bedrag,
        inlegMaand: waarde('res-inleg') || ui.maand,
        verwachteMaand: waarde('res-verwacht') || ui.maand,
        betaaldMaand: null
      });
      bewaar(); render();
    },
    'reservering-afvinken': function (d) {
      state.reserveringen.forEach(function (r) { if (r.id === d.id) r.betaaldMaand = ui.maand; });
      bewaar(); render();
    },
    'reservering-open': function (d) {
      state.reserveringen.forEach(function (r) { if (r.id === d.id) r.betaaldMaand = null; });
      bewaar(); render();
    },
    'reservering-weg': function (d) {
      state.reserveringen = state.reserveringen.filter(function (r) { return r.id !== d.id; });
      bewaar(); render();
    },

    'voorschot-erbij': function () {
      var naam = waarde('vs-naam'), bedrag = nummer('vs-bedrag');
      if (!naam || !bedrag) { alert('Naam en bedrag invullen.'); return; }
      state.voorschotten.push({
        id: S.id(), naam: naam, bedrag: bedrag,
        maand: waarde('vs-maand') || ui.maand, terugbetaaldMaand: null
      });
      bewaar(); render();
    },
    'voorschot-terug': function (d) {
      state.voorschotten.forEach(function (v) { if (v.id === d.id) v.terugbetaaldMaand = ui.maand; });
      bewaar(); render();
    },
    'voorschot-open': function (d) {
      state.voorschotten.forEach(function (v) { if (v.id === d.id) v.terugbetaaldMaand = null; });
      bewaar(); render();
    },
    'voorschot-weg': function (d) {
      state.voorschotten = state.voorschotten.filter(function (v) { return v.id !== d.id; });
      bewaar(); render();
    },

    'vastelast-erbij': function () {
      state.instellingen.vasteLastenOverig.push({ naam: '', bedrag: 0 });
      bewaar(); render();
    },
    'vastelast-weg': function (d) {
      state.instellingen.vasteLastenOverig.splice(parseInt(d.i, 10), 1);
      bewaar(); render();
    },
    'trede-erbij': function () {
      var l = state.instellingen.autoLadder;
      var hoogste = l.length ? M.getal(l[l.length - 1].vanaf) : 0;
      l.push({ naam: 'Nieuwe trede', vanaf: hoogste + 10000 });
      bewaar(); render();
    },
    'trede-weg': function (d) {
      state.instellingen.autoLadder.splice(parseInt(d.i, 10), 1);
      bewaar(); render();
    },

    export: function () {
      var naam = 'salaris-monitor-' + M.maandSleutel() + '.json';
      var json = JSON.stringify(state, null, 2);
      if (root.bewaarBestand) { root.bewaarBestand(naam, json); return; }
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = naam;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    },
    import: function () { document.getElementById('import-bestand').click(); },
    reset: function () {
      if (!confirm('Alles wissen? Alle maanden, reserveringen en instellingen verdwijnen.')) return;
      S.wissen(); state = S.leeg(); render();
    }
  };

  document.addEventListener('click', function (e) {
    var knop = e.target.closest('[data-actie]');
    if (!knop || knop.tagName === 'SELECT') return;
    var fn = acties[knop.dataset.actie];
    if (fn) { e.preventDefault(); fn(knop.dataset); }
  });

  // Voor de opslaglaag van de gedeelde versie.
  root.App = {
    ui: ui,
    render: function () { render(); },
    state: function () { return state; }
  };

  // ------------------------------------------------------------------- start
  document.addEventListener('DOMContentLoaded', function () {
    el.app = document.getElementById('app');
    el.tabs = document.querySelector('nav.tabs');
    render();
  });
})(window);
