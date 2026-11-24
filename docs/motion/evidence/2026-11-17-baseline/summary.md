# Motion evidence: baseline

## Correction, 2026-11-22 (read this first)

This baseline was recorded on 2026-11-17 against `main` at 76fdd782 with the harness as it was then. A review of the harness (PR #1106) found faults that make some of the values below wrong. The baseline has not been run again: everything below this note, and `numbers.json`, is left exactly as recorded, and this note says which values not to trust and why.

1. "First mark shown (throttled)" is wrong on `/learn/aspects/opposition/` (893 ms at 390x844, 872 ms at 1440x900) and on `/` (1357 ms, 1343 ms). `main` at 76fdd782 has no marked element on any of the twelve routes ("Marked elements" is 0 everywhere). Those times are when a `.reveal` heading was shown: the site-wide heading entrance in `src/layouts/Base.astro` adds the same `is-in` class, and the harness then counted any element gaining it. The right value on every route is "not applicable: no marks".
2. Long frames: on those four rows the 2.5 s window was anchored at that `.reveal`, and on every other row at first paint. With no marks on any page the long-frame check has nothing to judge, so it is "not applicable: no marks" on every route. The failing check "/learn/aspects/opposition/ 390x844 longFrames: longest 50.1 ms, 33.4 ms without marks" is void (it judged a page with no marks over a window anchored at a `.reveal`), and so is every "runner too slow to judge" note. The harness also dropped a frame gap that ran past the end of the window, so the longest frames shown may be too short. Read the long-frame numbers as noise of this 2-core runner under 4x CPU, nothing more.
3. With those corrections, 3 checks failed, not 4: the layout-shift failures on `/` (both sizes) and `/today/` at 390x844.
4. The row "CLS (load + scroll)" is the sum of every layout shift during the load and one scroll-through that starts at `load`. It is not CLS as field tools define it (the worst five-second session window of a real visit). The values on `/` (0.3435 and 0.5196) and `/today/` at 390x844 (0.0150) were measured on `main` and have nothing to do with motion (there were no marks). On `/`, the home "today by sign" grid (`ul.home-today__grid`) hydrates while the scroll that starts at `load` has it on screen, and the content below it moves: 0.29 of the shift at 390x844 came from the grid in a probe on 2026-11-17. On 2026-11-22, against `main` at 3e6bcbd3, the same shift measured 0.33 at 390x844 and between 0.51 and 0.99 at 1440x900, depending on when the hydration lands against the scroll, with Playwright's fixed clock or without it. On `/today/` that grid is not on the page and the 2026-11-17 probe did not isolate the element that moved; the page hydrates two islands after `load` (`TodayBrief` and `SkyTicker`, whose small shift AGENTS.md records as a known flake). With 500 ms between `load` and the scroll, neither page showed a shift in that probe. Both are present on `main` and tracked separately from motion.
5. Checks the harness did not have then, so this baseline says nothing about them: whether every mark ends up shown, whether the largest block above the fold is marked, the route's HTTP status, and whether the scroll position came back after the reload (no note says it did not, but it was not checked).
6. Since the second review of the harness (2026-11-22), long frames are printed for a person to read and never fail a run, and layout shift is two numbers: a hard one taken after the page has gone quiet, and a report-only one that starts the scroll at `load`, which is what the "CLS (load + scroll)" row below measured. In `numbers.json` every long-frame entry now carries `"void": true` and the top level points to this note; the values themselves are unchanged.

Build: `main` at 76fdd782 (astro preview on 127.0.0.1:4391), recorded 2026-11-17 with `node tests/motion-evidence.mjs --before http://127.0.0.1:4391 --check` (ZOD-294). This is the "before" set; nothing is compared.

- Before: http://127.0.0.1:4391
- Mode: baseline (one build, nothing compared)
- Generated: 2026-11-17T16:59:09.975Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the only build: 4 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /learn/aspects/opposition/ 390x844 longFrames: longest 50.1 ms, 33.4 ms without marks
- /today/ 390x844 cls: 0.0150
- / 390x844 cls: 0.3435
- / 1440x900 cls: 0.5196

## /numerology/ (rest: changed)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 172 ms `p` | 212 ms `h1.display` |
| LCP element marked | false | false |
| First paint (throttled) | 508 ms | 592 ms |
| DOMContentLoaded (throttled) | 708 ms | 714 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 2, longest 66.6 ms | 2, longest 116.7 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | 689 px | 643 px |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.6 ms, 66.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 116.7 ms, 116.6 ms without marks

Sheets: [390x844 first view](numerology-390x844-first-view.webp), [390x844 after step 1: scroll to .num-paths](numerology-390x844-step-1.webp), [390x844 after step 2: fill input[type=date], then click form button[type=submit]](numerology-390x844-step-2.webp), [1440x900 first view](numerology-1440x900-first-view.webp), [1440x900 after step 1: scroll to .num-paths](numerology-1440x900-step-1.webp), [1440x900 after step 2: fill input[type=date], then click form button[type=submit]](numerology-1440x900-step-2.webp)

## /compatibility/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 156 ms `p` | 284 ms `p` |
| LCP element marked | false | false |
| First paint (throttled) | 1072 ms | 1160 ms |
| DOMContentLoaded (throttled) | 1097 ms | 1134 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 1, longest 66.8 ms | 0, longest 33.4 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.8 ms, 66.7 ms without marks

Sheets: [390x844 first view](compatibility-390x844-first-view.webp), [1440x900 first view](compatibility-1440x900-first-view.webp)

## /birth-chart/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 324 ms `h1.bc-title` | 300 ms `h1.bc-title` |
| LCP element marked | false | false |
| First paint (throttled) | 476 ms | 644 ms |
| DOMContentLoaded (throttled) | 1125 ms | 1268 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 2, longest 133.3 ms | 7, longest 183.3 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | 716 px | 747 px |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 133.4 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 183.3 ms, 116.7 ms without marks

Sheets: [390x844 first view](birth-chart-390x844-first-view.webp), [1440x900 first view](birth-chart-1440x900-first-view.webp)

## /big-three/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 144 ms `p` | 216 ms `p` |
| LCP element marked | false | false |
| First paint (throttled) | 1088 ms | 1092 ms |
| DOMContentLoaded (throttled) | 793 ms | 765 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 0, longest 16.8 ms | 0, longest 50 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | 720 px | 768 px |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks: all pass.

Sheets: [390x844 first view](big-three-390x844-first-view.webp), [1440x900 first view](big-three-1440x900-first-view.webp)

## /learn/aspects/opposition/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 152 ms `p` | 184 ms `p` |
| LCP element marked | false | false |
| First paint (throttled) | 900 ms | 972 ms |
| DOMContentLoaded (throttled) | 691 ms | 680 ms |
| First mark shown (throttled) | 893 ms (+-7 after paint) | 872 ms (+-100 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 50.1 ms | 2, longest 83.3 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 5 | 5 |

Checks not passing:

- 390x844 longFrames: FAIL, longest 50.1 ms, 33.4 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.3 ms without marks

Sheets: [390x844 first view](learn-aspects-opposition-390x844-first-view.webp), [1440x900 first view](learn-aspects-opposition-1440x900-first-view.webp)

## /learn/zodiac-dates/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 152 ms `h1.display` | 244 ms `h1.display` |
| LCP element marked | false | false |
| First paint (throttled) | 960 ms | 1028 ms |
| DOMContentLoaded (throttled) | 708 ms | 682 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 0, longest 33.5 ms | 2, longest 66.7 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 12 | 12 |

Checks not passing:

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 83.4 ms without marks

Sheets: [390x844 first view](learn-zodiac-dates-390x844-first-view.webp), [1440x900 first view](learn-zodiac-dates-1440x900-first-view.webp)

## /aries/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 232 ms `img.sg-hero__art` | 316 ms `img.sg-hero__art` |
| LCP element marked | false | false |
| First paint (throttled) | 716 ms | 820 ms |
| DOMContentLoaded (throttled) | 808 ms | 888 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 6, longest 116.7 ms | 6, longest 216.7 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 116.7 ms, 99.9 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 216.7 ms, 200 ms without marks

Sheets: [390x844 first view](aries-390x844-first-view.webp), [1440x900 first view](aries-1440x900-first-view.webp)

## /today/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0150 | 0.0000 |
| LCP | 216 ms `header.today-hero` | 456 ms `header.today-hero` |
| LCP element marked | false | false |
| First paint (throttled) | 668 ms | 704 ms |
| DOMContentLoaded (throttled) | 830 ms | 842 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 3, longest 116.6 ms | 3, longest 133.4 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 0 |

Checks not passing:

- 390x844 cls: FAIL, 0.0150
- 390x844 longFrames: NOTE, runner too slow to judge: longest 116.6 ms, 166.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 133.4 ms, 250 ms without marks

Sheets: [390x844 first view](today-390x844-first-view.webp), [1440x900 first view](today-1440x900-first-view.webp)

## /horoscopes/aries/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 144 ms `img` | 276 ms `img` |
| LCP element marked | false | false |
| First paint (throttled) | 524 ms | 628 ms |
| DOMContentLoaded (throttled) | 703 ms | 678 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 3, longest 150 ms | 4, longest 149.9 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 150 ms, 99.9 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 149.9 ms, 183.3 ms without marks

Loops (never paused, sought or waited for): before: program-sky-drift on section.program__sky.

Sheets: [390x844 first view](horoscopes-aries-390x844-first-view.webp), [1440x900 first view](horoscopes-aries-1440x900-first-view.webp)

## /people/ada-lovelace/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 156 ms `p.person-lede` | 208 ms `img` |
| LCP element marked | false | false |
| First paint (throttled) | 980 ms | 1136 ms |
| DOMContentLoaded (throttled) | 785 ms | 758 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 1, longest 66.7 ms | 3, longest 99.9 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 66.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 99.9 ms, 83.3 ms without marks

Sheets: [390x844 first view](people-ada-lovelace-390x844-first-view.webp), [1440x900 first view](people-ada-lovelace-1440x900-first-view.webp)

## /tools/ (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.0000 | 0.0000 |
| LCP | 172 ms `img` | 232 ms `img` |
| LCP element marked | false | false |
| First paint (throttled) | 964 ms | 1072 ms |
| DOMContentLoaded (throttled) | 706 ms | 715 ms |
| First mark shown (throttled) | none | none |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 1, longest 133.3 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 |

Checks not passing:

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 100 ms without marks

Sheets: [390x844 first view](tools-390x844-first-view.webp), [1440x900 first view](tools-1440x900-first-view.webp)

## / (rest: identical)

| | before 390x844 | before 1440x900 |
|---|---|---|
| CLS (load + scroll) | 0.3435 | 0.5196 |
| LCP | 236 ms `img.hero__poster` | 340 ms `img.hero__poster` |
| LCP element marked | false | false |
| First paint (throttled) | 776 ms | 680 ms |
| DOMContentLoaded (throttled) | 1310 ms | 1300 ms |
| First mark shown (throttled) | 1357 ms (+581 after paint) | 1343 ms (+663 after paint) |
| Long frames > 50 ms (4x CPU) | 4, longest 183.4 ms | 4, longest 183.4 ms |
| Animated properties (marked) | none | none |
| Marked elements | 0 | 0 |
| Nested marks | 0 | 0 |
| html has is-in | false | false |
| Hidden above after reload | 0 | 0 |
| Primary action top | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 1 |

Checks not passing:

- 390x844 cls: FAIL, 0.3435
- 390x844 longFrames: NOTE, runner too slow to judge: longest 183.4 ms, 150 ms without marks
- 1440x900 cls: FAIL, 0.5196
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 183.4 ms, 216.6 ms without marks

Loops (never paused, sought or waited for): before: hero-poster-drift on img.hero__poster; looping video on video.hero__video.is-playing.

Sheets: [390x844 first view](home-390x844-first-view.webp), [1440x900 first view](home-1440x900-first-view.webp)

