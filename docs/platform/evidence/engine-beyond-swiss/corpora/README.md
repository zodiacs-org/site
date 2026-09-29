# Corpora for the engine brief's rules

The inputs the rules in `../PREREGISTRATION.md` run on, committed as brief v1
M0 item 1 asks. Each was used by the engine audit of 2026-09-22 and lived in
its scratch directory until now; where a file is copied unchanged, its digest
matches `../../engine-audit-2026-09-22/ARTIFACTS.sha256.tsv`.

Swiss Ephemeris output is not committed. Where a rule compares against
Swiss, the corpus holds the inputs and the Swiss output is named by the
SHA-256 of the audit's file. Counts measured against Swiss (for example "0 of
255,675 differ") are recorded; the values are not.

| file | what it is | source |
| --- | --- | --- |
| `horizons-24/` | The 24-instant corpus (`corpus.json`: instants stratified by epoch 1851–2148, the design and the five configurations it was run in) and NASA JPL Horizons's answers for it: apparent geocentric ecliptic longitude and latitude of date (QUANTITIES 31, airless, TT), one file per body. The outer planets are there both as bodies (599, 699, …) and as barycentres (5, 6, 7, 8, 9), and Mars as body and barycentre (499, 4), as brief v1 M0 item 3 asks. `Moon_UT.txt` is the Moon at the UT instants. Every file carries Horizons's banner: API 1.2, DE441; `Moon_UT.txt` names EOP file eop.260922.p261219, and the other sixteen, fetched again on 2026-09-29, eop.260928.p261225. `corpus-tt.json` gives the TT Julian dates sent: TT = UT + the engine's own ΔT, made by `tools/retime-corpus.mjs` (until 2026-09-29, UT + Swiss's ΔT; see below). `fetch.py` makes the requests from `corpus-tt.json` and logs each query in `queries.log`. Its frame is taken apart in `../horizons-frame/`. | audit, `production-positions/` |
| `angle-grid-inputs.json` | Inputs only, `[utc, lat, lon, house system]`: grid A, 3,128 cases (1800–2200 every 25 years, every 3 hours, latitude 0 and ±10 to ±66); grid B, a 5,616-case Placidus ladder at 0.1° steps from 55° to 66.6° in both hemispheres (1800, 2000, 2200); grid C, 1,152 whole-sign cases from 66.6° to 90° in both hemispheres; grid L, the 336-case ladder of rule 1h (66.05–66.55 in both hemispheres, 1800, 2000 and 2200, every 3 hours). | A, B, C: the auditor's `angles-houses-aspects/swiss.json` (sha256 `1e51824b…5355c`); L: the verifier's `swiss_grid.json` (sha256 `7be155ba…3d8f`) |
| `angle-grid-erfa.json` | The ERFA arbiter for grids A and L, so rules 1b and 1h can be checked without Swiss output: the ascendant and midheaven of each grid A case, and Placidus's limit (90° − ε, ε the true obliquity of date) at each grid L case, which allows 320 of the 336. pyerfa 2.0.1.5 (ERFA 2.0.1): `gst06a` with UT1 taken as UTC, `obl06` plus the Δε of `nut06a`, on the engine's own clock, so a comparison measures the angle model and not ΔT. Made by `tools/angle-clock.ts` and `tools/angle-arbiter.py`; `scripts/angles-grid.test.mjs` reads it. | this record |
| `canon-events.json` | The four canon events: the greatest eclipse of 2017-08-21 and 2024-04-08, and the greatest transit of Venus of 2004-06-08 and 2012-06-06, as NASA's eclipse pages give them, with the rounding and the digest of each page. | audit, `verification-honesty/anchors/` |
| `iers-finals2000A-ut1.csv` | UT1 − UTC with its formal error, per day, 1973-01-02 to 2027-09-25 (19,990 rows; `I` observed, `P` predicted), taken from the IERS `finals.all` (IAU 2000) file the audit fetched on 2026-09-22 (sha256 `c672540e026d3cd4840c0858d4ce2bc4a18c3bc9751f9636c3285e11950d58a1`, 3,767,520 bytes). Only these three columns were extracted; the polar motion and nutation columns were left out. 2026-09-22 is a prediction, −0.0117110 s. | audit, `verify/time/finals.all.txt` |
| `tzdb-divergence-98.json` | The audit's list of the 98 zones where Node's Intl (ICU 78.2, tzdb 2025c default build) and the host's TZif files (Debian tzdata 2025b, built with backzone) disagree on the UTC offset, 1850–2037, with up to three segments per zone. Copied unchanged. | audit, `time/zone-history-divergence-to-2037.json` |
| `tzdb-divergence-98-check.json` | The list checked against the site's resolver after step 1.12, by `tools/divergence-list-check.ts`: 179 of the 185 segments with a local time reproduce; eight are "-00" spans the site leaves to the browser. | this record |
| `../julian-vs-swiss.json` | The site's Julian-to-Gregorian conversion against Swiss's `swe_julday`/`swe_revjul`, 1500–2199, by `tools/julian-dump.ts` and `tools/julian-vs-swiss.py`: 255,675 dates, 0 differ. | this record |

## Not here, and where it is

- **The 2024 aspect scan (rule 1a).** Its input is a rule, not a file: every
  30 minutes of 2024 UTC (17,568 instants), the ten bodies, the engine's five
  aspects and orbs. The positions it runs on are Swiss's (`swiss-2024.json`,
  sha256 `0dc4b21fc5cbc9b45ad3b31cbbbc5330a2b23bd017bd13d60cdba3e682af3dc0`),
  which give 236,932 aspects. On the shipped engine's own positions the same
  scan finds 236,910, of which rc.6 misclassifies 486 as applying or
  separating (`applying_scan.json`, sha256
  `e181c771e9082f9ee3c3d4def873e8da9ddc0ca89693b8a34e149caee1d3a4b3`).
- **The Swiss outputs for the grids.** By digest, above.
- **The 180-case benchmark corpus.** Already committed:
  `docs/platform/evidence/swiss-benchmark/tools/corpus.mjs`.
- **The multi-year distribution (M0 item 4).** Committed as
  `../../swiss-benchmark/multiyear-1800-2199.json` (statistics only), made by
  `multiyear-zodiacs.mjs` and `multiyear_swiss.py` in
  `../../swiss-benchmark/tools/`.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../../programme/DECISIONS-2026-09-28.md)
two files here lost Swiss's values. `horizons-24/corpus-tt.json` lost Swiss's
ΔT at each of its 24 instants; its TT instants stayed, and their difference
from the UT instants still gave that ΔT to the precision of a Julian date
(until 2026-09-29, below). `canon-events.json` lost
Swiss's residual from the canon at each of the four events; the engine's and
the alpha's stay. Commit `2ca93d41` still has the values, and each file
records the SHA-256 of what it lost under `swissOutputRemoved`. The commands
that regenerate them, and the record of everything removed, are in
[`../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).

## The corpus re-timed, 2026-09-29

The corpus was fetched at TT = UT + Swiss's ΔT, so each TT instant, in
`corpus-tt.json` and in the time column of every Horizons response here and
in `../horizons-frame/vectors/`, gave Swiss's ΔT back beside the UT instants
of `corpus.json`. Under
[DECISIONS-2026-09-29 §2](../../../programme/DECISIONS-2026-09-29.md) that is
Swiss output kept as data, so the corpus now runs on the engine's own ΔT
(model zodiacs-deltat/1), the clock every chart on the site uses:

- `tools/retime-corpus.mjs` wrote `corpus-tt.json`: TT = UT + the engine's ΔT
  at each preregistered UT instant, rounded to the 1e-8 day a request carries;
- `horizons-24/fetch.py` asked Horizons again for the sixteen TT files, and
  `../horizons-frame/vectors/fetch_vectors.py` for the three VECTORS files;
- `Moon_UT.txt`, at the UT instants on Horizons's own ΔT, is unchanged.

The instants moved by the difference between the two programs' ΔT: fractions
of a second up to 2026, more after it, where both extrapolate. The fixed
clock the design asks for is kept, since every configuration is still
evaluated at the same TT; only where that TT comes from changed.
`corpus.json` is the preregistered design and still says Swiss's ΔT.
Commit `2ca93d41` has the corpus as first fetched, and so do the conformance
suite's L1 sources, which name commit `3f31ba17` of this repository. The
horizons-frame study was made on the first fetch and keeps its figures; its
re-run on this one is beside it
([`../horizons-frame/README.md`](../horizons-frame/README.md)). What left the
tree, file by file, is in
[`../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
