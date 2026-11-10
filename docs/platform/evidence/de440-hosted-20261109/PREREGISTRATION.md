# DE440 reduction as the hosted backend (P4.1): preregistration

Written on 9 November 2026 (Asia/Bangkok), before any code of the backend
exists in either repository, before the oracles of rule (viii) and check C4
are made, and before the holdout is drawn. Nothing here changes after the
commit that adds this file is pushed; a change after that is a departure (see
"Departures").

The owner's answers that shape it, all on 9 November 2026: "Yes, start P4.1"
(to "Start P4.1, the DE440 hosted backend, as the next unit?"), "Yes,
download them" (to "May the unit download JPL's DE440 files from NASA?") and
"Yes, engine-first" (to "Build the DE440 backend into the engine and cut
candidate 1.1.0-rc.3 for it?").

## The unit and its gate

The acceptance ledger's P4.1, weight 8: "DE440 reduction as the hosted backend
(v1 M2.6 rules)". Its gate is "v1 M2.6 (i)–(viii) on the hosted path", from
`docs/platform/evidence/engine-audit-2026-09-22/BRIEF-v1.md` (M2, item 6),
quoted exactly:

> (i) 240-row corpus, clock pinned, shipped-path longitudes vs Horizons
> barycentres: max ≤ 0.5″, p50 ≤ 0.15″ — parity with Swiss's 0.384″/0.098″
> within 0.12″; latitude max ≤ 0.2″; (ii) vs Swiss on the DE440 binary: Moon
> ≤ 0.01″, planets ≤ 0.003″; (iii) canon anchors on the shipped path: Venus
> transits within 2 s TT, eclipses within 2 s; (iv) the original 180-case
> benchmark re-run with the same denominator: over 1801–2026 p50 ≤ 0.2″, p95
> ≤ 0.4″, max ≤ 0.5″ (from 1.62 / 12.08 / 18.64), and the 2100/2190 rows
> reported with the new ΔT beside the old; (v) node vs Swiss `TRUE_NODE` p50
> ≤ 1″, max ≤ 3″ (Swiss's own internal noise); (vi) cross-runtime: same pack
> bytes in Node/Chromium/Firefox, positions equal to 1e-9° (bit-identical if
> the reducer is routed through `trig.mjs`); (vii) tier-A and tier-B green in
> CI (M6); (viii) the alpha's `apparent()` ERFA-chain comparison committed as
> a tier-B gate at 1e-6″.

Brief version 2 (`docs/platform/ENGINE-AND-PLATFORM-BRIEF.md`): Phase 4, "The
DE440 reduction becomes the hosted API's backend first; version 1's M2.6 rules
(i)–(viii) apply on that path"; Phase 3.3, "The DE440 pack on the server, not
redistributed, as the precise backend, named in the receipt; astronomy-engine
as the named fallback"; §7 item 5, the hosted API uses "the same engine and
the same receipts, never a separate code path with different numbers". It
serves results, not a pack, so it does not wait for NAIF
(DECISIONS-2026-09-28 §11).

Units that depend on P4.1 in the ledger: P2.A.points.osculating-lilith,
P2.A.aspects.declination-accuracy and P4.3. P1.03, P1.05 and P1.08 return with
it by the handover's plan (HANDOFF-2026-09-30 §5 item 5), not by `dependsOn`.

Earlier attempts: none on a hosted path. The owner's bundle branches
(HANDOFF-2026-09-30 §4) hold no M2 work. The research runs of 20 to 22
September 2026 (the alpha on DE440s; the audit's swiss-parity, anchors and
ERFA-chain runs) are development data: their numbers were seen, and they are
cited here only as expectations. This is version 1 of P4.1; its holdout id is
`zodiacs-holdout/P4.1`, and a version 2 would use `zodiacs-holdout/P4.1-v2`.

## Scope: what the hosted backend is

- **In the engine.** Because of brief v2 §7 item 5, the DE440 reduction goes
  into `@zodiacs/engine` as a new opt-in entry point that opens a sealed pack
  from bytes its caller supplies (no file or network access of its own). Given
  that source, every engine function the compute API calls computes body
  positions from it, and the engine's receipts name it. Without it, the engine
  behaves as it does today. It ships in candidate 1.1.0-rc.3.
- **On the hosted API.** The compute endpoints that give body positions
  (`/api/v1/chart`, `/positions`, `/events`, `/sky-fact`, `/elections`;
  `/time` and `/houses` compute none) accept `"backend": "de440"` or
  `"backend": "astronomy-engine"`. Until P4.1 is recorded `validated`, the
  default stays astronomy-engine; the record pull request (see "Verdict and
  the ledger") makes DE440 the default, with astronomy-engine as the named
  fallback. A deployment without its pack answers default requests from
  astronomy-engine and says so in the receipt and in a response flag, and
  answers a request that names `"de440"` with a typed 503. This request field
  and the deploy's pack are the flag M2 asks for.
- **Unchanged.** The hosted MCP server (`/mcp`), the site's own pages and every
  generated file (sky data, editions, examples, conformance results) keep
  astronomy-engine: the in-browser path waits for NAIF, and the MCP server is
  P3.6's surface (a follow-up).
- **Where the rules are scored.** Rules (i) to (v) on `POST /api/v1/positions`
  with `"backend": "de440"`, through the compute handler the site deploys
  (`api/_compute/compute.mjs`, built by `scripts/build-compute-handler.mjs`),
  called in Node 22.22.2 with the request bodies a client would send. C8 shows
  that every other endpoint takes its positions from the same source.

## The backend, fixed now

- **Pack.** DE440 (`de440.bsp`, 119,799,808 bytes, SHA-256
  `a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5`, NAIF
  generic kernels) compiled by the alpha's compiler 2.0.0 with
  `--fromYear=1790 --toYear=2210` and the default flags, then sealed by
  `tools/seal.mjs`: 2,489,664 bytes, SHA-256
  `51428874d9a47213abc0ff42cbcec65f338624eaa2d8831f0e6ddc3654bf1fa7` (P4.2's
  recorded digest, rebuilt identically on 9 November 2026 on macOS arm64; S2
  checks it on Linux). The deploy and CI build it from the kernel, fetched
  from NAIF and checked by digest. Neither is ever committed or uploaded as a
  workflow artifact (both repositories are public). The engine opens the pack
  only with that digest expected.
- **Coverage.** The API accepts 1800-01-01T00:00:00.000Z to
  2199-12-31T23:59:59.999Z, inside the pack's 1790 to 2210 with the
  light-time and the node's ±0.25-day speed samples. The engine's source
  refuses any instant outside its pack with a typed error; it never falls back
  inside a calculation.
- **Time.** The engine's own time basis, unchanged (UTC to TT). TT to TDB by
  the runtime's `tdbMinusTt`: 0.001658 sin g + 0.000014 sin 2g + 0.0000224
  sin l seconds, with g and l as in `reduce.mjs`.
- **Reduction.** The alpha's `CORRECTED`, ported into the engine with the same
  arithmetic and constants (au 149,597,870.700 km, light-time 499.004783836 s
  per au, 2GM/c² 1.97412574336e-8 au): IAU 2006 precession
  (Fukushima-Williams, with frame bias), IAU 2000B nutation with the P03
  adjustment, the true obliquity (IAU 2006 mean plus Δε), light-time (12
  iterations, tolerance 1e-11 s), solar deflection in the eraLd form (limiter
  1e-14; Sun at reception for e, at emission for q; none for the Sun), the
  relativistic aberration of the runtime (eraAb without its gravitational
  term), the observer's velocity from the Chebyshev derivative. Mars to Pluto
  are system barycentres, and the receipt says so. C9 checks that the port
  equals the alpha bit for bit.
- **The geocentric Moon,** in the port and in the alpha:
  MoonRelEMB(t − τ) − EarthRelEMB(t) + [EMB(t − τ) − EMB(t)], the bracket as
  −v τ + a τ²/2 from the EMB's velocity and acceleration at t, so that the
  EMB's 30 km/s never multiplies the rounding of the epoch t − τ (audit finding
  alpha-reduction-math-8). This is the one planned change to the reducer's
  arithmetic; any other is disclosed with its reason.
- **North Node.** h = r × v, with r and v the Moon's geometric geocentric
  position and velocity in the ICRF at TDB t from the pack (no light-time,
  aberration or deflection; v from the Chebyshev derivative), rotated into the
  true ecliptic and equinox of date by R1(true obliquity) and the reducer's
  bias-precession-nutation matrix; longitude atan2(h_x, −h_y), latitude 0.
  South Node: + 180°. This is the construction of the engine's current node
  and of the independent references
  (`docs/engine-validation/independent-references/tools/geometry.py`,
  `node_longitude`), on the reducer's frame.
- **Speed, retrograde, sign, degree** as the engine defines them (central
  difference over ±0.001 day; the nodes ±0.25 day).
- **Receipts.** The engine's and the compute receipts name the source: JPL
  DE440 through the pack, its digest, span and compiler; the reduction above;
  the node's construction; barycentres for Mars to Pluto; ΔT as today. The
  conventions registry gains their ids.

## Order of work

- **S1.** This file alone is committed and pushed (site, branch
  `p41/de440-hosted`) before any backend code in either repository. Backend
  code is any change to the engine's `src/`, `scripts/`, `package.json` or
  `CHANGELOG.md`, and to the site's `src/lib/compute-api/`, `api/`,
  `scripts/build-compute-*`, a new pack step under `scripts/`,
  `examples/precision-alpha/src/` or `examples/precision-alpha/tools/`.
- **S2.** Before any backend code, committed and pushed in this folder: the
  oracle of rule (viii) (the chain's places) and of C4 (the chain's nodes),
  their generator and its self-checks; and a CI step, in the workflow only,
  that runs the existing `tools/compiler/compile.mjs` and `tools/seal.mjs`
  unchanged on Linux from the fetched kernel and checks the sealed digest. The draft pull
  request is opened so the step runs, and its result is recorded. If Linux
  gives another digest, that is a defect of compiler 2.0.0: it is recorded,
  fixed before S3, and the new pinned digest is a departure. C3 is then run
  once against the unchanged alpha and recorded. If C3 does not fail, the
  oracle is at fault: the work stops, the generator is repaired and re-run
  before any backend code, and the repair is a departure. If a self-check
  fails, the generator writes no oracle file and exits non-zero.
- **S3.** The engine branch, from the engine's `main` (883371f5): the entry
  point, its tests, its size budget and its guide; the S2 oracles copied in
  with their digests checked. The site branch: the compute API, the deploy's
  pack step, the CI jobs, the harness.
- **S4.** The freeze: candidate 1.1.0-rc.3 cut by the engine's rules, and the
  site commit that adopts it with the harness, both pushed. The package cap
  (1,100,000 bytes, about 3,200 left at rc.2) will need a raise for the entry
  point; a raise is cut with the candidate and said in its changelog, after
  the owner's yes. Neither the engine's README nor its changelog carries an
  M2.6 figure unless its evidence is committed in the engine.
- **S5.** The run, once, by one recorded script: it draws the holdout, fetches
  Horizons and JPL's EOP2 file for it, runs Swiss and every rule and check on
  the frozen build, and writes `results.json`. Its log, without any per-case
  Swiss value, is committed as it came out, with the EOP2 file it used.
- **S6.** Two bounded reviews (brief v2 §5): read-only, no shared premises
  with the author, a different instrument where one exists; each finding is
  reproduced before it is acted on, and every disposition is recorded.
- **S7.** The engine pull request, merged under the owner's delegation of 4
  November 2026 as engine#82 was; then the site's evidence pull request, the
  deploy, the production record and the record pull request.
- **After the freeze.** A backend change made for a review finding re-runs the
  harness on the same inputs. If every scored output is bit-identical, the
  verdicts stand and the change is disclosed. If any scored output changes,
  this version's holdout has been opened; the unit cannot pass under this
  version, and a fix is version 2.
- **Gates.** The site's private search and full pre-push list before every
  site push; the engine's `ci.yml` commands and its private search before
  every engine push.
- **CI.** The kernel is cached by its digest. A failed download from NAIF is
  an instrument failure: the job is re-run, and the re-run is recorded.

## Oracles and their receipts

| oracle | where | receipt |
| --- | --- | --- |
| Horizons, 240 rows | `docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/` | 17 responses, `queries.log`, `fetch.py`; DE441; QUANTITIES=31; `APPARENT='AIRLESS'`; barycentres for Mars to Pluto; the TT list in `corpus-tt.json` |
| Horizons, holdout | fetched in S5 exactly as `fetch.py` does | responses and query log kept; each banner must name DE441 and API 1.2, or the run stops as an instrument failure |
| Horizons's frame | `engine-beyond-swiss/horizons-frame/decompose.py`, model `eopJpl` against the IAU 2006/2000A frame (`new_ecliptic`) | JPL's EOP2 file fetched in S5 with the responses, kept |
| Canon events | `corpora/canon-events.json` | NASA page digests in the file |
| 180-case benchmark | `docs/platform/evidence/swiss-benchmark/tools/` | `corpus.mjs`, `dump_swiss.py`, `compare.mjs` |
| Swiss Ephemeris 2.10.03 | pyswisseph 2.10.3.2, Python 3.11.16, numpy 2.4.6, in `toolchain/py311-oq6/venv` (beside the clones, outside both repositories) | `swiss-ephe/semo_18.se1` SHA-256 `1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7`, `swiss-ephe/sepl_18.se1` `ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66` (as in `docs/engine-validation/swiss-node-polar/README.md`), in `swiss-ephe/` beside the clones; `kernels/linux_p1550p2650.440`, 102,272,352 bytes, `29915576d0a6555766b99485ac3056ee415e86df4fce282611c31afb329ad062`; the returned flag of every call is checked |
| ERFA | pyerfa 2.0.1.5 (ERFA 2.0.1), same venv | `kernels/de440.bsp` read by the chain's own reader (S2) |

Swiss is an instrument, never a fitting target. Only statistics of Swiss
output are committed, never a per-case value (DECISIONS-2026-09-29 §2, F-22).

## The rules

Every rule gives PASS, FAIL or NOT RUN with its numbers. Longitude
differences are wrapped to (−180°, 180°] and given in arcseconds. Quantiles
(p50, p95) interpolate linearly between order statistics, as `compare.mjs`
does. Each rule's denominator is fixed below.

- A row the backend refuses, leaves out or answers with a non-finite number is
  a FAIL of the rule.
- NOT RUN is only for an instrument failure: an oracle or tool other than the
  backend that cannot give its row (a Swiss call returning a flag other than
  the one asked for, a Horizons fetch or banner that fails, a browser that
  does not launch, a NAIF download that fails), shown by a step that does not
  run the backend. A NOT RUN rule may be run again only on the same frozen
  build and inputs, and the re-run is recorded.

- **(i) Horizons.** Corpus: the 24 `horizons-24` instants by 10 bodies, 240
  rows, Mars to Pluto against the barycentre responses. Clock pinned: each
  request sends the UTC instant, to the millisecond, whose TT by the engine's
  time basis is nearest the `jdTt` Horizons was asked for; the residual (at
  most 0.5 ms) is reported per row. PASS when the longitude max ≤ 0.5″, the
  longitude p50 ≤ 0.15″, the latitude max ≤ 0.2″, and parity holds: our
  longitude max and p50 are each at most 0.12″ above Swiss's, both on the
  brief's figures (0.384″, 0.098″) and on Swiss re-measured on the same 240
  rows (.se1, `FLG_SWIEPH`, the same TT). Holdout: the holdout's rows (below)
  against Horizons carried into the IAU 2006/2000A frame by the `eopJpl`
  model, with the same thresholds and no parity clause; raw QUANTITIES=31 is
  reported beside. Over 1800 to 2199 the raw frame term reaches about 0.5″ on
  the committed table extended, and the model was validated only from 1851 to
  2148: Swiss (.se1) is compared with the carried Horizons rows the same way,
  and if Swiss's own longitude difference exceeds 0.05″ on any row, the model
  does not hold there and the holdout part of (i) is NOT RUN. With the frame removed,
  the brief's thresholds make this a smoke test; (ii) is the holdout's
  precise test.
- **(ii) Swiss on the DE440 binary.** Corpus: the same 240 rows. Holdout: the
  holdout's rows. Swiss 2.10.03 reading `linux_p1550p2650.440`
  (`set_jpl_file`, `FLG_JPLEPH`), apparent geocentric ecliptic of date, given
  the TT the backend used. PASS when, for both longitude and latitude, the
  Moon's largest difference is ≤ 0.01″ and every other body's (the Sun
  included) ≤ 0.003″.
- **(iii) Canon anchors.** The four events of `canon-events.json`. For each,
  `/positions` is sampled (the Sun with the Moon, or with Venus) on a 60 s
  grid over ±3 h about the canon instant, then by golden section to 1 ms, for
  the TT at which the apparent geocentric separation of the two centres is
  least. Canon TT: the eclipses' TD; the transits' UT + 64.184 s (2004) and
  + 66.184 s (2012), as the file records. PASS when every |Δt| ≤ 2 s. The
  separation minimum is a stand-in for greatest eclipse, which is the shadow
  axis's least distance from the Earth's centre; the geometry puts it about
  +0.8 s (2017) and +0.2 s (2024) after greatest eclipse. The transits'
  canon TT from UT1 (`corpora/iers-finals2000A-ut1.csv`) is reported beside.
- **(iv) The 180-case benchmark.** `corpus.mjs`'s 18 cases by 10 bodies, by
  the original method: the Swiss side unchanged (`dump_swiss.py`, `calc_ut` on
  the case's clock as UT, Swiss's own ΔT, `FLG_SWIEPH|FLG_SPEED`); our side
  the case's UTC instant sent to `/positions`; `compare.mjs`'s difference and
  quantiles, with its `excluded` list empty. PASS when the 160 rows outside the
  far-future stratum have p50 ≤ 0.2″, p95 ≤ 0.4″ and max ≤ 0.5″. The 2100 and
  2190 rows are reported as statistics, with today's ΔT beside rc.6's and
  rc.8's. A clock-aligned variant (Swiss given the backend's TT) is reported
  beside, for attribution only. No per-case Swiss value is committed.
- **(v) The node.** North Node against Swiss `TRUE_NODE` on the DE440 binary
  (`FLG_JPLEPH`) at the backend's TT. Corpus: 41 instants (the 24
  `horizons-24` instants and the 17 distinct instants of the 18 benchmark
  cases). Holdout: the 200 holdout instants. PASS when each, separately, has
  p50 ≤ 1″ and max ≤ 3″; the pooled 241 are reported only. Swiss `TRUE_NODE`
  on the .se1 files is reported beside. The node is also held to its own
  oracle at 1e-6″ (C4).
- **(vi) Cross-runtime.** The engine's DE440 positions, bundled once, on the
  same pack bytes in Node 22.22.2, in Node 24 (the Vercel project's setting;
  production's own Node version is read from the deployment and recorded, and
  (vi) also runs on it if it is neither), and in the Chromium and Firefox of
  the site's pinned Playwright, for the 24 `horizons-24` instants by the 12
  position bodies: 288 rows. PASS when every longitude and latitude equals
  Node 22.22.2's to within 1e-9°. WebKit is reported if it runs.
- **(vii) CI.** Green in the engine's and the site's CI, on each pull
  request's head and on each `main`'s merge commit: tier A (every tier-A file
  of the alpha, and the engine's own tests of the entry point) and tier B (the
  alpha's tier-B tests on the CI-built pack; rule (viii)'s gate for the alpha;
  the engine's tier-B tests: rule (viii)'s gate for the port, C4's node gate).
  Tier B fetches the kernel from NAIF and checks its digest instead of M6's
  committed excerpt pack, because no derived pack may be committed
  (DECISIONS-2026-09-28 §11). "Green" means those jobs pass; other workflows'
  results are reported separately.
- **(viii) ERFA chain.** 200 TT instants by the rule below, by 10 bodies,
  2,000 rows, for each of two reducers: the engine's port on the raw
  `de440.bsp` through a test-only reader of the kernel, and the alpha's
  through `tools/spk-backend.mjs`. PASS when both reducers' every row is
  within 1e-6″ of the chain, the angular difference between two directions u
  and w being atan2(|u × w|, u · w).

The chain of (viii), fixed now. Its inputs are the runtime's own doubles:
ttDays = (TT ms − J2000 ms) / 86,400,000 and et = ttDays × 86,400 +
tdbMinusTt(jd), by the runtime's formula and operation order. It runs its own
light-time iteration in doubles (12 at most, 1e-11 s), as the runtime does,
but evaluates every state at the exact, unrounded epoch et − τ (the rational
value of the double et minus the rational value of the double τ), so that the
EMB's 30 km/s never multiplies a rounding of that epoch. Every state comes from
`de440.bsp` through the chain's own SPK reader (`tools/spk_exact.py`),
evaluated in exact rational arithmetic: positions from the type-2 Chebyshev
series, velocities from their exact derivative. The Earth is segments 0 to 3
plus 3 to 399, the Moon 0 to 3 plus 3 to 301; every vector the chain needs
(the geocentric target, the observer, the Sun's) is formed exactly and rounded
to a double once. Then pyerfa: `ld(1, p, q, e, em, 1e-14)` with e at
reception and q at emission, none for the Sun; `ab(p, v, s, bm1)`,
gravitational term included, with s the Sun to observer distance in au and bm1
= √(1 − v²); `pfw06`, `nut00b` scaled by the P03 rule (Δψ × (1 + 0.4697e-6 −
2.7774e-6 t), Δε × (1 − 2.7774e-6 t)), `fw2m(γ, φ, ψ + Δψ, ε_A + Δε)`, and
R1(ε_A + Δε) to the ecliptic, with t from (2451545.0, ttDays). The bodies'
segments: Sun 0 to 10, Mercury 0 to 1, Venus 0 to 2, Mars to Pluto 0 to 4
through 0 to 9. Constants as in "Reduction". Budget for the corrected Moon:
about 0.3 µas from the runtime's rounding of t − τ times the Moon's 1 km/s
about the EMB, and up to about 0.4 µas from eraAb's gravitational term, which
the runtime leaves out. Self-check, which can fail: every state the chain
reads at a double epoch (each instant's et, where it reads all twelve
segments) equals the research reader's
(`precision-2026-09-20/numerics/src/spk2.mjs`) to within 1e-14 of the
position's size and 1e-12 of the velocity's; and for each Moon row, the place
from the rounded epoch differs from the place from the exact epoch by no more
than the Moon's barycentric speed times that rounding, over its distance (with
1 % and 1e-9″ allowed for the rest of the chain). The reader check runs on the
pinned Node 22.22.2 and records its version and `spk2.mjs`'s digest.

Instants for (viii) and C4: for i = 0 to 199, d = SHA-256 of the ASCII bytes
`p41-erfa/<i>` (i in decimal, no padding, no newline); u = the first 6 bytes
of d read as a big-endian integer, divided by 2^48; the instant is
1800-01-01T00:00:00 TT plus u × 146,097 days, rounded to the millisecond.

## The holdout

The programme's standing rule
(`docs/platform/evidence/engine-beyond-swiss/PREREGISTRATION.md`, "Fresh
holdouts"), followed as step 1.4 implemented it
(`docs/platform/evidence/deltat-2026-09-25/tools/holdout.ts`): mulberry32
seeded with the first 32 bits (big-endian) of SHA-256 of
`zodiacs-holdout/P4.1`; 200 positions, each drawn as a UTC instant in whole
milliseconds over [1800-01-01T00:00Z, 2200-01-01T00:00Z) then a latitude and a
longitude (unused here, drawn so the instants are the standard ones). It is
generated only in S5, after the freeze, and opened once; the result records
the frozen commits, the generator's digest and the output's.

The holdout's rows for (i) and (ii) are its 200 instants by 10 bodies, less
the rows of Mercury to Pluto that Horizons puts within 0.5° of the Sun's
centre (great circle, from Horizons's own longitude and latitude; the planets'
responses for Mercury and Venus, the barycentres' for Mars to Pluto). Those
rows are reported and not scored, because Swiss clamps deflection behind the
solar disc and the reduction does not
(`precision-2026-09-20/DEFLECTION-AUDIT.md`). The Sun and the Moon are always
scored. The count of rows left out is reported. Rule (v) has no such rows.

## Verdict and the ledger

- The unit passes only if every rule passes (on its corpus and, for (i), (ii)
  and (v), on the holdout) and every check C1 to C12 passes. A failed check is
  a FAIL of the unit.
- Then the site's evidence pull request records P4.1 `validated`, release
  `merged`. After the merge, the deploy, (vii) on both `main`s and the
  production record, a record pull request, reviewed independently and merged
  under the owner's delegation of 4 November, makes DE440 the compute API's
  default and records P4.1 `accepted`, release `deployed`. Its own live check
  then sends one default request to each endpoint that gives positions (each
  must answer from DE440) and repeats the replay; if it fails, the record pull
  request is reverted, the ledger entry with it.
- Any FAIL: P4.1 is recorded `failed` for this version with every verdict and
  number. Nothing is re-run under this version. A later attempt is version 2,
  preregistered anew, and cites this one.
- NOT RUN: the unit stays `partial` until the rule runs. A NOT RUN is never
  recorded as a departure.
- A failed production record: the deploy is reverted or fixed by a new pull
  request, and the unit is not recorded `accepted` until a record passes.

## Known risks, written before any run

- (v) sits on Swiss's own three-position noise: rebuilt from Swiss's own Moon
  state, the node met `TRUE_NODE` at p50 1.01″ (the verifier: 0.952″) and max
  about 2.95″ (LEDGER.md, production-positions-4).
- (iv) keeps each side's own clock: ΔT model differences before 1972, and
  UT1 − UTC after it, reach the Moon at about 0.55″ a second.
- (ii): the pack's proven budgets put Venus on 2012-05-21 and Mars on
  2003-08-27 at about 0.0026″ and 0.0027″ of the 0.003″
  (`pack-compiler-20261031/README.md`); Swiss's model differences near 1800
  and 2200 are unmeasured.
- (viii) fails for the Moon without the geocentric Moon change (C3).
- The pack's bytes are proven identical only on macOS arm64 until S2's Linux
  step; the Vercel build must reproduce them too, or the engine refuses the
  pack.
- (vi)'s Firefox leg may run only in CI; Node 24 may differ from Node 22 in
  the last bits of `Math` functions.
- If Horizons's frame model fails its check on the holdout, the holdout part
  of (i) is NOT RUN and cannot be run again on the same inputs, so the unit
  cannot pass under this version.
- Vercel builds only `main`, so the deploy's pack step is first exercised by
  the production deploy; it must fail safe (astronomy-engine, named).
- Cost: each DE440 position takes a few Chebyshev evaluations per light-time
  step; searches in `/events`, `/sky-fact` and `/elections` take many. Their
  time against the functions' limits is measured in S5 and reported.

## Checks, each with a control that must fail

- **C1.** This file's commit, and S2's after it, precede every backend-code
  commit (S1's list): by ancestry in the site, and by the repositories' push
  records (GitHub's activity API) across both. Control: a synthetic history
  with a backend file first fails.
- **C2.** The engine refuses a pack one byte different from the pinned digest.
  Control: the unmodified pack opens.
- **C3.** Run once in S2: (viii)'s gate fails for the Moon on the unchanged
  alpha. Control for the gate's teeth.
- **C4.** The engine's node, computed through its own code from the raw
  kernel's Moon state (the test-only reader), equals the S2 node oracle (the
  definition above, computed by the chain) to ≤ 1e-6″ at the 200 instants of
  (viii). Control: a node with a (dN/dt) r term added to v, N the matrix to
  the ecliptic of date, fails it.
- **C5.** Rule (vi)'s comparison detects a 1e-8° change in one row.
- **C6.** The harness reproduces `results.json` from the committed inputs (the
  holdout's responses and the EOP2 file included). Control: an input with a
  changed digest is refused.
- **C7.** With `"backend": "astronomy-engine"`, every endpoint's `result` for
  `src/lib/compute-api/examples.json` equals what the vendored rc.2 gives, on
  the same Node 22.22.2 and the same machine, and so does its receipt apart
  from the engine's version and the backend fields this unit adds. Control:
  the same requests with `"de440"` differ.
- **C8.** Every endpoint that gives positions takes them from the source the
  request names. (a) In the engine's tests, with the DE440 source selected, no
  evaluation reaches astronomy-engine's position functions in any call the
  compute API makes (`natalChart`, `positions`, the crossing searches for
  ingresses, stations and lunations, `moonPhase`, `separation`, `matchAspect`,
  `aspectMotion`, and the searches `/sky-fact` and `/elections` run), counted
  by a spy on astronomy-engine. Control: with astronomy-engine selected, the
  spy counts calls. (b) On the handler, for both backends: the bodies of
  `/chart` equal `/positions`'s at the same instants, bit for bit; and for
  `/events`, from `/positions` with the same backend 2 s before and 2 s after
  each event, an ingress's longitude, a station's speed and a lunation's
  Moon-Sun elongation lie on opposite sides of their target. Control: the
  `/chart` equality fails when `/positions` names the other backend.
- **C9.** The engine's port equals the alpha's `apparent()` bit for bit on the
  pack at the 24 `horizons-24` instants by 10 bodies. Control: a port with one
  constant changed fails.
- **C10.** The pack is in no client bundle and cannot be fetched over HTTP
  from a deployment. Control: a file under `public/` is found by the same
  check.
- **C11.** A deployment without its pack answers default requests from
  astronomy-engine with the flag, and `"de440"` with the typed 503; a
  `"de440"` receipt carries the pinned digest;
  `scripts/build-compute-handler.mjs --check` passes. Control: with the pack
  present, the 503 does not occur; the receipt check fails against any other
  digest; and a handler built from changed source fails the `--check`.
- **C12.** Requests naming different backends, interleaved in one process,
  each get their own source's numbers, equal to the same requests sent one
  backend at a time. Control: a test double that installs its source for the
  whole process without restoring it fails the check.

## Reported, not scored

Per body, per stratum and per epoch band for (i), (ii) and (iv) (brief v1
§5). Cost: evaluations and wall milliseconds per request locally, and on the
deployed endpoint p50 and p95 latency, warm and cold, and the cost of 1,000
`"de440"` requests (as P3.3 recorded its own).

## Departures

Anything done otherwise than written here is a departure. Each is disclosed
in the README with its reason and effect, and the unit stays `validated`
until the owner ratifies it (the programme README's rule).

## The production record

After the merge and the production deploy (Node 24.x): one request to each
endpoint that gives positions, naming `"de440"`, answers from DE440 with the
pinned digest in its receipt; the 24 `horizons-24` requests of rule (i),
replayed against https://zodiacs.org, return positions within 1e-9° of the
local run's; Vercel shows no runtime errors from the change. The record pull
request repeats the replay with the default.

## Not claimed

Planet centres (Mars to Pluto are barycentres), the Klioner term, IAU 2000A
nutation in the angle path, analytic rates (speeds stay central
differences), error bounds (P4.3), the in-browser engine or a downloadable
pack (NAIF), the hosted MCP server, WebKit.
