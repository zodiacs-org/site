# rc.17 gates, 6 October 2026

Checkpoint 21 judges the unit engine 0.1.1-rc.17 was made for, once production
serves it.

| unit | weight | gate | verdict |
| --- | ---: | --- | --- |
| P3.2, uniform calculation API | 3 | `.d.ts` covers every `calc_ut` option Phase 2 ships; round-trip fixtures; typed refusals | validated: met for every option it ships inside 1800–2200; a caller's ayanamsa carried by precession from an epoch outside that span counts only on a reading the owner has to ratify (FINDINGS F-80) |

**Release state.** For an engine capability the ledger needs an engine
candidate the site vendors and production serves
(`docs/platform/programme/README.md`, *Status and release*). Production
`dpl_64jrZa9XhBh51S8b9FryzfSkSnbA` (READY 2026-10-06T03:42:45Z, aliased to
zodiacs.org) serves site `6f873334` (#663), which vendors the rc.17 archive
`9cd24c78…299a`. Its
engine chunk names `0.1.1-rc.17` and is byte for byte the chunk a local
build of `6f873334` writes, and its compute API answers the documented
positions example with the body that build recorded, which names rc.17. The
site does not call `@zodiacs/engine/calc`
(`scripts/engine-entry-imports.test.mjs`); that is the release state the
ledger asks of an engine capability, as it was for `/calc` on rc.16 at
checkpoint 14. rc.17 is not on npm: publication is a unit of its own (P3.1a),
and under `DECISIONS-2026-10-05.md` §7 the next one is the 1.0 candidate.

## P3.2: validated

At checkpoint 14 (`../rc16-gates-2026-10-04/README.md`) the gate's first
clause was not met, for two options Phase 2 ships. The engine's own map of
Swiss Ephemeris's `calc_ut` flags typed `SEFLG_SIDEREAL` in but refused it
(`not-in-this-version`), while `@zodiacs/engine/vedic` computes sidereal
longitudes; and `CalcAyanamsa` named the nine built-in ayanamsas only, while
`/vedic` also ships `userAyanamsa`, the counterpart of `SE_SIDM_USER`. So the
clause asks two things of each option: that the declarations have it, and
that the functions compute it rather than refuse it.

**The declarations.** In rc.17, `calc()`, `houses()`, `events()` and
`chart()` take `zodiac: { sidereal }` with one of the nine built-in
ayanamsas or a caller's own (`CalcUserAyanamsa`).
`tools/calc-types-cover-vedic.ts` holds calc's types to what `/vedic` ships:
the same nine names and precession models; a caller's ayanamsa with the same
fields, the same optional ones and the same type in each but the epoch; and
each of the four request types taking the zodiac. The epoch is written in
calc's own vocabulary: an ISO string or a `Date`, as `/vedic` takes them, and
a TT Julian date as `{ jd, scale: "TT" }`, where `/vedic` writes
`{ julianDateTT }`; the check holds the epoch to exactly what `time` takes.
`/vedic` also takes epoch milliseconds, which calc's vocabulary does not, and
calc also takes a UT1 Julian date (`SE_SIDBIT_USER_UT`). The file runs
nothing; `tsc --strict` compiles it against rc.17
([`results/calc-types-rc17.log`](results/calc-types-rc17.log)) and refuses
it against rc.16, extracted from `vendor/`, where `CalcUserAyanamsa` and
`CalcAyanamsaModel` do not exist and eight assertions are false
([`results/calc-types-rc16.log`](results/calc-types-rc16.log)); five more,
which read the missing `CalcUserAyanamsa`, pass there only because `tsc`
reads a missing type as `any`. Eighteen faults, each one change to a copy of
rc.17's `calc.d.ts` (a name, a model or a field left out, an optional field
made required, a field narrowed, widened or made unusable, an epoch form
taken away, a function's request without the zodiac), each make `tsc` refuse
the check at the assertion they break, and the unchanged copy compiles
([`results/calc-types-faults.json`](results/calc-types-faults.json)).

**At run time.** Types cannot show an option that is declared but refused,
as rc.16's sidereal zodiac was. `tools/sweep-sidereal-options.mjs` runs each
of the four functions at a synthetic instant and place with each of the nine
built-in ayanamsas and twelve forms of a caller's: a TT epoch at J2000.0 with
the engine's precession, and at 1900 with each of the three models; a linear
rate; a UTC epoch as an ISO string, a `Date`, `{ iso }` and a Julian date; a
UT1 epoch, plain and with a pinned ΔT; and a name. Every one is computed,
none refused
([`results/sidereal-options-sweep.json`](results/sidereal-options-sweep.json)).
`calc()` gives `siderealChart()`'s longitude for each of the twelve bodies a
sidereal chart has, to the bit, and the same longitude in the true and the
mean ecliptic of date; `houses()` and `chart()` give `siderealChart()`'s
angles, cusps and bodies exactly. `/vedic` has no UT1 epoch, so the plain
UT1 form is run without that comparison; with a pinned ΔT it is compared
through its TT. `/vedic` has no crossing search either: `events()` finds the
Sun's and the Moon's crossings of sidereal 0°, at which calc's own sidereal
longitude is within 0.015″ of 0°.

**The other flags.** For every other flag the engine's map in `docs/calc.md`
at `aae419c` (*Swiss Ephemeris `calc_ut` flags*, unchanged at `782b4963`)
names the counterpart, or says it is not offered. Phase 2 ships none of the
ones not offered:

- the sidereal projections `SE_SIDBIT_ECL_T0` and `SE_SIDBIT_SSY_PLANE`,
  which `/vedic` does not offer either. The map leaves out three more
  sidereal bits, `SE_SIDBIT_ECL_DATE`, `SE_SIDBIT_NO_PREC_OFFSET` and
  `SE_SIDBIT_PREC_ORIG`, which neither `/vedic` nor calc offers
  (`SE_SIDBIT_USER_UT` is calc's UT1 epoch, above);
- gravitational light deflection, for which there is no Phase 2 unit; calc
  refuses it with `not-in-this-version`;
- `SEFLG_ICRS` without `SEFLG_J2000`: the frames of date are precessed from
  J2000.0, as Swiss Ephemeris's are without the flag;
- a choice of ephemeris (`SEFLG_SWIEPH`, `SEFLG_JPLEPH`, `SEFLG_MOSEPH`),
  `SEFLG_SPEED3`, the 1980 nutation and Horizons frame flags, and
  `SEFLG_CENTER_BODY`.

Its bodies are `SE_SUN` to `SE_PLUTO`, `SE_EARTH`, the true and mean nodes
and `SE_MEAN_APOG`. The osculating apogee (P2.A.points.osculating-lilith) and
the asteroids (P2.A.asteroids) are not started, so not shipped. `SE_ECL_NUT`
is not a body here. Of what it returns, Phase 2 ships the true obliquity
(`chartDeclinations()`) and the nutation in longitude (`/vedic`'s
`ayanamsa().nutation`); calc gives the first as `houses().obliquity` and the
second as `ayanamsa.nutation` in a sidereal result. It gives nowhere the
mean obliquity, which the root entry has offered since before Phase 2
(`meanObliquity()`), or the nutation in obliquity, which no Phase 2 unit
adds.

**The span.** calc computes an instant only from 1800 to 2200 (`CALC_SPAN`)
and refuses one outside it (`out-of-range`) in every function and zodiac, as
rc.16's calc did; `/vedic` and the root entry compute there and flag the
result `outside-reference-span`. Checkpoint 14 judged rc.16's calc with that
span in place and did not count it against the clause. This record does the
same, reading an instant as the input of `calc_ut` rather than one of its
options; the owner can read it otherwise.

A caller's ayanamsa is different. calc refuses one carried by precession from
an epoch outside the span at every instant, inside the span as well, because
its precession from that epoch has not been compared with ERFA there. `/vedic`
computes it and flags the result. A zero point at TT Julian date 1824800.5
(284 CE), asked for at 2026-03-20, gives a mean ayanamsa of 24.2461° through
`/vedic`, flagged, and is refused by all four of calc's functions; the same
epoch and value with a linear rate are computed by both (the sweep's `span`
section). The epoch is part of the `SE_SIDM_USER` option itself (`t0` in
`swe_set_sid_mode`), so by checkpoint 14's standard, an option declared but
refused, calc covers only part of it. The clause is met if the epoch's range
is read as the span the entry point keeps, with a typed refusal that says
why. That reading is the programme's own, made at this checkpoint, and under
`DECISIONS-2026-10-05.md` §4 such a reading is the owner's to ratify. FINDINGS
F-80 puts the decision to the owner; the programme recommends closing it in
the engine instead (below).

**Round-trip fixtures.** The engine's `src/fixtures/calc-roundtrip.json` at
`aae419c` (SHA-256 `3512922d…2a81`, unchanged at `782b4963`) has 37 cases:
27 `calc`, 3 `houses`, 3 `events` and 4 `chart`; 27 tropical and 10
sidereal, 3 of them with a caller's ayanamsa. Replayed through the vendored
rc.17, every result is the fixture's exactly, with the same keys (the tool
allows 1e-12, relative above 1 and absolute below; the largest difference is
0), and each of the 26 results with a receipt is given again when its
receipt's request is replayed
([`results/calc-roundtrip-replay.json`](results/calc-roundtrip-replay.json)).
The fixture holds the engine's own outputs, so the replay shows the vendored
archive reproduces them, not that they are accurate. The replay tool is
rc.16's, which also counts the zodiac each request names.

**Typed refusals.** Each of the four functions returns its result or a
`CalcRefusal` (`calc(request): CalcPosition | CalcRefusal`, and so on) with
one of four reasons, and the fixtures exercise all four: `not-in-this-version`
once (light deflection), `unsupported-combination` five times,
`out-of-range` four times and `sample-budget` once. Malformed input, such as
an unknown body or field, throws `RangeError` instead, as everywhere in the
engine (`docs/calc.md`, *The four functions*).

P3.2 is **validated**, release deployed, until the owner ratifies the
reading (F-80), or until an engine candidate that computes every such epoch
is served and judged. Two units depend on it, and neither is judged again
here: P2.D.frames, accepted at checkpoint 14 while P3.2 was partial, for the
sidereal zodiac, an option none of its outputs uses; and the compute API
(P3.3), which stays `merged` on its own gate.

**Closing F-80 without a reading.** The 1.0 candidate, which
`DECISIONS-2026-10-05.md` §7 makes the next publication, can compute a
caller's precession-carried ayanamsa from every epoch `/vedic` accepts,
which is the whole range of a JavaScript `Date`, far wider than the engine's
ephemeris span (a mean ayanamsa of 0° at TT Julian date 0.5 gives 92.864° at
2026-03-20 through `/vedic`, flagged), compared with ERFA there and with its
bound. Accepting more input does not
change the API it freezes. P3.2 would then be judged again once production
serves that candidate. A candidate that covers less, such as the ephemeris
span alone, would leave a narrower gap that needs the same reading.

## What is not established

- rc.17 is not published, and nothing here publishes it.
- The site, the compute API and the MCP adapter do not offer the sidereal
  zodiac. The MCP tools get it next (`DECISIONS-2026-10-05.md` §6).
- The accuracy of sidereal positions is the engine's record
  (`docs/evidence/calc-sidereal-2026-10-05/` in the engine repository).
  P2.B.ayanamsas, measured against Swiss's `get_ayanamsa_ex_ut`, stays
  failed; it is not judged again here.
- The sweep runs one instant and place for each combination; the fixtures
  and the engine's own tests carry the rest.

## Rerun

From the site's root with the vendored archives installed (`npm ci`) and an
engine checkout at `aae419c` or `782b4963`:

```sh
sh docs/platform/evidence/rc17-gates-2026-10-06/tools/run.sh <engine checkout>
```

It writes the five files in `results/` and exits 1 if the replay finds a
mismatch, if the type check does not compile against rc.17 or does not fail
against rc.16 as recorded, if a planted fault is missed, or if the sweep
finds a refusal or a difference inside the span, or refusals of the span
other than those recorded here.
