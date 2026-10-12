# Dated wording on the Spanish and Portuguese daily pages (F-86), and the footer on short pages (F-87)

From 00:00 UTC until the day's edition deploys, at about 05:30 UTC, every
daily page serves an edition that is a day old. F-84 made the English pages
paint their dated wording first. The Spanish and Portuguese daily pages carry
`data-edition-content` too, but the dating rules were English, so they went
on saying "hoy" and "hoje" while their kicker gave the older date. This
folder records the wording chosen for them, its review and the measurements.
Driving those pages also showed that their footer could move after the first
paint, on any clock (F-87). Faults the reviews found in the existing copy are
[F-88](../../programme/FINDINGS.md#f-88--faults-in-the-spanish-and-portuguese-daily-copy-found-reviewing-f-86-minor-copy).

## What the pages say in the dated window

The edition of 12 October 2026 as read on 13 October at 00:17 UTC. The date is
each page's own: the es-419 and pt-BR long dates that `formatDate` prints in
the kicker.

| where | Spanish now | dated |
| --- | --- | --- |
| `/es/today/` heading | Hoy | El cielo del 12 de octubre de 2026 |
| `/es/today/` intro | …de las posiciones registradas del cielo de hoy, leídas… | …de las posiciones registradas del cielo del 12 de octubre de 2026, leídas… |
| `/es/today/` link under each sign | Horóscopo de hoy de Aries | Horóscopo de Aries del 12 de octubre de 2026 |
| `/es/today/` closing note | …La comparación privada con el cielo de hoy vive en… | …La comparación privada con el cielo del 12 de octubre de 2026 vive en… |
| `/es/horoscopes/` heading | Horóscopos de hoy | Horóscopos del 12 de octubre de 2026 |
| `/es/horoscopes/` intro | …la nota más concreta del cielo de hoy. | …la nota más concreta del cielo del 12 de octubre de 2026. |
| `/es/horoscopes/` link on each card | Leer hoy → | Lectura del 12 de octubre de 2026 → |
| `/es/horoscopes/<sign>/` heading | Aries hoy | Aries, 12 de octubre de 2026 |
| the Moon's line | La Luna pasa hoy por tu octava casa: … | El 12 de octubre de 2026, la Luna pasa por tu octava casa: … |
| an ingress | Venus entra hoy en tu quinta casa y pone el foco en … | Venus entra en tu quinta casa el 12 de octubre de 2026 y pone el foco en … |
| an exact aspect | Marte en cuadratura con Saturno alcanza hoy su punto exacto: … | Marte en cuadratura con Saturno alcanza su punto exacto el 12 de octubre de 2026: … |
| a day without lines | Un cielo tranquilo hoy. | Un cielo tranquilo el 12 de octubre de 2026. |

| where | Portuguese now | dated |
| --- | --- | --- |
| `/pt/today/` heading | Hoje | O céu de 12 de outubro de 2026 |
| `/pt/today/` intro | …das posições registradas do céu de hoje, lidas… | …das posições registradas do céu de 12 de outubro de 2026, lidas… |
| `/pt/today/` link under each sign | Horóscopo de hoje de Áries | Horóscopo de Áries de 12 de outubro de 2026 |
| `/pt/today/` closing note | …A comparação privada com o céu de hoje está na… | …A comparação privada com o céu de 12 de outubro de 2026 está na… |
| `/pt/horoscopes/` heading | Horóscopos de hoje | Horóscopos de 12 de outubro de 2026 |
| `/pt/horoscopes/` intro | …a nota mais concreta do céu de hoje. | …a nota mais concreta do céu de 12 de outubro de 2026. |
| `/pt/horoscopes/` link on each card | Ler hoje → | Leitura de 12 de outubro de 2026 → |
| `/pt/horoscopes/<sign>/` heading | Áries hoje | Áries em 12 de outubro de 2026 |
| the Moon's line | A Lua passa hoje por sua oitava casa: … | Em 12 de outubro de 2026, a Lua passa por sua oitava casa: … |
| an ingress | Vênus entra hoje na sua quinta casa e coloca o foco … | Vênus entra na sua quinta casa em 12 de outubro de 2026 e coloca o foco … |
| an exact aspect | Marte em quadratura com Saturno chega hoje ao ponto exato: … | Marte em quadratura com Saturno chega ao ponto exato em 12 de outubro de 2026: … |
| a day without lines | Um céu tranquilo hoje. | Um céu tranquilo em 12 de outubro de 2026. |

Nothing else is dated: a "hoy" or "hoje" that none of these phrases names
stays as it is, and the drive fails on it. Kept as they are, as on the English
pages: "Las lecturas de mañana, de la semana y del mes…", the button "Mañana,
semana y mes" and their Portuguese twins (English keeps its "Tomorrow" tab in
the window), and the tab title, description and share-image text, which lie
outside the edition scopes (English titles carry an absolute date). Without
JavaScript these pages show their server wording, as English copy outside
EditionText does.

## How the wording was chosen and reviewed

1. **Written from the pages' own conventions,** not translated from the
   English dated forms: "el cielo del {date}" and "o céu de {date}" are the
   reviewed titles' wording, and "posiciones reales del {date}" / "posições
   reais de {date}" their descriptions'.
2. **Sheet.** [review-sheet.md](review-sheet.md) gave every page phrase with its
   proposed dated form and a sample of reading lines;
   [reading-lines.jsonl](reading-lines.jsonl) has all 169 distinct lines of
   each language that the templates wrote over the 117 committed editions
   since July, plus each planet's ingress, an exact aspect, a lunation, a
   station and a day without lines, each with its proposed dated form.
3. **Two independent reviews,** one per language, each a separate agent asked
   to read as a senior native-register editor (neutral Latin American Spanish
   with "tú"; Brazilian Portuguese with "você"), given the sheet, the pages
   and the templates but not the authors' reasoning, read-only. Their reports
   are in [reviews.md](reviews.md).
4. **What changed after review.**
   - The `/es/today/` heading was "Edición del 12 de octubre de 2026"; the kicker
     right above it says "Edición diaria · 12 de octubre de 2026", so it is
     now "El cielo del…", the page title's own wording. Asked the same, the
     Portuguese review moved `/pt/today/` from "Edição de…" to "O céu de…".
   - The Spanish sign heading was "Aries el 12 de octubre de 2026"; the review
     found it a word-for-word swap and chose the dateline "Aries, 12 de
     octubre de 2026", the form the page title already uses. Portuguese keeps
     "Áries em 12 de outubro de 2026": its review found the comma form reads
     as a letter's place-and-date line, and "signo + em + período" the
     standard heading.
   - The sheet also proposed catch-all word rules, as English has ("de hoy",
     "Hoy,", "Hoy", "hoy" and their Portuguese twins). Both reviews found
     them wrong in idioms ("hoy en día", "hoy mismo", "hoje em dia", "não é de
     hoje"), with "hoy" or "hoje" as a subject, after prepositions ("até hoje",
     "para hoje") and in labels. They were dropped; the Portuguese review
     confirmed that none of its 178 strings changed.
5. **Not claimed.** This is not a human native-speaker certification, and no
   page says its copy was reviewed.

## Implementation

- `src/lib/edition-freshness.ts` holds the rules for English (unchanged),
  Spanish and Portuguese: each a pattern and its dated form, with the edition's
  date label in the page's language. `datedEditionTextIn` applies them on the
  server; `inlineEditionRules` gives them to the head script.
- `src/components/EditionFreshnessGuard.astro` inlines its page's rules with the
  date already in each replacement, in place of its hand-kept copy of the
  English ones, and dates text as the parser adds it, so the first paint is
  final, as F-84 does. A daily page in a language without rules fails the
  build.
- `src/layouts/Base.astro` passes the edition date and the page's language to
  the guard.
- The Spanish and Portuguese page templates, catalogs and reading templates
  (Phase 1 protected) are unchanged.

## Measurements

`tests/edition-dated-drive.mjs`, Chromium 154 on an Apple M4, edition
2026-10-12, dated clock 2026-10-13 00:17 UTC, current clock 12:00 UTC. It now
drives `/es/today/`, `/es/horoscopes/`, `/es/horoscopes/aries/` and their
`/pt/` twins as it drives the English three: streamed with a break just after
the first "hoy" or "hoje", at 360, 412 and 1280 px in tall viewports.

| build | checks | failures |
| --- | --- | --- |
| #726's head `accb6786` ([drive-before-accb6786.txt](drive-before-accb6786.txt)) | 283 | 50, all on the localized routes: on each of their 18 dated loads, "hoy"/"hoje" remain and text nodes are not dated (36); the appended-text check on each route (6); and CLS on both sign pages, dated and current (8) |
| this branch ([drive-after.txt](drive-after.txt)) | 283 | 0 |

On the English routes both builds pass every check: the inlined rules date
English text as the hand-kept copy did.

## The footer (F-87)

`Base.astro` requests the footer's stylesheet after the footer is parsed,
without blocking rendering. Until it arrives the footer has only base.css's
`content-visibility` rule; the stylesheet then adds the footer's top margin
(112 px at 1280 px) and its layout. On a page short enough to show the footer
in the first viewport, the footer could paint first and then move and reflow.

[measure-footer-shift.mjs](measure-footer-shift.mjs) loads the localized pages
in fresh contexts, without streaming, on the real clock, in a 1400 px tall
viewport:

| build | `/es/horoscopes/aries/` 360 · 412 · 1280 px | `/pt/horoscopes/aries/` 360 · 412 · 1280 px | `/es/today/`, `/pt/today/` |
| --- | --- | --- | --- |
| `accb6786`, cold ([footer-before-cold.txt](footer-before-cold.txt)) | 3/5 · 5/5 · 5/5 loads shifted, CLS 0.010 · 0.014 · 0.173 | 5/5 · 5/5 · 4/5, CLS 0.010 · 0.010 · 0.173 | 0/30 |
| `accb6786`, web fonts aborted ([footer-before-nofonts.txt](footer-before-nofonts.txt)) | 5/5 · 4/5 · 5/5 | 3/5 · 5/5 · 5/5 | 0/30 |
| `accb6786`, second load ([footer-before-warm.txt](footer-before-warm.txt)) | 5/5 · 5/5 · 4/5 | 5/5 · 4/5 · 5/5 | 0/30 |
| this branch, cold ([footer-after-cold.txt](footer-after-cold.txt)) | 0/10 · 0/10 · 0/10 | 0/10 · 0/10 · 0/10 | 0/60 |

The elements that moved were the footer and its groups. It is a race: fonts are
not the cause, and a second load does not avoid it because the stylesheet is
served `must-revalidate`. Three attempts did not hold:

- reserving the footer's margin in base.css left the reflow inside it (CLS
  0.006 to 0.12);
- hiding the footer from the loader, which runs after the footer, still
  shifted once in 60 loads (0.12 at 1280 px), when the browser painted the
  footer before the loader ran;
- a script just before the footer that measured the content above it forced
  a layout while parsing every page, and changed how `/learn/` scrolled: the
  explorer drive's 44 px target check at 390 px failed on this PR's first
  Browser Evidence run and in 2 of 3 local runs (the label ended 0.45 px below
  the viewport), and passed 3 of 3 with that script removed from the built
  page, as on main and on #726.

The fix: a script in `<head>` holds the footer, and base.css hides a held
footer from its first layout. The loader, which already measures the footer,
shows a footer more than 200 px below the viewport at once, as before; a
nearer one stays held, its stylesheet is requested at once, and the
stylesheet shows the footer in the same style pass as its layout. The loader
drops the hold when the stylesheet has loaded, or if it fails or takes over
3 s. Nothing new reads the layout, and without JavaScript nothing is held and
the `@import` styles the footer as before. After it, the explorer's check
passed 3 of 3 locally.

## Phase 1 captures

The guard, the layout and the footer styles are template sources, so this
branch needs captures for its own digest. Browser Evidence run 38267976358 on
`ae3bcf15` took them first (digest `3e72452d`). Main then brought #720, whose
templates move the digest again, so after merging it run 38281931666 on
`e5b9bffc` took them for digest `f5b9b4fd`: the committed manifest and the 18
captures are that artifact's. Its build, captures, visual comparison,
Lighthouse and explorer drive all passed, the explorer's 44 px target check
included ([`browser-evidence-provenance.json`](browser-evidence-provenance.json)).

## Reproduce

```bash
npm run build
node tests/edition-dated-drive.mjs
node docs/platform/evidence/edition-dated-locales-20261012/measure-footer-shift.mjs cold 10
npx vitest run src/lib/edition-freshness.test.ts tests/footer-style-loader.test.mjs
```

The "before" rows ran this branch's drive and script against a build of
`accb6786` put in `dist/`.

## Not established here

- **Other browsers.** Only Chromium ran. WebKit's drives (the footer's
  discovery and visual-consistency drives) need Playwright's WebKit, which is
  not installed here; Site Check runs them.
- **Lighthouse.** Its routes do not include the localized daily pages.
- **Production.** Nothing here is deployed.
