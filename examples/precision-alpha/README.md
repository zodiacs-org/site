# precision-alpha

An experimental runtime that reads a compact ephemeris pack, computes apparent
geocentric places with a corrected reduction, and runs a bounded
longitude-event search — in a browser and in Node, from one copy of the
numerical rules.

It is an alpha. It does not replace the production engine, it is not wired
into the site, and no pack is distributed with it.

## What it supports, exactly

**Bodies.** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune,
Pluto. For **Mars, Jupiter, Saturn, Uranus, Neptune and Pluto** the DE440s
kernel carries only the planetary-*system* barycentre, so that is what this
returns; every result for them carries `isSystemBarycentre: true` and the
field is not cosmetic. Mercury, Venus, the Moon and the Earth have body-centre
segments and are the real thing.

**Coordinates.** Apparent geocentric ecliptic longitude and latitude of date,
in degrees, referred to the true equinox and equator of date, plus the
geometric geocentric distance in km. The observer is the geocentre: there is
no topocentric parallax, no diurnal aberration and no refraction.

**Velocities.** The backend returns the barycentric ICRF state derivative in
km/s, taken as the analytic derivative of the same Chebyshev polynomial as the
position rather than a finite difference of it. No apparent angular rate is
reported, because a rate consistent with light-time and aberration is not the
state derivative rotated, and the search differentiates the reduction as a
whole instead.

**Corrections applied.** TDB−TT (two-term Astronomical Almanac form, error
under 30 µs); light-time iteration to a caller-set tolerance; gravitational
light deflection by the Sun (the `eraLd` form, with the near-limb clamp set
far below the solar limb and reported when it binds); annual aberration
(special-relativistic, with a first-order switch); IAU 2000 frame bias; IAU
2006 precession; IAU 2000B nutation, all 77 published luni-solar terms,
adjusted to P03.

**Not modelled.** ΔT — the caller supplies TT, not UTC. Deflection by anything
but the Sun. Anything topocentric. IAU 2000A nutation: on this corpus it moves
apparent longitude by at most 0.0025″ for seventeen times the table, so it is
not carried; the research track keeps it for that comparison.

**Barycentric position is not offered**, and that is a decision rather than an
omission. The compression work declared a 0.2 km target on the barycentric
Moon and missed it: 0.165 km sampled, but **0.449 km on the proven bound**, and
the target is on the bound. Geocentric output — which is what this package
does expose — is a different quantity and is inside the target (0.00946 km
sampled, 0.0224 km proven), because the EMB term cancels against the observer.
Earth and Moon are derived from the same two stored bodies through the pack's
EMRAT, so their errors are correlated, and no geocentric bound here is built by
adding them as though they were independent. `CONTRACT.barycentricPositionExcluded`
carries this.

`CONTRACT` in `src/core/reduce.mjs` is this list in machine-readable form, and
`SEARCH_CONTRACT` in `src/core/search.mjs` is the equivalent for events.

## Structure

```
src/core/     environment-neutral: no node:*, no Buffer, no require, no clock
  errors.mjs            typed errors with codes
  source.mjs            the byte-source contract both loaders implement
  container.mjs         parse, validate, and the integrity POLICY
  ephemeris.mjs         Chebyshev evaluation, analytic derivative
  nutation*.mjs         IAU 2000B, from the published series
  frames.mjs            bias, precession, nutation as explicit matrices
  reduce.mjs            the apparent-place reduction — one copy, every caller
  interval-search.mjs   the bounded typed-verdict search
  search.mjs            longitude events over the reduction
  retarded.mjs          Newtonian reception light-time, as a verified contraction
  aberration.mjs        stellar aberration, pointwise and over intervals
  retarded-search.mjs   the four experimental modes, on one subdivision loop
  deflection.mjs        solar light bending, pointwise and over intervals
src/index.mjs        open, run, dispose — everything except how bytes arrive
src/browser.mjs      fetch / Response / Blob. No shims, no polyfills.
src/node.mjs         whole-file load, or a file-backed low-memory load.
src/experimental.mjs  modes being validated, behind their own import
```

The browser and Node entry points differ only in which byte source they
build. There is no second copy of the reduction, the validation or the
integrity policy for either to drift from.

## Three different things, never conflated

1. **Structural validity** — the artifact is self-consistent and safe to read.
   `parseContainer` decides this, synchronously, and allocates nothing from a
   header number it has not already bounds-checked.
2. **Integrity** — the bytes match a digest. The pack format used here
   (`ZODEPH02`) carries a SHA-256 over *everything before it*, header
   included; the earlier `ZODEPH01` hashed only the payload, which left
   `intervalSec`, coverage, EMRAT and every scale factor covered by nothing.
   Editing `intervalSec` in a v1 pack moved the Moon by 5.7·10⁵ km and verified
   clean. v1 packs are refused; `tools/seal.mjs` converts one without touching
   a coefficient.
3. **Authenticity** — that the pack came from a particular party. **This
   package does not establish that**, and says so on every result:
   `integrity.authenticity` is the sentence "not established: a digest stored
   in the artifact cannot attest to its source". Passing `expectDigest`, a
   digest you obtained *out of band*, is the only input here that gets closer.

There is no option to skip verification. A pack that does not verify does not
open — in the demo, in the tests, anywhere.

## Using it

```js
import { openPackFile, CORRECTED } from '@zodiacs/precision-alpha/node';

const rt = await openPackFile('/path/to/pack.zeph');
rt.apparent('Moon', 8765.5, CORRECTED);
// { body: 'Moon', lon: 155.982712…, lat: 3.568141…, distKm: 404633.75…,
//   isSystemBarycentre: false, lightTimeSec: …, dpsiArcsec: …, … }

rt.search({
  kind: 'aspect', body: 'Moon', other: 'Sun', targetDeg: 0,
  fromTtDays: 8766, toTtDays: 9131,
  epsilonDeg: 1 / 3600,          // required: declare the allowance up front
});
rt.dispose();
```

`ttDays` is TT days past J2000. `epsilonDeg` has no default on purpose:
choosing the angular allowance after seeing the margin is the move the
original Uranus D contract forbids, so the search will not choose it for you.

In a browser, `openPackFromUrl`, `openPackFromResponse` or `openPackFromBlob`
from `@zodiacs/precision-alpha/browser`. `crypto.subtle` is exposed only on a
secure context, so a page served over plain http on a non-localhost origin
cannot verify a pack; the failure says exactly that rather than degrading.

## The experimental modes

Behind a separate import, because they have not finished the
preregistration-and-holdout route the released modes went through, and
mixing them into `PrecisionRuntime` would make the difference a matter of
reading documentation.

```js
import { openPackFile } from '@zodiacs/precision-alpha/node';
import { experimental } from '@zodiacs/precision-alpha/experimental';

const rt = await openPackFile('/path/to/pack.zeph');
const x = experimental(rt);

const spec = { body: 'Mars', targetDeg: 95, fromTdbSec: -3.2e6, toTdbSec: 3.2e6 };

x.searchRetarded(spec);                          // reception light-time only
x.searchRetardedAberrated(spec);                 // + the observer's own motion
x.searchRetardedAberratedOfDate(spec);           // + the frame of date
x.searchRetardedAberratedDeflectedOfDate(spec);  // + solar deflection

x.dispose();      // detaches the handle; the runtime still owns the buffers
rt.dispose();
```

`fromTdbSec`/`toTdbSec`, not `ttDays`: these operations do no time-scale
conversion, because SPK coefficients are indexed by TDB and folding an
unbounded TT conversion into an operation whose point is a bound would make
the bound about something else. Converting is your decision, made where its
error can be stated.

All four return the same v2 result contract the released modes do, so
`isProven` narrows them the same way. **None is an apparent place**: the
Shapiro delay and everything topocentric are absent from all four,
deflection from the first three, and precession, nutation and the IAU 2006
frame bias from the first two. `diagnostics.notApplied` lists what a given
result omits, by name.

**The two of-date modes measure `targetDeg` from a different origin.** They
use the true equinox of date; the first two use the fixed J2000 ecliptic.
Those differ by precession since J2000 — roughly a quarter of a degree over
a couple of decades — so the same number asks two different questions, and
a crossing inside the window in one frame can fall outside it in the other.
`result.request.frame` names which.

### The deflected mode can decline, and the others cannot

`searchRetardedAberratedDeflectedOfDate` is the first mode here with a
**restricted domain**. Inside five degrees of the Sun it declines to answer
rather than guessing, so a window crossing a solar conjunction comes back
with `accounting.excluded` non-empty, `completeness.established` false, and
an event list that is a **lower bound over the request** rather than a
total:

```js
const r = x.searchRetardedAberratedDeflectedOfDate(spec);
if (r.accounting.excluded.length > 0) {
  // r.events is a lower bound.
  // r.interval.decidedTdbSec is what it IS exhaustive over.
}
```

That is not a failure, and the result does not present it as one — but a
consumer that reads `events` without reading `accounting.excluded` silently
turns *we did not look there* into *there is nothing there*, which is a
wrong answer rather than an error. `accounting.excluded` and
`accounting.unresolved` are also different answers and stay apart: excluded
is "no answer here at any resolution", unresolved is "not settled at the
cell size this run reached".

Two more things about that mode specifically. The **Sun as target** is
answered and *not* deflected — a body does not deflect its own light — and
`diagnostics.deflection.appliedToThisBody` is how a reader tells, since the
mode name alone would not. And it **costs**: measured, one to four times
the of-date mode where the window holds no conjunction, and 47 to 831 times
where it does. The deflection arithmetic is nearly free; isolating the
domain boundary is not. Research records in the repository, not in the
published archive, say what came of that: `DEFLECTION-RESULTS.md` records
that the layer **failed** its own preregistered usefulness rule at that
price, and `CHART-ADAPTER-CONTRACT.md` says what a full-chart integration
would need from it — including that on 32.9 per cent of days between 1900
and 2100 at least one charted body sits inside the floor.

### Where it can answer, asked separately from what it answers

Most of what the deflected mode costs is finding out *where* the floor
lies, and that question has no target longitude in it. So it can be asked
once and reused:

```js
const plan = x.planDeflectedDomain({ body, fromTdbSec, toTdbSec, packDigest });
for (const targetDeg of longitudes) {
  const r = x.searchRetardedAberratedDeflectedOfDateOverPlan({
    body, targetDeg, fromTdbSec, toTdbSec, plan, packDigest,
  });
}
```

`planDeflectedDomain` never receives a longitude — that is how its
independence from one is established rather than asserted. The plan
returns four span lists that tile the request exactly and mean four
different things: **admissible** (proved at or above the floor at every
instant), **excluded** (proved below it), **boundary** (proved neither —
the transition is in here, and the span's width is the whole of what is
known about it), and **unprocessed** (never examined; not excluded, and
not searched-and-empty).

A plan carries a `key` naming the pack, observer, body, profile, window,
tolerance and numerical policy it is a proof about; handed to a request it
is not about, it is **refused**, not silently recomputed. Pass
`packDigest` — without one the plan records
`identityStrength: 'structure-only'`, which cannot tell two packs of the
same shape apart.

Two other things are refused, and both are refusals about trust rather
than about the request. A plan that did not finish classified only part of
its window, so reusing it answers the request over a fraction of itself;
`acceptPartialPlan` takes it anyway: the run searches the part the plan
did classify and then reports `finished: false`. And a plan this runtime did not derive — one that came
back from a cache, a file or a worker message — is refused outright,
because a matching key is a fingerprint and not a signature: it says the
plan is *about* this request, not that anyone proved it.
`acceptImportedPlan` takes it on your authority after a check that its
spans are well formed, inside the request, disjoint and tiling it exactly.
Shape is all that can be checked; a structurally perfect plan with false
verdicts still passes, so a result over an import carries
`completeness.restsOnImportedPlan` and says CONDITIONAL in its statement.

The result is a **different contract** —
`zodiacs-partitioned-search/1`, not the released search result — because
it states completeness over the spans it names rather than over the
request, and its events carry an `eligibility` and a `positionFrom` the
released contract has no place for. A crossing found in a boundary span
was located *without* the solar term and says so.
`EXPERIMENTAL.partitioned.migration` names every field that moves.

Measured on twenty 300-day windows: the two Moon cases go from spending
the whole four-million-evaluation budget without finishing to finishing
inside it; Mercury costs 9.2× less; the conjunction-free controls cost
about 3 per cent more. One repeated longitude query already pays for the
plan on every conjunction case. `PARTITION-RESULTS.md` has the numbers,
including the two targets it did not meet.

Version 2 of the partition (`zodiacs-domain-partition/2`) meets them:
enclosing the Moon's geocentric vector from merged weights, and its
elongation in centred form, takes the Moon's boundary from 5.266 to 0.0114
per cent of its window, and every conjunction case is at least 5.44x
cheaper than the plain search, which on the Moon now finishes too.
`PARTITION-EVALUATION-V2.md` is the rule and `PARTITION-RESULTS-V2.md` the
result; version 1's stand beside them.

No coefficient pack to hand? `examples/04-experimental-aberrated.mjs`,
`examples/05-experimental-deflected.mjs` and
`examples/06-plan-once-many-longitudes.mjs` run on a synthetic fixture
that ships with the package — real arithmetic, an openly fake sky.
`docs/platform/evidence/precision-aberration/browser/` is the same thing in
a browser, on these ES modules with no bundler;
`docs/platform/evidence/precision-deflection/cross-runtime/` runs all four
modes on one file in Node, Chromium and Firefox; and
`docs/platform/evidence/precision-partition/cross-runtime/` does the same
for the plan itself.

## What a search result means

Results carry `contract: 'zodiacs-precision-search/2'`. Branch on it.

Nine parts, kept apart because they answer different questions:

- `events` — what was found, each with a bracket, not a bare instant. Always
  returned, whatever else the run concluded.
- `interval` — what was requested against what was actually decided.
- `execution` — whether the run **finished**. `finished`, `budget-exhausted`,
  `cancelled` or `refused`. Finishing is not the same as proving anything.
- `accounting` — whether every part of the interval was accounted for, and
  which parts were not.
- `completeness` — `established` (a Boolean), `support` (`none`,
  `conditional` or `proven`), and `conditionalOn`.
- `assumptions` — every unverified thing by name, with what would settle it.
- `eventCount` — `found`, and `isExactTotal`, which is true only when
  completeness is established. Otherwise there is a `conditionalTotal`,
  labelled as conditional.
- `uncertainty` — numerical, model and physical, never summed.
- `diagnostics` — declared bounds, branch splits, the aliasing measure.

### The declarations describe all six modes now, and did not before

`types/experimental.d.ts` shipped for three rungs without ever being
compiled — the type suite's `paths` mapped `.`, `/node` and `/browser` and
not `/experimental` — and `types/index.d.ts` described only the released
modes' results. So `accounting.excluded`, `interval.decidedTdbSec` and the
whole TDB-second event shape were absent from the declarations while the
runtime returned them: a TypeScript consumer could not read the deflected
mode's domain verdict at all without a cast.

Both are fixed, and the fix has a cost worth stating. A result's time-scale
fields are now **optional**, because an event carries TT days *or* TDB
seconds and never both, and a required field that half the results do not
carry is a declaration that lies about half its results. Released-mode code
reading `event.ttDays` under `strict` now needs a guard. That is the
compiler asking a fair question: `SearchResult` is one type and both kinds
of result flow through it.

**The empirical apparent mode never establishes completeness.** Its
derivative bounds are maxima sampled on a grid and multiplied by a factor,
and `src/core/result.mjs` refuses to build a result that claims more than
its support allows — the invariant is enforced when the object is
constructed, not written down in prose and hoped for.

That matters because the alpha's v1 contract did claim more. An angle making
96 turns across the 96 default sampling intervals returned `no-crossing,
certified, count 0` where the truth is 96: every sample read the same phase.
`MIGRATION.md` has the field map and the measurements; the case is a test.

### What the search assumes, and cannot check

One assumption cannot be verified by sampling and is stated rather than
hidden: **`maxRateDegPerDay`**, the fastest the searched angle can move. The
method unwraps differences of a wrapped angle, which is valid only while the
angle moves less than a half turn across a step — and no grid can detect a
violation, because an angle turning a whole number of times between every
pair of samples reads exactly like one that does not move. The default is 20
degrees a day, which covers this contract's ten bodies. A rate above the
declared ceiling is refused; a step too long for it is refused up front. A
caller who declares a ceiling the quantity exceeds gets a wrong answer, and
that is why the ceiling is on every result as an unverified assumption.

## Licences

See `NOTICE.md`. The nutation coefficients come from ERFA (BSD-3-Clause,
derived with permission from IAU SOFA); `LICENSE-erfa` is the required notice.
No kernel, no pack and nothing from Swiss Ephemeris is committed here.

## Acceptance

`ACCEPTANCE.md` is the checklist this work is measured against, frozen before
implementation. Items are marked from evidence, and never because a different
item passed.
