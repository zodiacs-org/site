# Phase 1 verdicts for steps 1.4, 1.5 (A4), 1.7, 1.10 and 1.11, 2026-09-26

These are the measurements behind the verdicts that
`../engine-beyond-swiss/PREREGISTRATION.md` records for steps 1.4 (rule 1c,
as amendment A2 restates it), 1.5's re-run under amendment A4 (rule 1d), 1.7
(rule 1e), 1.10 (rule 1i) and 1.11 (rule 1j). All were taken on the vendored
`@zodiacs/engine` 0.1.1-rc.8 (`vendor/zodiacs-engine-0.1.1-rc.8.tgz`,
SHA-256 `3b934376fa53983cbdd7eb1a6ecf0eb0d50fbc49df01bc610b20c63bd5d12be6`).
The site tree was the one PR #581 merged, which is where rc.8 landed.

Swiss Ephemeris 2.10.03 is the instrument the rules name. It reads
`sepl_18.se1` and `semo_18.se1`, and every call's return flag is checked.
Swiss's readings are not committed; `results/` holds statistics only.

| Step | Rule | Verdict | Deciding figures |
| --- | --- | --- | --- |
| 1.4 Observed ΔT with a band | 1c under A2 | PASS | See the three rows below. |
| ↳ gate 1 | | | At most 0.0306 s from IERS on the 12 dates. Every IERS day since 1962 is within 0.0834 s. σ covers IERS's formal error on every row. |
| ↳ gate 2 | | | The receipt carries the model, value, band, table and digest. |
| ↳ gate 3 and holdout | | | Gate 3 gaps are +0.022″ (corpus) and −0.070 to +0.006″ (eras), with paired p95 at most 0.119″. The holdout's paired p95 is at most 0.118″, and its gate 1 at most 0.0554 s. |
| 1.5 Lunations, A4's re-run | 1d | FAIL, as A4 said before the run | 80 of 124 are within 2 s of Swiss, and the largest gap is 5.153 s. The Swiss-free projection agrees to 1 ms. |
| 1.7 Span flags | 1e | PASS | The flag is set at 2300 and at 900, and exactly outside [1800, 2200). The site's scans stay inside the span. |
| 1.10 One crossing solver | 1i | PASS | The site imports the package's solver. The audit's s2 cases give the site's former results through both entry points. No scan throws. |
| 1.11 Receipts | 1j | PASS | A receipt from rc.8 on without the ephemeris's identity is refused. rc.7 receipts, which predate the field, still parse. |

## 1.4 Observed ΔT with a band (rule 1c, amendment A2)

**Rule, as A2 restates it.** There are three gates and a holdout:

- **Gate 1.** |ΔT − IERS| ≤ 0.2 s on the 12 dated values from 1962-03-15 to 2026-09-22. σ must be at least IERS's formal error on every observed and predicted row from 1962.
- **Gate 2.** The receipt carries the model, the value, the band, the table and its digest, and the engine's and the site's receipt tests pass.
- **Gate 3.** Measured against Swiss:
  - the gap between the Moon at the same UT and at the engine's TT is within 0.3″ on the 18 MEASURE cases, and in each era from 1800 to 2026;
  - in each era, the paired clock contribution has p95 ≤ 0.3″.
- **Holdout.** `zodiacs-holdout/1.4` is opened once.

**The module.** First, the vendored `dist/deltat.js` was checked against the
reference implementation that A2 fixed before the code
(`../deltat-2026-09-25/tools/parity.py`, with `DELTAT_MODULE` pointing at the
installed file). Over 18,384 points from −3000 to 3000, densified at every
join, the two agree:

- the largest difference in seconds is 1.5 × 10⁻¹¹;
- the largest difference in σ is 2.2 × 10⁻¹⁶;
- every point falls in the same segment;
- the table digest is the same, `6371988c510a1c6c`.

The shipped module is the preregistered model.

**Gate 1.** `../deltat-2026-09-25/tools/gate1.py` was run on the installed
module, on the raw IERS files the table was built from, each checked against
its recorded SHA-256 (`results/step-1.4-gate1.json`).

| | Measured | Limit | |
| --- | --- | --- | --- |
| The 12 dated values | at most 0.0306 s (2024-04-08) | 0.2 s | pass |
| Every observed day, 1962-01-01 to 2026-09-24 (23,643 days) | at most 0.0834 s (1998-05-29), RMS 0.0223 s | reported | |
| σ against IERS's formal error, observed rows | σ at least 15.0 times it | at least 1 | pass |
| σ against IERS's formal error, 373 predicted rows to 2027-10-02 | σ at least 4.8 times it; model at most 0.0196 s from the predictions | at least 1 | pass |

rc.7's clock was 6.302 s off on 2026-09-22.

**Gate 2.** The receipts check is `tools/receipts.mjs`
(`results/receipts.json`).

- A natal chart at 1990-06-15T18:30Z serialises to an envelope. Its `result.deltaT` is `{model: "zodiacs-deltat/1", seconds: 57.182, sigma: 0.03, table: "2026-09-24", tableDigest: "6371988c510a1c6c", segment: "observed"}`. Its conventions carry `deltaT: "tt-minus-ut1;ut1-read-as-utc;value-in-result"`.
- The envelope parses back with the same value.
- The site's receipt tests pass: all 5,954 tests of the suite on the merged tree.
- The engine's own suite, 608 tests in 23 files, passes on its rc.8 source commit `352ea49d` (run again 2026-09-26).

**Gate 3.** `../deltat-2026-09-25/tools/moon/moon_gate3.py` ran on dumps of
the installed rc.8. The rc.7 dumps came from the rc.7 tarball, and the
multi-year one reproduces the committed dump byte for byte (`4552e19f…`).
The results are in `results/step-1.4-gate3.json`.

| Era | Gap, rc.8 | Paired p95, rc.8 | Gap, rc.7 | Paired p95, rc.7 |
| --- | ---: | ---: | ---: | ---: |
| 18 MEASURE cases | +0.022″ | | +0.314″ | |
| 1800–1849 | −0.070″ | 0.103″ | −1.891″ | 2.838″ |
| 1850–1899 | −0.022″ | 0.044″ | −1.028″ | 1.671″ |
| 1900–1949 | −0.009″ | 0.119″ | −0.166″ | 0.609″ |
| 1950–1999 | +0.006″ | 0.118″ | −0.003″ | 0.075″ |
| 2000–2026 | −0.009″ | 0.100″ | +0.178″ | 3.233″ |

All gates pass, with the figures A2 gave before the result. After 2026 the
gaps are reported without a gate, because both clocks extrapolate there:
+0.401″ for 2027–2049, rising to +11.1″ for 2150–2199.

**Holdout.** `zodiacs-holdout/1.4` was drawn once, after the code commit.

- **How it was drawn.** `../deltat-2026-09-25/tools/holdout.ts` used seed 214798284 at site commit `ee37a83c`, the head of PR #581.
- **What it drew.** 200 positions (digest `509ebe79…`) and 50 of the catalog's 290 events for 2026–2035 (digest `8cb7789c…`).
- **How it was scored.** `holdout_score.py` scored it against Swiss (`results/holdout-1.4-score.json`).

| Era | Instants | Paired p95 | Gap p50 |
| --- | ---: | ---: | ---: |
| 1800–1849 | 26 | 0.095″ | −0.065″ |
| 1850–1899 | 26 | 0.041″ | −0.027″ |
| 1900–1949 | 30 | 0.118″ | −0.004″ |
| 1950–1999 | 23 | 0.116″ | −0.002″ |
| 2000–2026 | 15 | 0.089″ | −0.088″ |

Every era is inside the 0.3″ gate. Gate 1 at the 31 holdout instants from
1962 to the last observed IERS day gives at most 0.0554 s, inside 0.2 s.

The events part is reported without a gate (`tools/holdout_events.py`,
`results/holdout-1.4-events.json`). Each drawn event is taken from the two
committed catalog comparisons.

| Class | Events | rc.8 − rc.7, median | rc.8 − Swiss, largest | rc.7 − Swiss, largest |
| --- | ---: | ---: | ---: | ---: |
| New and full moons | 23 | +7.17 s | 4.30 s | 11.80 s |
| Eclipse peaks | 3 | +6.41 s | 5.10 s | 11.03 s |
| Stations | 15 | +6.59 s | 36.6 min | 36.4 min |
| Sign changes | 2 | +5.99 and +7.85 s | 28.0 min | 27.9 min |
| Exact aspects | 7 | +7.01 s | 1.59 h | 1.59 h |

The fast events follow the clock. The slow ones follow the positions, which
are M2's work.

## 1.5 Lunations: A4's re-run (rule 1d)

A4 said, before the run, that 80 of 124 would be within 2 s and the largest
would be 5.15 s, and that the verdict would be FAIL.
`../events-vs-swiss-2026-09-25/` has the run: all 124 committed lunations of
2026–2030 against Swiss with `compare.py`, statistics only.

- 80 of 124 are within 2 s, and the largest is 5.153 s (the new moon of 2030-05-02).
- The Swiss-free projection agrees with every lunation to the millisecond.
- With rc.7 it was 1 of 124, and 11.8 s.

**Verdict: FAIL**, recorded beside the first FAIL. What remains is the analytic
Moon.

## 1.7 Span flags (rule 1e)

**Rule.** The flag is present for 2300 and 900, and scans never exceed the
span.

`tools/span.mjs` produced `results/step-1.7.json`. On rc.8, `natalChart`
flags `outside-reference-span`:

- at 2300-06-15 and 0900-06-15;
- at 1799-12-31T23:59:59.999Z and at 2200-01-01T00:00Z.

It does not flag 1800-01-01T00:00Z or 2199-12-31T23:59:59.999Z. So the span
is [1800, 2200), as `REFERENCE_SPAN` states. The receipt validator expects the
flag wherever the instant is outside the span. The scans' half of the rule
passed on the site before rc.8 (`src/lib/engine/reference-span.test.ts`) and
still does. **Verdict: PASS**; the earlier PARTIAL stays beside it.

## 1.10 One crossing solver (rule 1i)

**Rule.** The rule asks for two things:

- a parity test on the audit's s2 cases;
- no throw on the site's Moon scans.

Since rc.8 the site has no crossing solver of its own.
`src/lib/engine/longitude-crossings.ts` is gone. Returns, lunar returns, the
calendar function's transit scan and the void-of-course Moon all call
`@zodiacs/engine/crossings`.
`scripts/crossings-s2.test.mjs` runs the audit's s2 cases through the site's
scan (`src/lib/engine/returns.ts`) and the package's root
`findLongitudeCrossings`, and `tools/crossings-s2.mjs` records them
(`results/step-1.10.json`).

| s2 case | rc.6 package | Site before rc.8 | rc.8, both entry points |
| --- | --- | --- | --- |
| Sun exactly on the target at `from`, window of 2 days, step 1 day | a root at `from` | none | none: the window (from, to] leaves it to the window that ends there |
| Moon 0° over 2,600 days at 0.25 days | threw past 10,000 samples | 95 | 95, identical to the millisecond |
| Moon 0° over 2,100 and 2,400 days | threw | | 77 and 88 |
| Saturn 0° 1900–2100 at 5 days | threw | | 13, identical to the millisecond |

A search given `maxSamples: 10000` over the 2,600 days is refused whole
(`status: "refused"`, no crossings) instead of throwing. **Verdict: PASS.**

## 1.11 Receipts (rule 1j)

**Rule.** The receipt validator rejects a receipt without ephemeris identity.

`tools/receipts.mjs` (`results/receipts.json`) alters an rc.8 envelope and
parses it again with the vendored `parseNatalEnvelope`.

| Alteration | Result |
| --- | --- |
| `engine.ephemeris` removed | refused, `invalid_shape` |
| `engine.ephemeris.name` emptied | refused, `unsupported_feature` |
| `result.deltaT` removed | refused, `invalid_shape` |
| `result.deltaT.model` changed | refused, `unsupported_feature` |
| `engine.version` set to rc.7 with rc.8 conventions | refused, `inconsistent_result` |
| `engine.ephemeris.version` changed to 2.1.18 | accepted |
| `result.deltaT.tableDigest` changed | accepted |

The two accepted alterations are claims the validator cannot check without
the other release: a receipt names what made it, and a replay on another
version is a different calculation (A2, *Receipts*). An envelope made by the
vendored rc.7 tarball has no ephemeris field and still parses on rc.8, as the
conventions sets intend: rc.3 to rc.7 stay readable. **Verdict: PASS** for
every receipt from rc.8 on. The rule covers the ephemeris only; whether a
receipt carries a tzdb version (ledger time-7) is not part of it and is not
judged here.

## Files

- `tools/run-all.sh` reruns everything here. It needs:
  - the site with rc.8 installed;
  - the raw ΔT sources in `DELTAT_SOURCES`;
  - Swiss's two `.se1` files in `SWISS_EPHE`;
  - an install of the rc.7 tarball in `RC7_ENGINE`, for the rc.7 dumps and the legacy receipt.

  It writes only `results/` and a scratch directory. The holdout is not
  drawn again: `results/holdout-1.4.json` is the draw, and the tool scores it.
- `results/` holds statistics only, with the provenance of every input in
  `provenance.json`.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) `results/holdout-1.4-events.json` lost each drawn event's
difference from Swiss (`minusSwissSeconds` for rc.8, `rc7MinusSwissSeconds`
for rc.7), which with the published instants give Swiss's times back. Each
event's rc.8-minus-rc.7 difference stays, and the table's figures above are
unchanged. Commit `2ca93d41` still has the values, the file records the
SHA-256 of what it lost under `swissOutputRemoved`, and
`tools/holdout_events.py` regenerates them once both event comparisons have
been regenerated. The record of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
