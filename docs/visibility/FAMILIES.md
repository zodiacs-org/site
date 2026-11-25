# High-volume families in every locale (plan, 2026-11-08)

Dias re-centred the program on 2026-11-08: the fifteen phrases in
[PHRASES.md](PHRASES.md) are low volume, so the main effort moves to the five
search families that carry most astrology traffic, in every language the site
supports.

1. Horoscope per sign: daily, tomorrow, weekly, monthly, yearly ("leo horoscope today")
2. Sign pair compatibility: all 144 ordered pairs, served by 78 pair pages
3. Birth chart / natal chart, with the rising sign, moon sign and big three calculators
4. Sky events: Moon phase today, full and new Moons, Mercury and other retrogrades, eclipses
5. Sign meanings and traits

Rules unchanged: draft PRs only; nothing bought, published or merged without
Dias's yes; no em or en dashes and no token, market or crypto words in
consumer copy; Growth OS pace (10 net-new indexable pages per 7 days) unless
Dias raises it.

## 1. What each locale publishes today

From the local build of `main` at f17b7ce2 with default feature flags, sitemap
entries only ([baseline/2026-11-08/coverage.md](baseline/2026-11-08/coverage.md),
`node scripts/visibility/coverage.mjs`). Treat this as a local-build
baseline. Production enables a few more flagged pages; we believe none of
them is in these families, but that was not checked against production's
flags or the live sitemap.

Locales the code knows: en, es, pt, fr, it (released); ru (calculators in the
sitemap); zh-hans, zh-hant (Chinese zodiac guide only); ar (nothing
published). No page in these families is `noindex`, and no title in them has
a dash.

| Family | en | es | pt | fr | it | ru | zh-hans / zh-hant | ar |
|---|---|---|---|---|---|---|---|---|
| Horoscope per sign | **97**: daily, tomorrow, weekly, monthly, love, career, 2026, 2027 for 12 signs. Rebuilt daily (lastmod 2026-11-08). ~1,040 words | **13**: daily only, rebuilt daily. ~760 words. Week and month link to English | **13**: same as es. ~775 words | **0** | **0** | **0** | 0 | 0 |
| Compatibility | **78 pairs** + hub. ~1,260 words. Last edited 2026-10-20 | **78** + hub, ~1,170 words | **78** + hub, ~1,130 | **78** + hub, ~1,220 | **78** + hub, ~1,150 | hub only | 0 | 0 |
| Birth chart | Calculator, big three, moon sign, rising sign, how-to-read, 12 houses, 10 planets, 5 aspects, 120 placements (161 pages) | 4 calculators (~1,400 words) | 4 | 4 | 4 | 4 | 0 | 0 |
| Sky events | 120: today, Moon phase, void of course, 25 full and 25 new Moon pages, Mercury (8), Venus, Mars, all retrogrades, eclipses (11), 26 event pages, seasons (13) | 20: today, Moon phase, Mercury, retrogrades, eclipses, full Moon calendar, seasons (13). No single full or new Moon pages | 20, same as es | 19 (no today) | 19 (no today) | Moon phase, sky calendar | 0 | 0 |
| Sign meanings | 12 sign guides, 12 rising sign pages, zodiac dates. ~980 words. Last edited 2026-10-16 | 12 + 12 rising, ~1,490 words | 12 + 12, ~1,500 | 12 + 12, ~1,455 | 12 + 12, ~1,275 | 0 | 0 | 0 |

Quality notes:

- **Freshness.** Horoscopes and the today pages rebuild daily from the
  engine. Sign guides, rising sign pages and pairs are static since mid
  October; that is fine for evergreen meanings, but none of them shows a live
  element that changes, so they give a returning reader nothing new.
- **Localized horoscopes stop at "today".** A Spanish or Portuguese reader who
  wants the week or month lands on English. French and Italian have no
  horoscopes at all, and these are the largest family in every language.
- **Localized single-event pages are missing.** English has a page per full
  and new Moon; the other languages only have the calendar.
- **Slugs are English in every locale** (`/es/horoscopes/gemini/`). Slugs are a
  weak signal and changing them costs redirects; leave them. Titles and H1s
  carry the native words.
- **Who wrote the localized copy.** The localized decks were drafted by the
  site's writing model under the i18n copy decks (`docs/i18n/`), which forbid
  claiming native review. Before scaling, a native speaker should read a
  sample per language (Dias's call; it costs money).
- **Russian is ambiguous.** `ru` is not in `RELEASED_LOCALES`, yet 23 `/ru/`
  URLs are in the sitemap and indexable. Dias should confirm Russian is meant
  to be public before any Russian work.

## 2. Keyword tables

`node scripts/visibility/build-keywords.mjs` writes one CSV per locale in
[keywords/](keywords/), plus `all-locales.csv`: 296 queries per locale, 4,144
in all, written the way people search in each language (for example
"horóscopo escorpio hoy", "affinità leone scorpione", "thème astral gratuit",
"гороскоп лев на сегодня"), each with the target URL and whether a page in
that language answers it.

The files cover the site's nine locales and, since 2026-11-09, the five
candidates for the next locale: German, Polish, Turkish, Japanese and Hindi
(`de.csv`, `pl.csv`, `tr.csv`, `ja.csv`, `hi.csv`). Their volumes decide
which candidate is built first (`docs/i18n/NEW-LOCALE-RUNBOOK.md`). Nothing
is published in those languages, so every candidate row is `partial` and
targets the English page. The query wording needs a native speaker's check
before use. For Hindi, much astrology search is sidereal (Vedic) while the
site is tropical.

Coverage `held` marks a page the locale expansion has built in that
language and holds until its release batch: the Spanish and Portuguese
periods, the French and Italian horoscopes, the full and new Moon pages in
all four, and the Russian horoscopes, pairs and sign guides. The target URL
is the localized address the page will have.

| Family | Queries per locale |
|---|---|
| Horoscope | 60 (12 signs x today, tomorrow, week, month, 2027) |
| Compatibility | 144 (12 x 12 ordered pairs, same-sign pairs included) |
| Birth chart | 10 |
| Sky events | 10 |
| Signs | 72 (12 signs x 6 trait and meaning queries) |

`monthly_volume`, `volume_source` and `competition` are **TBD**. Nothing is
estimated. To fill them:

1. In Google Keyword Planner, "Get search volume and forecasts", paste the
   `query` column of one locale file (it takes 10,000 per request), set the
   language and locations to the file's `kp_language` and `kp_locations`, last
   12 months, and download.
2. `node scripts/visibility/families.mjs --volumes <download> --locale es`
   writes the averages and Keyword Planner's competition into `es.csv`; then
   `node scripts/visibility/build-keywords.mjs` refreshes `all-locales.csv`.
   Filled values survive regeneration.
3. Keyword Planner's "competition" is advertiser competition, not organic
   difficulty. Organic difficulty goes into `competition.json` (see 3).

Search Console matches its queries against the same tables:
`gsc.json` now has a `families` block (impressions, clicks, position per
family and locale). The property was verified on 2026-11-08, so no family has
any history before that date. That is missing data, not a measured zero: the
first export is each family's baseline, and growth is only reported between
two exports covering the same window length.

The Arabic and Chinese lists need a native speaker's check before use (noted in
each row). The Chinese lists target Singapore, Malaysia, Taiwan and Hong Kong:
Google is little used in mainland China.

## 3. Ranking: where the traffic is winnable

The scored ranking comes from `node scripts/visibility/families.mjs --rank`,
which writes [RANKING.md](RANKING.md):

`winnable = monthly volume x (1 - organic competition) x readiness`

Readiness is 1 when a page in that language answers the query or is built
and held for its release batch, 0.6 when only the English page does, 0.3
when nothing does. Organic competition is a
0 to 1 score per family and locale in `competition.json`, set by looking at
page one for 10 sample queries per cell: 0.9 when it is all national media
and long-established astrology sites, 0.5 when mixed, 0.2 when thin or off
topic. That check needs a browser that reaches Google; this session cannot.

Until the numbers arrive, this is the proposed order, with reasons. It is a
hypothesis to test, not a measurement:

| Order | Cell | Why |
|---|---|---|
| 1 | Horoscope, es and pt (week, month, tomorrow) | The largest family in both languages; the daily pages already exist and rebuild every day, so the engine and pipeline are proven; the gap is three periods per sign. Page one in Spanish and Portuguese is likely held by media sites and astrologer brands (to confirm in the competition check), which is hard, but long-tail period queries ("horóscopo semanal escorpio") are less locked than "horóscopo hoy" |
| 2 | Compatibility, es, pt, fr, it | All 78 pairs exist in four languages, at length. The work is on-page: titles in each language's search form ("affinità" in Italian, "combinam" in Portuguese), a live comparison tool at the top, and links between each sign's 11 pairs. Lower competition than English is likely |
| 3 | Sky events, es, pt, fr, it | Moon phase and full Moon queries recur every month and the engine already computes them; English has the single-event page template. Localized full and new Moon pages are cheap to make correct |
| 4 | Birth chart, fr, it, es, pt | High-intent tool queries ("thème astral gratuit", "tema natale"); the calculators exist in each language. Long-established free chart sites own these, so a short title and opening rewrite plus internal links first, before anything bigger |
| 5 | Sign meanings, es, pt, fr, it | Large volume, but page one is usually encyclopedias and big media. The pages exist; add a live element (this year's Sun entry date, today's Moon for the sign) and link them from horoscopes and pairs |
| 6 | Horoscope, fr and it | Large volume and nothing published. It needs daily copy in each language, the biggest build of all: start once es and pt show movement |
| 7 | All families, en | Everything exists; English is the most contested market. Work is on-page and linking only |
| 8 | ru | Calculators exist, but Russian search is largely Yandex, and the release status needs confirming first |
| 9 | zh-hant, zh-hans, ar | No pages in these families. zh-hant (Taiwan, Hong Kong) is the most promising of the three because Google is widely used there. Needs native writers; a later phase |

Non-English markets are often less contested, but the horoscope family is the
exception: big national media publish daily horoscopes in every one of these
languages. The tool-shaped families (compatibility with a live tool, sky
events, calculators) are where a computed, dated page has the clearest edge.

## 4. Page template plan

One template per family, shared by every locale. Each page:

1. **Live tool first.** Above the fold, fed by the site's own engine, not
   text about a tool:
   - Horoscope: today's sky for the sign (Moon sign and phase, the day's
     aspects to the sign's ruler) computed for the edition date, then the
     reading, then a switcher for tomorrow, week, month and year. The
     existing pages already show the reading beside the sky it draws on;
     the change is to put that sky first and add the period switcher in
     every language.
   - Compatibility: a two-sign picker that swaps pairs in place, plus "compare
     your full charts" into the calculator.
   - Birth chart: the calculator itself (already the case).
   - Sky events: the live state ("the Moon is 54% lit, waxing, in Pisces"),
     a countdown to the next event, all from the engine at build and
     refreshed client side.
   - Signs: this year's exact dates for the sign's season, today's Moon
     position for the sign, then the meaning.
2. **Daily refresh.** Through the existing daily publication workflow, which
   already rebuilds horoscopes and the today pages; `dateModified` changes
   only when visible content changes.
3. **Internal links in a mesh, per locale.** Sign guide links its horoscopes,
   its 11 pairs, its season and its rising sign page; each horoscope links the
   sign guide and the events in its window; each pair links both sign guides
   and the other pairs of each sign; every page links the locale's calculator.
   Always to pages in the same language when they exist.
4. **Structured data that matches the page.** Horoscopes: Article with
   `datePublished` and `dateModified`, BreadcrumbList. Pairs: Article,
   FAQPage, BreadcrumbList. Calculators: WebApplication, FAQPage. Sky events:
   Event with the computed instants, Dataset where data is downloadable. Signs:
   Article, BreadcrumbList. No ratings, no review markup. Hreflang stays
   reciprocal, which the build already enforces.
5. **Natural copy in each language.** Titles and H1s follow the local query
   form from the keyword tables, not English word order. Copy is written in
   the language, per the i18n copy decks, with a per-locale glossary (signs,
   aspects, house names, the local word for compatibility). A native speaker
   reads a sample before a family goes live in a new language. The no-dashes
   and no-market-words rules hold in every language, checked by the consumer
   boundary scanner and `copyProblems()`.
6. **Measured.** Each new page is in the keyword tables before it ships, so
   Search Console picks it up by family and locale.

## Proposed PR sequence (each a draft, each waiting for Dias)

| PR | What | New indexable pages |
|---|---|---|
| F1 | es and pt horoscope periods: tomorrow, week, month for 12 signs, from the English edition's computed sky with copy written in each language | 72 (36 per language): at 10 a week, about 7 weeks unless Dias raises the cap |
| F2 | Compatibility on-page in es, pt, fr, it: native-form titles and H1s, live pair picker at the top, sign-to-pairs links | 0 |
| F3 | Localized full and new Moon pages for es, pt, fr, it, next 12 months | 96 (24 per language) |
| F4 | Sign guides in all released locales: live season dates and Moon element, links to horoscopes and pairs | 0 |
| F5 | Calculators: titles and openings in each language's search form | 0 |

F2, F4 and F5 add no pages and can start as soon as Dias says yes.

### Status, 2026-11-09

Dias delegated the start decision; F2 was chosen (decision recorded on the PR).

- **F2a, built, then parked on 2026-11-11 (see Decisions below):** the 312
  localized pair pages titled in each language's search form: "Compatibilidad
  Leo y Escorpio en el amor", "Leão e Escorpião combinam? Compatibilidade no
  amor", "Compatibilité Lion et Scorpion en amour", "Affinità Leone e Scorpione
  in amore". The article headline in JSON-LD keeps the article's own title.
  One shared component (`src/components/compat/LocalizedPairPage.astro`) plus
  the sitemap re-dating, in
  [parked/2026-11-11-f2a-pair-titles.patch](parked/2026-11-11-f2a-pair-titles.patch).
  CI passed with it, and an independent review found no blockers. Shipping it
  needs a fresh Phase 1 capture (`npm run build`,
  `npm run test:phase1:acceptance`) and the sitemap date set to the merge day.
- **F2b, parked, needs Dias:** the hub titles ("Compatibilidad de signos",
  "Compatibilidade de signos", "Compatibilité amoureuse des signes", "Affinità
  di coppia tra segni"), a row on each localized sign guide linking all twelve
  of its pairs (today 3 of 12), and removal of a stale French and Italian line
  saying the pair guides are in English (they are not any more). These files
  are in the frozen locale page trees, so the scope guard needs a one-time
  allowance that only the owner should add. The edits are in
  [parked/2026-11-09-f2-locale-tree-edits.patch](parked/2026-11-09-f2-locale-tree-edits.patch);
  `git apply` it and add the allowance to ship.
- **Live picker at the top of pair pages:** not done. The hero already links to
  the comparison tool and the pair switcher; moving the tool above the fold
  changes the first-paint path that `pair-page-delivery.test.mjs` guards, so
  it needs its own visual pass.
- F3 to F5 wait for Dias as listed above.

### Decisions, 2026-11-10 (delegated by Dias)

- **Decided: pace.** The Growth OS cap stays: at most 10 net-new indexable
  pages per 7 days. F1 (72 pages) ships in weekly batches over about 7 weeks,
  F3 (96 pages) after it. Reason: the cap is the site's own guard against thin
  pages, and new pages here are model-written in languages without native review yet.
- **Recommended, needs Dias's yes:** paid native review of the first batch in
  each language before it merges; the F2b allowance; the F1 allowance and the
  workflow change for tomorrow's facts ([F1-SPEC.md](F1-SPEC.md)); leaving the
  23 `/ru/` pages as they are and keeping Russian out of this program until
  Dias decides its status.
- **Next step:** F1, specified in [F1-SPEC.md](F1-SPEC.md). It cannot be built
  here without the freeze allowance and a production workflow change, both
  Dias's to grant.

### Decisions, 2026-11-11 (delegated by Dias)

- **Ready to merge as docs and scripts.** Recommended to Dias; the merge is
  his. An independent review found no blockers, and its fixes are in.
- **F2a parked with F2b.** The pair titles reach 312 pages routed from the
  frozen locale trees through a shared component the scope guard does not
  list. Reason: the freeze should be lifted openly by the owner, not routed
  around; F2a and F2b then ship together under one allowance. The PR now
  changes nothing under `src/`, so it no longer touches the sitemap or the
  Phase 1 evidence and stops conflicting with `main`.
- **Recommended, needs Dias's yes:** one scope allowance covering F2a and
  F2b, then apply both patches; the rest as listed on 2026-11-10.

## Still needed from outside the sandbox

- Keyword Planner volumes per locale (step 2 above).
- A page-one look at 10 sample queries per family and locale for
  `competition.json`.
- Search Console exports at weeks 4 and 8 (and the family block filled from
  them).
- Dias: confirm Russian's status and whether to
  pay for native review.
