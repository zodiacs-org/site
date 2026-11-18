# Motion evidence

- Before: http://127.0.0.1:4391
- After: http://127.0.0.1:4401
- Generated: 2026-11-17T19:09:14.695Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 2 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /retrogrades/ 390x844 longFrames: longest 66.7 ms, 50 ms without marks
- /mercury-retrograde/ 390x844 longFrames: longest 66.7 ms, 50 ms without marks

## /transits/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.206% |  | 2.641%, height changed: 4291 to 4344 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 212 ms `p` | 132 ms `p` | 296 ms `p` | 288 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1056 ms | 1092 ms | 1228 ms | 1212 ms |
| DOMContentLoaded (throttled) | 1045 ms | 1199 ms | 1206 ms | 1105 ms |
| First mark shown (throttled) | 1132 ms (+76 after paint) | 1171 ms (+79 after paint) | 1260 ms (+32 after paint) | 1101 ms (+-111 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.7 ms | 2, longest 83.3 ms | 1, longest 100 ms | 3, longest 150 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 2 | 0 | 2 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 66.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 150 ms, 100 ms without marks

Sheets: [390x844 first view](transits-390x844-first-view.webp), [1440x900 first view](transits-1440x900-first-view.webp)

## /eclipses/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.105% |  | 2.056%, height changed: 5070 to 5123 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 132 ms `p` | 176 ms `p` | 216 ms `h1.display` | 180 ms `h1.display` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 924 ms | 932 ms | 988 ms | 1032 ms |
| DOMContentLoaded (throttled) | 693 ms | 701 ms | 699 ms | 720 ms |
| First mark shown (throttled) | 891 ms (+-33 after paint) | 952 ms (+20 after paint) | 1001 ms (+13 after paint) | 950 ms (+-82 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 83.4 ms | 1, longest 66.7 ms | 2, longest 83.4 ms | 2, longest 116.6 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 3 | 1 | 3 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 83.4 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 116.6 ms, 83.4 ms without marks

Sheets: [390x844 first view](eclipses-390x844-first-view.webp), [1440x900 first view](eclipses-1440x900-first-view.webp)

## /full-moon-calendar/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 5.096%, height changed: 13420 to 13456 px |  | 0.067% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 176 ms `p` | 180 ms `p` | 212 ms `p` | 180 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 948 ms | 980 ms | 1068 ms | 1060 ms |
| DOMContentLoaded (throttled) | 714 ms | 702 ms | 687 ms | 712 ms |
| First mark shown (throttled) | 913 ms (+-35 after paint) | 989 ms (+9 after paint) | 1008 ms (+-60 after paint) | 1054 ms (+-6 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.7 ms | 0, longest 50 ms | 2, longest 99.9 ms | 2, longest 83.3 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 3 | 1 | 3 |

Checks not passing:

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 99.9 ms without marks

Sheets: [390x844 first view](full-moon-calendar-390x844-first-view.webp), [1440x900 first view](full-moon-calendar-1440x900-first-view.webp)

## /retrogrades/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 4.933%, height changed: 10825 to 10861 px |  | 0.089% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 160 ms `strong.rx-now__line` | 172 ms `h1.display` | 220 ms `h1.display` | 268 ms `h1.display` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 948 ms | 1008 ms | 1108 ms | 1052 ms |
| DOMContentLoaded (throttled) | 698 ms | 707 ms | 704 ms | 703 ms |
| First mark shown (throttled) | 977 ms (+29 after paint) | 945 ms (+-63 after paint) | 1079 ms (+-29 after paint) | 942 ms (+-110 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 1, longest 66.7 ms | 3, longest 116.6 ms | 2, longest 100 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 2 | 0 | 2 |

Checks not passing:

- 390x844 longFrames: FAIL, longest 66.7 ms, 50 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 100 ms, 116.6 ms without marks

Sheets: [390x844 first view](retrogrades-390x844-first-view.webp), [1440x900 first view](retrogrades-1440x900-first-view.webp)

## /mercury-retrograde/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.140% |  | 0.125% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 160 ms `p` | 160 ms `p` | 228 ms `p` | 204 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 936 ms | 944 ms | 1008 ms | 1076 ms |
| DOMContentLoaded (throttled) | 689 ms | 688 ms | 666 ms | 689 ms |
| First mark shown (throttled) | 910 ms (+-26 after paint) | 884 ms (+-60 after paint) | 917 ms (+-91 after paint) | 1050 ms (+-26 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 2, longest 66.7 ms | 3, longest 116.7 ms | 2, longest 100 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 3 | 1 | 3 |

Checks not passing:

- 390x844 longFrames: FAIL, longest 66.7 ms, 50 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 100 ms, 116.7 ms without marks

Sheets: [390x844 first view](mercury-retrograde-390x844-first-view.webp), [1440x900 first view](mercury-retrograde-1440x900-first-view.webp)

## /void-of-course-moon/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.128% |  | 0.088% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 124 ms `p` | 144 ms `p` | 184 ms `span.nav__name` | 272 ms `h1.display` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1004 ms | 932 ms | 1108 ms | 1032 ms |
| DOMContentLoaded (throttled) | 930 ms | 754 ms | 779 ms | 754 ms |
| First mark shown (throttled) | none | 900 ms (+-32 after paint) | none | 928 ms (+-104 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.7 ms | 1, longest 66.7 ms | 3, longest 116.7 ms | 1, longest 83.3 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 2 | 0 | 2 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 66.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 116.7 ms without marks

Sheets: [390x844 first view](void-of-course-moon-390x844-first-view.webp), [1440x900 first view](void-of-course-moon-1440x900-first-view.webp)

