# Horizons QUANTITIES=31's frame, taken apart

Brief v1, M0 item 3 (brief v2, Phase 0 item 3). The engine audit compared
Swiss Ephemeris, the engine and the precision runtime with NASA JPL Horizons's
apparent ecliptic longitudes (QUANTITIES=31) and found Horizons minus each of
them to be the same for every body at a given instant. The audit put that
down to Horizons's "IAU76/80 ecliptic-of-date" frame. This folder checks it
with ERFA, on the 24-instant corpus in `../corpora/horizons-24/`, and then
compares the precision pack's ephemeris with Horizons's in a check that does
not involve any frame.

## What Horizons's frame is

A model of Horizons's frame reproduces Horizons's longitudes to within
5.5 mas of Swiss, with a median of 1.4 mas, for ten bodies at 24 instants
from 1851 to 2148. Latitudes agree to 1.9 mas. The model is:

- IAU 1976 precession applied directly to the ICRF direction, with no frame
  bias;
- IAU 1980 nutation, corrected by the celestial-pole offsets dψ and dε from
  Horizons's earth-orientation (EOP) file;
- the IAU 1980 mean obliquity for the ecliptic of date.

Outside its EOP file Horizons holds the offsets constant. The corpus banner
names the file, `eop.260922.p261219`, which covers "DATA-BASED 1962-JAN-20 TO
2026-SEP-22. PREDICTS-> 2026-DEC-18". The Horizons manual says the same:
"For future times outside the available EOP data-fit or prediction intervals,
Horizons uses the last predicted values available in the EOP file as
constants."

`decompose.py` tries four models of the frame. It carries each Horizons
direction out of the model and into the IAU 2006/2000A ecliptic of date that
Swiss uses, then subtracts Swiss's position. The difference that is left is
the remainder, in `results.json`.

| model | remainder in longitude, median | largest | largest in latitude |
| --- | --- | --- | --- |
| `bare`: the IAU 1976/1980 model only, as brief v1 wrote it | 66.2 mas | 125.0 mas | 1.9 mas |
| `bias`: `bare` after the IAU 2006 frame bias | 62.0 mas | 131.2 mas | 22.2 mas |
| `eopJpl`: `bare` with the EOP offsets from JPL's file for the same day | 1.40 mas | 5.45 mas | 1.9 mas |
| `eopIers`: `bare` with the IERS's own IAU 1980 offsets | 1.42 mas | 5.38 mas | 1.9 mas |

The frame term is Horizons's longitude minus the IAU 2006/2000A longitude of
the same direction. Under `eopJpl`, averaged over the ten bodies, it is:

| instant | Horizons minus Swiss | frame term |
| --- | --- | --- |
| 1851-03-14 | −0.3711″ | −0.3730″ |
| 1957-10-04 | −0.0647″ | −0.0675″ |
| 1969-07-20 to 2026-09-22, eight instants | −0.0469″ to −0.0499″ | −0.0471″ to −0.0503″ |
| 2038-01-19 | +0.0002″ | −0.0005″ |
| 2148-12-30 | +0.3452″ | +0.3445″ |

It has two parts:

- **From 1962 to 2026**, the EOP offsets put Horizons's pole where the IAU
  2006/2000A pole is. What is left, about −48 mas in longitude, is the
  offset between the two models' equinoxes. The Horizons manual puts that
  offset at "about −53 mas" in right ascension.
- **Outside 1962–2026**, the offsets are held while the IAU 1976 precession
  drifts from IAU 2006 at 0.30″ a century. That drift is the slope of the
  `bare` frame term, −0.436″ at 1851 and +0.461″ at 2148. It reaches −0.37″
  at 1851 and +0.34″ at 2148.

The audit's "+0.369/+0.047/−0.346″" is engine minus Horizons, so it is this
column with the sign reversed.

The models were not fitted to the residual. `bare` and `bias` have no free
choice. The two EOP models take their offsets from published series:

- `eopJpl` uses JPL's EOP2 file of 2026-09-22. It gives dX and dY relative
  to IAU 2006/2000A, so `decompose.py` solves for the IAU 1980 dψ and dε that
  put the 1976/1980 pole on that pole. JPL's dX and dY are zero before 1998,
  so before then these are the IAU 2006/2000A model expressed as IAU 1980
  offsets.
- `eopIers` uses the IERS 14 C04 series to 2026-01-05 and finals.all's
  Bulletin A after that.

The only other choices come from Horizons itself: the hold dates from its
banner and manual, and "no bias" from its manual, which says it applies
IAU76/80 to the ICRF. Latitude settles the bias: nutation leaves the ecliptic
unmoved, and with the bias the latitudes miss by 22 mas.

The two EOP models differ at the 1 mas level. At the 1962 hold, JPL's
implied dψ is 63.200 mas and the IERS C04 value is 64.504 mas. The IERS
predictions stop at 2026-11-23, 25 days before Horizons's last prediction.
So `eopIers` fits better before 1962 and `eopJpl` after 2026. Moving
`eopJpl`'s last day from 2026-12-18 to 2026-12-19 changes its post-2026
remainders by 0.24 mas.

Swiss's own nutation departs from both IAU 2000 models by 0.39 to 0.56 mas
rms (`../../precision-2026-09-20/numerics/RESULTS.md` §1). The median
remainder, 1.4 mas, is the same size as these differences, so the
decomposition cannot resolve anything smaller.

The largest remainder, 5.4 mas, is Venus on 2012-05-21, sixteen days before
the inferior conjunction of the 2012 transit. It is the same under both EOP
models, so it is not the frame.

**What this means for arbitration.** Horizons QUANTITIES=31 can arbitrate
an IAU 2006/2000A position at the level of a few milliarcseconds, but only
after this frame is carried out. Without that step it differs by:

- about 0.05″ from 1962 to 2026;
- 0.37″ at 1851 and 0.34″ at 2148;
- more beyond those dates, at 0.30″ a century.

Brief v2's R8 gives "about 0.05″" as the frame's limit. That figure holds
only inside the EOP span.

## The pack against Horizons, with no frame involved (VECTORS)

`vectors/` holds Horizons's geometric geocentric ICRF positions from DE441
for the Moon (301), Mars (499) and the Mars system barycentre (4) at the same
24 instants. `vectors/compare_vectors.py` compares them with the DE440s
kernel that the precision pack is compiled from (`de440s.bsp`, sha256
`c1c7feea…0a49f2`, the input a compiled pack's header records). The kernel is read
with jplephem at the JDTDB Horizons printed for each row. The pack's own
reader agrees with an independent reader to 1.7 ulp
(`../../precision-2026-09-20/numerics/RESULTS.md` §5), so this is the pack's
ephemeris. Neither side involves precession, nutation, light-time or
aberration.

| body | 1851-03-14 | 1933 to 2020 | 2148-12-30 | median |
| --- | --- | --- | --- | --- |
| Moon, DE440s against DE441 | 10.24 mas (18.1 m) | under 1 mas | 8.60 mas (16.5 m) | 1.78 mas |
| Mars (499 against the kernel's 4) | 0.0007 mas | ≤ 0.0004 mas | 0.0002 mas | 0.0003 mas |

This settles the attribution the numerics report left open, without a frame
model. The Moon's 0.0107″ at 1850 in the precision runtime's comparison with
Swiss is the difference between the lunar ephemerides of DE440 and DE441.
Swiss's `.se1` files are DE441-based. Over the same span, Mars in the two
ephemerides agrees to 1.3 m. DE440s has no Mars body centre, and Horizons's
own 499 minus 4 is 0.11 to 0.21 m.

## Outer planets: barycentres

Swiss gives the outer planets as system barycentres, so every comparison
with Swiss here uses Horizons's barycentre `COMMAND`s, as brief v1 asks:

- `decompose.py` reads `MarsBary.txt` through `PlutoBary.txt`;
- `vectors/` fetches both 499 and 4.

The engine's own `src/lib/engine/fixtures/horizons-reference.json` does not
follow that yet. Re-fetched on 2026-09-23, its 2020 values match body
centres 599, 699, 799 and 999 to the seventh decimal. Neptune is 0.004″ off 899, the drift the
audit noted. The barycentres differ from those values by up to 0.073″
(Pluto). The test's tolerance is 0.05° and the engine's residuals are
arcseconds, so nothing changes:

- Neptune is 14.7741″ from the body centre and 14.7755″ from the barycentre,
  so the published 14.8″ stands;
- Saturn is −1.93″ from the body centre and −1.90″ from the barycentre;
- Pluto is −0.74″ from the body centre and −0.82″ from the barycentre.

`src/lib` is part of the Phase 1 screenshot receipt's source digest. The
fixture therefore moves to barycentres in the rc.7 re-vendoring, which
recaptures that receipt anyway.

## Reproducing

```bash
# Swiss's .se1 files at the digests in ../../swiss-benchmark/CONFIGURATION.md;
# pyswisseph 2.10.03, pyerfa 2.0.1.5, jplephem 2.24, numpy.
curl -O https://eop2-external.jpl.nasa.gov/eop2/latest_eop2.long
curl -O https://datacenter.iers.org/data/latestVersion/EOP_14_C04_IAU1980_one_file_1962-now.txt
curl -O https://datacenter.iers.org/data/latestVersion/finals.all.iau1980.txt
python decompose.py <ephe-dir> latest_eop2.long \
    EOP_14_C04_IAU1980_one_file_1962-now.txt finals.all.iau1980.txt \
    <fetched> > results-<fetched>.json

python vectors/fetch_vectors.py            # cached files are kept, not refetched
python vectors/compare_vectors.py <path>/de440s.bsp > vectors/results-<fetched>.json
```

`<fetched>` is the day the EOP files were fetched. The commands wrote
`results.json` and `vectors/results.json` on the corpus as first fetched, and
`results-2026-09-29.json` and `vectors/results-2026-09-29.json` on the
re-timed one (below).

The EOP files are not committed. `results.json` records:

- each file's URL and SHA-256 as fetched on 2026-09-23;
- the offsets used at every instant.

Anyone can check those against the published series. JPL and the IERS
update these files, so a later download has a different digest, and its
predictions near the present differ.

Only remainders, frame terms, offsets and statistics are written. No Swiss
position is written.

## The corpus re-timed, 2026-09-29

This study ran on the corpus as first fetched, at TT = UT + Swiss's ΔT. Those
TT instants, beside the UT instants, gave Swiss's ΔT back, so under
[DECISIONS-2026-09-29 §2](../../../programme/DECISIONS-2026-09-29.md) the
corpus was re-timed on the engine's own ΔT and fetched again
([`../corpora/README.md`](../corpora/README.md)), and so were the three
VECTORS files here. The figures above, `results.json` and
`vectors/results.json` are the first run's and stay as written; commit
`2ca93d41` has the responses they were made from. `vectors/results.json` lost
the TT of each instant (`instants[].jdTdb`), which gave the same ΔT back.

The same scripts on the re-timed corpus, with the EOP files of 2026-09-29
(`eop.260928.p261225`, predicting to 2026-12-24), are
`results-2026-09-29.json` and `vectors/results-2026-09-29.json`. They agree
with the first run to within the rounding of Horizons's printed angles
(1e-7°, 0.36 mas):

| figure | first run | re-run |
| --- | --- | --- |
| `eopJpl` remainder in longitude, median / largest | 1.40 / 5.45 mas | 1.44 / 5.50 mas |
| `eopIers` remainder in longitude, median / largest | 1.42 / 5.38 mas | 1.29 / 5.43 mas |
| largest remainder in latitude, `eopJpl` | 1.86 mas | 1.86 mas |
| Moon, DE440s against DE441, 1851-03-14 / 2148-12-30 / median | 10.24 / 8.60 / 1.78 mas | 10.21 / 8.57 / 1.79 mas |

The largest `eopJpl` remainder is still Venus on 2012-05-21. Each instant's
`eopJpl` frame term moved by at most 0.0001″. Its `eopIers` frame term
moved by at most 0.0011″, and only at the seven instants after 2026, which
hold the last IERS prediction; that prediction moved between the two days.
