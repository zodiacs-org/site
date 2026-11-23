> 23 Nov 2026: describes the state before the independent review. No longer true: event pages are no longer marked (no `aside.next-action` entrance, no `<Motion />`); /people/ marks 98 cards, not 104 (the first 6 never wait), and a name search shows every card at once. See the PR #1107 body, "After independent review, 23 Nov".

# Motion evidence

- Before: http://127.0.0.1:4411
- After: http://127.0.0.1:4460
- Generated: 2026-11-22T02:02:05.794Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 3 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- /events/ 390x844 longFrames: longest 133.3 ms, 50 ms without marks
- /events/jupiter-trine-saturn-2027-04-03/ 390x844 longFrames: longest 66.6 ms, 33.3 ms without marks
- /seasons/ 1440x900 cls: 0.0153

## /events/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 208 ms `p` | 176 ms `p` | 216 ms `p` | 236 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1124 ms | 1084 ms | 1268 ms | 1112 ms |
| DOMContentLoaded (throttled) | 788 ms | 717 ms | 771 ms | 728 ms |
| First mark shown (throttled) | 1087 ms (+-37 after paint) | 1046 ms (+-38 after paint) | 1139 ms (+-129 after paint) | 1029 ms (+-83 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 50 ms | 3, longest 133.3 ms | 2, longest 383.4 ms | 2, longest 66.7 ms |
| Animated properties (marked) | none | transform | none | transform |
| Marked elements | 0 | 8 | 0 | 8 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 1 | 1 | 1 | 1 |

Checks not passing:

- 390x844 longFrames: FAIL, longest 133.3 ms, 50 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 383.4 ms without marks

Sheets: [390x844 first view](events-390x844-first-view.webp), [1440x900 first view](events-1440x900-first-view.webp)

## /events/jupiter-trine-saturn-2027-04-03/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 124 ms `p` | 128 ms `p` | 160 ms `p` | 172 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 876 ms | 896 ms | 972 ms | 980 ms |
| DOMContentLoaded (throttled) | 661 ms | 680 ms | 694 ms | 695 ms |
| First mark shown (throttled) | 902 ms (+26 after paint) | 889 ms (+-7 after paint) | 940 ms (+-32 after paint) | 901 ms (+-79 after paint) |
| Long frames > 50 ms (4x CPU) | 0, longest 33.3 ms | 1, longest 66.6 ms | 3, longest 83.3 ms | 2, longest 83.4 ms |
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

- 390x844 longFrames: FAIL, longest 66.6 ms, 33.3 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.4 ms, 83.3 ms without marks

Sheets: [390x844 first view](events-jupiter-trine-saturn-2027-04-03-390x844-first-view.webp), [1440x900 first view](events-jupiter-trine-saturn-2027-04-03-1440x900-first-view.webp)

## /seasons/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0153 | 0.0153 |
| LCP | 144 ms `p` | 128 ms `p` | 232 ms `p` | 272 ms `p` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 920 ms | 900 ms | 1056 ms | 1044 ms |
| DOMContentLoaded (throttled) | 731 ms | 734 ms | 752 ms | 757 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 0, longest 33.3 ms | 0, longest 50 ms | 2, longest 83.3 ms | 2, longest 83.3 ms |
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
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 83.3 ms without marks

Sheets: [390x844 first view](seasons-390x844-first-view.webp), [1440x900 first view](seasons-1440x900-first-view.webp)

## /seasons/aries/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 152 ms `img` | 140 ms `img` | 212 ms `img` | 224 ms `img` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 1080 ms | 1056 ms | 1136 ms | 1220 ms |
| DOMContentLoaded (throttled) | 1369 ms | 1342 ms | 1779 ms | 2048 ms |
| First mark shown (throttled) | none | none | none | none |
| Long frames > 50 ms (4x CPU) | 2, longest 66.7 ms | 2, longest 83.3 ms | 1, longest 99.9 ms | 2, longest 100 ms |
| Animated properties (marked) | none | transform | none | transform |
| Marked elements | 0 | 12 | 0 | 12 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 0 | 0 |

Checks not passing:

- 390x844 longFrames: NOTE, runner too slow to judge: longest 83.3 ms, 66.7 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 100 ms, 99.9 ms without marks

Notes:

- after 390x844: no element gained is-in during the throttled load; the long-frame window starts at first paint
- after 1440x900: no element gained is-in during the throttled load; the long-frame window starts at first paint

Sheets: [390x844 first view](seasons-aries-390x844-first-view.webp), [1440x900 first view](seasons-aries-1440x900-first-view.webp)

## /people/ (rest: changed)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| LCP | 188 ms `p.people-page__lede` | 164 ms `p.people-page__lede` | 260 ms `p.people-page__lede` | 244 ms `p.people-page__lede` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 904 ms | 940 ms | 1008 ms | 716 ms |
| DOMContentLoaded (throttled) | 912 ms | 929 ms | 907 ms | 990 ms |
| First mark shown (throttled) | none | 948 ms (+8 after paint) | none | 984 ms (+268 after paint) |
| Long frames > 50 ms (4x CPU) | 1, longest 66.6 ms | 1, longest 66.7 ms | 2, longest 83.3 ms | 2, longest 66.6 ms |
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

- 390x844 longFrames: NOTE, runner too slow to judge: longest 66.7 ms, 66.6 ms without marks
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 66.6 ms, 83.3 ms without marks

Sheets: [390x844 first view](people-390x844-first-view.webp), [1440x900 first view](people-1440x900-first-view.webp)

