> 23 Nov 2026: describes the floated mark before the independent review. No longer true: the mark's 72px and 112px sizes, the headings and intros wrapping around it, and the form or answer card moving down (up to 80 px). The mark now sits out of the text flow and nothing moves; see the PR #1108 body, "After independent review, 23 Nov".

# Motion evidence

- Before: http://127.0.0.1:4411
- After: http://127.0.0.1:4440
- Generated: 2026-11-22T01:36:45.824Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 5 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /big-three/ 390x844 longFrames: longest 66.6 ms, 16.8 ms without marks
- /big-three/ 390x844 rest: 0.241% differs (limit 0.1%)
- /big-three/ 1440x900 rest: 0.208% differs (limit 0.1%)
- /rising-sign/ 1440x900 longFrames: longest 116.6 ms, 49.9 ms without marks
- /lunar-return/ 390x844 cls: 0.0005, retake 0.0005

## /big-three/ (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.241% |  | 0.208% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 180 ms `p` | 132 ms `p` | 228 ms `p` | 264 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1144 ms | 1036 ms | 1164 ms | 1168 ms |
| DOMContentLoaded (throttled) | 817 ms | 797 ms | 862 ms | 843 ms |
| First mark shown (throttled) | none | 1074 ms (+38 after paint) | none | 1040 ms (+-128 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 16.8 ms | 1, longest 66.6 ms | 1, longest 66.6 ms | 2, longest 150 ms |
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

- 390x844 longFrames: FAIL, longest 66.6 ms, 16.8 ms without marks
- 390x844 rest: FAIL, 0.241% differs (limit 0.1%)
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 150 ms, 66.6 ms without marks
- 1440x900 rest: FAIL, 0.208% differs (limit 0.1%)

Sheets: [390x844 first view](big-three-390x844-first-view.webp), [1440x900 first view](big-three-1440x900-first-view.webp)

## /moon-sign/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 6.078%, height changed: 4185 to 4221 px |  | 2.111%, height changed: 4041 to 4074 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 184 ms `p` | 168 ms `p` | 304 ms `p` | 296 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1040 ms | 1036 ms | 1108 ms | 1156 ms |
| DOMContentLoaded (throttled) | 1129 ms | 1025 ms | 1163 ms | 1073 ms |
| First mark shown (throttled) | none | 1006 ms (+-30 after paint) | none | 1037 ms (+-119 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 83.3 ms | 2, longest 83.3 ms | 2, longest 133.4 ms | 2, longest 166.7 ms |
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

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 166.7 ms, 133.4 ms without marks

Sheets: [390x844 first view](moon-sign-390x844-first-view.webp), [1440x900 first view](moon-sign-1440x900-first-view.webp)

## /rising-sign/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 10.490%, height changed: 8177 to 8218 px |  | 6.513%, height changed: 5673 to 5737 px |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 120 ms `p.klede.rs-lede` | 112 ms `p.klede.rs-lede` | 328 ms `img` | 352 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1220 ms | 1188 ms | 1412 ms | 1204 ms |
| DOMContentLoaded (throttled) | 793 ms | 768 ms | 918 ms | 778 ms |
| First mark shown (throttled) | none | 1167 ms (+-21 after paint) | none | 1073 ms (+-131 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.6 ms | 0, longest 33.4 ms | 0, longest 49.9 ms | 2, longest 116.6 ms |
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

- 1440x900 longFrames: FAIL, longest 116.6 ms, 49.9 ms without marks

Sheets: [390x844 first view](rising-sign-390x844-first-view.webp), [1440x900 first view](rising-sign-1440x900-first-view.webp)

## /solar-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.650% |  | 0.303% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 144 ms `p` | 148 ms `p` | 208 ms `p` | 252 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1020 ms | n/a | 1072 ms | 1048 ms |
| DOMContentLoaded (throttled) | 802 ms | 765 ms | 772 ms | 776 ms |
| First mark shown (throttled) | none | 1031 ms (+1031 after paint) | none | 951 ms (+-97 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.6 ms | 0, longest 33.4 ms | 1, longest 83.4 ms | 1, longest 99.9 ms |
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

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 99.9 ms, 83.4 ms without marks

Sheets: [390x844 first view](solar-return-390x844-first-view.webp), [1440x900 first view](solar-return-1440x900-first-view.webp)

## /lunar-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.552% |  | 0.272% |
| CLS (load + scroll) | 0.0005 | 0.0005 (retake 0.0005) | 0.0000 | 0.0000 |
| LCP | 128 ms `p` | 132 ms `p` | 228 ms `p` | 224 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 480 ms | 472 ms | 704 ms | 632 ms |
| DOMContentLoaded (throttled) | 625 ms | 711 ms | 699 ms | 834 ms |
| First mark shown (throttled) | none | 556 ms (+84 after paint) | none | 831 ms (+199 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.6 ms | 2, longest 83.4 ms | 2, longest 150 ms | 5, longest 116.7 ms |
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
- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 66.6 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 116.7 ms, 150 ms without marks

Sheets: [390x844 first view](lunar-return-390x844-first-view.webp), [1440x900 first view](lunar-return-1440x900-first-view.webp)

## /saturn-return/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 7.091%, height changed: 4123 to 4159 px |  | 0.228% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 192 ms `p` | 164 ms `p` | 284 ms `p` | 280 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 900 ms | 1004 ms | 1116 ms | 1120 ms |
| DOMContentLoaded (throttled) | 732 ms | 783 ms | 782 ms | 798 ms |
| First mark shown (throttled) | none | 1033 ms (+29 after paint) | none | 1001 ms (+-119 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 0, longest 33.3 ms | 1, longest 100 ms | 1, longest 100 ms |
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

- 1440x900 longFrames: NOTE, runner too slow to judge: longest 100 ms, 100 ms without marks

Sheets: [390x844 first view](saturn-return-390x844-first-view.webp), [1440x900 first view](saturn-return-1440x900-first-view.webp)

