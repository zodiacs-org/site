# Production compute release and verification, 2026-10-01

## Released result

[PR610](https://github.com/zodiacs-org/site/pull/610) merged normally as `fd1ce88af66eca158c24a92569a9101281b964f7`, tree `341a3d7de0d1688585fba8d723d8f270f366c3d8`. Production deployment `dpl_AsJc5MrDgH4PpgoZSGMe7XTZePe4` became READY at 20:23:31.991 UTC and was independently bound to that source and the canonical aliases. The server-only F59 cache-lifetime fix is live. Engine rc.15 and the owner frontend remain unchanged.

The bounded post-release cohort contains 120 successful synthetic requests, 20 per endpoint, with exact platform request-ID joins. It has 119 Hot requests, one Prewarmed chart and zero Cold requests. [Platform report](platform-report.md) preserves measurement boundaries, rounded pricing inputs, sample limits and privacy scope. [Client summary](client-summary.json) retains every observation, including the first chart's 7,853 ms client outlier. The target pacing was 2,200 ms; observed UTC-start minimum was 2,198 ms and at most 28 requests started in any rolling minute. The UTC clock and timer contributions cannot be separated from these records.

**P3.3 remains unaccepted.** Cold latency/cost has not been measured, and the earlier F60 general-counter discrepancy remains unresolved. No new limiter-exhaustion probe or security-setting change was made. Empty exported application-message fields do not prove absence of input data in every platform layer or process memory.

## Reviewed release gates

The final head `3a93b730bdef66f84382dc31b7abc5316465ac48` passed all 19 jobs in [Site Check36915333265](https://github.com/zodiacs-org/site/actions/runs/36915333265). Local build/check and the required Node22 suite passed: 6,354 tests, four skipped, no failures. [Packaged source binding](packaged-source-binding.json) records the exact existing Vercel function import and its reuse limits.

Fresh post-main [Browser Evidence36914298793](https://github.com/zodiacs-org/site/actions/runs/36914298793) produced artifact11190935475. ZIP SHA-256 is `e62607cdaaa9ef889b87bc915c983bc9a4ea44545b1e3184960b9c9a0d506372`; manifest SHA-256 is `bc71a3afc5c3c0d9feaa7c9e59181787d3f59914c7db00dc8ef33d906d79bc6b`. All18 image hashes/dimensions were checked and paired full-page sheets plus readable Today crops independently reviewed. Source hash `66d386ef3d0d46898c703f9311573a427dad9edd7aad8d1a8ee70c19f4ab4c81` equals the owner's retained captures. The only subsequent change was scope metadata, with no render/runtime effect.

The owner images retain their original provenance. Fresh Chromium149 images differ from the owner's Chromium154 raster output, including a one-pixel mobile-height difference, without an observed new content/order/major-geometry/clipping change. This is a reviewed fresh-run record, not a claim that owner images came from the new run. [Capture review](capture-review/verification.json) and [comparison](capture-review/owner-capture-comparison.json) retain the exact bindings. All capture/receipt/visual/Lighthouse gates passed. Four unchanged Explorer diagnostics remained red and are [reported explicitly](capture-review/FRONTEND-HANDOFF.md); they were not called green or repaired in this programme. Final [Browser Evidence36915333255](https://github.com/zodiacs-org/site/actions/runs/36915333255) retained those same limits.

## Post-merge CI follow-through

The main-source [Site Check36920792637](https://github.com/zodiacs-org/site/actions/runs/36920792637) completed with18 jobs green and one Build & Check failure after the release. Its DailyForYou360px active hydration observation was CLS0.00040552126200274344 against an exactly-zero requirement. Other horoscope cases passed. The [selected CI receipt](post-merge-ci.json) preserves the exact run, assertion and retained artifact; no flaky-cause explanation is established and no frontend code or assertion was changed. Pre-merge green gates and post-merge failure are separate observations. The successful exact120-request production API verification remains valid.

## Reproduction and privacy

The public candidate includes only an explicit allowlist of synthetic request IDs, timings, response hashes, engine identity, aggregate resource observations and nonsecret deployment identities. No raw logs, IPs, headers, request/response bodies, account details, private birth inputs or raw UI exports are included. Raw exports were used for the independent exact join and remain private. A sanitized-only validator can reproduce internal arithmetic and consistency, but cannot independently re-observe the original provider export or UI.

The original baseline and all failed/inconclusive rate probes remain unchanged in the earlier evidence directories. This checkpoint grants no additional compute acceptance credit.

`measure.mjs` preserves the exact executed request recorder and fixed synthetic workload. It requires an explicit `--execute` mode and verified source/deployment arguments; merely inspecting this checkpoint sends no traffic. `analyze-platform.py` preserves the private-input joining method, but cannot run from this public subset because its raw inputs are intentionally withheld. Use the sanitized-only validator for public internal-consistency checks.

## Programme ledger snapshot

This evidence-only change leaves the public programme ledger unchanged. On base main fd1ce88a, its actual summary is `Overall delivery: 24% (43.5 of 182.45); blocked 2% (3.5)`. That is the older public snapshot, not the newer private programme bookkeeping. No held ledger or STATUS payload is included in this change.
