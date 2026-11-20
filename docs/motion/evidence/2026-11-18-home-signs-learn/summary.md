# Motion evidence

- Before: http://127.0.0.1:4391
- After: http://127.0.0.1:4402
- Generated: 2026-11-17T18:19:33.973Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 5 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- / 390x844 cls: 0.3435
- / 1440x900 cls: 0.4869
- / 1440x900 hiddenAboveAfterReload: 10
- / 1440x900 rest: 0.160% differs (limit 0.1%)
- /learn/ 1440x900 cls: 0.0001, retake 0.0001

## / (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.160% |
| CLS (load + scroll) | 0.3445 | 0.3435 | 0.0000 | 0.4869 |
| LCP | 188 ms `img.hero__poster` | 284 ms `img.hero__poster` | 448 ms `img.hero__poster` | 480 ms `img.hero__poster` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 588 ms | 564 ms | 808 ms | 800 ms |
| DOMContentLoaded (throttled) | 1310 ms | 1526 ms | 1536 ms | 1382 ms |
| First mark shown (throttled) | 1335 ms (+747 after paint) | 1612 ms (+1048 after paint) | 1553 ms (+745 after paint) | 1419 ms (+619 after paint) |
| Long frames > 50 ms (4x CPU) | 4, longest 300 ms | 6, longest 183.3 ms | 4, longest 216.7 ms | 4, longest 300 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 16 | 0 | 16 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 10 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 1 | 1 |

Checks not passing:

- 390x844 cls: FAIL, 0.3435
- 390x844 longFrames: NOTE, runner too slow to judge: longest 183.3 ms, 300 ms without marks
- 1440x900 cls: FAIL, 0.4869
- 1440x900 hiddenAboveAfterReload: FAIL, 10
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 300 ms, 216.7 ms without marks
- 1440x900 rest: FAIL, 0.160% differs (limit 0.1%)

Loops (never paused, sought or waited for): before: hero-poster-drift on img.hero__poster; looping video on video.hero__video.is-playing. after: hero-poster-drift on img.hero__poster; looping video on video.hero__video.is-playing.

Sheets: [390x844 first view](home-390x844-first-view.webp), [1440x900 first view](home-1440x900-first-view.webp)

## /aries/ (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 192 ms `img.sg-hero__art` | 216 ms `img.sg-hero__art` | 248 ms `span.nav__name` | 400 ms `h1.h-hero.sg-hero__title` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 676 ms | 864 ms | 1100 ms | 796 ms |
| DOMContentLoaded (throttled) | 1183 ms | 1178 ms | 1130 ms | 675 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 5, longest 250 ms | 2, longest 283.4 ms | 3, longest 166.6 ms | 6, longest 433.4 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 4 | 0 | 4 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 283.4 ms, 250 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 433.4 ms, 166.6 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](aries-390x844-first-view.webp), [1440x900 first view](aries-1440x900-first-view.webp)

## /leo/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 220 ms `img.sg-hero__art` | 204 ms `img.sg-hero__art` | 304 ms `img.sg-hero__art` | 316 ms `img.sg-hero__art` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 804 ms | 688 ms | 1036 ms | 1000 ms |
| DOMContentLoaded (throttled) | 412 ms | 796 ms | 439 ms | 929 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 3, longest 216.6 ms | 5, longest 83.3 ms | 5, longest 133.4 ms | 3, longest 166.7 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 4 | 0 | 4 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 216.6 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 166.7 ms, 133.4 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](leo-390x844-first-view.webp), [1440x900 first view](leo-1440x900-first-view.webp)

## /learn/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0001 | 0.0001 (retake 0.0001) |
| LCP | 224 ms `img` | 224 ms `img` | 308 ms `img` | 332 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1120 ms | 1148 ms | 1308 ms | 1232 ms |
| DOMContentLoaded (throttled) | 779 ms | 810 ms | 792 ms | 1140 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 3, longest 100.1 ms | 1, longest 83.3 ms | 2, longest 166.7 ms | 3, longest 166.7 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 8 | 0 | 8 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 100.1 ms without marks
- 1440x900 cls: FAIL, 0.0001, retake 0.0001
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 166.7 ms, 166.7 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](learn-390x844-first-view.webp), [1440x900 first view](learn-1440x900-first-view.webp)

