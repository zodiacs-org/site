# Motion evidence

- Before: http://127.0.0.1:4411
- After: http://127.0.0.1:4421
- Generated: 2026-11-22T01:10:07.112Z
- Viewports: 390x844, 1440x900. Strip times: 0, 100, 200, 300, 440, 700, 1100, 1600, 2200 ms.
- Checks applied to the "after" build: 2 failing.

The 4x CPU and throttled-network numbers are a proxy, not a phone: headless Chromium on a shared machine with a slowed main thread and an emulated slow connection. Compare them between builds measured on the same machine, not against real devices.

How to read the numbers: CLS covers the load and a scroll through the page that starts at `load` (steps of 0.8 of the screen, 150 ms apart). Long frames count requestAnimationFrame gaps over 50 ms in the 2.5 s after the first element gains is-in (after first paint when none does). Hidden above after reload is measured with the scroll restore made instant. Rest diff compares full-page screenshots with every finite animation finished, infinite loops on their first frame, videos on their first frame and `Date` fixed to the run's start in both builds.

## Failing checks

- / 390x844 cls: 0.3445
- / 1440x900 cls: 0.4904

## / (rest: identical)

| | before 390x844 | after 390x844 | before 1440x900 | after 1440x900 |
|---|---|---|---|---|
| Rest diff |  | 0.000% |  | 0.000% |
| CLS (load + scroll) | 0.3440 | 0.3445 | 1.0301 | 0.4904 |
| LCP | 236 ms `img.hero__poster` | 292 ms `img.hero__poster` | 384 ms `img.hero__poster` | 388 ms `img.hero__poster` |
| LCP element marked | false | false | false | false |
| First paint (throttled) | 524 ms | 480 ms | 648 ms | 644 ms |
| DOMContentLoaded (throttled) | 1322 ms | 1288 ms | 1360 ms | 1386 ms |
| First mark shown (throttled) | 1369 ms (+845 after paint) | 1401 ms (+921 after paint) | 1369 ms (+721 after paint) | 1404 ms (+760 after paint) |
| Long frames > 50 ms (4x CPU) | 3, longest 216.6 ms | 2, longest 133.3 ms | 5, longest 166.6 ms | 6, longest 233.4 ms |
| Animated properties (marked) | none | none | none | none |
| Marked elements | 0 | 16 | 0 | 16 |
| Nested marks | 0 | 0 | 0 | 0 |
| html has is-in | false | false | false | false |
| Hidden above after reload | 0 | 0 | 0 | 0 |
| Primary action top | n/a | n/a | n/a | n/a |
| Reduced motion | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque | 0 running, 0 not opaque |
| No script | 0 not opaque | 0 not opaque | 0 not opaque | 0 not opaque |
| Animations in first-view strip | 0 | 0 | 1 | 1 |

Checks not passing:

- 390x844 cls: FAIL, 0.3445
- 390x844 longFrames: NOTE, runner too slow to judge: longest 133.3 ms, 216.6 ms without marks
- 1440x900 cls: FAIL, 0.4904
- 1440x900 longFrames: NOTE, runner too slow to judge: longest 233.4 ms, 166.6 ms without marks

Loops (never paused, sought or waited for): before: hero-poster-drift on img.hero__poster; looping video on video.hero__video.is-playing. after: hero-poster-drift on img.hero__poster; looping video on video.hero__video.is-playing.

Sheets: [390x844 first view](home-390x844-first-view.webp), [1440x900 first view](home-1440x900-first-view.webp)

