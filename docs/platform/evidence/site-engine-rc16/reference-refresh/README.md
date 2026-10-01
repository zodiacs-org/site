# rc.16 independent references and conformance

Local adoption evidence for `@zodiacs/engine` 0.1.1-rc.16, from engine commit
`6807f632fc5aad08999d97f61e50793c6ca9a0b4`. No programme acceptance gate is
changed. [validation.json](validation.json) records source digests, changed
return instants, commands, numerical checks and the conformance comparison.

## Independent references

The existing generator ran with Node 22.22.2 and pyerfa 2.0.1.5. The retained
batch-B Horizons queries changed because rc.16's full IAU 2000B nutation moved
the product's solar and lunar return instants. `--refresh-changed` fetched
only the ten `points-b-*` responses and `vectors-b`; no Swiss values were
read or written. The official responses and their manifest are retained.

Two subsequent offline rebuilds were byte-identical to the refreshed output
across 47 source, response and reference files. Their logs are
[offline-rebuild-1.log](offline-rebuild-1.log) and
[offline-rebuild-2.log](offline-rebuild-2.log). The four reference files and
exactly five existing SHA-256 assertions were updated, with causes beside
the assertions. Numerically, only the product-returned chart instants and
the independent reference charts evaluated there changed. Independent
return roots, node/polar values, transit-window values, policies and gates
are unchanged.

Horizons' official text responses contain trailing spaces. These are an
expected `git diff --check` exception: stripping them would corrupt the
retained source bytes and invalidate the recorded digests.

## ERFA angle arbiter

The clock dump and arbiter rebuilt twice byte-identically. Every independent
ERFA angle and Placidus limit is unchanged; the provenance now records the
installed version instead of hard-coding rc.15. The formula-consistency test
uses rc.16's full IAU 2000B equation of equinoxes and true obliquity.

On the same 3,128-case corpus, the maximum ascendant residual is
0.0955745633 arcseconds, at 1850-03-21 18:00 UTC and latitude −66°. The maximum
within 45° is 0.0037809337 arcseconds; the maximum midheaven residual is
0.0021232953 arcseconds. All 320 computable and 16 refused Placidus ladder
cases keep their verdicts. The 8″ / 0.5″ ascendant, 0.21″ midheaven and
1e-6″ formula-consistency gates are unchanged; only residual regression pins
were refreshed.

## Conformance

`src/data/conformance/summary.json` is copied byte-for-byte from the engine's
committed result at `6807f632`, SHA-256
`849df9f680e470e9fb8b363e7dc74bfc6f83e6b3846752d10eb7c7394aa0bb8f`.
The suite and vector identities are unchanged. The engine passes 267, fails
192 and reports 41 unsupported out of 500. Only `L1-POS-0041` changes verdict,
from fail to pass. The Swiss summary remains 403 / 47 / 50 with `values: none`.
The corresponding `conf.results`, shared conformance digest and changed note
occurrences were handed to the parent as a patch for the claims ledger.

## Verification

- Seven focused test files pass, 143 tests: [targeted-tests.log](targeted-tests.log)
- `strip.py --check` passes: 10 removed, 133 stripped, 21 replaced files;
  40,597 gone and 3,474 retained value digests
- The Swiss output guard passes, including archive scanning
- No full site build or full suite was run in this subtask
- No commit, push, deployment, package publication or ledger acceptance
