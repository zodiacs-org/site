# After composite-adapter deferral

Read-only measurements of the completed production-flags build on
2026-10-01, saved separately from every earlier graph and failure.

- Compatibility initial closure: **36,763 B gzip**, **101 B** below the
  unchanged 36,864 B limit
- All sixteen initial route closures pass and contain no ephemeris/full
  fingerprints
- RelationshipWheel static closure: **22 chunks, 52,151 B gzip**, with **no
  ephemeris fingerprints**, restoring the earlier lazy-view property
- Engine static closure: **33,130 B gzip**, **+1,022 B** over the verified
  rc.15 baseline of 32,108 B

At this snapshot the temporary engine allowance remained 32.621484375 KiB
(the earlier +1,046 B allowance), so the measured headroom was 274.4 B.
The final engine is 24 B smaller than the pre-deferral engine. To apply
only its final measured growth while preserving the prior 250.4 B headroom,
the allowance should be **32.598046875 KiB** = 33,380.4 B. This audit did not
edit the budget. The integrator must record/recheck that final tightening
separately; the passing snapshot gate is `after-deferral-budget-gate.log`.

Exact final chunk graphs, per-chunk hashes, all route totals and the
then-current allowance are in `after-deferral-route-measurements.json`.
The prior +51 B compatibility failure and 30-chunk ephemeris-bearing wheel
remain in `production-route-measurements.json`,
`compatibility-attribution.json` and `production-budget-gate.log`.

Reproduce another snapshot without overwriting these records:

```sh
node docs/platform/evidence/site-engine-rc16/bundle-audit/measure-production.mjs NEW-LOWERCASE-LABEL
node scripts/report-bundles.mjs --fail
```

Use a lowercase label, for example `after-deferral-tightened`. The script
refuses to overwrite an existing label's JSON. It reads `dist/`; it does
not build, modify source, or move any lazy boundary.
