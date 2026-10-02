# Engine rc.16 adoption: local preparation

This is an unfinished adoption, not a release, publication or acceptance
checkpoint. Site WIP `4f5df854` was integrated with main `ed55dacb` (including
owner changes #606, #611 and #612) and reviewed compute prerequisite
`458b6ab9`, in a separate worktree. Later main `450f0fd9` (#614/#615) is
merged with its owner changes intact. No Guide or homepage repair is authored
by this adoption.

## Immutable artifact

Source `ddbbaa0b1d21e16834722f81e8708816849c6726`, carried by
`ef44477f85f28a57d5ec7f61ed6ea6a99c4be563`:
https://raw.githubusercontent.com/zodiacs-org/engine/ef44477f85f28a57d5ec7f61ed6ea6a99c4be563/artifacts/zodiacs-engine-0.1.1-rc.16.tgz

SHA-256 `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`;
266,934 bytes, 69 files, 923,282 unpacked bytes. The vendor copy is identical
to that carrier's git object. Existing archives keep their bytes.
The dated npm record is still the separate rc.15 record under
`site-engine-rc15/npm-registry.json`; this preparation changes no registry tag.

## What is verified so far

- [Server private-state cleanup](PRIVATE-STATE.md) and independent
  [review](private-state-review/README.md): rc.16 frame TT, rotation and tilt,
  Pluto epoch segments, aggregate Moon count; synchronous DeltaT restoration
  and request-isolated resolver maps. 59 focused tests passed, with nine
  fresh-process exact response/receipt/citation comparisons. The review also
  covered 315 top-level bindings and one-millisecond overlapping inputs.
- [Independent references](reference-refresh/README.md): two offline builds
  and two ERFA builds are byte-identical; 143 focused tests. Conformance is
  267 pass / 192 fail / 41 unsupported, not a blanket accuracy pass.
- [Output attribution](site-outputs.md): 574,961 calls, 34,189,944 values,
  10,131,398 changes, zero unexplained values and zero mechanism failures.
  The installed 69 files match the immutable archive; seven negative controls
  refuse invented changes. Finite-corpus parity is not an accuracy bound.
- [Daily and event data](DAILY-EVENTS.md) preserves the first mixed-source
  comparison. The [subsequent station alignment](station-alignment/README.md)
  uses the same product longitude source with the existing ±0.25-day derivative,
  scans, refinement and shadow definitions. All 90 monthly stations now agree
  within 1,237 ms, below the unchanged 2,000 ms gate. The original disagreement
  up to 2,651.961 s remains recorded. IDs, counts and dates are unchanged.
  The fresh Swiss statistics-only measurement has 290 matches, zero fallbacks,
  and station maximum 419.451 s (formerly 2,454.390 s); this is still minutes,
  not acceptance of a planetary-station accuracy gate.
- [Independent statistics](accuracy-refresh/README.md): multiyear and ΔT
  records refreshed twice identically. P1.03 still fails both original UTC
  and aligned-UT1 modes (63/816 and 44/816 over 5″). Original Koch ladder
  fails 48/353 over 3″; aligned UT1 passes that historic ladder at 0.035″.
  Given-input/polar checks pass, while full-span failures remain recorded.
- Node [22](node22-parity.json) and [24](node24-parity.json) node/polar checks
  passed their fixed finite corpus. [Packed consumers](public-candidate-consumer.log)
  on Node 22.22.2 and 24.19.0 passed the engine's unchanged consumer harness,
  including declarations. Smoke coverage is not the formal capability gates.
- MCP rc.16 local archive: carrier `03142a4d9a78733876137f611586d7482793bee6`,
  SHA-256 `dfc9177eb3e5e1a02163fdd0084dd88e426d13355103156213ccf8fc36f9aeb9`
  (the generated manifest is authoritative), 89,871 bytes; protocol 87/87
  and synthetic comparison regression 18 scenarios / 112 assertions pass.
  The bundle and pack drift checks pass. Fresh named-host proof passes 7/7
  with official Claude Code 2.1.286 in disposable configuration; only existing
  MCP add/list/get/remove actions were used, without login, model turn, auth
  variables, credentials, grants or paid use. See [setup](host-validation/setup.json)
  and the current [host result](../mcp-adapter/host-drive.json).
- [Packaged server functions](packaged-functions/README.md): twelve Node 22
  functions package locally; six synthetic compute examples pass in 60 fresh
  processes / 120 responses with module detection disabled and Firewall stubbed.
  CLI diagnostics are preserved. This is not live latency/cost/Firewall proof.
- [Bundle audit](bundle-audit/AFTER-DEFERRAL.md): final engine closure 33,130 B,
  measured growth 1,022 B over the same-boundary rc.15 baseline. The allowance
  increases by exactly that growth, retaining 250.4 B headroom under handoff
  step 10. All production-flags route gates pass without route-budget changes;
  compatibility has 101 B headroom and its saved-chart wheel loads no ephemeris.
- The exact registry ingress golden moves by 130 ms; [same-generator replay](registry-ingress-pin.json)
  attributes it to the nutation change. No tolerance or performance limit changes.
- [Unaligned generator clock margins](model-clock.json) remain at most 0.689 s
  with no minute/date changes. This is a clock-only counterfactual, not a
  full-nutation root displacement measurement; the other generators stay unchanged.

## Eligible units and remaining gates

The four technique units P2.E.returns, void-of-course, aspect-patterns
and moon-sign-candidates have local package imports/removals and
[WIP technique parity](techniques-parity.json). Their gate additionally
requires released package adoption and deployment; no unit is accepted here.
Composite adoption is deferred: its package entry newly loads the ephemeris
for the saved-chart relationship view and exceeds the unchanged production
route budget. The prior parity evidence remains, but the consumer adapter
is restored to main pending a lightweight published entry (F-54).
Dignities stay unadopted because the current entry can pull the ephemeris
into an eager bundle and exceed its budget; declinations and sect await an
ephemeris-free entry. P1.03 and Koch retain their existing failed statuses
after the fresh measurements above; an aligned-clock pass does not substitute
for the original failed comparison or the release checks.

The existence of calc/window/houses/sky exports or packed-consumer smoke tests
does not accept P3.2, P2.D.frames, B2.a, house positions, co-ascendants, cusp
speeds, planetary returns, rise/set or planetary hours. Each still needs the
specific evidence and release state in the unchanged acceptance ledger.

## Blocking and unfinished checks

- Both full build modes pass on owner-main-integrated source `3e901191`, with
  all chained `check-dist` and route/engine gates. Astro check reports 0 errors,
  0 warnings and 18 hints. The stable four-worker full suite has **6,357 pass,
  3 fail, 4 skip**. The failures are exactly Guide context, the homepage's old
  “See your forecasts” assertion and stale native captures. The earlier three
  load-sensitive timeouts pass with the same assertions/timeouts. See the
  complete source-bound [validation record](validation.json) and its logs.
- Native browser drives and final Phase 1 captures remain pending. Chromium
  launch is disallowed by this executor; there is no bypass or fresh capture claim.
- Known Guide/context/homepage failures belong to the other frontend session.
  They are neither repaired nor represented as passing by this adoption.
- Earlier P3.3 and P1.15 production/checkpoint gates remain separate and
  unaccepted. No Moon holdout was rerun; no raw Swiss values/code/data or
  DE440-derived coefficients were added.

Executed programme summary remains 23% (42.5 of 182.45), blocked 2% (4).
The exact weights-derived percentage is **23.294%**. Denominator and accepted
units are unchanged.
