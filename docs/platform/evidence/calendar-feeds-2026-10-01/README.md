# Calendar feed release preparation, 1 October 2026

This is local release-candidate evidence, not a production release or an
acceptance of P1.15. The programme remains 23% (42.5 of 182.45 weighted units),
with 2% (4) blocked, as printed by `node scripts/programme-ledger.mjs --summary`.

## Starting material and ordering

- The supplied `feed-ids` branch is exactly
  `9b6c770d28bfdfda4fce8f63dd86f5920123ef25`. Contrary to the generic statement
  in HANDOFF-2026-09-30.md §4, it contains no root `HANDOFF-STATUS-*.md` file.
  Its release instructions are OWNER-SETUP-RUNBOOK.md §8a.
- Merge `06117894` incorporates main
  `9cfafa3e742de943062c9174338472781724a4b5`. Conflicts in the allowance,
  runbook, claims ledger and findings preserve the compute work and calendar
  work together. The obsolete claim that no hosted chart API exists is gone.
- Source checkpoint `33b63987` sets the candidate release day to 2026-10-01,
  dates all six privacy pages and their sitemap entries, and narrows the
  protected-scope allowance to the four translated privacy pages, pinned to
  the merged main commit. It also fixes exception logging and inherited
  generated-context / historical-evidence binding drift.
- The release day is provisional until production actually serves the feature.
  If it is later than 2026-10-01 UTC, re-date the legacy window, all six privacy
  pages, the sitemap and the date test expectations, then rebuild and retake
  the final captures. Do not shorten the promised 60-day window by shipping an
  old candidate date.

## Exception privacy regression

The original opaque-feed logger interpolated arbitrary exception messages;
legacy calendar errors logged the exception itself. Six synthetic negative
controls failed before the fix. They cover network errors carrying a synthetic
id/code/key, malformed store JSON, a builder error containing synthetic
positions, and a legacy exception containing its positions token.

The routes now log fixed failure-stage messages only. Their responses remain
bounded, generic errors. The focused calendar, service-worker, sweep-workflow,
account-panel and runtime-import set passed 137 tests. The expanded set with
claims, generated context, dates and packaged engine checks passed 183 tests.
The legacy calendar's ordinary format tests now use a fixed pre-release clock;
the separate legacy-window suite still checks both boundaries and 410 expiry.

## Interrupted and repeated subscription actions

Source checkpoint `2458f0b6` adds a synchronous request guard and per-chart
revision ownership. It rejects repeated callbacks before Preact rerenders,
keeps an older request's successful feed out of a newer chart's primary
subscription block, and invalidates an old asynchronously loaded positions
code immediately on new props, before the passive effect runs.

Every successful feed and its removal key stays in the current visit's list,
even when local storage refused the write. Switching charts, a late response,
the initial storage-read effect or a later successful storage write no longer
drops those in-memory capabilities. Removal clears only the matching feed and
keeps other removal keys; failed removals can be retried.

The first deterministic hook regression run failed 9 of 11 tests before the
source fix. All 15 final recovery tests pass, including leave-and-return
ownership, stale callback rejection, both subscribe/remove ordering cases,
storage-refusal late responses and retry behavior. The focused run passed
143 tests across nine files. These tests do not substitute for the outstanding
browser integration drive.

### Remount and clear-all review

The independent review correctly rejected `2458f0b6` as insufficient: the real
chart callers unmount the calendar island during recalculation, so keeping a
key in one component's state was not enough. Source checkpoint `250e205d`
addresses the actual lifecycle with a `WeakMap` keyed by the current browser
Document. The store holds only validated feed records and full removal keys,
not positions codes or chart data. It is neither persistent storage nor an
SSR-global record. A newly mounted island is notified if an older request
finishes; deletion notifications update every mounted view, and the shared
request guard spans island replacement.

Explicit successful clear-all now clears document-held keys and invalidates
both pending client results and later component callbacks before sign-out can
fail or reload. It does not delete server feeds. Ordinary profile lease
revocation preserves keys. A different document has no volatile fallback, and
a non-persisted pagehide prevents a late request from refilling storage.

The remount negative control failed five of 22 tests. Another control failed
when clear-all landed between client completion and the awaiting view callback.
After the fixes, the focused contracts pass 185 tests in ten files; the final
three affected suites pass 69 tests, including 25 hook-level recovery cases.

## Complete local gate at source checkpoint 33b63987

Runtime: Node 22.22.2, as the repository and Site Check require.

- `npm run build`: passed, including check-dist, schema, isolation and all
  existing route/chunk budgets. 4,343 generated pages; check-dist inspected
  4,446 HTML files, 1,141 search entries and 9 feed items.
- `npm run check`: passed, 0 errors, 0 warnings, 18 informational hints.
- `npm test`, after the build completed: 506 files passed, one skipped and
  one failed; 6,445 tests passed, four skipped and one failed. The sole failure
  is `scripts/phase1-acceptance-evidence.test.mjs`, correctly rejecting the
  now-stale capture source hash. It remains a mandatory release gate.
- Claims inventory: zero unlisted sentences and zero orphans; claims binding
  tests pass. The rc.15 browser claim binds rc.15's historical validation file,
  rather than the mutable current Phase 1 capture receipt.
- Programme ledger validation and protected-scope guard: passed. The latter
  names exactly four protected privacy pages.
- Released engine and MCP archives are unchanged.

An earlier exploratory test run used a symlinked dependency tree and overlapped
an unfinished build. Its module-resolution and partially built-dist failures
are not counted as final results. An independent dependency directory and the
sequential complete gate above resolve those environmental failures. The
release-date, claims-order, historical-browser binding and generated-context
failures found in that run were repaired explicitly, not ignored.

## Final local gate at source checkpoint 250e205d

The complete sequence was rerun after all lifecycle fixes, in order:

- `npm run build`: passed, with all existing bundle budgets unchanged
- `npm run check`: 1,182 files, zero errors, zero warnings, 18 hints
- `npm test`: 507 files passed, one skipped and only the stale Phase 1 capture
  file failed; 6,480 tests passed, four skipped and one failed
- Claims: zero unlisted sentences and zero orphans; scope guard and programme
  ledger validation pass
- Independent re-review: the remount/key-loss blocker is resolved, with 69
  focused tests passing and no new blockers found

`validation.json` records these results and the precise old/new capture hashes.
The review used hook fixtures with the real client, not browser execution.
The clear-all fences are document-scoped: a clear-all/pending-POST race across
separate tabs remains inherited behavior outside this checkpoint's tests.
Do not describe this evidence as cross-tab erasure or repopulation proof.

## Packaged calendar runtime

`packaged-calendar.json` records the local Vercel CLI 62.0.0 package check.
The function is `nodejs22.x`, loads with module-syntax detection disabled,
rejects wrong methods for all three opaque-feed routes before any storage
operation, and builds a synthetic twelve-event calendar through the real
server ephemeris. Fetch is replaced with a failing observer; no fetch was
attempted. This is not a check of production credentials or a database write.

Reproduce after the functions-only local build:

```sh
node --no-experimental-detect-module \
  docs/platform/evidence/calendar-feeds-2026-10-01/tools/verify-packaged-calendar.mjs
```

Only nonsecret `.vercel/project.json` metadata was copied for that local build;
no environment values were pulled, no project was changed, and nothing was
deployed. The CLI's incidental package-lock normalization was discarded so
this release does not change dependency identities. Vercel's transpiler also
prints type diagnostics in existing email/type-only-import graphs even though
packaging exits successfully; the repository's separate `npm run check` is the
type gate. The newly introduced body-union diagnostic was fixed with an
explicit false discriminant before the final package check.

## Release gates still outstanding

1. Merge the final compute checkpoint from updated main and re-pin the scope
   allowance. Recheck the release day before the last rebuild.
2. Run the PostgreSQL 17 **Calendar feed SQL** CI job on the release commit.
   `npm run test:calendar:feeds-sql` was invoked locally and refused to run:
   this executor has no Docker. Static review is not a substitute for this gate.
3. Retake Phase 1 captures after the last source change. Local Chromium is
   unavailable under this executor's Unix-socket restrictions; the supported
   fallback already exists in `.github/workflows/browser-evidence.yml`.
   A same-repository PR with `<!-- browser-evidence -->` in its body runs
   head-bound captures and validates their receipt. Review its uploaded
   provenance and pixels, import the correct captures, then rerun the full
   checks on the resulting release commit. Do not fake or relax the source hash.
4. Run the calendar browser integration drive and the other required CI jobs.
   No local browser result is claimed by this record.
5. Apply the reviewed production migration only after the SQL gate passes and
   with the required authorization. Then deploy, manually run **Calendar Feed
   Sweep**, and perform the runbook's synthetic create/fetch/CDN/remove test,
   live read/write 429 checks, and redacted log review. Keep live feed addresses
   and removal capabilities out of committed evidence.

The local preparation performed none of steps 5's external mutations.
