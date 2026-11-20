# Motion evidence

- Before: http://127.0.0.1:4391
- After: http://127.0.0.1:4403
- Generated: 2026-11-17T18:24:24.690Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 2 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /events/jupiter-trine-saturn-2027-04-03/ 390x844 longFrames: longest 66.6 ms, 50 ms without marks
- /seasons/ 1440x900 cls: 0.0153

## /events/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 268 ms `p` | 192 ms `p` | 248 ms `p` | 244 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1172 ms | 1364 ms | 1152 ms | 1188 ms |
| DOMContentLoaded (throttled) | 706 ms | 754 ms | 735 ms | 719 ms |
| First mark shown (throttled) | 1132 ms (+-40 after paint) | 1455 ms (+91 after paint) | 1049 ms (+-103 after paint) | 1312 ms (+124 after paint) |
| Long frames > 50 ms (4x CPU) | 2, longest 83.3 ms | 1, longest 83.3 ms | 3, longest 83.3 ms | 1, longest 100 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 8 | 0 | 8 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 1 | 1 | 1 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 100 ms, 83.3 ms without marks

Sheets: [390x844 first view](events-390x844-first-view.webp), [1440x900 first view](events-1440x900-first-view.webp)

## /events/jupiter-trine-saturn-2027-04-03/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 176 ms `p` | 172 ms `p` | 208 ms `p` | 192 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 992 ms | 904 ms | 980 ms | 952 ms |
| DOMContentLoaded (throttled) | 695 ms | 667 ms | 686 ms | 703 ms |
| First mark shown (throttled) | 1040 ms (+48 after paint) | 877 ms (+-27 after paint) | 908 ms (+-72 after paint) | 935 ms (+-17 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 2, longest 66.6 ms | 2, longest 150 ms | 2, longest 66.7 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: FAIL, longest 66.6 ms, 50 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 150 ms without marks

Sheets: [390x844 first view](events-jupiter-trine-saturn-2027-04-03-390x844-first-view.webp), [1440x900 first view](events-jupiter-trine-saturn-2027-04-03-1440x900-first-view.webp)

## /seasons/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0153 |
| LCP | 180 ms `p` | 168 ms `p` | 304 ms `p` | 284 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1020 ms | 948 ms | 1172 ms | 1028 ms |
| DOMContentLoaded (throttled) | 803 ms | 765 ms | 781 ms | 754 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 1, longest 50.1 ms | 0, longest 33.4 ms | 1, longest 233.3 ms | 4, longest 83.4 ms |
| Animated properties (marked) | none | none | none | none |
| Marked elements | 0 | 0 | 0 | 0 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 1440x900 cls: FAIL, 0.0153
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 233.3 ms without marks

Sheets: [390x844 first view](seasons-390x844-first-view.webp), [1440x900 first view](seasons-1440x900-first-view.webp)

## /seasons/aries/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0001 | 0.0000 | 0.0002 | 0.0000 |
| LCP | 212 ms `img` | 232 ms `img` | 336 ms `img` | 312 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1108 ms | 1088 ms | 1352 ms | 1184 ms |
| DOMContentLoaded (throttled) | 1551 ms | 1502 ms | 2175 ms | 2114 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 2, longest 116.7 ms | 3, longest 133.3 ms | 2, longest 100 ms | 4, longest 183.2 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 12 | 0 | 12 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 116.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 183.2 ms, 100 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](seasons-aries-390x844-first-view.webp), [1440x900 first view](seasons-aries-1440x900-first-view.webp)

## /people/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 208 ms `p.people-page__lede` | 168 ms `a.nav__chip` | 224 ms `span.nav__name` | 200 ms `span.nav__name` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 936 ms | 1008 ms | 1068 ms | 1008 ms |
| DOMContentLoaded (throttled) | 980 ms | 1019 ms | 893 ms | 920 ms |
| First mark shown (throttled) | none | 1069 ms (+61 after paint) | none | 958 ms (+-50 after paint) |
| Long frames > 50 ms (4x CPU) | 3, longest 133.3 ms | 4, longest 133.3 ms | 3, longest 66.7 ms | 4, longest 116.7 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 104 | 0 | 104 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 2 | 0 | 6 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 133.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 116.7 ms, 66.7 ms without marks

Sheets: [390x844 first view](people-390x844-first-view.webp), [1440x900 first view](people-1440x900-first-view.webp)

