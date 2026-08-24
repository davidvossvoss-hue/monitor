# Geldmonitor

Je bankafschriften erin, een analyse en een planner eruit. Eén gebruiker, één
browser. Geen inlog, geen bankkoppeling, geen cloud: het inlezen gebeurt op je
eigen toestel en alles blijft daar.

**Openen:** dubbelklik `index.html`. Geen build, geen dependencies.
**Op je telefoon:** <https://claude.ai/code/artifact/4f85c94e-2c97-4db4-8f53-f7b0318b89b1>
**Rekenmodel controleren:** `npm test` rekent drie voorbeeldmaanden door.
**Telefoonversie bouwen:** `npm run bouw` schrijft `dist/monitor.html`.

---

## De maandelijkse ronde

Exporteer je afschriften en sleep ze in het scherm **Inlezen**. Dat is alles.

| Bank | Wat je pakt |
|---|---|
| Amex | de maandafrekening (PDF) — één per maand |
| ABN AMRO | Bij- en afschrijvingen (PDF), of de CSV/TAB-download |
| Revolut | het account statement (PDF of CSV) |

Je hoeft niet bij te houden wat je al gedaan hebt: **elke transactie heeft een
vaste vingerafdruk, dus dubbel inladen verandert niets.** Exporteer bij ABN en
Revolut gerust elke maand het hele jaar opnieuw; alleen wat nieuw is komt erbij.

## Wat het zelf uitzoekt

**Het controleert zichzelf.** Elke lezer legt zijn optelling naast de cijfers
die op het afschrift zelf staan: Amex tegen de saldo-opstelling (vorig saldo −
crediteringen + debiteringen = nieuw saldo), ABN tegen totaal af- en
bijgeschreven, Revolut tegen begin- en eindsaldo per rekening. Klopt het niet,
dan zegt het scherm dat, met bedragen erbij.

**Eigen geld heen en weer telt niet mee.** Je Amex-afrekening betalen vanaf je
ABN is geen uitgave — de Amex-transacties zijn dat al. Zulke paren worden
herkend aan de IBAN's die uit de afschriften zelf komen, en aan bedragen die
tegen elkaar wegvallen tussen twee van je rekeningen.

**Vaste lasten vindt het zelf.** Herkend aan drie dingen tegelijk: een vast
ritme, een vast bedrag én een vaste dag van de maand. Een winkel waar je
toevallig elke maand komt wordt daarom geen abonnement genoemd. Kwartaal- en
jaarposten worden over de maanden uitgesmeerd.

**Sparen is geen uitgave.** Geld naar je eigen spaarpot of beleggingsrekening
gaat niet van je uitgaven af en geld dat je eruit haalt telt niet als inkomen.

**Uitschieters** zijn de grootste losse uitgave per maand, met vaste lasten en
sparen eruit gefilterd — anders is de uitschieter elke maand je huur.

## De schermen

**Inlezen** — bestanden erin, per bestand zie je wat er herkend is en of de
optelling klopt. Daaronder wat er nu in zit, en een waarschuwing als er maanden
ontbreken.

**Indelen** — wat het niet kende, op volgorde van bedrag. Deel een partij één
keer in; daarna herkent hij hem vanzelf.

**Analyse** — per maand inkomen, vast, stuurbaar, gespaard en wat er overblijft.
Daaronder waar het heen gaat, welke vaste lasten gevonden zijn en de uitschieter
van elke maand. Klik een categorie open om de grootste posten te zien en ze
anders in te delen.

**Planner** — wat er per maand overblijft, en één knop: een streefbedrag per
categorie. Het verschil met wat je nu uitgeeft loopt rechtstreeks door naar de
auto-ladder, de projectie en de mijlpalen.

**Instellingen** — rekeningen (eigen, gezamenlijk, zakelijk), oorlogskasdoel, of
de autopot naast of ná de oorlogskas loopt, de ladder, rendement en beginstanden.

## Het rekenmodel

```
inkomen
  − vaste lasten
  − stuurbare uitgaven
  = ruimte
        1. oorlogskas   tot het doel bereikt is
        2. autopot      een deel van wat er overblijft
        3. beleggen     de rest
```

Het oorlogskasdoel is een instelbaar aantal maanden × je totale burn rate, dus
inclusief je gezamenlijke rekening en je dagelijkse uitgaven. Zet je
*autopot naast oorlogskas* aan, dan gaat er meteen een vast deel naar de auto en
loopt de oorlogskas met de rest vol: later veilig, eerder onderweg.

Bij een wisselend inkomen rekent de planner met het gemiddelde over de
meegetelde maanden en toont daarnaast de mediaan, zodat een doorsnee maand naast
een goed jaar staat.

## Eerlijkheid

Elk getal komt uit wat je zelf hebt ingeladen. Is er nog niets, dan zegt het
scherm dat in plaats van voorbeeldcijfers te tonen.

## Bestanden

```
index.html              de app
src/lezen.js            CSV en TAB: scheidingsteken, kolommen en teken herkennen
src/lezen-pdf.js        PDF-afschriften van Amex, ABN AMRO en Revolut
src/pdf-inlezen.js      pdf.js in de browser aansturen
src/categorie.js        categorieën en regels
src/analyse.js          ontdubbelen, interne overboekingen, vaste lasten, per maand
src/planner.js          ruimte, potjes, ladder, projectie, mijlpalen
src/rekenen.js          ladder, rente op rente, mijlpalen
src/opslag.js           localStorage
src/schermen.js         inlezen, indelen, analyse
src/planner-ui.js       planner en instellingen
src/app.js              staat, acties, bestanden
src/artifact-opslag.js  alleen in de telefoonversie: schrijft de pagina weg
src/analyse.test.js     de hele keten op voorbeeldbestanden (npm test)
voorbeeld/              drie voorbeeld-uitdraaien
vendor/                 pdf.js
oud/                    de eerste opzet met handmatige invoer
```
