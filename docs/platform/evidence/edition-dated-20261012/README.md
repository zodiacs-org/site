# Daily pages dated before the first paint (F-84)

From 00:00 UTC until the day's edition deploys, at about 05:30 UTC, every
daily page serves an edition that is a day old. Those pages dated their
"today" wording after the first paint, and the longer text moved the page.
This folder records the failing run, the reproduction and the fix's
measurements. The finding is
[F-84](../../programme/FINDINGS.md#f-84--the-daily-pages-moved-after-their-first-paint-while-their-edition-was-a-day-old-minor-performance-fixed-in-726).

## The failing run

Site Check run 38184748851, on main after #722 (`ec0451ff`), failed only its
"Lighthouse performance budgets" step. The step ran from 00:03 to 00:17 UTC
on 2026-10-12, with the 2026-10-11 edition built before midnight. Its own
reports (artifact `phase-1-browser-performance-38184748851`) give the same
value in each of the three samples, and name the element that moved:

| route | CLS | element that moved |
| --- | --- | --- |
| `/today/` | 0.019766 | `section#save-moment`, the Today card |
| `/horoscopes/` | 0.005477 | `div.horo-grid`, below "A look at today's readings" |
| `/horoscopes/aries/` | 0.010503 | `p.experience-note`, whose link is named Today |

Every other route measured 0.000.

## Reproduced

`ec0451ff`, built here (Apple M4, Chrome 154, Node 22.22.2) without the two
`editorial:*:freshness` prebuild steps, served on 2026-10-12 with its
2026-10-11 edition, so the real clock was dated:

- `LIGHTHOUSE_ROUTES=today,horoscopes,horoscope-daily npm run test:lighthouse`:
  `/today/` CLS 0.020 with the same element; `/horoscopes/` and
  `/horoscopes/aries/` measured 0 on this machine's timing.
- `tests/edition-dated-drive.mjs`, run from a checkout of `ec0451ff` against
  that build: 10 of its 93 checks fail ([drive-ec0451ff.txt](drive-ec0451ff.txt)).
  Seven are CLS on 7 of the 9 dated loads, from 0.0075 to 0.0595, on all three
  routes; three are the appended-text check, which the old guard also fails.

## Cause

`Base.astro`'s head script marked the page dated before the first paint, and
EditionText spans already carry their dated server text. The rest of the
"today" wording inside `[data-edition-content]` stayed relative in the HTML
and was dated by `EditionFreshnessGuard` on DOMContentLoaded. That event waits
for the page's module scripts, so it can come after the first paint. A trace
of the old `/today/` on a fast local load shows the rewrite at
DOMContentLoaded and the first paint after it; Site Check's runner painted
first, and the dated text took another line.

## Fix and measurements

`EditionFreshnessGuard.astro` decides the state in `<head>` and dates the
wording as the parser adds it, so the first paint is final. See F-84 for the
details.

- **Drive.** On the merged head `c394aa6e` (2026-10-12 edition, clock
  2026-10-13 00:17 UTC), all 93 checks pass
  ([drive-c394aa6e.txt](drive-c394aa6e.txt)). A build of the fix without the
  re-dating of appended text fails only the three appended-text checks.
- **Lighthouse,** three samples a route, worst value
  ([lighthouse-summary.json](lighthouse-summary.json) has every sample):

| build and clock | `/today/` CLS | `/horoscopes/` CLS | `/horoscopes/aries/` CLS | performance | LCP |
| --- | --- | --- | --- | --- | --- |
| Site Check, `ec0451ff`, dated | 0.020 | 0.005 | 0.011 | 99, 100, 99 | 1.38, 1.81, 2.10 s |
| here, `ec0451ff`, dated | 0.020 | 0.000 | 0.000 | 100, 99, 98 | 1.74, 1.96, 2.26 s |
| here, fix `1632196d`, dated | 0.000 | 0.000 | 0.000 | 100, 100, 98 | 1.74, 1.88, 2.26 s |
| here, merged `c394aa6e`, dated | 0.000 | 0.000 | 0.000 | 100, 100, 98 | 1.75, 1.88, 2.26 s |
| here, merged `c394aa6e`, current | 0.000 | 0.000 | 0.000 | 100, 100, 98 | 1.74, 1.81, 2.26 s |

The `ec0451ff` and `1632196d` rows ran on the real clock of 2026-10-12, a day
after their edition. On the merged head the edition is 2026-10-12's, so its
dated row moved the page clock to 2026-10-13 00:17 UTC: a local proxy in front
of `astro preview` added a clock-shift script at the start of each HTML
`<head>` and passed every other byte through, compression included. The
current row ran on the real clock.

## Production, 2026-10-13

#728 was built on #726's branch, so its merge (`c8bd493d`, 04:12 UTC)
brought #726's head `accb6786` to main, and GitHub marked #726 merged.
Vercel deployed it to production as `dpl_9HgvWwPALVsK5cCoVzPnrYebmqSh`. Main's
Site Check on `c8bd493d` (run 38345292287) passed, the new drive and the
Lighthouse gate included. That gate does not move the clock, and the run's
edition was current, so in CI only the drive covered the dated state.

- **Deployment.** Read through the Vercel connector before the checks and
  again after them (14:44 UTC), zodiacs.org named the same deployment,
  `dpl_FF8v9Lp4xeRCaGMYPyAgmMPqRW3N`: READY, target production, commit
  `7d12c0f1` (#730's merge), alias last updated at 10:13:52 UTC. It serves the
  2026-10-13 edition and the new guard.
- **Drive.** `tests/edition-dated-drive.mjs` as it stood at `7d12c0f1`, run
  with `ZODIACS_TEST_BASE_URL=https://zodiacs.org`: 283 of 283 checks pass,
  over nine routes in English, Spanish and Portuguese at 360, 412 and 1280 px
  ([drive-production-7d12c0f1.txt](drive-production-7d12c0f1.txt)). Its
  dated loads ran on a page clock of 2026-10-14 00:17 UTC, its current loads
  on 2026-10-13 12:00 UTC, and two checks loaded `/today/` without
  JavaScript. #737 later added a tab-title check to each load, so the drive
  on main now has more checks.
- **Lighthouse.** The harness through a local proxy in front of zodiacs.org,
  which moves the page clock to 2026-10-14 00:17 UTC with a script at the
  start of each HTML `<head>` and passes every other byte through: CLS 0.000 in each of the three samples on `/today/`,
  `/horoscopes/` and `/horoscopes/aries/` (`production-7d12c0f1-dated` in
  [lighthouse-summary.json](lighthouse-summary.json)). Performance and LCP
  ran over this machine's connection, so they do not compare with CI's.

## Not established here

- **Other browsers.** Only Chromium ran. The appended-text case is checked by
  appending to a dated node, because Chromium holds a text run back until its
  end arrives; a parser that paints partial text was not observed.
- **A real dated window in production.** Production was checked on a moved
  clock. On 10, 11 and 12 October the scheduled publisher committed the
  edition at about 05:30 UTC; on 9 and 13 October a dispatch at 00:06 UTC
  committed it at 00:08. So the window's length varies from minutes to
  hours.
