# The lite entry's site checks (P2.E declinations, sect, composite and dignities)

This folder holds what the lite preregistration asks of the site's adoption:
the parity record of section 4, its tool and the tool's controls, B5's
version 2, and later the bundle reports and the production checks.

## The preregistration

[PREREGISTRATION.md](PREREGISTRATION.md) is the engine's
`docs/evidence/1.1.0-rc.2-20261102/lite/PREREGISTRATION.md` byte for byte, as
its header asks ("The site adoption pull request commits the same text beside
its parity tool before that tool first runs"):

- SHA-256 `9019d67cc9a39b0039d0b9a6f89346f7685034a4e5bdd22393052ff2b05a115f`,
  61,340 bytes;
- git blob `1e76a003c21425c2db35c4f65f2ac9b07e958557` at the engine's source
  commit `806f76b` (`git rev-parse 806f76b:docs/evidence/1.1.0-rc.2-20261102/lite/PREREGISTRATION.md`),
  the same blob in the tree of engine main `883371f5`.

It is committed here together with the tools below, before either tool runs.
Its amendments are the engine's; a change the site makes to a control is a
version of its own in this folder ([B5-VERSION-2.md](B5-VERSION-2.md)).

## The parity tool

[tools/compare-lite.mjs](tools/compare-lite.mjs), written from the rc.16
record's `../site-engine-rc16/tools/compare-techniques.mjs` to section 4.
It is run once on the adoption head, from the repository root, with the base
commit as its argument:

```sh
nice -n 10 node docs/platform/evidence/site-engine-1-1-0-rc2/lite/tools/compare-lite.mjs <base> > docs/platform/evidence/site-engine-1-1-0-rc2/lite/parity.json
```

A rerun after any change to the tool or to the code is a new attempt with a
new seed text that cites this one (section 4.1).

How the tool reads section 4, fixed here before it runs:

- **Sides.** S is the base commit's code read from git objects (`git archive`
  of `src/lib`, `src/islands/chart3d` and `src/islands/synastry`); A is the
  head commit's four adapters and `src/islands/synastry/relationshipData.ts`,
  read the same way at the head; P is the installed `@zodiacs/engine/lite`,
  with the root for `sectOf` and `chartDeclinations`. S and A are bundled by
  the repository's esbuild for Node with `@zodiacs/engine` and
  `astronomy-engine` external, and all three resolve the one installed
  package.
- **What A is called with.** The adapters are written after this tool, so
  the tool fixes their interface, which is the lite design's section 10:
  `declination.ts` exports `findDeclinationAspects(bodies, obliquity)` in the
  site's shape (no `maximumOrb`) and `declinationRows(bodies, obliquity)`,
  giving `{ body, dec, outOfBounds }` for each body in input order;
  `sect.ts` exports `sectOf({ sunAltitude, sunLon, mercuryLon })` in the
  site's shape; `composite.ts` exports `compositeMidpoints` and
  `compositeAspects`; `dignities.ts` exports `dignityFor`, `dignitiesFor`
  and `hasClassicalDignities`. The tool stops if one is missing.
- **Corpus.** One stream per section, mulberry32 seeded by the 32-bit
  FNV-1a of `site-engine-1-1-0-rc2-lite:<section>`. The 3,000 charts that
  D2-A, D2-R, D2-O, S2-A, S2-E and S2-P share come from the section name
  `charts`: for each, an instant uniform from 1800-01-02 to 2199-12-30, then
  a latitude (the first 2,400 uniform in [-66, 66]; the last 600 north or
  south by one draw, their size uniform in [66.6, 88.6]), then a longitude
  uniform in [-180, 180]. Each is cast by the base's `computeChart` with
  whole-sign houses (the house system plays no part in what is compared);
  the bodies are the ten the view draws; the obliquity is the base's
  `meanObliquity(julianCenturies(utcMs))`; the Sun's altitude is the base's
  `altitudeOf` from `turnFrame(..., 0).zenith`, the view's frame at scrub
  zero. D2-P draws two instants per case (the view's own chart, for the
  obliquity, and the second chart), and every other case has every latitude
  set to exactly 0. C2-P draws, for each person, whether the time is known,
  an instant, and for a timed person whether the instant is a whole minute
  (one in four), so that `pictureBodies` takes both of its paths.
- **Comparisons and causes.** Every leaf is compared with `Object.is`.
  Aspect lists are compared by pair: a pair in one list only, a type, the
  orb and the two declinations, the separation, and the order of the pairs
  both lists hold, each a difference of its own; rows are compared by body,
  declination and flag. Each difference gets the first cause of section
  4.3's table, in its order, whose predicate holds. Where the table is not
  explicit the tool reads it as follows, and its test holds each reading:
  `bound-boundary` asks both sides' declinations to lie within 1e-12 of the
  obliquity; `type-tie` takes either side's declinations; `order-tie` asks
  every pair of pairs that changes order to have orbs within 1e-12 on both
  sides; `declination-formula`'s "with the pair set, types and order equal"
  is a condition on the case for a pair's numbers and does not apply to rows;
  `composite-validation` also covers C2-X's longitude that is not finite, as
  C2-X names it; `site-prototype-lookup` takes A's false and null or P's
  `RangeError` as the other side.
- **Sections without a pass condition.** D2-X, S2-X and C2-X record S against
  A and against P; DG-N records S against P; D2-O records the pair sets and
  flags that change with the true obliquity of date (the root's
  `chartDeclinations`) in place of the mean; S2-P records each disagreement
  of the two sect rules, judged by astronomy-engine where the Sun's altitude
  exceeds 0.01 degrees in size, and lists any judged chart where the site's
  altitude and astronomy-engine disagree in sign, which section 4.1 makes a
  question for the owner before anything else is done. An unexplained
  difference anywhere fails the record.
- **The referee.** For every D2-A chart and D2-T fixture, P's own
  declination doubles are read as exact rationals (BigInt) and every pair's
  type, inclusion under 1 (or 1.5 with the Sun or the Moon) and order are
  derived and compared with P's list.

## The tool's controls

[tools/compare-lite.test.mjs](tools/compare-lite.test.mjs) holds section
4.5's eight controls. Control 2 (each cause just outside its predicate, and
just inside) and the referee's control (its inclusive test written strict
must disagree on the fixture whose declinations are exactly 1 degree apart)
are light and run in every `npm test`. Controls 1 and 3 to 8 each run the
whole tool once, as a child process, with one change (to the base's code, to
an adapter by a wrapper module around it, or to a scratch copy of the
package), and run only when `COMPARE_LITE_BASE` names the base commit:

```sh
COMPARE_LITE_BASE=<base> npx vitest run docs/platform/evidence/site-engine-1-1-0-rc2/lite/tools/compare-lite.test.mjs
```

A note written before any run, from no measurement: control 1 changes the
site's luminary orb from 1.5 to 1.4999, which changes a result only where a
pair with the Sun or the Moon has an orb in (1.4999, 1.5]. A rough estimate
from the spread of declinations puts the expected number of such pairs among
the 3,000 charts' 51,000 luminary pairs below one, so the control may find no
difference to show. If it finds none, it has not behaved as run, and that is
recorded as it is; nothing here changes it.

## B5

[B5-VERSION-2.md](B5-VERSION-2.md) is B5's version 2: the claims extractor's
control with a planted sentence that the extractor's lexicon selects.
