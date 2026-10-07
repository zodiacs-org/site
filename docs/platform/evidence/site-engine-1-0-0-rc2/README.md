# Site adoption of engine 1.0.0-rc.2 — local validation draft

Base: site main `f4715b7047c852f48d0e188d43863d5825ae2bef`.
This is an adoption draft for review. It is not deployed, and no programme
unit is accepted here.

## Artifact and registry identity

The site consumes [the immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/e790362bddf28016405df4164e66baea057c4f19/artifacts/zodiacs-engine-1.0.0-rc.2.tgz),
copied byte for byte into `vendor/zodiacs-engine-1.0.0-rc.2.tgz` with its receipt.
SHA-256: `4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002`.
Source: `7fa964d2a77d09dbb819b5733b36e303fc7fc513`.
The archive is 287,011 bytes, 74 files and 989,528 unpacked bytes; the
lockfile records its SHA-512 integrity. Licence: **MIT AND CC-BY-4.0**.
All 49 earlier engine, MCP and plugin archives retain their digests.

The [7 October registry read](npm-registry-rc16.json) records rc.16 under
`next`, rc.15 under `latest`; [the candidate lookup](npm-view.txt) returns
404. rc.17, rc.1 and rc.2 are not published by this adoption. The new
signature verification attempt could not download its verification data.
The successful 1 and 6 October rc.16 attestation records keep their dates;
the fresh distribution metadata agrees with the retained archive and those
records. This does not claim that signature verification ran successfully today.

## Audit and behavior

Engine main `ff4457be` is PR #31's merge commit and retains carrier
`e790362b` as an ancestor; PR #30's 1.0 API work is retained. Site PRs #663
and #664 have merge commits `6f873334` and `b1c42f19`. The local ledger
check preserves 61/182.45 accepted weight, 33.434% delivered, 1.644% blocked.
The engine's final table-check repair passes its 28-test suite, but this
session has not supplied an independent fresh-context review of that repair.
The checker remains an aid, not proof of a call's purity.

The 1.0 CHANGELOG lists stricter argument/option checks, frozen exported
tables, lowercase calc time scales and the caller-ayanamsa epoch bound.
rc.2 marks table-building calls pure. [All 14 entry graphs differ](entry-graphs.txt),
including `./houses`; this is not a version-only dependency replacement.
The site keeps its current engine entries and lazy boundaries. The CDS
star-values question is documented in the
[engine's LICENSING.md](https://github.com/zodiacs-org/engine/blob/7fa964d2a77d09dbb819b5733b36e303fc7fc513/LICENSING.md#timing-and-vedic-values).
Neither calc nor Vedic is added to production imports or the MCP adapter.

The owner decisions are carried in
[DECISIONS-2026-10-06](../../programme/DECISIONS-2026-10-06.md).
The package has 10,472 bytes under its approved unpacked cap. P3.2 stays
validated until the candidate is served in production and judged.

## Rebuilt outputs and finite comparisons

[regenerated-outputs.json](regenerated-outputs.json) is an assembled exact
JSON comparison with main, not raw runner output. Generated sky, eclipses,
all monthly transits, daily facts, horoscope editions and event publication
retain their numerical values to the bit in every comparison made here.
The protected Registry Moon-ingress table retains its original generation
metadata after an exact fresh payload comparison, so it keeps its bytes.
The retained [comparison checker](tools/check-regenerated-outputs.py) verifies
all 73 recorded file hashes and JSON differences against the immutable base.
Other differences are generation timestamps, the daily publication receipt's
engine identity/fingerprint, and compute examples' engine/citation identities
and runtime timezone version. The compute examples were generated on Node
24.19.0; production's current Node runtime has not been read here.

The server time basis was checked against natalChart at 14,765 instants and
177,180 body longitudes. [Node 22](node22-parity.json) and
[Node 24](node24-parity.json) preserve the independent node/polar residuals.
[The packed consumer summary](public-candidate-consumer.log) is assembled
from actual smoke/type reports on Node 22.22.2 and 24.19.0.
The [fresh Swiss aggregate reports](accuracy-refresh/) change only their
engine identity and dump digest. Raw Swiss values and ephemeris files stayed
outside the repository. The [frozen benchmark redraw](sky-benchmark-redraw.json)
records its exact comparison; v0's published files retain their bytes.

The [compute-state review](PRIVATE-STATE.md) preceded its reviewed digest
update. The same record includes a source review and static inventories of all three
current AI runtimes; their actual-bundle lifetime regression drive passes
success, refusal, failure and overlapping timezone resolution. Site main PR #681 removed the older
hosted `/api/v1/mcp` bundle; this adoption rebuilds the current sole `/mcp`
runtime instead of reinstating that removed endpoint. Developer plugin
0.3.4 is a new review ZIP; sky 0.4.0 and developer 0.3.3 retain their bytes.

MCP adapter 0.1.0-rc.18 bundles rc.2. The [278-call comparison](mcp-rc17-rc18.json)
finds no differences after version/receipt-digest normalization, including
ten refusals, both resources and the tool list. The protocol drive passes
106 checks, Claude Code 2.1.292 host registration/launch/removal passes seven,
and one synthetic benchmark run passes 18 scenarios and 112 assertions.
That run is not an astronomical accuracy rate or a model-driven trial.
The final 123,273-byte archive installs fresh with its shrinkwrap and passes
21 verification checks on Node 22.22.2; [the record](mcp-fresh-install.json)
binds its SHA-256. The complete local release checks and their failures are recorded below.

## Bundle and compute cost

The current-main baseline measures 33,128 gzip bytes across seven static
chunks, under the unchanged 33,380.4-byte engine allowance.
[baseline-engine-closure.json](baseline-engine-closure.json) gives each chunk.
The candidate build measures 33,193 gzip bytes in seven static chunks,
187.4 bytes below the unchanged limit. [candidate-engine-closure.json](candidate-engine-closure.json)
records the closure. The final documentation build and its dist, schema, isolation and budget gates
pass, with the same closure. Final local suite/capture results follow below. One fresh nine-shape
sweep made 4,600 measured requests after two warmups per shape, interleaved
with seed 20261005, through the production handler's TypeScript source and
local-time bundle. It ran alone with respect to heavy builds/tests, on Node
22.22.2 and Xeon Platinum 8573C under a four-CPU quota. It did not use the
previous run's two-minute quiet-load admission criterion. The exact report is
[compute-worst-case.json](compute-worst-case.json); source is the unchanged
`election-search-v0/tools/worst-case.ts` and its draw/harness imports.

CPU maxima in that run: events 1,001.5 ms; positions 287.1 ms; chart 15.7 ms;
sky-fact 41.2 ms; time 24.1 ms; election void-of-course 1,129.6 ms, five
conditions 932.8 ms, four-day Moon-angular 1,447.5 ms, and sign/phase/Mars-angular
1,008.4 ms. A separate [houses sweep](houses-cost.json) through the generated,
guarded bundle made 5,200 requests (13 systems in each year 1800–2199), after
one warmup per system: CPU p95 23.0 ms, maximum 98.5 ms. These are observed
maxima for finite synthetic draws, not a universal upper bound.

The existing 40/10 rule arithmetic gives an illustrative 23.1 CPU-seconds
per address per minute at the nine-shape maxima and 9.2 at p95. The separate
houses maximum is below positions and does not change that arithmetic.
Hardware and protocol differences prevent attributing the increase to the
engine. The owner security step remains open; deployed cold latency/cost
are still missing. No budget, Firewall rule or production flag changes.

## Limits and outstanding delivery checks

The unchanged five-second receipt-invalidation test timed out in two complete
runs. Its hasher read each source file sequentially. The helper now reads in
batches of 16 and hashes every path and byte in the same sorted order, without
caching or changing the source boundary. [The reference comparison](phase1-hash-equivalence.json)
uses main's original implementation on the same tree: all five scenarios have
identical digests, read coverage and order across 1,103 files. Source/font
changes still invalidate; excluded delivery/payload changes still do not.
The first focused run correctly rejects the now-stale capture receipt. The
fresh build and 18/18 captures bind source digest
`b513a934c454dd36466ea647c234010cd0ab063027f9bcb521486d2334ba9d45`.
The complete suite after this helper change runs every test, with one Vitest
thread and unchanged time limits: 6,915 pass, one solar-return consistency case
times out, and the five pre-existing skips remain. All ten solar-return checks
then pass in isolation (461 ms for the file). The complete run is **failed**;
the isolated pass does not turn it into a green full-suite result. CI remains
required before delivery or acceptance.

- The final build, typecheck (1,319 files: zero errors/warnings, 39 hints),
  generated bundle/reference/AI checks and 18/18 Phase 1 captures pass.
  The first full unit run had 6,904 passes, 12 failures and five skips. Stale
  release/demo/ingress expectations were corrected; the five time limits
  remained unchanged. All 105 checks across the ten failed files pass on an
  isolated rerun. The second complete run had two five-second timeouts;
  its 31 isolated rerun checks passed. The third complete run, with one Vitest
  thread and the same deadlines/assertions, had 6,915 passes and just the
  receipt-invalidation timeout. The fourth complete run passes the repaired
  invalidation check and has the one solar-return timeout described above.
  The [idle frame comparison](browser-frames/comparison.json) runs the unchanged
  driver once on freshly built, untouched main, then on the candidate before
  and after the evidence-hasher optimization.
  Both calibrations measure 58.1 fps, below the unchanged 59 fps floor; all
  three animation trials pass at 60 fps in those first two runs. The final
  candidate measures 58.4 fps in calibration and 58.7–60 fps in its three
  passing animation trials. All three frame gates fail their unchanged calibration.
  The earlier candidate reports remain retained. This reproduces the calibration
  failure on main; it does not establish a passing calibration or rule out
  every performance regression. No animation, Guide or threshold changes.
- Pinned IANA archive checks are blocked by network access; timezone pins and
  generated tables remain unchanged. The People assembler checks its frozen
  reviewed charts; those historical charts were not redrawn here.
- GitHub API access is refused, so engine merge-commit CI, PR review threads,
  site CI and PR delivery have not been verified through it.
- Vercel project variable names/targets, including the two older entries, and
  production deployment identity have not been read. No values are read.
- P3.3 is merged but not accepted; deployed cold latency and cost are missing.
- Privacy evidence establishes finite behavior, not secure memory erasure;
  numerical agreement is consistency, not independent observation.
- Birth-data search for this branch is pending. Private inputs stay outside
  every repository and public record; only counts and anonymous labels may
  be recorded when it runs.
- No npm publication is authorized, and no daily scheduled check is duplicated.

The regenerated Moon ingress table was redrawn against Swiss 2.10.03: 481
ingresses, 4.484 s maximum absolute residual, 0.861 s median;
[the fresh aggregate](moon-ingresses.json) binds its current bytes.

The protected-scope guard passes against the release base. The npm production
audit reports zero vulnerabilities; the full tree reports two moderate dev
advisories and passes its unchanged high/critical CI threshold.
The separate precision-alpha tier A suite passes all 423 tests, with no skips.

Runner log copies have trailing whitespace removed for review.
[log-normalization.json](log-normalization.json) records the captured and
normalized SHA-256 for each affected log; original captured logs remain
outside Git. This formatting change does not change assertions or results.
