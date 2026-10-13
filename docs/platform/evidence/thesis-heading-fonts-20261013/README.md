# The first heading row on /thesis/ and its late fonts (F-93) — 2026-10-13

Site Check's Lighthouse gate failed /thesis/ on changes that do not touch it:
one sample in three measured a positive CLS that the table prints as 0.000.
This record reads the failing trace, reproduces the movement, and measures
the fix ([F-93](../../programme/FINDINGS.md#f-93--the-first-heading-row-on-thesis-moved-when-its-late-fonts-arrived-minor-performance-fixed-here)).

## The failure

- main's post-merge Site Check for #730, [run 38381457494](https://github.com/zodiacs-org/site/actions/runs/38381457494)
  attempt 1, on `7d12c0f1`: `FAIL /thesis/ 97 100 100 2.42s 0.000 0ms`.
  Sample 2 measured CLS 0.00009151810136236585; samples 1 and 3 measured 0.
  Attempt 2 passed.
- #735's [run 38415921818](https://github.com/zodiacs-org/site/actions/runs/38415921818)
  attempt 1, on `f389384a`, failed the same way.
- Read here: the attempt-1 artifact `phase-1-browser-performance-38381457494`
  (id 11806292524, 159,445,992 bytes, SHA-256
  `d5df0751b306d1d22dead7d17ebe9684f59bc8aca9cd7c15a1d2e9b9f5af972f`),
  its three thesis reports and traces only.
  [`ci-38381457494-traces.txt`](ci-38381457494-traces.txt) is the output of
  [`tools/ci-trace-fonts.mjs`](tools/ci-trace-fonts.mjs) on them.

## What the traces show

Times are from navigation start. "Reveal script" is the inline script at the
end of the body (line 1362 of the built page) that adds `motion-ready`, which
hides each `.reveal` section until it scrolls into view.

| sample | 500 face | italic face | reveal script | first paint | shift |
| --- | --- | --- | --- | --- | --- |
| 1 | 96.2 → 134.2 | 116.8 → 145.8 | 82.8 | 181.4 | none |
| 2 | 121.2 → 177.7 | 136.3 → 178.7 | 185.3 | 227.5 | 195 ms, 0.0000915 |
| 3 | 115.8 → 168.5 | 135.7 → 169.2 | 154.9 | 206.6 | none |

The page preloads only EB Garamond's 400 face. The 500 face (the section
numerals and the essay rail's labels) and the italic face (the accents in the
section headings) are requested once the styles need them, 60–85 ms after
the preloads.
The first section's heading row sits at the bottom of Lighthouse's 412 × 823
viewport (y ≈ 788–823). In samples 1 and 3 the reveal script ran before those
faces arrived, so they replaced the fallback while the section was hidden. In
sample 2 the parser stopped at line 1360, and the page laid out and painted
the row, visible, in the fallback before the script ran. On CI's Ubuntu
runner that fallback is Liberation Serif, which the stack's `'Times New
Roman'` resolves to. When the two faces arrived, both of the row's text boxes
moved:

- the accent `span.it`, from `[39, 788, 264, 32]` to `[39, 788, 255, 29]`;
- the numeral `I` (`span.mov__no`, 500 face), from `[20, 802, 5, 10]` to
  `[20, 799, 5, 13]`.

The move is in the text boxes' height. EB Garamond's three faces all have
ascent 1.007 em and descent 0.298 em (hhea and OS/2 typo agree;
USE_TYPO_METRICS is set). Liberation Serif, like Times New Roman, has 0.891
and 0.216 em, and Georgia, macOS's fallback here, has 0.917 and 0.219 em.
At 25 px the accent's top moves 3 px with Liberation Serif and 2 px with
Georgia. Chrome marks the shift `had_recent_input` because Lighthouse's
emulated viewport changed at 7 ms, and Lighthouse counts such shifts within
500 ms of that change.

## The fix

`public/thesis/index.html` adds a local fallback family, `EB Garamond
Metrics`. It points at Georgia, Times New Roman, Liberation Serif and Noto
Serif, and at their italics, and gives them `ascent-override: 100.7%;
descent-override: 29.8%; line-gap-override: 0%`, EB Garamond's own values.
The family comes second in `--serif` and `--display`. Before a face arrives,
the page shows the same local font as before, but its text boxes now have EB
Garamond's height, so the swap no longer moves them. Requests, preloads and
`font-display` are unchanged. The hero sets its own Georgia stacks and is
unaffected.

## Measurements

### The lab

[`tools/font-race-lab.mjs`](tools/font-race-lab.mjs) loads the page in
Lighthouse's mobile viewport against `astro preview`. It holds the 500 and
italic faces back, records the heading row while they are held and after
they arrive, and logs every layout shift. `FALLBACK=times` removes Georgia
from the page's stacks so that the fallback is Times New Roman, which has
Liberation Serif's metrics. Main's page is served from main's build
(`HTML=`) against the same assets.

| condition | main `6af799c7` | this change |
| --- | --- | --- |
| essay visible from the first paint (reduced motion), Times New Roman, faces held 400 ms, 5 loads | shift 0.0000908 in 5 of 5 loads; numeral top 801.53 → 799.53, accent 787.53 → 784.53 | no shift in 5 loads; tops 799.53 and 784.53 while held and after |
| sample 2's order (CPU slowed 8×, default motion), Times New Roman, faces held 150 ms, 5 loads | accent shift 0.0000766–0.0000795 in 5 of 5 loads | no accent shift in 5 loads |
| essay visible, Georgia, faces held 400 ms, 3 loads | numeral moves 1 px, accent 2 px; Chrome reported no shift | tops unchanged; no shift |

Outputs: `lab-main-*.txt` and `lab-fix-*.txt`. Main's shift with Times New
Roman reports CI's rectangles to the pixel: `[38.83, 788, 263.94, 32]` →
`[38.83, 788, 254.94, 29]` here and `[39, 788, 264, 32]` →
`[39, 788, 255, 29]` on CI, as Liberation Serif's metric compatibility with
Times New Roman predicts. In the 8× rows, a separate
shift of the hero (0.082) appears on main and on this change alike; see
"Remaining".

### Lighthouse

The repository's script, `LIGHTHOUSE_ROUTES=thesis LIGHTHOUSE_RUNS=5 node
tests/visual/lighthouse.mjs`, ran four times per build on macOS arm64
(Lighthouse 13.4.1, HeadlessChrome 154). Per-sample values are in
[`lighthouse-samples.json`](lighthouse-samples.json), written by
[`tools/lighthouse-samples.mjs`](tools/lighthouse-samples.mjs).

| build | samples | CLS > 0 | LCP min / median / max | FCP median | performance |
| --- | --- | --- | --- | --- | --- |
| main `6af799c7` | 20 (1 more set aside for a runner stall) | 0 | 2.329 / 2.332 / 2.416 s | 1.507 s | 97–98 |
| this change | 20 | 0 | 2.329 / 2.334 / 2.416 s | 1.508 s | 97–98 |
| not adopted: preload the italic, `swap` | 10 | 0 | 2.328 / 2.330 / 2.410 s | 1.354 s | 98 |
| not adopted: preload the italic, `optional` | 10 | 0 | 2.328 / 2.328 / 2.332 s | 1.353 s | 98 |
| not adopted: the italic `optional`, no preload | 10 | 0 | 2.328 / 2.329 / 2.407 s | 1.504 s | 97–98 |
| CI, run 38381457494 attempt 1 (main `7d12c0f1`) | 3 | 1 (0.0000915) | 2.408 / 2.411 / 2.416 s | 1.505 s | 97 |

On macOS the fallback is Georgia and the italic always arrived before the
first paint, so these runs measure CLS 0 before and after. What they show is
that the change costs nothing: LCP and FCP are as on main. The movement
itself is measured by the lab and by the drive below, and on Linux by CI's
Lighthouse step on this change.

Preloading the italic did not raise LCP here; it lowered simulated FCP by
about 150 ms. With `swap`, though, a preload only narrows the race: in the
lab a preloaded face held back still moved the accent. With `optional`, the
whole page's italic would stay in the fallback for the rest of the visit
whenever the face arrived late. The page dropped its 500 and italic preloads
on 2026-10-09 while bringing LCP back under 2.50 s
([record](../thesis-poster-loading-20261009/README.md)).

### The regression test

`tests/thesis-qa-drive.mjs` now holds only the 500 and italic faces at 390,
412, 810 and 1440 px, with reduced motion so that the essay stays visible and
untransformed. It requires the first heading row's numeral, accent and rail
label to keep their top and height when the faces arrive.

- This change: all 246 checks pass ([`drive-this-change.txt`](drive-this-change.txt)).
- Control, with main's built page served in place of this change's: the four
  new checks fail (numeral 871.375 → 870.375 with height 11 → 13, accent 2–3
  px) and the other 242 pass
  ([`drive-main-page-control.txt`](drive-main-page-control.txt)).

## Remaining

- The 400 face is preloaded, and in all three CI samples it finished 49–79 ms
  after navigation start, long before the reveal script and the first paint. If it ever arrived after a paint that
  showed the heading, the heading's words would still change width, since no
  fallback has EB Garamond's widths, and the accent could move sideways. No
  sample has shown this.
- With the CPU slowed 8× in the lab, the parser sometimes stopped inside the
  hero. The first paint then lacked the season clock and the "Read the story"
  cue, and when they arrived the bottom-aligned hero text rose 82 px
  (CLS 0.082). It happened on main and on this change alike (in the recorded
  runs, 4 of 5 loads and 1 of 5; both had it in exploratory runs too), and
  never in any Lighthouse sample, local or CI. It is not changed here.
