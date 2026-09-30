# Engine rc.8 site adoption evidence

The site installs the exact archive
[zodiacs-engine-0.1.1-rc.8.tgz](https://raw.githubusercontent.com/zodiacs-org/engine/a5b7d1d19a1c79465b2970b9ae948a8b5721a7c4/artifacts/zodiacs-engine-0.1.1-rc.8.tgz),
SHA-256 `3b934376fa53983cbdd7eb1a6ecf0eb0d50fbc49df01bc610b20c63bd5d12be6`,
from `vendor/`. It was packed from the root of
[zodiacs-org/engine](https://github.com/zodiacs-org/engine) at source commit
`352ea49d9e1d7b07975a050bb4877acc454f86f5`; the artifact carrier is
`a5b7d1d19a1c79465b2970b9ae948a8b5721a7c4`, and the engine's merge commit
`a2b256f2d402b32eef202c756be824ef2f3e0dbb` carries the same bytes. An
anonymous read of that address on 2026-09-25 returned HTTP 200 and the same
51,748 bytes, with 30 archive members. The package is an unpublished
candidate: `npm view @zodiacs/engine` returns 404.

## What rc.8 changes

The engine's changelog lists five changes. Two of them move numbers the site
shows:

- **The clock.** Every calculation now runs on observed ΔT (TT − UT1), model
  `zodiacs-deltat/1`, step 1.4 of the engine brief, written down before its
  code in [`../deltat-2026-09-25/`](../deltat-2026-09-25/README.md) and
  amendment A2 of the preregistration. rc.7 used astronomy-engine's 2004
  polynomial: 75.50 s on 2026-09-22, where IERS has 69.20 s and the model
  69.20 s. Today's Moon moves back about 3.4″; the 124 new and full moons of
  2026–2030 come 5.93 to 8.49 s later, and the other events of the catalog by
  similar amounts. Every chart carries its ΔT, its 1-σ band and the table's
  version and digest.
- **Which events a search finds.** One crossing solver,
  `@zodiacs/engine/crossings`, is the one the site used for returns and the
  Moon's ingresses (`src/lib/engine/longitude-crossings.ts`, now removed).
  It has no sample budget and returns a typed refusal instead of throwing.
  With the new clock, no event in the committed catalogs appeared or
  disappeared: the 60 monthly catalogs list the same ingresses, lunations,
  stations and aspects, with the same signs, in the same order, and the Moon
  ingress, eclipse and sign-date catalogs have the same counts.

The other three change what a receipt says, not a position: a chart outside
1800–2200 carries the `outside-reference-span` flag; receipts name the
ephemeris (`astronomy-engine` 2.1.19, now an exact dependency) and record ΔT
under a new conventions set; receipts from rc.3 to rc.7 stay readable and
replay as before.

## What the site does with the clock

astronomy-engine keeps its ΔT in one module-level slot. The engine installs
its model there before each of its own calls, and the site's other callers
of astronomy-engine install the same model first: the data generators
through `scripts/lib/deltat-install.mjs`, the calendar function's CommonJS
instance in `src/lib/engine/server-ephemeris.ts`, and the tests that call
astronomy-engine themselves. `scripts/deltat-install-guard.test.mjs` fails
when a module that imports astronomy-engine does neither.

Each engine release freezes its ΔT table. Every Friday,
`.github/workflows/deltat-monitor.yml` runs `scripts/deltat-monitor.mjs`,
which checks the table against IERS's finals2000A.all using the rule in
section 6 of the ΔT record. When a refresh is due, it opens one issue or
comments on the one already open. It commits nothing. On 2026-09-25 the model
was 2.3 ms from IERS, and the table's last prediction knot was 372 days away.

## Records

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) are `scripts/platform-engine-report.mjs`
run against the vendored archive on Node 22.22.2 (tzdata 2025c) and Node
24.21.0 (tzdata 2026c). Both passed on the frozen Swiss node and polar pack,
with identical figures: 6.07″ in node longitude, 0.00035°/day in node speed,
1.58″ in the polar angles and exact whole-sign cusps, as with rc.7.

[public-candidate-consumer.log](public-candidate-consumer.log) records the
engine repository's own `scripts/verify-packed-consumer.mjs`, at the source
commit, run against the vendored archive on both Node versions. Each run
installs the archive into a fresh directory and uses only the root, geo,
receipt and crossings exports and the archive's declarations, with TypeScript
5.9.3. All 16 checks passed. The `./deltat` export is not among them; the
site's own tests import it (`scripts/lib/deltat-install.mjs`,
`src/lib/engine/server-ephemeris.test.ts`). It is an automated check run by
the integrator, not an independent review.

The Swiss Ephemeris comparisons were run again on rc.8, statistics only:
[`../swiss-benchmark/RESULTS.md`](../swiss-benchmark/RESULTS.md) has both the
180-case set and the every-tenth-day comparison from 1800 to 2199.

## Limits

There is no separate browser record for rc.8; the site's own Chromium checks
run the vendored package in CI. ΔT before 1620 is an estimate, not a
calibrated 1-σ, and after the table's last predicted day (2027-10-02) it is an
extrapolation whose band grows with the years. The analytic Moon is unchanged,
so before about 1955, where rc.7's clock error partly offset the Moon's own,
the Moon is further from Swiss at the same UT than it was: a median of 3.9″
instead of 2.9″ over 1850–1899. That is M2's work. Exact geographic poles and
ecliptic-horizon coincidences remain outside verified angle scope.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the two parity reports here lost their per-case differences from
the Swiss node/polar fixture (`nodes` and `polar`). Their maxima, which the
figures above quote, stay, and each report records the SHA-256 of what it
lost under `swissOutputRemoved`; the Node 22 and Node 24 digests are equal,
as the values were. Commit `2ca93d41` still has the reports whole.
`scripts/platform-engine-report.mjs` now measures against the NASA JPL
Horizons and ERFA references
([`../../../engine-validation/independent-references/`](../../../engine-validation/independent-references/README.md));
run it at `2ca93d41` to measure against the Swiss fixture again. The record
of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
