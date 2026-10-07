# Technical decision: one product station source, 1 October 2026

Recorded by the programme integrator under the existing programme mandate and
reviewed implementation-repair direction. This is not a new claim of explicit
owner approval, a scope deletion or a changed accuracy gate.

## Existing contract

`scripts/build-sky.mjs` supplies product SkyTicker/retrograde data and
`src/lib/events/catalog.ts` derives timeline station facts from its boundaries.
It is not an independent accuracy reference. `scripts/build-transits.mjs`
explicitly uses the same ±0.25-day wrapped central-difference longitude speed
so its monthly stations and sky.json name the same moment. The catalogue's
existing agreement test requires less than two seconds.

The rc.16 adoption changes the monthly generator to the package's full IAU
2000B ecliptic-of-date frame, while build-sky still calls astronomy-engine's
five-term frame on its model/UT1 clock. The original mixed-source review is
retained unchanged in `evidence/site-engine-rc16/DAILY-EVENTS.md`: all 90
monthly station instants move; maximum 2,651.961 seconds, 52 displayed minutes
and no dates. This breaks that existing product-consistency contract.

WIP `HANDOFF-STATUS-rc16.md` step 13 expected the direct generators to stay on
their older nutation and asked for their margins. The measurement invalidates
that transitional assumption for product stations. FINDINGS F-52 already
records the product's two-clock debt and proposes giving these generators the
engine's time basis.

## Narrow repair

Only build-sky's longitude primitive changes to the same
`@zodiacs/engine/internal` bodyLongitude used by build-transits. Both remain
apparent geocentric tropical ecliptic-of-date longitudes, with the same
light-time/aberration semantics. The implementation now shares full IAU 2000B
nutation and the package's UTC/IERS time interpretation in its covered span.

The ±0.25-day derivative, daily scan, 16 bisections, range/clamping behavior,
retrograde sign predicate, shadow definition and existing <2 s test stay
unchanged. It does not substitute the engine's finer ±0.001-day body speed.
Existing generatedAt is preserved for reproducibility. Only affected product
data are regenerated. Other direct-astronomy generators and protected Moon
items are outside this repair.

Old/new station evidence is retained; new aligned catalogue evidence and an
independent statistics-only Swiss rerun are required. A consistent product
source does not make it physically exact and does not accept any programme
accuracy/release gate. Raw Swiss values/code/data are neither committed nor
used as expectations. The holdout Moon corpus and DE440 are untouched.
