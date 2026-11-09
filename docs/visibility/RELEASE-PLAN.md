# Locale expansion release plan (decided 2026-11-09)

Dias delegated three decisions on PR #926 to the agent: the freeze-guard
allowance, the release batching and native review. This file records the
batching. The other two decisions are in the PR description and in
[LOCALE-EXPANSION.md](LOCALE-EXPANSION.md).

## The rule

- **At most 10 net-new indexable pages in any rolling 7 days**, counting
  every locale together (Growth OS rule in `docs/growth/README.md`). Fixes to
  pages already live do not count.
- **One batch is one small pull request** that edits only
  `src/data/locale-expansion-publication.json`: `released: true`, `reviewer`,
  `reviewedAt`, and, for part of a family, `paths` (the English paths being
  released). `check-dist`, hreflang and the sitemaps follow the record by
  themselves, so the batch PR shows exactly which pages go live. The record
  rejects a `paths` entry from another family.
- **Nothing is released before #926 merges**, and every batch PR goes through
  the usual draft, CI, review and merge-log path.
- **2 of the 10 weekly slots are kept for the next Moon page**, released at
  least 10 days before the date in all four locales. Moon pages are
  computed facts with short prose, and their search interest peaks in the
  days before the date.

## Order and reasons

1. **Computed pages first.** These are zodiac dates, today, and the upcoming
   full and new Moons. Their sentences mostly state calculated facts (dates,
   times, degrees, houses), so a wording slip costs least. The copy rules and
   the independent AI review cover them well.
2. **Spanish and Portuguese periods next.** The order is week, month,
   tomorrow, then love, work and the years. This is #924's top cell: the
   largest family, and the daily pages in these languages already show the
   pipeline works.
3. **French and Italian daily, then their periods.** These are the biggest
   build, with no published history yet. They wait until the Spanish and
   Portuguese periods show movement in Search Console.
4. **Moon pages for dates already past go last.** Their search value is low,
   and they exist mainly so that previous and next links stay in one
   language.

## The first six batches

| Week | Pages | Count |
|---|---|---|
| 1 | zodiac dates es, pt, fr, it; today fr, it; full Moon 2026-11-24 es, pt, fr, it | 10 |
| 2 | new Moon 2026-12-09 es, pt, fr, it; full Moon 2026-12-24 es, pt (fr and it in week 3); horoscope hub fr, it; weekly es (aries, taurus) | 10 |
| 3 | full Moon 2026-12-24 fr, it; weekly es (gemini to pisces, 8 signs) | 10 |
| 4 | new Moon 2027-01-07 es, pt; weekly pt (aries to capricorn, 8 signs) | 10 |
| 5 | new Moon 2027-01-07 fr, it; weekly pt (aquarius, pisces); monthly es (aries to virgo, 6 signs) | 10 |
| 6 | full Moon 2027-01-22 es, pt; monthly es (libra to pisces, 6 signs); monthly pt (aries, taurus) | 10 |

From week 7 the order above continues at 10 a week, with 2 slots a week for
the next Moon page. The whole set is 568 pages: 135 each in Spanish and
Portuguese, 149 each in French and Italian. At this pace that is about 57
weeks. Raising the cap is Dias's decision, not the agent's; see the
recommendation in the PR.

## Gate for each batch

- `npx vitest run src/lib/locale-expansion` passes, along with the full CI.
- For a family's first batch in a language: the independent review notes in
  [samples/REVIEW.md](samples/REVIEW.md) are applied, and the sample sheet is
  regenerated.
- After merge and deploy: one live page from the batch is checked for
  `index`, self-canonical, reciprocal hreflang and its sitemap entry. The
  batch is logged in the merge log issue.
