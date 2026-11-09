# Adding the next locale (prepared, not published)

The candidates are German (`de`), Polish (`pl`), Turkish (`tr`), Japanese
(`ja`) and Hindi (`hi`). Part 2 of the locale expansion prepares the work
and publishes nothing. The choice waits for Keyword Planner volumes:
Part 5 writes `docs/visibility/keywords/{de,pl,tr,ja,hi}.csv`, and Dias
chooses.

## What exists now

- `src/lib/locale-candidates/candidates.mjs` holds each candidate's code,
  hreflang, Intl locale, script, direction, path prefix, Keyword Planner
  settings, font status and the register question for its copy deck. It
  contains no volumes or market sizes.
- `node scripts/new-locale/font-coverage.mjs` reports which candidates the
  self-hosted fonts can already draw. Today German is covered. Polish and
  Turkish need the latin-ext subsets of the same three families. Japanese
  and Hindi need a new self-hosted family.
- `npx vite-node --script scripts/new-locale/scaffold.ts <code>` writes
  `docs/i18n/staging/<code>/`:
  - `catalog.json`: every key of the English UI catalog with an empty target;
  - `glossary.json`: signs (with their grammatical cases), planets, aspects,
    Moon phases, houses and key terms;
  - `COPY-DECK.md`: the rules every locale follows plus this language's open
    decisions;
  - `CHECKLIST.md`.

  It touches nothing under `src/`.
- `scripts/new-locale/new-locale.test.ts` holds that no candidate appears in
  `LOCALES`, in the publication record or in the hreflang policy. The
  scaffold always produces a complete skeleton, and the font status stays as
  stated.

## From choice to release (each step a draft PR)

1. **Choose.** Dias picks the locale after the Keyword Planner volumes are
   in. Run the scaffold for it and commit the staging folder.
2. **Write the deck and glossary** natively. A native speaker reads them
   before any page is written (the review recommendation in
   `docs/visibility/samples/REVIEW.md` applies).
3. **Fonts.** Add the self-hosted subsets the font check names. There are
   no external font hosts.
4. **R0 foundation.** Add the locale to `LOCALES` and `LOCALE_META` in
   `src/lib/i18n/core.ts`, turn `catalog.json` into
   `src/lib/i18n/ui/<code>.ts`, and add the language's banned terms to the
   boundary scanner (`scripts/consumer-boundary-lib.mjs`) and to
   `src/lib/locale-expansion/copy-rules.ts`. Every route stays absent. These
   files are under the Phase 1 freeze, so the PR needs a one-time allowance.
5. **R1 content, held.** Write the language modules of the locale expansion
   (`src/lib/locale-expansion/{horoscope,lunation,zodiac-dates}/<code>.ts`,
   `daily-copy`, and a daily renderer as `daily-ru.ts` does). Add the
   locale's entries to `src/data/locale-expansion-publication.json`, all
   held, and add the entry files under `src/locale-pages/<code>/`. Preview
   with `PUBLIC_LOCALE_EXPANSION_PREVIEW=<code>`.
6. **Native review** of the generated sample sheet
   (`scripts/locale-expansion/sample-sheet.ts`).
7. **R2 release** in batches within 10 new indexable pages a week, as
   `docs/visibility/RELEASE-PLAN.md` describes.
