# Motion evidence

- Before: http://127.0.0.1:4411
- After: http://127.0.0.1:4440
- Generated: 2026-11-22T01:41:25.662Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 2 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /eclipses/ 390x844 longFrames: longest 66.7 ms, 33.4 ms without marks
- /void-of-course-moon/ 390x844 longFrames: longest 66.7 ms, 50 ms without marks

## /transits/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.206% |  | 2.641%, height changed: 4291 to 4344 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 232 ms `p` | 140 ms `p` | 264 ms `p` | 316 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1024 ms | 1136 ms | 1236 ms | 1292 ms |
| DOMContentLoaded (throttled) | 1159 ms | 1198 ms | 1091 ms | 1336 ms |
| First mark shown (throttled) | 1265 ms (+241 after paint) | 1130 ms (+-6 after paint) | 1234 ms (+-2 after paint) | 1299 ms (+7 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 100 ms | 3, longest 150.1 ms | 2, longest 83.4 ms | 3, longest 83.3 ms |
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

- 390x844 longFrames: NOTE, runner too slow to judge: longest 150.1 ms, 100 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.4 ms without marks

Sheets: [390x844 first view](transits-390x844-first-view.webp), [1440x900 first view](transits-1440x900-first-view.webp)

## /eclipses/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.105% |  | 2.056%, height changed: 5070 to 5123 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 148 ms `p` | 140 ms `p` | 192 ms `h1.display` | 180 ms `h1.display` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 908 ms | 904 ms | 932 ms | 932 ms |
| DOMContentLoaded (throttled) | 710 ms | 676 ms | 640 ms | 695 ms |
| First mark shown (throttled) | 903 ms (+-5 after paint) | 915 ms (+11 after paint) | 843 ms (+-89 after paint) | 865 ms (+-67 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 33.4 ms | 1, longest 66.7 ms | 2, longest 83.3 ms | 2, longest 66.7 ms |
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

- 390x844 longFrames: FAIL, longest 66.7 ms, 33.4 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 83.3 ms without marks

Sheets: [390x844 first view](eclipses-390x844-first-view.webp), [1440x900 first view](eclipses-1440x900-first-view.webp)

## /full-moon-calendar/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 5.095%, height changed: 13420 to 13456 px |  | 0.067% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 172 ms `p` | 124 ms `p` | 188 ms `p` | 176 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 900 ms | 932 ms | 964 ms | 956 ms |
| DOMContentLoaded (throttled) | 707 ms | 738 ms | 690 ms | 700 ms |
| First mark shown (throttled) | 939 ms (+39 after paint) | 906 ms (+-26 after paint) | 863 ms (+-101 after paint) | 877 ms (+-79 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 33.4 ms | 0, longest 33.4 ms | 2, longest 100 ms | 2, longest 83.3 ms |
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

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 100 ms without marks

Sheets: [390x844 first view](full-moon-calendar-390x844-first-view.webp), [1440x900 first view](full-moon-calendar-1440x900-first-view.webp)

## /retrogrades/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 4.934%, height changed: 10825 to 10861 px |  | 0.089% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 124 ms `strong.rx-now__line` | 124 ms `h1.display` | 172 ms `h1.display` | 160 ms `h1.display` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 916 ms | 884 ms | 1008 ms | 1008 ms |
| DOMContentLoaded (throttled) | 707 ms | 678 ms | 721 ms | 680 ms |
| First mark shown (throttled) | 904 ms (+-12 after paint) | 901 ms (+17 after paint) | 922 ms (+-86 after paint) | 973 ms (+-35 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.6 ms | 0, longest 50 ms | 2, longest 83.2 ms | 2, longest 66.7 ms |
| Animated properties (marked) | opacity, transform | opacity, transform | opacity, transform | opacity, transform |
| Marked elements | 8 | 9 | 8 | 9 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 2 | 4 | 2 | 4 |

Checks not passing:

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 83.2 ms without marks

Sheets: [390x844 first view](retrogrades-390x844-first-view.webp), [1440x900 first view](retrogrades-1440x900-first-view.webp)

## /mercury-retrograde/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.140% |  | 0.125% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 124 ms `p` | 116 ms `p` | 180 ms `p` | 168 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 904 ms | 872 ms | 928 ms | 920 ms |
| DOMContentLoaded (throttled) | 691 ms | 694 ms | 682 ms | 698 ms |
| First mark shown (throttled) | 901 ms (+-3 after paint) | 854 ms (+-18 after paint) | 845 ms (+-83 after paint) | 885 ms (+-35 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 0, longest 49.9 ms | 2, longest 66.7 ms | 2, longest 66.7 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 1 | 2 | 1 | 2 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 3 | 1 | 3 |

Checks not passing:

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 66.7 ms without marks

Sheets: [390x844 first view](mercury-retrograde-390x844-first-view.webp), [1440x900 first view](mercury-retrograde-1440x900-first-view.webp)

## /void-of-course-moon/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.127% |  | 0.088% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 140 ms `p.voc-now__text` | 132 ms `p.voc-now__text` | 192 ms `p.voc-now__text` | 180 ms `p.voc-now__text` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 912 ms | 912 ms | 996 ms | 964 ms |
| DOMContentLoaded (throttled) | 745 ms | 744 ms | 736 ms | 875 ms |
| First mark shown (throttled) | none | 898 ms (+-14 after paint) | none | 917 ms (+-47 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 1, longest 66.7 ms | 2, longest 83.4 ms | 2, longest 83.4 ms |
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
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 83.4 ms without marks

Sheets: [390x844 first view](void-of-course-moon-390x844-first-view.webp), [1440x900 first view](void-of-course-moon-1440x900-first-view.webp)

