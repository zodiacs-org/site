# Calendar feed transaction evidence — 2026-10-01

The calendar-owned native gates pass on public PR613 head `7a9c9fe52689fddf9338d706459bebc981e180ac`: **34/34 cross-tab cases and 25/25 transit/calendar UI checks**, with no page errors or external requests. PostgreSQL 17 replay/privacy/search-path/concurrency CI also passes. The release is still gated by unrelated frontend checks, final capture review/adoption, server Production target confirmation and the production runbook. This packet advances no calendar acceptance.

## Source binding

- Core fix: local `54cedce894cfa05c46279f757b58d029256a98b5`, published as `5a8c80ef3ab7653223fe76cba5ce0efd91d4c416`
- Main integration: local `32e3873e9406d86bfb77d078a19c529564eba7f1`, public `7a9c9fe52689fddf9338d706459bebc981e180ac`
- Integrated tree: `290000b7ffcd7dad7090ea4b5ba4db2734c9644d`; public parents retain both the previous candidate and owner main `450f0fd948d86d82c416bcbd51b3dace5196097e`
- Phase 1 render-source hash: `d861b489661f154f021c1ca5236acd88975d6ecb5abb0ad43d92ec90a344f28a`
- Only merge conflict: the allowance, kept to four translated privacy pages and pinned to the integrated main. All 15 other upstream paths remain byte-identical after rebuilding (`owner-main-paths.json`), including homepage, navigation generator/output and owner Guide checks

## Why the persistence changed

The original native run at `3594bd96` failed a legitimate two-document subscription. A diagnostic rerun at `cb69bf6d` passed without changing client code. Twenty controlled queued-preflight trials at `502e1248` then reproduced eight failures: four replaced a fence after a later locked read still returned absent, and four lost a record after both responses said it was kept. Web Locks serialized callbacks but did not refresh another renderer's localStorage cache. Those runs remain historical failures; the passing diagnostic was never treated as a fix.

The browser now keeps the removable random fence and validated `{id,url,secret,madeAt}` records in one canonical IndexedDB row. Preflight, final compare-and-merge and erasure are transactions; success waits for transaction completion. No network operation holds a transaction or lock. Explicit clear-all awaits the row's deletion under the existing exclusive profile transition and reports failure honestly. No new calendar-owned post-clear marker remains; an empty schema may remain. The existing living-chart clear-request mechanism and the server/Supabase store are unchanged.

Only genuinely volatile keys remain in document recovery. Failed storage never upgrades an old response into persistence automatically. Another document's authoritative removal drops durable keys from the view; independent volatile keys survive. Remount starts guarded hydration without requiring a helper read. Loading, unavailable storage and a conservatively cancelled stale-generation click have explicit UI states. A document that misses all notifications and cannot read canonical storage cannot establish that its memory snapshot was cleared elsewhere; a later successful refresh or document exit resolves that limit, and the cache never authorizes persistence.

There is no automatic import from the unpublished localStorage candidate. Repository main had never shipped the opaque store. Preview/development users retain their old records until clearing and can use their original candidate or the existing address-by-email removal procedure. This does not alter the actual legacy token URL's 60-day transition.

## Verification

Independent reviews at the core commit passed 162 and 133 focused tests. Negative controls reproduced the stale explicit-read cache bug and all three durable-echo/remount regressions before their fixes. The final native drive retains all original 8 semantic cases and 20 queued trials, adds four real transaction-failure cases, and adds two cache-only view regressions that cannot be repaired by an explicit read in the test.

Post-merge local build and typecheck pass, with unchanged budgets and 1,185 checked files, 0 errors, 0 warnings and 18 existing hints. The complete four-worker suite has 6,545 passes, 4 skips and 3 failures: preserved generated Guide month drift, stale checked-in Phase 1 captures, and owner main's homepage test still requiring “See your forecasts” after its approved navigation-copy change. Calendar and claims tests pass. The earlier load-related evidence timeout passed in isolation and did not recur in this run.

The inspected native artifact is `11154819933` from [Browser Evidence 36850243300](https://github.com/zodiacs-org/site/actions/runs/36850243300), ZIP SHA-256 `012cb64e806a16c9e503fc89132a903a1ed0096da5287667638006142aa81167`. Its ZIP was downloaded and hash-verified; all 21 bundled source inputs and the UI driver/build hash match this source. Raw result JSON is preserved here. Runtime: Chromium 149.0.7827.55, Node 22.23.3. Site Check independently reports both calendar browser steps successful as well.

The exact candidate's [Calendar feed SQL job 110329914844](https://github.com/zodiacs-org/site/actions/runs/36850243233/job/110329914844) passes. It tests an isolated PostgreSQL 17 database; it does not prove the production migration is installed. Migration file SHA-256 is `a0bd1d713360f73ea3a53f53fb7592e0ae2b43c23205b506ec62a441b9e18438`.

Phase 1 capture and receipt-validation steps succeeded. Combined artifact `11155943680` is 105,802,958 bytes; GitHub reports SHA-256 `ecfa8e17a5940d2b5c010d8c79406e8ad2209ef1534187752bd5e21b0f1a1c14`. Its complete archive/per-image hashes were not locally verified: it exceeds the file helper's 32 MiB limit, and a selective byte-range request returned HTTP 403, after which that route was stopped. Active captures and owner visual baselines were not replaced. Broader visual comparison, Lighthouse and explorer steps failed and remain visible in `ci-status.json`.

## Production target and remaining release

Current Vercel deployment metadata, the live profile CSP and its public client bundle bind the browser to `mftpcdpttteuwbolobye` (`production-binding.json`). At **2026-10-01 11:24:01 UTC**, the programme coordinator completed the reviewed SELECT-only packet through the refreshed Supabase connector. The exact export is `supabase-production-metadata.json`, SHA-256 `b9798edbe2cd18f735f53ca28543c833479d48d0ab00e85ab4f9984b30d8c968`. It confirms Zodiacs.org, Tokyo (`ap-northeast-1`), ACTIVE_HEALTHY and PostgreSQL 17.6 (project engine version 17.6.1.141). The only returned migration IDs are `20260819050930` and `20260831190940`; `20260929180000` is not listed, `public.calendar_feeds` is absent, and the calendar security/column/named-function queries return no rows. The SQL database role is `postgres`; the account organization-role label is unavailable and is not inferred from that SQL role.

This is the **first valid live-target absence observation**. It supersedes the earlier access block; the calendar worker's stale connector remained denied, so the worker imported the coordinator's export byte-for-byte rather than independently claiming a successful database query. The earlier `wlzzboekuffmagakvxaq` check remains withdrawn as production evidence because it addressed an unused test project. That original observation and the access-denial history remain preserved. No user rows, function bodies, secrets or environment values were returned, no permissions were expanded and no production writes occurred. The historical owner handoff packet no longer requires owner action for these completed metadata checks.

`MIGRATION-REVIEW.md` prepares the exact additive migration for later review. It remains unapplied and depends on server Production target confirmation, the final release gates and execution authorization. The native/SQL results above belong to public source `7a9c9fe5`; this later locally prepared evidence update does not imply its own publication or calendar acceptance.

`RELEASE-CHECKLIST.md` gives the remaining sequence and the smallest safe next step. The release date remains provisional 2026-10-01; deployment on another UTC date requires coordinated re-dating, rebuilding and final captures. The live 60-day clock has not started by preparing this candidate.

The executed source-ledger command reports 23% (42.5/182.45), blocked 2% (4). Separately reviewed G4 acceptance in PR616 belongs to a later main integration and must not be overwritten by this branch.
