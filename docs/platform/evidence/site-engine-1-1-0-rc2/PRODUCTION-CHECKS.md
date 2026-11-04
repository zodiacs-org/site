# Production checks of the 1.1.0-rc.2 adoption, named before they run

Written on 2026-11-04 and committed before any production run, as the
preregistrations ask: time-entry S3, "The adoption names those requests in its
record before the run", and lite D2's sect text, "named in the adoption's
record before the run" (the engine's
`docs/evidence/1.1.0-rc.2-20261102/time-entry/PREREGISTRATION.md` section 8
and `lite/PREREGISTRATION.md` section 6, at `806f76b`). The tool that makes
them, `tools/verify-production.mjs` (1.1.0-rc.1's, adapted to this file), is
committed before its first production run.

**When.** Every check runs on the deployment the zodiacs.org alias names
once the adoption's merge has deployed (`production/production-at-merge.json`)
and again on the next production deployment (`production/production-later.json`).
Every check's control runs before the merge, on the deployment then serving
the site, and must fail there. The one exception is S3a, time-entry S3's
calendar request, which is not run at all (decided on 2026-11-04, before any
run: see F-53 below). The expected values are read from the merge
commit (its candidate record, MCP manifest and documented example), never
from a working tree.

**Alias reads.** Through the Vercel connector (`get_alias`, `get_deployment`
for the zodiacs.org production alias), just before and just after each run,
recording only `deploymentId`, `updatedAt`, `readyState`, `target` and
`githubCommitSha`. The protection bypass is never read.

## 1.1.0-rc.1's eleven checks, adapted

| # | Check | Passes when | Control on the deployment before the merge |
| --- | --- | --- | --- |
| R1 | The alias | It names a READY production deployment built from the merge commit (at the merge) or from a commit that contains it (the later run) | its commit neither is nor contains the merge commit |
| R2 | `/developers/engine/` | It names engine 1.1.0-rc.2 as a release candidate npm does not carry, with npm's 1.0.0 under `latest` and the archive's SHA-256 | it names 1.1.0-rc.1 |
| R3 | `/developers/support/` | The same, for the support page's wording | as R2 |
| R4 | `/developers/mcp/` | It names `@zodiacs/engine 1.1.0-rc.2`, `zodiacs-mcp-server 0.1.0-rc.26` and the adapter archive's SHA-256 | it names rc.25 |
| R5 | `/llms.txt` | It names `@zodiacs/engine` 1.1.0-rc.2 as a candidate npm does not carry, npm's `latest` 1.0.0, and the adapter 0.1.0-rc.26 | as R2 |
| R6 | `/llms-full.txt` | The same, in its own wording | as R2 |
| R7 | `/developers/engine/reference/provenance.json` | Version 1.1.0-rc.2, the archive's SHA-256, source commit `806f76b43c0ee652016fe1b522c02d6f6e9c7ae5`, licence `MIT AND CC-BY-4.0` | it names 1.1.0-rc.1 |
| R8 | `/examples/mcp-server.json` | It equals the merge commit's `public/examples/mcp-server.json` | it is rc.25's |
| R9 | `/examples/zodiacs-mcp-server-0.1.0-rc.26.tgz` | Its bytes have the manifest's SHA-256 and length | it is not served |
| R10 | The documented positions example | The request sent is the one `src/lib/compute-api/examples.ts` documents at the merge commit | none: it reads the merge commit, not production |
| R11 | `POST /api/v1/positions`, the documented example | It answers 200 on engine 1.1.0-rc.2 (`backend.version` and `receipt.engine.version`), with the receipt's convention ids | it answers on 1.1.0-rc.1 |

The page texts each check looks for are the merged pages' own wording (the
adoption rewrites them), taken from the merge commit by the tool as
1.1.0-rc.1's tool took them.

## The lite entry (lite section 6)

- **D1.** The alias read, as R1.
- **D2.** The static closures of the `EclipticView`, `RelationshipWheel` and
  `ChartCalculator` chunks, found in a local build of the merge commit with
  production's flags (site-check.yml's `production-flags-build` environment,
  with the three `_SECRET` stand-ins at 32 characters or more), equal
  production's byte for byte, hold neither ephemeris marker
  (`Value is not boolean:`, `Light-travel time solver did not converge`) and
  hold their lite parts' refusal texts:

  | Closure | Unit | Text |
  | --- | --- | --- |
  | `EclipticView` | declinations | `declination bodies must be a standard array.` |
  | `EclipticView` | sect | `sunAltitude must be from -90 to 90 degrees.` |
  | `RelationshipWheel` | composite | ` must be an array of { body, lon }.` (with its leading space) |
  | `ChartCalculator` | dignities | `sign must be a lowercase zodiac sign name.` |

  The sect text is `src/sect.ts`'s own message. In the vendored archive
  (`vendor/zodiacs-engine-1.1.0-rc.2.tgz`, read on 2026-11-04) only
  `dist/lite-sect.js` holds it; the declination text is also in a root chunk
  (`dist/chunk-NIRYKLHT.js`), the composite text in `dist/techniques.js` and
  `dist/lite-dignities.js`, and the dignity text in `dist/techniques.js`. Each
  text is looked for in its named closure, which leaves out the engine chunk
  (a dynamic import), so the root chunk's copies do not count.
  Control: on the deployment before the merge the closures hold the site's
  own code and none of the lite texts.
- **D3.** The engine chunk (`/_astro/full.*.js`, as `scripts/report-bundles.mjs`
  finds it) names `1.1.0-rc.2`. Control: before the merge it names
  `1.1.0-rc.1`.

## The time bands (time-bands C9, for the record)

- **C9.** `/developers/conventions/registry.json` names
  `time-band:first-order`; the alias and the engine chunk are D1 and D3.
  P1.M3c's version 1 failed C1b, so C9 is read for the record only (the
  adoption plan's decision D-4). Control: before the merge the registry
  lacks the id.

## The varga sensitivity (varga section 11, item 2)

- **V1.** `/developers/engine/reference/functions/vedic.vargaSensitivity.html`
  is served (200), and the engine chunk names 1.1.0-rc.2 (D3). Control:
  before the merge that page is not served.

## F-53 (time-entry S3): two requests named, the first not run

- **S3a, the calendar function (named, and not run).**
  `GET /api/calendar/transits?token=<X>`, where `<X>` is
  `encodePositionsLink` (`src/lib/share-positions.ts`) of the synthetic
  chart that `src/lib/engine/full.ts`'s `computeChart` casts at the merge
  commit for `2001-02-03T04:05:06Z`, latitude 10, longitude 20, whole-sign
  houses, time known. Its body is compared with `buildTransitCalendar(<X>,
  { generatedAt })` of `api/calendar/transits.ts` at the merge commit, run
  locally on the vendored package, with `generatedAt` the response's own
  generation time. Control request: the token of the chart cast the same way
  for `2002-03-04T05:06:07Z`, latitude -20, longitude 30, whose body must
  differ from `<X>`'s.

  **Found while writing this file, not run:** at the base `0bf69bd5` the
  route's default handler answers every request `410 Personal calendar feeds
  are retired.` without building a calendar (`api/calendar/transits.ts`,
  since #628, `250d62af`, 2026-10-03; `handleTransitCalendar` and
  `buildTransitCalendar` are kept for tests). So this request cannot reach
  `server-ephemeris.ts` in production, and S3a fails as named. The only
  production path that loads `server-ephemeris.ts` is the signed-in,
  canary-only creation of a compatibility invite
  (`src/lib/invite/routes/invites.ts` line 64, through `api/compatibility.ts`),
  which a check without an account cannot make.

  **Decided on 2026-11-04, before any run: S3a is not run.** The adoption's
  coordinator decided it under the owner's delegation of 2026-11-04, and it
  is recorded here before any production check named in this file, and
  before any tool committed in this folder, has run. Why: the request cannot reach `server-ephemeris.ts` in
  production, because `/api/calendar/transits` has answered `410` to every
  request since #628 (`250d62af`, 2026-10-03); and the only other
  production path that loads that adapter, the creation of a compatibility
  invite, needs a signed-in account and is open to the canary only, while no
  agent of the programme holds an account or signs in. No substitute request
  is made in its place. The switch in `server-ephemeris.ts` (its time basis
  taken from `@zodiacs/engine/time` in place of the generated module) is
  covered on the build by S1b ([time-entry/](time-entry/),
  `tools/adapter-parity.mjs`): the adapter bundled with the site's esbuild
  for Node, packages left external as Vercel leaves them, once importing the
  committed module and once the package, must give the same `bodyLongitude`
  and `longitudeSpeed` (`Object.is`) for the 12 bodies at the 14,765 K1
  instants, before any import changes. S3b below keeps its request and its
  control unchanged. Time-entry S3's record will say that its first request
  was not run, and why.
- **S3b, the compute API.** `POST /api/v1/positions` with the documented
  example (R10) as its body:
  `{"instants":["2026-09-29T12:00:00Z","2026-12-31T00:00:00-05:00"],"bodies":["Sun","Moon","Mercury"]}`.
  Its handler calls `timeBasis` (`src/lib/compute-api/endpoints.ts` line 97,
  through `basisOf`). Passes when it answers 200 on engine 1.1.0-rc.2 (as
  R11) and each instant's `deltaT` and `timeScale` equal, value for value
  as JSON, those of `timeBasis(Date.parse(instant), "utc")` from the
  vendored `@zodiacs/engine/time`, run locally at the merge commit. Control
  request: the same body with each instant 1 ms later
  (`2026-09-29T12:00:00.001Z`, `2026-12-31T00:00:00.001-05:00`), whose
  records, compared with `timeBasis` at the original instants, must differ
  (UT1 - UTC is interpolated within the day, so ΔT moves by much more than
  a unit in the last place over a millisecond). Control on the deployment
  before the merge: it answers on 1.1.0-rc.1 and fails on the version; its
  time records are expected to equal rc.2's, which is what F-53's parity
  (S1) found, and are recorded.

## After the merge

Main's Site Check on the merge commit, read once
(`gh run list --workflow site-check.yml --branch main --commit <merge> --limit 1`),
is part of time-entry S3, lite R5 and time-bands C9. Its record names the run.
