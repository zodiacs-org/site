# Birth-time window: canonical production, 2026-10-11

B2.b's gate is "deployed UI with one-line summary and detail on request". This
record closes the last condition the PR703 records left open: the merged source,
served from zodiacs.org, passes the same browser controls that qualified it.

## The chain from reviewed head to production

| step | identity | result |
| --- | --- | --- |
| Reviewed head | `5a46fb08a51cddb8bdbff02d8fc23837fd0cad76`, tree `d5a580d38df67d8150d6684e8ff6bd75d82bd389` | [Site Check 38069869006](https://github.com/zodiacs-org/site/actions/runs/38069869006): 20 of 20 jobs; [numerical gate 38069869015](https://github.com/zodiacs-org/site/actions/runs/38069869015): passed. Retained in [`../birth-time-window-ui-20261010/carrier-5a46fb0/`](../birth-time-window-ui-20261010/carrier-5a46fb0/full-suite.json); its `full-suite.log` and `numerical.log` are byte for byte the job logs GitHub serves for jobs 114264917730 and 114264917315 (SHA-256 `9a0b9115…` and `73a21323…`, checked 2026-10-10T20:20Z) |
| Review | Codex comment `6100016486`, 2026-10-10T17:04:02Z, on `5a46fb08a5` | "Didn't find any major issues"; review threads `4237818455`, `4237818457` and `4238230846` all resolved |
| Merge | [#703](https://github.com/zodiacs-org/site/pull/703) as `7028d01905137b45e835db1dca785cecb672a729` | tree `d5a580d3…`, the reviewed head's tree; parents `51b2c0d3` (main) and `5a46fb08` (head) |
| Post-merge | [Site Check 38073108054](https://github.com/zodiacs-org/site/actions/runs/38073108054) on `7028d019` | 20 of 20 jobs; all 63 steps of Build & Check succeeded: 6,989 unit tests passed with six existing skips, the journal says "Runner stalls: none; no sample was retaken.", and both birth-window drives passed thirteen controls per viewport. Retained in [`postmerge/`](postmerge/postmerge.json): the job log as GitHub serves it, and the two drive reports decoded from it |
| Deployment | Vercel `dpl_6sNuHibXGVrm67tBvp6dJHczAYGX`, from `7028d019` | READY; zodiacs.org and www.zodiacs.org assigned to it before and after the first browser run ([connector record](connector-observation.json), assembled) |
| First canonical run | [`run-7028d019/`](run-7028d019/observation.json), 2026-10-10T20:09:38Z to 20:11:05Z | passed in both viewports |
| Production moves | Vercel `dpl_9ycqFxvKfKRePBjaBYKAybUJGpgg`, from `ed1137cb` (#705, the daily email, merged by another session) | READY; zodiacs.org assigned to it from 22:05:11Z, before and after the second run |
| Second canonical run | [`run-ed1137cb/`](run-ed1137cb/observation.json), 2026-10-10T22:37:42Z to 22:39:20Z | passed in both viewports, with source binding enforced |

## What the browser runs did

`scripts/observe-birth-time-window-production.mjs` ran the unchanged
`tests/birth-time-window-drive.mjs` (SHA-256 `ce2770e3…`, the same file at
both commits) with `ZODIACS_TEST_BASE_URL=https://zodiacs.org`, in headless
Google Chrome 154.0.8037.98 on macOS, from a clean checkout of the deployed
commit with a completed local build. Every page, script and worker came from
canonical production.

It ran twice. The first run, on `7028d019`, recorded the worker's identity and
whether the page's module graph stayed the same, but its result counted only
the drive; the PR's Codex review (thread on line 169) asked for both to fail
the observation, and the script now does (schema v2, `sourceBinding`). By the
time of the second run another session had merged #705, so production served
`ed1137cb`. The second run, with the corrected script, passed on that
deployment: the drive, the worker byte for byte and an unchanged graph. The
first run's files are kept as they were written, and its recorded values meet
the same two conditions.

- **Both viewports pass all thirteen controls** (390×844 and 1440×1000), as
  the drive names them: no worker before the request; a real sampled window;
  every cell rendered; an explicit cancel, a window change and a chart
  replacement each terminate the actual worker; no window entry for an unknown
  time, nor for a local date that resolves past the UTC span; disabled 30- and
  120-minute options at the lower edge; a real worker result for the edge's
  preset; the worker loaded from the production `/_astro/birth-window.worker-…`
  file; the boundary charts' committed instants checked; and no horizontal
  overflow. Each viewport created and terminated six workers. No page error
  was observed.
- **The one-line summary** production showed for the drive's first chart:
  "Rising sign depends on the birth time: Cancer or Leo or Virgo." The
  boundary charts committed `2200-01-01T05:59:00.000Z` (no entry) and
  `1800-01-01T00:20:58.000Z` (a two-minute window).
- Each run folder holds the drive's own report, `drive-browser-controls.json`,
  byte for byte, and its output, `drive.log`. The drive writes fixed limitation
  sentences meant for its default local preview; in these runs its base URL
  was production, which each `observation.json` records. The drive writes over
  the committed `birth-time-window-ui-20261010/browser-controls.json`; the
  observer kept that file's bytes and put them back, and checked that no
  tracked file changed.

## What production served

- **The worker.** `/_astro/birth-window.worker-BrxRL5ql.js` is 88,808 bytes,
  SHA-256 `678516ae…`, the same bytes in both runs and in the local builds of
  `7028d019` and `ed1137cb`. It is
  40,367 bytes gzipped at zlib's default level (the figure PR703's records
  give) and 40,349 at level 9, under the 60 KB chunk limit.
- **The page.** `/birth-chart/` and the modules it reaches came to 190 files,
  the same set with the same digests before and after each run, and the same
  in both runs; the page's HTML was the same bytes too. 182 are byte for
  byte the local build with the flags unset. The other eight differ because
  production builds with its feature flags on. A second local build with the
  production-flags job's settings explains each of them
  ([`run-7028d019/flag-chunk-explanation.json`](run-7028d019/flag-chunk-explanation.json),
  which holds for the second run's identical files): seven are
  identical once the content hashes in file names are set aside, and
  `client.BznKc0x4.js` differs from its counterpart only in two string
  literals, where production has its public Supabase address and key and the
  build has the CI's stand-ins.
- [`local-builds.json`](local-builds.json) gives the builds' bundle gates. With
  the production flags, `/birth-chart/` is 70.2 KB against its 71 KB budget and
  `/compatibility/` 36.0 KB against 36 KB; both pass, with little room.

## What the screenshots show

Each run's four drive screenshots are in its `screenshots/`. A separate
capture during the first run's deployment, `scripts/capture-birth-window-detail.mjs`,
recorded the opened detail for the same chart in both viewports
(`run-7028d019/screenshots/detail-*.png` and `detail-capture.json`); it is a
picture of the deployed detail, not a control. They were read:

- The summary shows the one line, the sampling label and "See the time window
  and changes".
- The opened detail shows the window control, the UTC note, the pre-1972 clock
  sentence, the note that shares are not birth-time probabilities, the note
  that the entered chart is unchanged, seven intervals with their start and end
  to the second and their share of the window, the Sun, Moon, rising sign and
  house system in each, nested houses and aspects, and "When features change
  (6 instants)".
- Two copy faults, recorded as F-81: the sampling sentence starts in lower
  case ("sampled at one-second resolution. This check varies birth time…"),
  and the times read "GMT+0" under a note that says "Times below use UTC
  notation". Neither changes a value or the gate's two parts.

## Limits

- These are two runs from one machine with anonymous requests and synthetic
  or public demonstration inputs. They show the deployed interface working;
  they are not a load, availability or long-term health measurement.
- The windows are sampled at one-second resolution, as the interface says.
  Nothing here is a new accuracy measurement or an interval proof; B2.a and
  B2.c carry the thousand-window rule.
- The Vercel connector's records are assembled by hand from its responses; the
  bytes a visitor receives are what the observer measured.
- English full calculator only, as built. No saved-window model and no other
  locale.

## Reproduce

Make a clean checkout of the commit production serves, run `npm ci` and
`npm run build` there (the daily-freshness gate needs the day's edition), and
run this branch's observer against it:

```bash
PRODUCTION_SOURCE_COMMIT=<deployed commit> PRODUCTION_DEPLOYMENT_ID=<its deployment> PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chrome> node <this checkout>/scripts/observe-birth-time-window-production.mjs <clean checkout> <output folder>
```

Then `node scripts/explain-birth-window-flag-chunks.mjs <output folder>/observation.json <production-flags dist>`
after a build with the environment of `site-check.yml`'s
`production-flags-build` job. A rerun observes whatever deployment production
serves then, not these two.
