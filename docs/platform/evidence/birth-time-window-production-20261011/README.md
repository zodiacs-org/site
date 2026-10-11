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
| Canonical runs | five passing runs on four production deployments, and one failed attempt (below) | each passing run: all thirteen controls in both viewports |

## The canonical runs

Production moved three times while this record was made: twice because
another session merged a change to main, #705 (`ed1137cb`, the daily email)
at 22:05:11Z and #706 (`368ce361`, the daily email's header) at 22:49:45Z,
and once for the daily edition, `58362fb1`, at 2026-10-11T05:34:38Z. The
birth-chart page served the same 190 files, with the same digests, on all
four deployments.

| run | deployment and commit | window (UTC) | observer | result |
| --- | --- | --- | --- | --- |
| [`run-7028d019/`](run-7028d019/observation.json) | `dpl_6sNuHibXGVrm67tBvp6dJHczAYGX`, `7028d019` | 20:09:38–20:11:05 | v1: the drive decides the result; worker identity and graph stability recorded | passed |
| [`run-ed1137cb/`](run-ed1137cb/observation.json) | `dpl_9ycqFxvKfKRePBjaBYKAybUJGpgg`, `ed1137cb` | 22:37:42–22:39:20 | v2: also fails unless the worker is the local build's and the page graph did not change | passed |
| [`run-368ce361/`](run-368ce361/observation.json) | `dpl_4vt77TuBeFzkq9Kp8q6FM8ZfoHSS`, `368ce361` | 23:08:52–23:10:26 | v3: also reads, before and after, which deployment the alias names and its commit | passed |
| [`run-368ce361-failed-crawl/`](run-368ce361-failed-crawl/observer-stdout.log) | the same | about 23:19–23:21 (its files' times; it wrote no observation) | v4: also makes its own build of the checkout | **failed**: the build and the drive passed, then the observer's own after-run crawl got a network reset (ECONNRESET) and stopped before writing an observation |
| [`run-368ce361-v4/`](run-368ce361-v4/observation.json) | the same | 23:23:28–23:24:06 | v4, with a request that fails at the network level tried up to three times and counted (none was) | passed |
| [`run-58362fb1/`](run-58362fb1/observation.json) | `dpl_95AEBXr2SXKqGwE5B4szXg2SVRYU`, `58362fb1` | 2026-10-11T06:51:24–06:52:45 | v5: also refuses a checkout holding an ignored `.env` file; then the v3 flag-chunk analysis, which builds this commit with the production flags itself | passed; every chunk explained |

Each version of the observer answers a review of the one before it on
#704: the Codex threads on `scripts/observe-birth-time-window-production.mjs`
lines 169 (v2), 159 (v3), 46 (v4), 52 (v5), and 138 and 228 (v6). The last
run was made with v5 and the v4 runs with the version before it; the
committed observer is v6, which adds two checks that every run's record also
meets (below). Each earlier version is in the PR's history. The flag-chunk analysis,
`scripts/explain-birth-window-flag-chunks.mjs`, is at v3 (threads on lines 36
and 34). The earlier runs predate the later checks, so the record says what
bound each of them:

- **The deployment.** Runs 1 and 2 were bracketed by reads of the zodiacs.org
  alias made through the Vercel connector by hand
  ([`connector-observation.json`](connector-observation.json), assembled):
  before and after each, the alias named the run's deployment with an
  unchanged `updatedAt`. Runs 3 to 5 made those reads themselves through the
  Vercel CLI's existing login and recorded the deployment's commit.
- **The local build.** Before runs 1 to 3 the commit was checked out clean and
  built with the flags unset just before the run
  ([`local-builds.json`](local-builds.json), assembled, with each log's
  SHA-256). From the fourth attempt the observer deletes `dist/` and builds
  the checkout itself, and its `build.log` is committed beside the run; from
  the fifth run it first refuses a checkout holding an ignored `.env` file.
- **The flags build.** The first analysis used a production-flags build of
  `7028d019` made from a clean checkout just before it
  ([`local-builds.json`](local-builds.json)); v2 checked its fetched bytes
  against the first run's digests. v3 builds the observed commit with the
  production flags itself, from a clean checkout, with the environment of that
  checkout's own `site-check.yml` production-flags job, puts back the two
  tracked files the flags-on generators rewrite, and checks that none is left
  changed; it explained every chunk of the fifth run
  ([`run-58362fb1/flag-chunk-explanation.json`](run-58362fb1/flag-chunk-explanation.json),
  build log `flags-build.log`).

### Checks added after the runs

The observer's v6 adds two checks. No run was made with v6; every recorded run
meets both:

- **Every response 200.** Every asset crawled before and after the drive, and
  the worker, must have answered 200 (Codex thread on line 138). Each
  `observation.json` records 381 asset responses (the page's 190 files twice,
  and the worker), every one 200, and the page itself 200 before and after.
- **The graph grows from the recorded response.** v1 to v5 read each chunk's
  imports from a second request for it, which they did not record, so a
  failed second request could have left imports out of a graph without
  failing the run (Codex thread on line 228). v6 reads them from the bytes of
  the response it records. `scripts/check-birth-window-graph-closure.mjs`
  checks the retained graphs, reading each chunk only from bytes whose
  SHA-256 equals the recorded digest: at 2026-10-11T13:56:12Z canonical
  production still served all 188 chunks of every graph with those digests,
  and in all ten graphs (five runs, before and after) every import of every
  chunk names a file the same crawl recorded
  ([`graph-closure.json`](graph-closure.json)). With one chunk taken out of
  the fifth run's before-graph it failed, naming the chunk that imports it
  ([`observer-controls/closure-tampered.json`](observer-controls/closure-tampered.json),
  input `closure-tampered-observation.json`).

### Checks added after the v4 runs

Codex's review of the v4 head raised two more points, which the scripts now
check; neither changes a recorded result:

- **Ignored `.env` files.** Vite and `scripts/build-assistant-ui.mjs` read
  `.env` files, which git ignores, so a checkout holding one would not give the
  flags-unset build the record claims. The observer now refuses such a
  checkout before it builds (schema v5): with a synthetic `.env` placed in the
  `368ce361` checkout and removed afterwards, it stopped with "No ignored .env
  file in the checkout; the build would read it: .env"
  ([`observer-controls/env-refusal.log`](observer-controls/env-refusal.log)).
  Every run above used a fresh clone, which holds no `.env` file.
- **The analysed chunks are the observed bytes.**
  `scripts/explain-birth-window-flag-chunks.mjs` fetches each chunk again, so
  it now analyses one only when the response is 200 and its SHA-256 equals the
  observation's digest for that path, and fails otherwise (schema v2). The
  first analysis, made at 2026-10-10T20:15:43Z while production still served
  `7028d019`, recorded each chunk's served digest: all eight equal the first
  run's observed digests. Run again with the check at 2026-10-11T06:34:06Z against the
  first run's observation, every chunk matched its observed digest and was
  explained ([`run-7028d019/flag-chunk-explanation-v2.json`](run-7028d019/flag-chunk-explanation-v2.json));
  with one recorded digest replaced by zeros it refused that chunk and failed
  ([`observer-controls/explanation-tampered.json`](observer-controls/explanation-tampered.json),
  input `tampered-observation.json`).

## What the browser runs did

`scripts/observe-birth-time-window-production.mjs` runs the unchanged
`tests/birth-time-window-drive.mjs` (SHA-256 `ce2770e3…`, the same file at all
four commits) with `ZODIACS_TEST_BASE_URL=https://zodiacs.org`, in headless
Google Chrome 154.0.8037.98 on macOS, from a clean checkout of the deployed
commit. Every page, script and worker came from canonical production.

- **Every passing run passes all thirteen controls in both viewports**
  (390×844 and 1440×1000), as the drive names them: no worker before the
  request; a real sampled window; every cell rendered; an explicit cancel, a
  window change and a chart replacement each terminate the actual worker; no
  window entry for an unknown time, nor for a local date that resolves past
  the UTC span; disabled 30- and 120-minute options at the lower edge; a real
  worker result for the edge's preset; the worker loaded from the production
  `/_astro/birth-window.worker-…` file; the boundary charts' committed
  instants checked; and no horizontal overflow. Each viewport created and
  terminated six workers. No page error was observed.
- **The one-line summary** production showed for the drive's first chart:
  "Rising sign depends on the birth time: Cancer or Leo or Virgo." The
  boundary charts committed `2200-01-01T05:59:00.000Z` (no entry) and
  `1800-01-01T00:20:58.000Z` (a two-minute window).
- Each run folder holds the drive's own report, `drive-browser-controls.json`,
  byte for byte, and its output, `drive.log`. The drive writes fixed limitation
  sentences meant for its default local preview; in these runs its base URL
  was production, which each `observation.json` records. The drive writes over
  the committed `birth-time-window-ui-20261010/browser-controls.json`; the
  observer keeps that file's bytes and puts them back, and checks that no
  tracked file changed.

## What production served

- **The worker.** `/_astro/birth-window.worker-BrxRL5ql.js` is 88,808 bytes,
  SHA-256 `678516ae…`, the same bytes in every run and in the local builds of
  `7028d019`, `ed1137cb`, `368ce361` and `58362fb1`. It is 40,367 bytes gzipped at zlib's
  default level (the figure PR703's records give) and 40,349 at level 9,
  under the 60 KB chunk limit.
- **The page.** `/birth-chart/` and the modules it reaches came to 190 files,
  the same set with the same digests before and after each run and in every
  run; the page's HTML was the same bytes too. 182 are byte for byte the local
  build with the flags unset. The other eight differ because production builds
  with its feature flags on. A build with the production-flags job's settings
  explains each of them, for the first run
  ([`run-7028d019/flag-chunk-explanation.json`](run-7028d019/flag-chunk-explanation.json),
  and its bound re-check `flag-chunk-explanation-v2.json`) and for the fifth
  ([`run-58362fb1/flag-chunk-explanation.json`](run-58362fb1/flag-chunk-explanation.json)):
  seven are identical once
  the content hashes in file names are set aside, and `client.BznKc0x4.js`
  differs from its counterpart only in two string literals, where production
  has its public Supabase address and key and the build has the CI's
  stand-ins.
- With the production flags, `/birth-chart/` is 70.2 KB against its 71 KB
  budget and `/compatibility/` 36.0 KB against 36 KB
  ([`local-builds.json`](local-builds.json)); both pass, with little room.

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

- These are runs from one machine with anonymous requests and synthetic or
  public demonstration inputs, on 2026-10-10 between 20:09 and 23:25 UTC and
  on 2026-10-11 between 06:51 and 06:54 UTC. They
  show the deployed interface working; they are not a load, availability or
  long-term health measurement.
- The windows are sampled at one-second resolution, as the interface says.
  Nothing here is a new accuracy measurement or an interval proof; B2.a and
  B2.c carry the thousand-window rule.
- The connector's records for runs 1 and 2 are assembled by hand from its
  responses; runs 3 to 5 recorded the CLI's answers themselves. The bytes a
  visitor receives are what the observer measured.
- English full calculator only, as built. No saved-window model and no other
  locale.

## Reproduce

Make a clean checkout of the commit production serves and run `npm ci` there
(the build inside the observer needs the day's edition, which the
daily-freshness gate checks). With the Vercel CLI logged in to the team, run
this branch's observer against it:

```bash
PRODUCTION_SOURCE_COMMIT=<deployed commit> PRODUCTION_DEPLOYMENT_ID=<its deployment> PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<chrome> node <this checkout>/scripts/observe-birth-time-window-production.mjs <clean checkout> <output folder>
```

Then `node scripts/explain-birth-window-flag-chunks.mjs <output folder>/observation.json <clean checkout> <build log path>`,
which builds the checkout with the production flags itself. A rerun observes
whatever deployment production serves then, not these. The retained graphs'
closure is checked with
`node scripts/check-birth-window-graph-closure.mjs <site checkout> <observation.json>...`;
it reads each chunk from production, or from the checkout's `dist/`, only when
the bytes have the recorded digest, so it can be repeated only while one of
them still holds those bytes.
