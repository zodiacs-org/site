# Motion evidence

- Before: http://127.0.0.1:4411
- After: http://127.0.0.1:4450
- Generated: 2026-11-22T01:56:23.280Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 1 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /learn/ 1440x900 cls: 0.0001, retake 0.0001

## /aries/ (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 216 ms `img.sg-hero__art` | 216 ms `img.sg-hero__art` | 320 ms `img.sg-hero__art` | 268 ms `img.sg-hero__art` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 648 ms | 612 ms | 860 ms | 816 ms |
| DOMContentLoaded (throttled) | 715 ms | 623 ms | 771 ms | 792 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 5, longest 83.3 ms | 2, longest 100 ms | 5, longest 116.7 ms | 5, longest 166.7 ms |
| Animated properties (marked) | none | none | none | none |
| Marked elements | 0 | 4 | 0 | 4 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 100 ms, 83.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 166.7 ms, 116.7 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](aries-390x844-first-view.webp), [1440x900 first view](aries-1440x900-first-view.webp)

## /leo/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 168 ms `img.sg-hero__art` | 168 ms `img.sg-hero__art` | 292 ms `img.sg-hero__art` | 276 ms `img.sg-hero__art` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 800 ms | 656 ms | 764 ms | 820 ms |
| DOMContentLoaded (throttled) | 774 ms | 773 ms | 700 ms | 724 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 1, longest 83.3 ms | 5, longest 83.4 ms | 5, longest 166.7 ms | 5, longest 133.4 ms |
| Animated properties (marked) | none | none | none | none |
| Marked elements | 0 | 4 | 0 | 4 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 83.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 133.4 ms, 166.7 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](leo-390x844-first-view.webp), [1440x900 first view](leo-1440x900-first-view.webp)

## /learn/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0001 | 0.0001 (retake 0.0001) |
| LCP | 192 ms `img` | 196 ms `img` | 296 ms `img` | 256 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1080 ms | 1032 ms | 1148 ms | 1216 ms |
| DOMContentLoaded (throttled) | 803 ms | 761 ms | 769 ms | 803 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 1, longest 83.4 ms | 1, longest 83.4 ms | 1, longest 83.3 ms | 2, longest 133.3 ms |
| Animated properties (marked) | none | none | none | none |
| Marked elements | 0 | 8 | 0 | 8 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 83.4 ms without marks
- 1440x900 cls: FAIL, 0.0001, retake 0.0001
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 83.3 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](learn-390x844-first-view.webp), [1440x900 first view](learn-1440x900-first-view.webp)

