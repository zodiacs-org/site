# Motion evidence: baseline

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

