# Review of the sample sheets

## What was done (free, 2026-11-09)

1. **Copy rules, automatic.** Every string in every language passes
   `copyProblems()` in `src/lib/locale-expansion/copy.test.ts`: no dashes, no
   template leaks, no leftover English, nothing about investing, betting,
   guarantees or diagnoses, no market or crypto words. Signs read differently
   from each other, and titles are 60 characters or fewer.
2. **Independent AI review.** For each language, a separate AI pass that did
   not write the copy read the whole sample sheet as a demanding native
   editor. Its findings are in [review-2026-11-09/](review-2026-11-09/). The
   verdict was **mostly** natively written in all four languages. Grammar and
   register were sound. The findings were calques, agreement slips (Venus is
   feminine in Spanish, Portuguese and Italian), repeated lines and two
   phrasings close to spending advice. Every finding was applied at the
   source, and the sheets were regenerated.
3. **One data bug found by the reviewers.** An aspect's time differed between
   the week (engine time) and the month (NASA time). The localized readings
   now print NASA's instant for ingresses, stations and aspects, as the
   English pages do, and a test holds the week and the month to the same time.

## What it is not

None of this is a review by a native speaker. An AI reading AI copy catches
grammar and calques. It does not reliably catch tone, cultural fit, or what
a reader in Madrid, São Paulo, Lyon or Milan would find odd.

## Recommendation for Dias (would cost money)

Before the **horoscope prose families** are released in a language (daily,
tomorrow, week, month, love, work, years), have one native speaker per
language read that language's sheet with the checklist at its top. A
freelance editor for about an hour per language would do, or a volunteer if
one is available without cost. The computed families (zodiac dates, today,
full and new Moons) carry little prose, and the release plan puts them
first. They can go out on the free review above, so the plan does not wait
on this decision.
