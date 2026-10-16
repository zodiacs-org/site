# The bio drive's clock — 2026-10-12

`tests/bio-drive.mjs` is Site Check's "Link-in-bio page acceptance" step
(`npm run test:bio:browser`). It checks "desktop: primary CTA arrives in the
opening scan" with `primaryTop <= 360`, and it read the real clock. Finding
F-85.

## What failed

`/bio/` renders its heading as `Your chart and <EditionText current="today’s" …/> sky`
(`src/pages/bio/index.astro`). From 00:00 UTC until the day's "Daily sky"
commit deploys, at about 05:30 UTC, the page's edition is a day old, the page
is dated, and the heading reads "Your chart and the October 11, 2026
edition’s sky". The longer heading takes another line, and the CTA moves down
by that line.

- A run on 2026-10-12 against `ec0451ff` (2026-10-11 edition, real clock
  2026-10-12) failed: `FAIL desktop: primary CTA arrives in the opening scan · 374px`.
- [Site Check 38184748851](https://github.com/zodiacs-org/site/actions/runs/38184748851),
  on `ec0451ff`, passed the step because it started at 23:58:31 UTC on
  2026-10-11, 89 seconds before midnight. Its Lighthouse step, from 00:03:42
  to 00:17:06 UTC, ran on the day-old edition (F-84, #726).

## Reproduced here

`812423b1` is main just before the 2026-10-12 daily commit (`5ab297a9`), so
it carries the 2026-10-11 edition. Built without the two freshness gates (the
prebuild steps except `editorial:daily:freshness` and
`editorial:horoscopes:freshness`, then `npm run build --ignore-scripts` and
`npm run postbuild`) and driven at 07:30 UTC on 2026-10-12, the old drive
fails the same check at 374 px (`drive-before-dated-clock.txt`). On
`5ab297a9`'s build at 07:18 UTC, when its edition was current, it passes at
328 px (`drive-before-current-clock.txt`).

## Where the CTA lands

`measure-opening.mjs` sets the page clock as the drive now does, to 12:00 UTC
on the edition's day and to 00:17 UTC on the next day, and writes other
dates' labels into the served heading. Chrome 154.0.8037.98 on macOS 27.0.1
(arm64), 2026-10-12 edition. The top of the CTA, in px; its bottom is 72 to
76 px lower:

| viewport | edition's day | dated, Georgia | dated, Times New Roman | first screen |
| --- | --- | --- | --- | --- |
| desktop 1440 × 900 | 328 | 374 | 420 | 900 |
| tablet 1024 × 900 | 316 | 357 | 397 | 900 |
| mobile 390 × 844 | 286 | 326 | 365 | 844 |
| annotation 412 × 915 | 291 | 332 | 374 | 915 |
| narrow 320 × 780 | 291 | 323 | 356 | 780 |

- On the edition's day the heading takes 2 lines in both faces.
- The page's own font stack sets the heading in Georgia on this Mac
  (`opening-page-fonts.txt`, which records Chrome's platform font on each
  line). Every label tried takes 3 lines: October 12, May 1, February 28,
  November 30, December 31, September 28 and September 30.
- `FONT='"EB Garamond Fallback Times"'` sets it in the page's Times face,
  which is Times New Roman here (`opening-times-face.txt`). Every label but
  "May 1, 2026" takes 4 lines; May 1 takes 3, at the Georgia positions.
- The Times face also lists Liberation Serif, which has Times New Roman's
  widths, and GitHub's Ubuntu runner has `fonts-liberation`
  (`../birth-time-window-ui-20261010/focused-qualification.log`). Which face
  the runner uses for this heading is not measured here; the drive prints the
  dated positions on every run.
- In every measured case the whole CTA is in the first screen, and nothing
  overflows.

## Why the drive changes and the page does not

- The 360 px ceiling came with this heading, in the redesign `1dac5100`
  (2026-08-29). The Site Check logs kept in this repository show the edition
  day's composition, 328, 316, 286, 291 and 291 px (for example
  `../birth-time-window-production-20261011/postmerge/build-check.log`). It
  is one figure for five viewports from 780 to 915 px tall, 32 px above the
  desktop position: a ceiling for the designed composition, not a share of
  the screen.
- The dated heading adds one or two lines, depending on the date and the
  fonts. A fixed ceiling for it would hold only by moving the edition day's
  design for every visitor, and would otherwise change with the calendar.
- So the acceptance checks run on the edition's day, and the dated state
  keeps an expectation of its own: the dated heading, no horizontal
  overflow, and the whole CTA in the first screen.

No page, style or copy changes, so no captures are retaken. `src/pages/bio/`
is not among the Phase 1 template sources.

## The change

In `tests/bio-drive.mjs`:

- An init script sets the page clock, with the `FixedDate` of
  `tests/edition-parser-drive.mjs`. The acceptance pass runs at 12:00 UTC on
  the edition's day and checks on each viewport that the heading is the
  current one, "Your chart and today’s sky". The reduced-motion page uses the
  same clock.
- The edition is the one the target serves: the drive reads `/bio/`'s
  `data-edition-date` before it sets either clock. With
  `ZODIACS_TEST_BASE_URL` the target can serve another edition than the
  checkout's `src/data/daily-publication.json`, which the drive's first
  version (`263ec244`) read (review of #727).
- A dated pass over the same five viewports runs at 00:17 UTC on the next
  day. It checks for page errors, that the page is dated and the heading
  reads exactly "Your chart and the ‹edition date› edition’s sky", that
  nothing overflows horizontally, and that the bottom of the primary CTA is
  within the first screen. With `OUT_DIR` it also saves
  `bio-<viewport>-dated.png`.
- 109 checks, from 84.

## Runs

Node 22.22.2, Chrome 154.0.8037.98, macOS 27.0.1 (arm64), all on
2026-10-12. "After" is the drive of `263ec244`; the drive that reads the
served edition gives byte-identical output on the first four builds.

| build | edition | real clock (UTC) | drive | result | log |
| --- | --- | --- | --- | --- | --- |
| `812423b1` | 2026-10-11 | 07:30 | before | 83 pass, 1 fail: desktop CTA at 374 px | `drive-before-dated-clock.txt` |
| `5ab297a9` | 2026-10-12 | 07:18 | before | 84 pass | `drive-before-current-clock.txt` |
| `812423b1` | 2026-10-11 | 10:12 | after | 109 pass | `drive-after-dated-clock.txt` |
| `5ab297a9` (the change touches no built file) | 2026-10-12 | 10:15 | after | 109 pass | `drive-after-current-clock.txt` |
| `263ec244` merged with #726's head `accb6786` | 2026-10-12 | 10:13 | after | 109 pass | `drive-after-with-726.txt` |
| `812423b1` served at `ZODIACS_TEST_BASE_URL`, driven from a checkout with the 2026-10-12 edition | 2026-10-11 | 14:42 | after, `263ec244` | 98 pass, 11 fail: both clocks a day late | `drive-external-preview-before.txt` |
| the same | 2026-10-11 | 14:42 | after, reading the served edition | 109 pass | `drive-external-preview-after.txt` |

## Remaining

- The dated pass does not bound where in the first screen the CTA lands:
  374 to 420 px on desktop in the measured cases, against 328 px on the
  edition's day. Keeping the edition day's position in the dated state would
  be a design change to the page.
- Other drives that read the real clock were not surveyed.
