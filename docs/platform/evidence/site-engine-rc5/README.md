# Site engine rc.5 adoption evidence

The proposed site pin consumes `@zodiacs/engine@0.1.1-rc.5`. This is an
unpublished candidate, not an npm release or a production deployment receipt.
The standalone starter and its engine rc.3 artifact keep separate identities.
No account or saved-chart migration is implemented by this dependency change.

- Source: SDK `97f5e8d01828f4b85ffa845825dee9acff4695e4`, `packages/engine`.
- Artifact carrier: SDK `333369256af683c560603dd1e6411dd7a07adb1f`.
- [Anonymous immutable archive](https://raw.githubusercontent.com/ZodiacsOfficial/sdk/333369256af683c560603dd1e6411dd7a07adb1f/artifacts/zodiacs-engine-0.1.1-rc.5.tgz).
- SHA-256: `1809c1686843a6be148eb185535e32059a20c35896e29ccfc7583a6b2738da65`.
- 23 packed files, 36,065 packed bytes, 121,212 unpacked bytes.
- [SDK acceptance record](https://github.com/ZodiacsOfficial/sdk/blob/785e3ea154c28e890ecc97ce2284ee3e9f48a4a7/docs/platform/EVIDENCE.md#public-flags-and-civil-settings-candidate).

## New independent-reference comparisons

The existing `scripts/platform-engine-report.mjs` was executed without edits
against this installed candidate in an isolated site checkout of
`921cd0d16cd0c4a82692d311c3af326b0045531d` plus the rc.5 dependency pin.
The frozen Swiss reference corpus and predeclared tolerance policy were neither
regenerated nor changed. Reports identify their exact artifact and input hashes.

```sh
node scripts/platform-engine-report.mjs > docs/platform/evidence/site-engine-rc5/independent-node-polar-node22.json
node scripts/platform-engine-report.mjs > docs/platform/evidence/site-engine-rc5/independent-node-polar-node24.json
```

These two commands used separate binaries: Node 22.23.2 / ICU 78.2 / tzdata
2026a, and Node 24.19.0 / ICU 78.3 / tzdata 2026b, respectively. Both exited 0.
See [Node 22](independent-node-polar-node22.json) and
[Node 24](independent-node-polar-node24.json). Each checks three independent
true-node epochs and three polar locations with both requested house systems.
Maximum residuals on both runtimes were 0.0016854563243668963° node longitude,
0.00035060403237266446°/day node speed, 0.0004348240686340432° polar angle, and
0° whole-sign cusp. Node-direction comparison retains the original deadband.

This is a finite reference comparison, not a broad date-range error bound,
ephemeris authentication, human practitioner review, or interpretation evidence.
The earlier rc.1 reports remain unchanged and are not relabelled as rc.5 checks.

## Packed consumer receipt

[The original fresh Node 22 consumer log](public-candidate-consumer.log) is copied
byte-for-byte from the SDK rc.5 acceptance run. It records public examples,
TypeScript 5.9.3 imports, errors, optional isolation, GeoNames recovery, receipt
round trips/redaction, compatible derived flags, scalar snapshots and civil
validation before Intl. The JSON receipt names the same artifact SHA-256.
Its scratch paths describe the test environment, not deployed application state.
The SDK acceptance record links the additional Node 20 and browser controls.

Full site gates, browser checks, and publication status belong to the integrator's
subsequent checkpoint. This record alone does not establish those outcomes.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the
two parity reports here, and the rc.1 reports at
`../independent-node-polar-node22.json` and `-node24.json`, lost their
per-case differences from the Swiss node/polar fixture (`nodes` and `polar`).
Their maxima, which the figures above quote, stay, and each report records the
SHA-256 of what it lost under `swissOutputRemoved`; within each release the
Node 22 and Node 24 digests are equal, as the values were. Commit `2ca93d41`
still has the reports whole. `scripts/platform-engine-report.mjs` now measures
against the NASA JPL Horizons and ERFA references
([`../../../engine-validation/independent-references/`](../../../engine-validation/independent-references/README.md));
run it at `2ca93d41` to measure against the Swiss fixture again. The record
of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
