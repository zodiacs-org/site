# F1 build spec: Spanish and Portuguese horoscopes beyond "today"

Status 2026-11-10: specified, not built. It is the next step of
[FAMILIES.md](FAMILIES.md) and the first-ranked cell (horoscope, es and pt).
Building it is blocked on the three items under "Before code".

## What F1 adds

For each of the 12 signs, in Spanish and Portuguese: tomorrow, this week and
this month. 72 new indexable pages at the addresses the English edition uses,
with the language prefix:

- `/es/horoscopes/{sign}/tomorrow/`, `/weekly/`, `/monthly/`
- `/pt/horoscopes/{sign}/tomorrow/`, `/weekly/`, `/monthly/`

The localized daily page's week and month links stop pointing at English
(`src/components/localized/LocalizedHoroscope.astro`, the `c.week` and
`c.month` links) and point at these pages.

## Decided

- **Pace:** at most 10 net-new indexable pages per 7 days (Growth OS), decided
  2026-11-10 under Dias's delegation. 72 pages ship in weekly batches over about
  7 weeks, in this order: es weekly (12), pt weekly (12), es monthly, pt monthly,
  es tomorrow, pt tomorrow. Weekly first because a week edition stays
  relevant for 7 days and its query form ("horóscopo semanal escorpio",
  "horóscopo semanal escorpião") is the least contested of the three. Each
  batch is held back with a list of released signs and periods in one data
  file (`src/data/horoscope-locale-release.json`, new), so a batch ships by
  editing that list, not by deploying code.

## Before code (Dias)

1. **The locale tree freeze.** The pages live under `src/pages/es/` and
   `src/pages/pt/`, which `scripts/phase1-scope-guard.mjs` freezes. Shipping
   needs a one-time allowance in `.github/phase1-scope-allowance.json`, which
   is the owner's to add. The alternative, a `src/pages/[releasedLocale]/`
   route, would sidestep the guard's purpose and is not proposed.
2. **Native review (paid).** Recommended: a native reader for each language
   reads the first batch (12 weekly pages) and the template phrases before
   anything merges. The copy is written by the site's writing model under
   the i18n copy decks, which forbid claiming native review.
3. **Tomorrow's sky facts in the daily workflow.** `src/data/daily.json` holds
   one date. The localized tomorrow page needs the next day's facts, so
   `.github/workflows/daily-horoscopes.yml` would run
   `node scripts/build-daily.mjs <date+1>` into a second file
   (`src/data/daily-tomorrow.json`). That changes a production workflow, so it
   needs Dias's yes. Week and month need no workflow change: they read the
   English program's computed facts, which the workflow already builds.

## How the copy is made

The English week and month readings come from `src/lib/horoscope-program.ts`
(1,830 lines). Each passage is composed from computed facts (the week's
lunations, ingresses, stations and exact aspects, each with an evidence id),
held to word ranges (week 200 to 300 words, month per
`horoscopeWordCount`) and to a similarity ceiling between signs
(`horoscopeShingleJaccard`).

F1 does **not** translate the English output. It adds a locale layer the way
`dailyReadingForLocale` (`src/lib/i18n/daily-reading.ts`) already does for
today:

- The same selection of facts and the same evidence ids, so every Spanish or
  Portuguese sentence can be traced to the fact it states, as the English can.
- Sentence templates written in each language, with the language's own
  grammar for planets, aspects, house themes and dates
  (`planetLabel`, `aspectLabel` and the house-theme tables already exist
  for es and pt).
- The same word ranges and similarity ceiling, checked per language by the
  program verifier (`scripts/verify-horoscope-program.ts`), plus the
  no-dash and no-market-word rules.
- A reading-confidence label on each reading, as on the English pages.

New code, roughly:

| File | What |
|---|---|
| `src/lib/i18n/period-reading.ts` | Week and month passages for es and pt from the program's facts |
| `src/lib/i18n/period-reading.test.ts` | Evidence parity with English, word ranges, similarity, no dashes |
| `src/components/localized/LocalizedHoroscopePeriod.astro` | The page: live sky for the period first, then the reading, then the period switcher |
| `src/pages/{es,pt}/horoscopes/[sign]/{tomorrow,weekly,monthly}.astro` | Routes, filtered by the release list |
| `src/pages/sitemap.xml.ts` | New entries with their own dates; hreflang to the English pages |
| `src/lib/og-art-cards.locales.mjs` (generated) | Share-card words, through `build-og-art-card-copy.ts` |

Structured data follows the English period pages: Article with
`datePublished` and `dateModified`, BreadcrumbList, `inLanguage`.

## Measures

The keyword table rows for these pages (`keywords/es.csv`, `keywords/pt.csv`,
subfamilies `weekly`, `monthly`, `tomorrow`) switch from `partial` to `full`
when a batch ships. At weeks 4 and 8 after each batch, the `families` block in
Search Console data (`gsc.mjs`) gives impressions and position for
`horoscope:es` and `horoscope:pt`, split by period through the subfamily.
