# rc.16 accuracy-statistics refresh

Local measurements on 2026-10-01. Engine archive SHA-256
`43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`;
Node 22.22.2, Python 3.11.15, pyswisseph 2.10.3.2 (library 2.10.03),
pyerfa 2.0.1.5. The official Swiss files match the original
[`CONFIGURATION.md`](../../swiss-benchmark/CONFIGURATION.md) pins.
`summary.json` records complete runtime, archive, data, input, tool and output digests.

Only aggregate statistics are recorded. Raw Swiss readings and the detailed
comparison rows remain outside the repository under `/tmp/rc16-accuracy-refresh/`.
No Swiss source or data, fixtures, fitted coefficients, DE440 input or Moon-enclosure
holdout is added or used. These are consistency comparisons, not observational validation.
No ledger, public page, released artifact, remote state or acceptance status is changed.

## Swiss multiyear and ΔT statistics

The original multiyear and ΔT tools run unchanged against the installed rc.16:
14,610 instants every ten days from 1800 to 2199, 11 bodies, the same UT1 and
same TT comparisons; all 321,420 position calls returned `SWIEPH`.
The ΔT comparison covers 36,524 daily instants in 2100–2199.

| Aggregate | rc.15 | rc.16 |
| --- | ---: | ---: |
| 1800–2026, same UT1, median longitude difference | 1.962″ | 1.960″ |
| 1800–2026, same UT1, p95 | 11.898″ | 11.894″ |
| 1800–2026, same UT1, maximum | 22.922″ | 22.886″ |
| Moon 2150–2199, same TT, maximum | 7.151″ | 7.221″ |
| Moon 2150–2199, same UT1, maximum | 20.469″ | 20.454″ |

The through-2026 denominator is 91,201; its maximum remains Venus in 1878.
All current one-decimal public headline numbers remain unchanged: 2.0″ median,
22.9″ maximum, 7.2″ Moon same-TT maximum and 20.5″ Moon same-UT1 maximum.
`statistical-changes.json` records the exact 597 changed numeric statistics
among 1,528 compared fields, not just the headlines. Historic files are left intact.

The ΔT statistics are numerically unchanged: Swiss minus engine 14.255–36.749 s,
engine sigma 42.390–103.386 s, and resulting Moon displacement 7.016–23.362″.
The engine-version and dump-digest bindings are refreshed.

Recommended current bindings:

- `multiyear-1800-2199.json`
- `deltat-gap-2100-2199.json`

The named files are in this directory. Their original-format schemas are retained
so the public-claim checks can bind to them without weakening assertions.

## P1.03: original gate still fails

`p103.json` measures the original Grid A (3,128 cases) and its original 816 extra
vectors at ±63°, ±65° and ±66°. It includes both quantile conventions from the
historical comparator; no gate or corpus changed. The rejected A1 amendment is
not used to turn a failure into a pass.

| Mode | ASC p95, original audit quantile | ASC maximum | Extra vectors over 5″ |
| --- | ---: | ---: | ---: |
| Original default chart options: engine UTC, Swiss UT1 | 6.2163″ | 160.6371″ | 63 / 816 |
| Explicit `timeScale: 'ut1'` on the engine, Swiss UT1 | 2.0960″ | 68.1737″ | 44 / 816 |

In the default run, 19 failures are inside Swiss's IAU sidereal-time window and
44 outside. In the aligned run, all 44 are outside 1850–2050. The original gate
fails in both modes. The ledger's narrower 1800/1950/2200 subset fails 7 of 144
in both modes, maximum 19.956″.

ERFA is evaluated on each run's exact engine UT1 and TT. The engine's maximum
ASC difference from it is 0.0956″ across Grid A, and 0.0038″ within ±45°.
Both ERFA gates pass. Site/package outputs and the diagnostics reconstructed
from rc.16's own sidereal-time and nutation implementation agree bit for bit
in every case. The source-bound diagnostics therefore measure the current
engine, rather than astronomy-engine's older five-term nutation.

## Koch: keep the clock distinction visible

The historical seeded end-to-end corpus and 3″ gate are unchanged. The original
record judges that gate in 1850–2049, where Swiss uses its IAU sidereal-time
model. The complete 1800–2199 results remain in the files, including failures.

| Original 1850–2049 set | Default engine UTC / Swiss UT1 | Aligned UT1 |
| --- | ---: | ---: |
| Ladder, 353 computed cases | 82.677″ max, 48 over 3″: FAIL | 0.035″ max, 0 over 3″: PASS |
| Broad, 1,499 computed cases | 44.064″ max, 252 over 3″ | 0.055″ max, 0 over 3″ |

The whole 1800–2199 ladder still fails in both modes: 114/696 over 3″, maximum
82.677″ by default; 66/696, maximum 31.358″ aligned. Those results are not
silently excluded from the evidence or represented as full-span agreement.

Given identical sidereal-time/latitude/obliquity inputs, Koch passes the
unchanged 0.01″ gate: maximum 4.71e-9″ in 5,568 computed ladder cases and
3.68e-9″ in 14,801 broad cases. Undefined statuses agree exactly: 48 ladder
and 5,199 broad, with zero one-sided refusals. See `houses-given.json`.

These are numerical validation results, not acceptance or deployment evidence.
The parent checkpoint must retain the window/clock qualifications and verify
all package, site and MCP release conditions before changing a unit's status.

## Historical tool compatibility and adaptations

Both literal historical tool failures are preserved:

- P1.03's `engine_grids.mjs` refuses any installed version other than rc.7
  (`original-p103-tool-failure.log`)
- The houses dump iterates over today's `HOUSE_SYSTEMS`, but its old comparator
  only knows twelve systems; it throws `KeyError: 'equal-mc'`
  (`original-house-tool-failure.log`)

The adapted P1.03 runner changes the version binding and uses rc.16's actual
clock, nutation and sidereal-time diagnostics. It leaves all input chart options
unchanged in the default run and adds only `timeScale: 'ut1'` in the aligned run.
The original Swiss grid instrument runs unchanged. The original comparison
formulas, gates and quantiles run with a regenerated ERFA arbiter on the selected
clock; only aggregate fields are copied into `p103.json`.

The adapted house comparators retain all twelve systems in the original
comparator's mapping, all original cases and its fallback handling. Newly added
systems are explicitly named as outside this historical benchmark's scope.
The original end-to-end dump runs unchanged for default chart options; its
aligned variant adds only `timeScale: 'ut1'`. No original system is dropped.

## Reproduce

From the site root, the exact complete measurement commands are in
`tools/run.sh`; no network or installation is performed:

```sh
bash docs/platform/evidence/site-engine-rc16/accuracy-refresh/tools/run.sh
```

Defaults use the already-verified sibling `reference-swiss-env`, `reference-env`
and `reference-swiss-ephe` directories and the local Node 22.22.2 binary.
`WORK_ROOT`, `SWISS_EPHE`, `PSWISS` and `PERFA` can select equivalent paths;
scratch inside the repository is refused and the Swiss data digests are asserted.
`validation.json` records the repeat-run and Swiss-output-guard result.
