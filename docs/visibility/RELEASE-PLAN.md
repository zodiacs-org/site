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
the next Moon page. The whole set is 864 pages: 209 each in Spanish and
Portuguese, 223 each in French and Italian. Each locale's Moon families
follow every full and new Moon the English publishes, 62 of each from 2026
to 2030. At this pace that is about 87 weeks, and the Moon pages for dates
in 2028 to 2030 come due in date order, so they never wait at the back.

## The cap stays at 10 a week (decided 2026-11-10, delegated by Dias)

The cap is not raised. Reason: it is the site-wide Growth OS rule, and these
pages are written from shared facts, so a steady pace lets Search Console show
whether they earn their place before more of them go out. The plan is looked
at again after the first eight batches; any change to the cap is a change to
`docs/growth/README.md`, not to this file.

## Gate for each batch

- `npx vitest run src/lib/locale-expansion` passes, along with the full CI.
- For a family's first batch in a language: the independent review notes in
  [samples/REVIEW.md](samples/REVIEW.md) are applied, and the sample sheet is
  regenerated.
- After merge and deploy: one live page from the batch is checked for
  `index`, self-canonical, reciprocal hreflang and its sitemap entry. The
  batch is logged in the merge log issue.

## Russian (decided 2026-11-09, delegated by Dias)

Russian is released through the same plan, inside the same 10 pages a week,
and never ahead of the Spanish, Portuguese, French and Italian computed
batches it would compete with. Its 325 held pages wait behind the first six
batches above.

- **Order.** The 12 sign guides first, two a week: they are already built at
  `/ru/{sign}/` and only change from noindex to indexable. Then zodiac dates,
  today and the next Moon pages, then the daily hub and signs, then the
  periods in the order above, then the rising profiles and the 78 pairs,
  which carry the most prose.
- **Reasons.** The Russian pages pass the same copy rules and the same
  independent review as the other four locales, and the existing Russian
  calculators already earn Russian search traffic. Holding Russian back
  entirely would leave built, reviewed pages unused; releasing it ahead of
  the others would spend the weekly cap on the locale with the least
  evidence so far.
- **Gate.** The same per-batch gate applies. Before the first Russian batch,
  the review notes in `samples/review-2026-11-09/ru.md` stay applied, and
  the sample sheet `samples/ru.md` is regenerated. A paid native review is
  recommended to Dias before the pairs and profiles go out, but nothing is
  bought.

Dias can reverse this at any time by leaving the Russian entries held; no
batch PR releases Russian without the usual draft, CI, review and merge
path.
