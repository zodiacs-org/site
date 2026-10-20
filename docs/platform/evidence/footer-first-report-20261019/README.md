# The footer stylesheet's request on /es/learn/ (F-98)

From 2026-10-18 Site Check's I18n route-boundary regression
(`tests/i18n-r0-drive.mjs`) failed now and then on /es/learn/:

```
- /es/learn/: near-viewport footer CSS waited for window load
- /es/learn/: footer CSS waited for the post-load fallback (null >= 45.5 + 250)
```

| Site Check run | head | at (UTC) | logged |
| --- | --- | --- | --- |
| 39103684996, attempt 1 | #775, `86880ff5` | 2026-10-18 06:41 | `null >= 45.5 + 250` |
| 39159775076 | main, `cb4b0a5e` (#783) | 2026-10-18 20:02 | `null >= 37.9000000001397 + 250` |
| 39211508684, attempt 1 | #784, `81715925` | 2026-10-19 07:03 | `null >= 45.39999999990687 + 250` |
| 39224024706, attempt 1 | #781, `ce9e7423` | 2026-10-19 08:53 | `null >= 38.29999999993015 + 250` |

## What changed

#775 (merged as `bf2e7e5b`) brought `192b43ba`: the footer loader in
`src/layouts/Base.astro` stopped reading the footer's position while the page
parses and learns it from its IntersectionObserver's first report, which
Chromium computes in the first frame after the loader observes the footer.
/es/learn/ built at `e7ad9dfc` (main before #775) and at `bf2e7e5b` differs
only in that loader. At `5b5e17ab` (#780) and `cb4b0a5e` (#783) the page is
the same file as at `bf2e7e5b`; #785 and #787 changed only its stylesheet,
`/_astro/Base.*.css` (69,520 bytes at `bf2e7e5b`, 73,147 at `ac378d5d`,
73,232 at `a353c2b2`).

## Why the drive found no request

A Chrome trace of a failing load (Google Chrome 155.0.8059.80, macOS arm64,
`astro preview`; milliseconds from navigation start):

| ms | |
| --- | --- |
| 9.4 | the parser stops at the navigation's first classic script, which waits for the render-blocking `/_astro/Base.*.css` |
| 14.1 | the stylesheet is parsed and the script runs |
| 15.4–20.3 | the first frame lays out and paints what is parsed so far, the navigation; no observer exists yet |
| 20.4–22.3 | the parser reads `<main>`, the footer and the loader, which observes the footer |
| 22.6 | DOMContentLoaded; nothing is left to load, so window load follows at 23.6 |
| 30.1 | the drive reads the page: no request |
| 31.2 | the next frame computes the observer's first report: the footer is near |
| 34.8 | the loader requests the stylesheet |

In a passing load the first frame began at 17.1 ms, after the loader had run at
17.0, so the report came from that frame and the request at 27.0 ms, just
after window load at 26.6 and before the drive's read at 42.2. Which of the
two happens depends on where Chromium's frame clock stands when the
stylesheet arrives.

## Measurements

`tools/footer-timing-probe.mjs` loads a page 40 times in fresh 1280×900
pages, as the drive does, and records DOMContentLoaded, window load and the
request, and whether a read right after DOMContentLoaded (the drive's read
before F-98) finds the request. The two older builds left out the two daily
freshness steps, their editions being a day old.

| build | the read finds the request | request before DOMContentLoaded | request after window load |
| --- | --- | --- | --- |
| `e7ad9dfc` (main before #775) | 40 / 40 | 40 | 0 |
| `bf2e7e5b` (#775) | 22 / 40 | 0 | 40 |
| `a353c2b2` (main, 2026-10-19) | 19 / 40 | 0 | 40 |

## The fix

The loader is unchanged: on a page with nothing left to load, a request a
frame after window load is what `192b43ba` chose over reading the footer's
position while the page parses, and the footer stays hidden until its styles
apply. The drive now waits for the loader's decision (the stylesheet link, or
a distant footer's hold dropped) before it reads the page:

- with the page's font requests held open, window load cannot fire, and the
  request must come before it, which only the observer's report can then
  make;
- with nothing held, the request must come before the post-load fallback
  (window load + 250 ms), as before.

On `a353c2b2`'s build the drive passed 10 of 10 runs; before the change it
had failed 1 of 5 there. Two controls on that build changed the loader in the
built `dist/es/learn/index.html` only: with the near footer judged distant,
so that only the post-load fallback requests the stylesheet, the drive fails
both checks; with the request moved to window load, it fails the first.

## Reproduce

```
npm run build
node docs/platform/evidence/footer-first-report-20261019/tools/footer-timing-probe.mjs /es/learn/ 40
```
