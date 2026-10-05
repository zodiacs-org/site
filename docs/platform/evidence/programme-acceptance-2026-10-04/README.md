# Seven programme acceptances, 4 October 2026

This checkpoint records seven existing gates against site source
`b1636359d7f79351b5fb2b477a57e6dafb7c0a3c`. The owner authorized evidence-backed
accounting and publication after PR635's release. No gate, weight, denominator,
calculator, package, runtime or frontend changes. Earlier dated records retain
their original verdicts; this is not a reconstructed October 2 checkpoint.

## Evidence identity and verification

[reconciliation.json](reconciliation.json) is the producer's finalized input,
20722 bytes, SHA-256
`971bc15a7f2e3bb4a292973265dda3270efad3392e65d45a1dd1117bc14edc16`.
Its `decisionStatus` describes its preparation before this accounting update.
Library resolved version 0 but its supported transfer failed twice. The producer
then supplied the original text directly. Two transport-escaped `Build &amp; Check`
job names were decoded to `Build & Check`; the resulting bytes exactly match the
producer's original size and digest. Library materialization did not succeed.

The input distinguishes source evidence from the producer's read-only GitHub
and deployment observations. Those observations are carried here with their
source links and times, not represented as fresh executor network probes.
[verification.json](verification.json) records local checks of the seven exact
gate/weight pairs, four parity summaries, three A4 bundle hashes and the rc16
archive. No private pattern list, authentication material or raw private log is
included or reconstructed.

## Gate dispositions

| Unit | Added weight | Evidence and bounded disposition |
| --- | ---: | --- |
| S6 | 0.5 | [PR632](https://github.com/zodiacs-org/site/pull/632) and the committed post-build scanner/negative controls cover persona, editor and Person markup in served developer docs. The existing source guard remains. Premerge [37143121771](https://github.com/zodiacs-org/site/actions/runs/37143121771) and postmerge [37146059723](https://github.com/zodiacs-org/site/actions/runs/37146059723) passed; deployment and current source retain it. This is a bounded scanner, not a general JSON-LD semantic processor. |
| A4 | 0.5 | [Engine PR23](https://github.com/zodiacs-org/engine/pull/23) published the [skill bundle](https://github.com/zodiacs-org/engine/blob/c8a390ee1f3ad1f6883a0b986d66a31bf010ddd7/skills/zodiacs-compute/SKILL.md): tool selection, unknown-time handling, receipt citations and forbidden claims. All three manifest hashes match and the producer recovered 21 successful postmerge checks. The gate requires public repository publication, not npm publication. |
| P2.E.returns | 0.5 | [PR620](https://github.com/zodiacs-org/site/pull/620): solar/lunar instant searches use package techniques; site adapters retain chart shape and reference-span refusals. Recorded parity: 1980 cases, 1930 agree, 50 differ (`returns-span`). |
| P2.E.void-of-course | 0.5 | PR620: the page calls package windows/status at build time; the old site implementation is removed. Recorded parity: 156 cases, all agree. The named convention and finite-window limits remain. |
| P2.E.aspect-patterns | 0.5 | PR620: the adapter calls package detection and retains the site's unavailable-result shape for malformed input. Recorded parity: 1840 cases, all agree. |
| P2.E.moon-sign-candidates | 0.5 | PR620: the active sharing helper calls package `moonSignCandidates`, with preview/download callers. Recorded parity: 5147 cases, 5134 agree, 13 differ: date-form 3, skipped-date 1, before-1970 9. The main calculator still marks unknown-time Moon certainty unresolved; this acceptance credits sharing adoption only. |
| G1 | 1.0 | [PR635](https://github.com/zodiacs-org/site/pull/635) supplies the source-pinned [rc16 reference](https://zodiacs.org/developers/engine/reference/) outside `/sdk/`, linked from the engine landing. The producer verified neutral repository description/topics/homepage, canonical routes and matching provenance/license bytes on READY production. Historical SDK bytes remain unchanged. |

The four technique gates share the [committed parity artifact](../site-engine-rc16/techniques-parity.json),
[publication record](../site-engine-rc16/integration-2026-10-02/PUBLICATION.md),
[npm release run](https://github.com/zodiacs-org/engine/actions/runs/36858851623)
and [site release checks](https://github.com/zodiacs-org/site/actions/runs/37003714196).
Exact per-unit source links are retained in `reconciliation.json` and the ledger.
The rc16 archive digest is
`43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`,
from engine source `ddbbaa0b1d21e16834722f81e8708816849c6726`.
Current source retains the package imports and removals. The producer bound that
source to READY deployment `dpl_4LmaXAGm8YJFF6vastJQ5WWXSTE8` at `b1636359`.
PR635's exact-head [premerge](https://github.com/zodiacs-org/site/actions/runs/37191270664)
and [postmerge](https://github.com/zodiacs-org/site/actions/runs/37193751725)
runs each passed all 19 jobs. Live GET observations are dated in the input.

## Limits retained

- The original October 2 six-request local live receipt and private acceptance
  commit remain missing. No request timestamps, original receipt or prior
  percentage are reconstructed. This is not a new live computation replay.
- A4 retains its committed initial private-scan aggregates and missing optional
  example-input limitation. The final local rescan receipt is not recovered;
  accepting the published skill does not claim otherwise or rerun private patterns.
- Product parity and generated declarations are not new astronomical accuracy
  or completeness evidence. Returns' 50 and Moon's 13 discrepancies remain
  explicit. Engine conformance remains 267 passed, 192 failed, 41 unsupported.
- The rc16 distribution retains both **MIT AND CC-BY-4.0** obligations and all
  notices. No legal condition is bypassed. JSR remains blocked on its license
  issue; no retry or acceptance is part of this checkpoint.
- No credit is added for composite, dignities, declinations, sect, P3.3/F60,
  cold telemetry or the shelved calendar proposal. F60's unresolved limiter and
  absent Cold observations stay unaccepted. No calendar work is reopened.

## Accounting and reproduction

Only these seven units change to accepted: +4.0, from 43.5 to **47.5 of 182.45**
(26.035% to three decimals). Only A4's stale 0.5 publication blocker is removed:
blocked weight becomes **3.0** (1.644%). The fixed denominator digest remains
`52f0e08533e8774bf10d33a322b597f3205aea1a76980f6e2a8a6ba33fc1d0a8`.

Run `node scripts/programme-ledger.mjs --check` and
`npx vitest run scripts/programme-ledger.test.mjs`. The unchanged calculator's
actual `--summary` headline changes from:

```text
Overall delivery: 24% (43.5 of 182.45); blocked 2% (3.5)
```

to:

```text
Overall delivery: 26% (47.5 of 182.45); blocked 2% (3)
```

## Correction, checkpoint 13 (4 October 2026)

The independent audit of this checkpoint ([record](../programme-audit-2026-10-04/README.md))
found one gate clause unmet. "Current source retains the package imports and
removals" was not true for returns: `src/lib/engine/year-scan.ts`, the year
ahead on `/profile/`, still found solar returns with the site's own Sun crossing
scan, the construction PR620 removed from `solar-return.ts` (FINDINGS F-67).
The audit routes it through the package and returns P2.E.returns to validated
until production serves the change: 47 of 182.45 (25.760%). The other six
acceptances stand. The recorded parity of the Moon candidates' adopted sharing
path is section M-A, 3,002 of 3,005 (F-68). The text above is left as written.
