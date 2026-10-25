# Natal planet-pair aspects: released

Scope: the third adjacent build in the plan. Three natal pair references,
`/learn/aspects/sun-moon/`, `/learn/aspects/moon-venus/` and
`/learn/aspects/venus-mars/`, each one family page with five geometry
anchors (`#conjunction`, `#sextile`, `#square`, `#trine`, `#opposition`).
The five generic geometry guides and their `entries.length !== 5` route
assertion are unchanged. No other pair, locale, reversed pair or calculator
is introduced.

## Publication is released

Released 2026-10-26 with the owner's approval. `src/data/natal-aspects-publication.json`
is complete: `released: true`, reviewer Dias Malayev, reviewed 2026-10-25,
updated 2026-10-26, and indexing evidence in
`docs/natal-aspects/indexing-evidence.md` (pre-release readiness now, crawl
confirmation appended after deploy). The three MDX articles in
`src/content/natal-aspect-pairs/` are `draft: false` with the same reviewer and
review date. A complete publication record with any draft entry fails the
build (`assertNatalPairEntries`).

Normal builds emit the three routes as indexable, self-canonical, English-only
pages. They answer 200 and appear in the sitemap and the search index;
`tests/natal-aspects-publication-drive.mjs` checks all of that after the main
CI build, along with the discovery links below. `PUBLIC_NATAL_ASPECTS_PREVIEW=1`
(set in the shell, not a `.env` file) still builds the pages when the record
is withheld, as noindex pages outside the sitemap and search; the flag cannot
mark anything published.

## Routing and the Phase 1 freeze

`scripts/phase1-scope-guard.mjs` freezes `src/pages/learn/` and
`src/content/learn/`. This build stays outside that scope, as the synastry
build did:

- `scripts/natal-aspects-policy.mjs` injects three static routes, one per
  pair, all served by `src/reference-pages/natal-aspects/pair.astro`. There
  is no second dynamic route beside `src/pages/learn/aspects/[slug].astro`.
- The records are a separate collection, `natalAspectPairs`
  (`kind: natal-aspect-pair`), not entries in the `learn` collection, so no
  existing Learn listing, sitemap loop or locale route picks them up.

Both discovery hooks are wired. The two files are inside the freeze, so the
release carries an owner-approved one-time allowance
(`.github/phase1-scope-allowance.json`, id
`natal-aspect-pairs-release-2026-10-26`, pinned to the PR's base commit and
naming exactly these two paths):

1. The hub improvement for `/learn/aspects/`: `src/pages/learn/aspects/index.astro`
   renders `{natalAspectsEnabled && <NatalAspectsHubSection />}` after the
   closing `cluster-note` paragraph. The section lists the three pairs and
   adds about 680 words (`src/components/learn/NatalAspectsHub.mdx`), bringing
   the hub past the plan's 800 words. Its styles are inlined. The hub's
   editorial date moves to 2026-10-26.
2. Links from each geometry guide: `src/pages/learn/aspects/[slug].astro`
   renders `{natalAspectsEnabled && <NatalPairLinks type={type} />}` after the
   FAQ section. It uses the page's prose rules and adds no CSS. The five
   guides' sitemap dates and `dateModified` move to the record's `updated`
   date.

The pair pages also link to each other and back to the hub.

## Reciprocal synastry links

The synastry references (`/compatibility/aspects/`, PR #805) are not on
main, so the natal pages do not link to them. Each page explains the
two-chart distinction on the first screen and links the compatibility tool
instead. `src/lib/natal-aspect-pairs.test.ts` and the browser drive check
that no `/compatibility/aspects/` link appears. Add first-screen reciprocal
links for Sun-Moon and Moon-Venus once those routes are released;
Venus-Mars has no synastry counterpart.

## Evidence

`node scripts/build-natal-aspect-examples.mjs` writes
`src/data/natal-aspect-examples.json` from the site's own `computeChart`
(engine version recorded) on synthetic, nonpersonal UTC instants:

- two worked examples per pair, with longitudes, separation, target angle,
  residual orb, applying or separating, and 25 hourly samples across the UTC
  date;
- a feasible instant within 1 degree for all five geometries of every pair,
  so no page describes an impossible natal configuration;
- one time-sensitive case per pair, an aspect listed at noon but not all
  day, which the birth-time panel quotes;
- schematic wraparound and luminary-allowance cases (no timestamps);
- over one eight-year Venus cycle, the largest Sun-Venus separation and how
  long each Venus-Mars aspect stays listed, which the copy quotes.

`--check` replays the generator for drift (CI legacy-drift job and
`src/lib/natal-aspect-pairs.test.ts`). The unit test replays every example
through the calculation. Calculation replay verifies numbers only. The
interpretive sections are editorial suggestions awaiting named review.

## Checks

- `scripts/natal-aspects-policy.test.mjs`: publication rule, preview flag,
  injected routes, the closed allowlist, the draft guard, Phase 1 scope.
- `src/lib/natal-aspect-pairs.test.ts`: evidence replay, feasibility,
  editorial depth (at least 2,000 words a page, 300 a geometry section),
  exact headings such as "Sun square Moon in a birth chart", natal wording
  in titles and openings, four FAQs, no dashes, no outcome or wing language.
- `scripts/report-bundles.test.mjs`: `budgets.natal-aspects.json` holds each
  emitted pair route to a 0 KB entry closure.
- `tests/natal-aspects-publication-drive.mjs` (main CI build): routes 200,
  indexable, self-canonical, in the sitemap and search, linked from the hub
  and the five geometry guides.
- CI job "Natal aspect pairs": normal build under the normal postbuild
  gates, `npm run check`, the browser drive
  (`tests/natal-aspects-reference-drive.mjs`: 320px, 200% text, keyboard,
  zero CLS, static delivery, accessible diagram) and mobile Lighthouse on
  the three routes with the existing thresholds.

Not covered by automation: a manual screen reader pass, visual regression
baselines for the three pages, and post-release crawl confirmation (appended
to the indexing evidence after deploy).
