# Locale expansion: es, pt, fr and it (built, held)

Part 1 of the visibility program in [FAMILIES.md](FAMILIES.md) (PR #924). It
completes the five high-volume families in Spanish, Portuguese, French and
Italian. Every new page is **held**: nothing is published until Dias releases
it, family by family, within the Growth OS cap of 10 net-new indexable pages
per 7 days.

## What is built

| Family | Paths (English twin) | es | pt | fr | it |
|---|---|---|---|---|---|
| Daily horoscope + hub | `/horoscopes/`, `/horoscopes/{sign}/` | live | live | 13 held | 13 held |
| Today | `/today/` | live | live | 1 held | 1 held |
| Tomorrow, week, month, love, work, 2026, 2027 | `/horoscopes/{sign}/{period}/` | 84 held | 84 held | 84 held | 84 held |
| Single full Moon | `/full-moon/{date}/` (every date the English publishes) | held | held | held | held |
| Single new Moon | `/new-moon/{date}/` | held | held | held | held |
| Zodiac dates | `/learn/zodiac-dates/` | 1 held | 1 held | 1 held | 1 held |

Sign guides, rising sign pages, the 78 pairs, the calculators and the sky
calendar hubs were already live in all four languages. What the English site
has in these families that the four languages still do not: the 26 event
pages under `/events/`, Mercury's dated retrograde pages, Venus and Mars
retrograde, the void-of-course Moon page, and the Learn reference pages
(houses, planets, aspects, placements). Those are the next build.

## How it is held

`src/data/locale-expansion-publication.json` has one entry per locale and
family. `src/lib/locale-expansion/policy.mjs` reads it once, for the pages,
the route integration, the sitemap, hreflang and the postbuild checks:

- **Held** (`released: false`, the committed state): the route is not
  injected, so the page is not built. No hreflang, no sitemap entry, no link
  in the language's own pages (those links fall back to English with
  `hreflang="en"` and the English-only cue).
- **Preview**: `PUBLIC_LOCALE_EXPANSION_PREVIEW=1` in the shell (not a `.env`
  file) builds every held family as `noindex` pages outside the sitemaps and
  hreflang, for review on a preview deploy. The flag cannot publish.
- **Released**: `released: true` with `reviewer` and `reviewedAt`. A release
  without both fails the build. The pages become indexable, join the locale
  sitemap through `alternatePathEntries`, get reciprocal hreflang with
  x-default, and the localized pages link to each other.

To release, flip one entry (12 pages for a horoscope period, 13 for the daily
family, 1 for today or zodiac dates, 62 for a whole Moon family, so Moon pages go out a few dates at a time through `paths`), keeping the
rolling 7-day count within 10 unless Dias raises it. `check-dist` and the
hreflang policy count released families automatically.

## How the copy is written

Nothing is translated from English sentence by sentence.

- `src/lib/locale-expansion/horoscope/engine.ts` turns the English
  program's receipts (`src/data/horoscope-program.json`) into plain facts:
  a body in a sign and solar house on a day, or a dated event with its house.
  The monthly reads the transit catalog of the month the English monthly
  publishes, with NASA-refined times.
- `src/lib/locale-expansion/horoscope/{es,pt,fr,it}.ts` write each passage in
  that language from those facts, with their own house themes, first steps,
  sign lines and closers. Each localized passage keeps the English passage's
  receipts, so every language answers to the same evidence.
- The Moon pages (`lunation/`) and zodiac dates (`zodiac-dates/`) follow the
  same pattern from the events catalog and `src/lib/zodiac-dates.ts`.
- The French and Italian daily pages reuse the Spanish and Portuguese
  components. Their copy moved into `today-copy.ts` and `hub-copy.ts` beside
  `horoscope-copy.ts`, and the fr/it strings live in
  `src/lib/locale-expansion/daily-copy/`. The daily reading text itself was
  already written for fr and it in `src/lib/i18n/daily-reading.ts`.

Register: Spanish tú, Portuguese você (pt-BR), French tu, Italian tu,
matching the existing daily readings.

## Checks

- `src/lib/locale-expansion/copy.test.ts`: every passage, heading, month,
  Moon page and chrome string in every written locale passes
  `copyProblems()` (`copy-rules.ts`): no dashes, no template leaks, no
  leftover English, nothing about investing, betting, guarantees, diagnoses
  or market and crypto words. One passage per English passage with its
  receipts; signs read differently from each other (shingle Jaccard under
  0.75); titles 60 characters or fewer; the reading confidence label in each
  language.
- `src/lib/locale-expansion/policy.test.ts`: the record is committed held; a
  release needs a reviewer; preview builds but never publishes; no route is
  injected while held.
- `scripts/i18n-hreflang-policy.test.ts`: the block arithmetic for released
  families.
- `npm run check:consumer-boundary` scans the new copy like any consumer
  source.

## Native review

`npx vite-node --script scripts/locale-expansion/sample-sheet.ts` writes
[samples/es.md](samples/es.md), [samples/pt.md](samples/pt.md),
[samples/fr.md](samples/fr.md) and [samples/it.md](samples/it.md): one sign's
every period, the month, a full and a new Moon and the zodiac dates text,
with the English beside each and a reviewer checklist. The copy was written
by AI; a native speaker should read each sheet before its language is
released (Dias's call; paid review is his decision).

## The one frozen file

The hreflang and rendering policy lives in `src/lib/i18n/index.ts`, which
`scripts/phase1-scope-guard.mjs` freezes. The change there is one hook,
`withExpansion()`, that adds released (or previewed) locales to a path's set
and changes nothing while every family is held. The guard needs an
owner-approved one-time allowance; it is not committed. If Dias approves, the
allowance to commit is below, with `baseCommit` set to the pull request's
base commit at merge time.

```json
{
  "version": 1,
  "id": "locale-expansion-hook-2026-11-08",
  "baseCommit": "<the PR's base commit>",
  "protectedPaths": [
    "src/lib/i18n/index.ts"
  ]
}
```

## Russian (part 2, built, held)

Russian joins the same record as a fifth locale, with every family held,
including three it lacked that es, pt, fr and it already publish:

| Family | Russian pages |
|---|---|
| Daily horoscope + hub, today | 14 |
| Tomorrow, week, month, love, work, 2026, 2027 | 84 |
| Full and new Moon pages | 50 |
| Zodiac dates | 1 |
| Sign guides (`sign-guide`): already built at `/ru/{sign}/` as noindex; a release makes them indexable | 12 |
| Rising-sign profiles (`rising-profile`) | 12 |
| Compatibility pairs (`compatibility-pair`) | 78 |

- The daily reading comes from `src/lib/locale-expansion/daily-ru.ts`, beside
  the frozen renderer, with the same line selection and receipts.
- The copy follows `docs/i18n/RU-COPY-DECK.md`, with one exception: the deck's
  spaced em dash. The house rule bans dashes, so the Russian copy uses commas,
  colons and full stops instead.
- The guide and share blocks have no Russian, so the Russian daily pages
  leave them out, as the existing Russian pages do.
- `signInRu()` writes «во Льве»: Russian puts «во» before Льве. Several
  browser islands still write «в Льве» through `t('readIn')` plus the
  prepositional case: the explorer inspector, the sky ticker, the chart
  calculator and the Moon phase tool. They sit under tight bundle budgets
  and are left for a separate fix.
- The independent review of the Russian copy is in
  `samples/review-2026-11-09/ru.md`, and every item is applied.

Russian's release status is Dias's decision (#924, decision 1). This part
builds and holds the pages; it releases nothing.
