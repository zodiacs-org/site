# Independent epoch, station, progression and return validation

Eight additional cases use an oracle acquired before application comparison,
under the immutable `src/lib/engine/fixtures/swiss-eight-cases-policy.json`.
The tests consume a 47KB projection of the raw receipts. Every extracted field
has its exact input filename and JSON Pointer in the fixture's `sourceMap`.
`extract-fixture.py` verifies all three input hashes and refuses to overwrite
an existing extraction. It performs no application or ephemeris calculations.

| Cases | Owning test | Independent input and scope |
| --- | --- | --- |
| E1800, E2000, E2199 | `engine.test.ts` | Ten-body Swiss positions on 1800-01-02, leap day 2000 and 2199-12-31; representative epochs, not an exhaustive range certificate |
| Mstation, Sstation | `transit-scan.test.ts` | Mercury minimum and Saturn maximum in fixed 2026 windows, targets 0.10° inward from the independent extrema, both exact contacts and disjoint timing bands |
| P2020 | `progressions.test.ts` | A literal nonzero 365.2422-day year maps to 2020-01-01; ten existing JPL Horizons longitudes check positions, not a published progression report |
| Solar1990 | `solar-return.test.ts` | Independent birth-Sun target, return root and chart; separately acquired chart at the product's returned timestamp |
| Saturn1990 | `returns.test.ts` | One consistent nominal-UT1 birth and complete 26–92-year scan; seven passes in seasons of 3/1/3 |

The first six node/polar references remain separate, byte-preserved fixtures
documented in `../swiss-node-polar/README.md`. The five existing independent
solar-longitude crossing vectors retain their original 60/120-second limits.
Same-engine and doctrinal sanity checks remain labelled separately.

## Immutable source receipts

| Artifact | SHA-256 |
| --- | --- |
| Frozen eight-case policy | `9dfc069be7c6854da1f0dff578c0b213e64624e720d21e27c6301b7612fd79a4` |
| `eight-case-oracle.raw.json` | `26b7d70935e1d4e95aae655fa54041a07d1a22c07cb7422aead44a4f24072c94` |
| `eight-case-evaluations.jsonl.gz` | `eb992af0b5ae5fc1970529a907695068e4dd78f6c978ce37cd0ed43cf0b0b9d8` |
| `returned-chart-oracle.raw.json` | `77fa5b4518d27e28e2830cf1eaffd790b23765a06550ce96031557803c4c5241` |
| Compact `swiss-eight-cases.fixture.json` | `e51073b6c78ce721a4cd284d6626566c1c267c63075e6c81654302d6d5f9c7ed` |
| Initial application comparison | `97a3176462e6def11bbdb2706c8132f023ee125226ff3181bcc6b087cc2e3974` |
| Final comparison with returned chart | `a0fc52b1e47f8abbfe899b9d0170096d2d3e307a0ac99e857d3972812583bee4` |

The full raw expected values, compressed evaluation journal, generation and
comparison recipes, acquisition/runtime receipts, original source hashes,
application results and failure logs are retained separately in the immutable
Wave19 validation evidence bundle. Raw oracle and application outputs remain
separate. The journal preserves all 101,718 distinct provider evaluations;
every one returned flags 258, finite six-tuples and an empty C warning buffer.
The same-time Solar supplement preserves another eleven such body tuples.
Do not replace original raw receipts when adding later references.

The acquisition uses pinned, unmodified Swiss 2.10.03 through pyswisseph
2.10.3.2 and the same official DE441 files/hashes documented with the six-case
pack. Source and ephemeris binaries are not redistributed in this repository.
Provider [coordinate conventions](https://www.astro.com/swisseph/swisseph.htm)
and [API documentation](https://www.astro.com/swisseph/swephprg.htm) describe
the reference calls. P2020 retains the existing literal [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html)
quantity-31 geocentre tuple, originally retrieved 2026-07-05; its provider
version was not recorded and remains unknown.

## Time scales, conditioning and accuracy limits

UTC cases use `swe.utc_to_jd`: TT for positions and Swiss-model UT1 for houses.
The intended UTC branch is checked against TT-minus-nominal-UTC values of
57.184 seconds for the 1990 Solar birth, 64.184 for the 2000 epoch, and 69.184
for modern station/return searches. No optional leap-second or Delta-T files
were installed. E1800, E2199 and the entire Saturn1990 chronology instead use
nominal UT1, with Swiss Delta-T converting to TT. Their ISO `Z` strings are
numeric application transports, not claims of historical/future civil UTC.
E1800 starts on January 2 so the pinned planet file covers light-time lookback.

Swiss flags 258 request apparent geocentric tropical ecliptic-of-date positions.
The product's Moon path computes its lunar state at `MakeTime(date)` and then
precession/nutation, without an explicit light-time/aberration pass. This known
difference remains under the unchanged 0.15° Moon gate; identical apparent
corrections are not claimed for every body. Other planet gates remain 0.05°,
node longitude/speed gates 0.10°/0.02° per day, ASC/MC 0.1°, and cusps 0.2°.
These are engineering acceptance limits, not provider guarantees or uniform
error envelopes over the supported range.

Timing intervals were solved independently from Swiss longitude, before any
application output: ±0.05° for fixed targets and ±0.10° for natal-derived
returns, allowing natal and moving longitude budgets separately. Every band
is connected on one monotonic branch, excludes query endpoints/extrema, is
disjoint from the others, and has only one second of formatting padding.
The oracle checks *all* extrema/endpoint margins, including branches with no
exact root, because a near miss could otherwise gain two application roots.
Reference roots have brackets no wider than 0.1 seconds. That bracket precision
does not determine cross-model event accuracy. Mercury contact bands span
roughly 0.73–0.75 day; Saturn station bands roughly 5.61–5.64 days. Planetary
speed residuals are diagnostics, with no new tight station-speed gate.
Direction checks requiring both absolute speeds above 0.02°/day deliberately
skip the two Saturn station contacts. The full Saturn return pass directions
are independently asserted outside that station deadband case.

## Returned-chart clock applicability

The original independent Solar root remains as the pack recorded it (the
instant left this file on 2026-09-29, below). The initial product return was
`2025-01-31T23:57:48.787Z`, less than one second after it, and its chart
received a separate Swiss evaluation at that exact timestamp. Only the
timestamp was supplied by the product; location came from the frozen input
policy, and all expected coordinates came from Swiss. Both independent
return-time checks remain separate from chart parity.

The test first verifies that this same-time reference applies to the actual
returned timestamp. If solver output changes, even within the unchanged
independent timing band, it fails explicitly requesting a new independent
same-time Swiss acquisition. This exact clock guard is fixture applicability,
**not** a newly tightened ephemeris timing guarantee. Never compare shifted
clocks or widen the original timing band to make a new result pass. Preserve
all old raw receipts when adding a new same-time supplement. A separate test
continues to compare charts at the original independent fixed instant.

The chosen Solar input selects the same nearest and most-recent event. It
exercises both paths but does not independently prove selection differentiation.
Unlocated mode is checked for identical instant/body positions and absent
angles/houses. Independent comparisons ran against clean commit
`a395549a36991c031b48a1d104b706e9df935f41` with Node 22.23.2;
the raw receipts retain all imported source/dependency hashes.

## Extraction

From the repository root, with the immutable bundle unpacked elsewhere:

```sh
python3 docs/engine-validation/swiss-eight-cases/extract-fixture.py /path/to/evidence /tmp/swiss-eight-cases.fixture.json
```

Verify its hash against the table above before comparing with the committed
fixture. The frozen policy is copied byte-for-byte, not reconstructed by this
script. Raw acquisition is intentionally outside offline tests and CI.

## Addition, 2026-09-25: engine 0.1.1-rc.8

`@zodiacs/engine` 0.1.1-rc.8 computes on observed ΔT instead of Astronomy
Engine's own Delta-T model, and the product's Solar return moved from
`2025-01-31T23:57:48.787Z` to `2025-01-31T23:57:54.143Z`, +5.356 s, still
inside the unchanged independent timing band. The exact clock guard above
failed, as designed.

No new same-time Swiss acquisition was made: the raw package and pinned DE441
files are not available here, and this repository now keeps new Swiss output
to statistics. The guard was changed instead, and this departs from the rule
above, so it is stated here. The Swiss chart is kept as acquired and is still
compared at identical clocks: the product's chart computed at
`2025-01-31T23:57:48.787Z` meets every returned-chart gate. The returned chart
must equal the chart computed at its own instant, and the two instants may
differ by at most 15 seconds; beyond that the exact rule above applies again.
The independent timing band was not widened, and no raw receipt was changed.

## Addition, 2026-09-28: the fixture left the tree

Under [DECISIONS-2026-09-28 §3](../../platform/programme/DECISIONS-2026-09-28.md)
the compact fixture `src/lib/engine/fixtures/swiss-eight-cases.fixture.json`,
SHA-256 `e51073b6c78ce721a4cd284d6626566c1c267c63075e6c81654302d6d5f9c7ed`
as in the table above, left the tree. Commit `2ca93d41` still has it, and
`extract-fixture.py` regenerates it from the retained bundle as under
Extraction, into a path outside the repository. The frozen policy stays and
still gates the tests: `engine.test.ts`, `transit-scan.test.ts`,
`solar-return.test.ts` and `returns.test.ts` read
`independent-eight-cases.json`, the same cases, inputs and bands with NASA JPL
Horizons and ERFA as the arbiter
([`../independent-references/`](../independent-references/README.md)).
`progressions.test.ts` takes its ten JPL longitudes from
`horizons-reference.json`, which holds the same values. The Solar1990
returned-chart reference is taken at the instant the product returns, under
the same 15-second rule. The figures above are this pack's, measured against
Swiss. The record of everything removed is
[`../SWISS-OUTPUT-REMOVAL.md`](../SWISS-OUTPUT-REMOVAL.md).

## Addition, 2026-09-29: the Swiss root left this file

Under [DECISIONS-2026-09-29 §2](../../platform/programme/DECISIONS-2026-09-29.md)
no per-case Swiss value stays as data, and the section on returned-chart
clock applicability gave the Solar root's Swiss instant and the product's
residual from it, which together gave it back. Both left; the root is in
commit `2ca93d41`, in the fixture and in this file, and `extract-fixture.py`
regenerates it outside the repository.
