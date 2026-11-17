# Motion evidence

- Before: http://127.0.0.1:4391
- After: http://127.0.0.1:4401
- Generated: 2026-11-17T18:57:42.283Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 7 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /big-three/ 390x844 rest: 0.241% differs (limit 0.1%)
- /big-three/ 1440x900 longFrames: longest 116.6 ms, 33.3 ms without marks
- /big-three/ 1440x900 rest: 0.208% differs (limit 0.1%)
- /rising-sign/ 1440x900 longFrames: longest 166.7 ms, 49.9 ms without marks
- /solar-return/ 1440x900 longFrames: longest 99.9 ms, 50 ms without marks
- /lunar-return/ 390x844 cls: 0.0005, retake 0.0005
- /saturn-return/ 1440x900 longFrames: longest 83.2 ms, 50 ms without marks

## /big-three/ (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.241% |  | 0.208% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 172 ms `p` | 172 ms `p` | 268 ms `p` | 272 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1064 ms | 1044 ms | 1136 ms | 1228 ms |
| DOMContentLoaded (throttled) | 805 ms | 759 ms | 825 ms | 812 ms |
| First mark shown (throttled) | none | 1037 ms (+-7 after paint) | none | 1110 ms (+-118 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 50.1 ms | 0, longest 50 ms | 0, longest 33.3 ms | 1, longest 116.6 ms |
| Animated properties (marked) | none | opacity, transform | none | opacity, transform |
| Marked elements | 0 | 1 | 0 | 1 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | 720 px | 720 px | 768 px | 768 px |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 2 | 0 | 2 |

Checks not passing:

- 390x844 rest: FAIL, 0.241% differs (limit 0.1%)
- 1440x900 longFrames: FAIL, longest 116.6 ms, 33.3 ms without marks
- 1440x900 rest: FAIL, 0.208% differs (limit 0.1%)

Sheets: [390x844 first view](big-three-390x844-first-view.webp), [1440x900 first view](big-three-1440x900-first-view.webp)

## /moon-sign/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 6.078%, height changed: 4185 to 4221 px |  | 2.111%, height changed: 4041 to 4074 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 168 ms `p` | 212 ms `p` | 288 ms `p` | 272 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1100 ms | 1076 ms | 1132 ms | 1232 ms |
| DOMContentLoaded (throttled) | 1145 ms | 1101 ms | 1173 ms | 1249 ms |
| First mark shown (throttled) | none | 1055 ms (+-21 after paint) | none | 1225 ms (+-7 after paint) |
| Long frames > 50 ms (4x CPU) | 2, longest 83.3 ms | 2, longest 66.7 ms | 1, longest 216.6 ms | 2, longest 133.4 ms |
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

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 83.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 133.4 ms, 216.6 ms without marks

Sheets: [390x844 first view](moon-sign-390x844-first-view.webp), [1440x900 first view](moon-sign-1440x900-first-view.webp)

## /rising-sign/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 10.490%, height changed: 8177 to 8218 px |  | 6.513%, height changed: 5673 to 5737 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 184 ms `p.klede.rs-lede` | 180 ms `p.klede.rs-lede` | 420 ms `img` | 376 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1464 ms | 1260 ms | 1492 ms | 1480 ms |
| DOMContentLoaded (throttled) | 800 ms | 1415 ms | 790 ms | 754 ms |
| First mark shown (throttled) | none | 1298 ms (+38 after paint) | none | 1347 ms (+-133 after paint) |
| Long frames > 50 ms (4x CPU) | 2, longest 99.9 ms | 3, longest 183.4 ms | 0, longest 49.9 ms | 4, longest 166.7 ms |
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

- 390x844 longFrames: NOTE, runner too slow to judge: longest 183.4 ms, 99.9 ms without marks
- 1440x900 longFrames: FAIL, longest 166.7 ms, 49.9 ms without marks

Sheets: [390x844 first view](rising-sign-390x844-first-view.webp), [1440x900 first view](rising-sign-1440x900-first-view.webp)

## /solar-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.650% |  | 0.303% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 164 ms `p` | 120 ms `p` | 200 ms `p` | 228 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1072 ms | 1016 ms | 1088 ms | 1084 ms |
| DOMContentLoaded (throttled) | 1069 ms | 811 ms | 788 ms | 774 ms |
| First mark shown (throttled) | none | 1036 ms (+20 after paint) | none | 1004 ms (+-80 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 49.9 ms | 0, longest 33.4 ms | 0, longest 50 ms | 2, longest 99.9 ms |
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

- 1440x900 longFrames: FAIL, longest 99.9 ms, 50 ms without marks

Sheets: [390x844 first view](solar-return-390x844-first-view.webp), [1440x900 first view](solar-return-1440x900-first-view.webp)

## /lunar-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.552% |  | 0.272% |
| CLS (load + scroll) | 0.0005 | 0.0005 (retake 0.0005) | 0.0000 | 0.0000 |
| LCP | 144 ms `p` | 136 ms `p` | 256 ms `p` | 216 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 496 ms | 492 ms | 596 ms | 636 ms |
| DOMContentLoaded (throttled) | 715 ms | 709 ms | 736 ms | 881 ms |
| First mark shown (throttled) | none | 643 ms (+151 after paint) | none | 918 ms (+282 after paint) |
| Long frames > 50 ms (4x CPU) | 2, longest 83.4 ms | 1, longest 83.3 ms | 7, longest 149.9 ms | 2, longest 116.7 ms |
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

- 390x844 cls: FAIL, 0.0005, retake 0.0005
- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.4 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 116.7 ms, 149.9 ms without marks

Sheets: [390x844 first view](lunar-return-390x844-first-view.webp), [1440x900 first view](lunar-return-1440x900-first-view.webp)

## /saturn-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 7.091%, height changed: 4123 to 4159 px |  | 0.228% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 168 ms `p` | 188 ms `p` | 240 ms `p` | 280 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1108 ms | n/a | 1144 ms | 1116 ms |
| DOMContentLoaded (throttled) | 797 ms | 777 ms | 823 ms | 805 ms |
| First mark shown (throttled) | none | 1050 ms (+1050 after paint) | none | 1033 ms (+-83 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 100 ms | 0, longest 33.3 ms | 0, longest 50 ms | 2, longest 83.2 ms |
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

- 1440x900 longFrames: FAIL, longest 83.2 ms, 50 ms without marks

Sheets: [390x844 first view](saturn-return-390x844-first-view.webp), [1440x900 first view](saturn-return-1440x900-first-view.webp)

