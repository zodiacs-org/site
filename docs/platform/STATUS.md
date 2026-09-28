# Zodiacs Platform status

*Appended 2026-09-28.* For the engine and platform programme, the current status is [`programme/STATUS.md`](programme/STATUS.md), measured against the brief by [`programme/LEDGER.md`](programme/LEDGER.md). This page is kept as its history. An audit on 2026-09-28 found parts of it out of date: saved records, for example, are now active in production.

## Released — the chart-difference tool, and a local MCP adapter over it

Two deliveries after L3, both recorded here because this page was behind
`REMAINING.md` and said nothing about either.

**`/developers/compare/`** shipped in
[#509](https://github.com/ZodiacsOfficial/site/pull/509) and is live. It reads
two `zodiacs.natal-envelope.draft-v1` records in the browser, lists every
differing value before any prose, and labels each offered cause `reproduced`,
`reported`, `hypothesis` or `unresolved`. Two bounded AI reviews of the first
candidate found nine defects; each was reproduced before it was fixed and each
carries a regression test verified to fail on `fef5f9bf`.
[#513](https://github.com/ZodiacsOfficial/site/pull/513) then took analytics off
that page after a live drive recorded a request to `plausible.io`, and
[#514](https://github.com/ZodiacsOfficial/site/pull/514) recorded the deployed
drive. Method and tested limits: [evidence/chart-compare](evidence/chart-compare/README.md).

**`zodiacs-mcp-server@0.1.0-rc.6`** is the agent half of the same stage. A local
stdio MCP server with three tools, over the real `natalChart`, the real envelope
codec and the real `compareEnvelopes` — the same module the browser tool runs,
not a copy. No listener, no port, no outbound request, no file access.

Established separately, because these are separate claims: the official SDK
client against the real server process (84/84 checks), the Claude Code CLI
launching it and reporting it connected (7/7), a model running the whole
workflow through that host — capabilities, two synthetic records, a comparison,
a refusal and a recovery, in one run recorded verbatim — the browser surface of
the same rules driven at two viewports (34/34), and a synthetic regression
corpus whose expected classifications were committed before each candidate ran
(18/18 scenarios, 112/112 assertions, every post-hoc change to an expectation
recorded with its reason).

rc.1 through rc.3 are superseded and still downloadable; each archive is
immutable. What each candidate corrected, and the two bounded AI reviews that
found the defects, are in
[evidence/mcp-adapter](evidence/mcp-adapter/README.md) and
[evidence/chart-compare](evidence/chart-compare/README.md).

Not claimed: publication. Neither the adapter nor the engine is on npm, both
report `unpublished-candidate`, and `npm view @zodiacs/engine version` returned
`E404` when re-checked on 2026-09-18. A versioned archive hosted in this
repository is a candidate, not a release. Also not claimed: any host other than
Claude Code (Claude Desktop is macOS and Windows only and could not run here),
any measure of how reliably a model uses the tools, and any adoption — nobody
outside this work has used it, and the trial that would change that is written
and unsent.

Still not activated, and still for the same reason: `PUBLIC_SAVED_RECORDS_ENABLED`
is a Vercel project setting this environment cannot write. Both that and the
engine publication now have precise action cards —
[ACTION-CARDS.md](ACTION-CARDS.md).

## Released — L3 saved calculation records, merged and deployed, flag still off

[#490](https://github.com/ZodiacsOfficial/site/pull/490) merged as
`52ae6eeb2bfc0e5d2697e7a50205025b3f5d65b9` with all 19 checks green, and
production deployment `dpl_CZsZBKawNkeiKMuF1NwJSWwsdsAS` is READY from that exact
commit. Superseded draft #486 was closed without merging after verifying its tip
`99d22482` is an ancestor of the merge.

Verified on the live site rather than inferred from the merge: `/profile/` in en,
es and ru and `/birth-chart/` all return 200 and carry no `data-saved-records`,
no `data-keep-calculation-record` and no records heading, and the deployed
`/_astro/SavedRecordsPanel.--giIpmA.js` is byte-identical (SHA-256
`64f41d8c324ce4510d18db98f62a21da0dba4ff7495b4ce366d3f5d3baeec71f`) to the local
build the browser drives ran against, carrying the Escape handler, the
pointer-down-elsewhere disarm and the twelve-second expiry. A browser session
against the production origin was not run from here: this environment's egress
proxy re-terminates TLS and the headless browser could not be given the proxy CA.

`PUBLIC_SAVED_RECORDS_ENABLED` is **still unset**, so nothing new renders for
anyone yet. Activation is a Vercel project setting this environment cannot
write; the steps, the verification to run afterwards and the exact blocker are in
[ACTIVATION](evidence/l3-saved-records/ACTIVATION.md).

Three timing failures on the Lighthouse and composite gates delayed the merge by
four attempts. They were root-caused, not waited out: the same commit reported
TBT 288 ms and then 0 ms for one route, the gate takes the worst of three runs
across ~90 samples by design, and the affected routes measured 1–9 ms locally on
the same build while shipping byte-identical budgets. Nothing was skipped,
loosened or re-pinned to get past them.

## How that candidate was reviewed

The owner replaced human engineering review with evidence-based automated
adversarial review and authorized merge, release and flag activation
([D-2026-09-16](DECISIONS.md)). This section records what that produced; it is
updated as each step actually completes, and nothing below is claimed before it
is verified.

Three bounded AI reviewers ran against candidate `ed585d3c` in isolated
worktrees: data safety and lifecycle, integration and release, and product and
clean-room browser experience. Their findings are in
[REVIEW-2026-09-16](evidence/l3-saved-records/REVIEW-2026-09-16.md).

The decisive finding was that the build flag gated cleanup as well as writing.
Reproduced in a real browser against the unmodified production modules: after an
activation and rollback, records kept while the feature was on stayed on the
device while "clear all Zodiacs data", the boundary clear and confirmed account
deletion all reported success; an erasure interrupted after its durable intent
was never finished; and signing in auto-bound a browser holding guest records
while recording a clear decision the visitor never made. The flag now gates
writing and the record surfaces only. A flag-off build still finds, exports and
removes records kept earlier, still finishes an interrupted removal, still
honours destructive account actions and still refuses that silent bind, while
creating no database on a device that never had the feature on. The sequence is
gated by `npm run test:saved-records:rollback`, which builds the same source
four times (off, on, off, on) against one persistent browser profile, and the
procedure is written down in [ROLLBACK](evidence/l3-saved-records/ROLLBACK.md).

The second material finding was that no CI job ran the site integrity gates on a
flag-on build: every check lived in the flag-off `build-check` job. The
flag-on job now also runs `npm run check`, `check-dist` and the bundle and
engine-isolation gates, so the configuration activation ships is actually
validated.

The third was in the product surface. A destructive control armed for its second
activation never expired and no ordinary cancel gesture reached it, so a
"Remove" or "Remove all" left armed would destroy records on one later tap —
reproduced in Chromium and Firefox. An armed control is now unmistakable and
short-lived: it fills, announces what it is waiting for and how to back out, and
returns to its safe label on Escape, on a pointer down anywhere else, on losing
focus, or after twelve seconds. A removal that happens is now said out loud and
the keyboard stays inside the panel, the panel's live region exists before it
has anything to announce, and the intro states plainly what destroys these
records — clearing site data, or the browser reclaiming storage. The findings
and their dispositions are in
[REVIEW-2026-09-16-product](evidence/l3-saved-records/REVIEW-2026-09-16-product.md).

Both storage surfaces remain behind `PUBLIC_SAVED_RECORDS_ENABLED`. Production
runs with that flag and `PUBLIC_ACCOUNT_SYNC_V2_ENABLED` unset today, verified
by probing the live pages: `/profile/` carries no `data-account-sync-v2` and no
records panel, and `/birth-chart/` carries no keep affordance.

## Previous checkpoint — L3a inactive receipt lifecycle prerequisite (draft #486)

The owner now authorizes L3, beginning from refreshed main
`693c2ac90b5be78c0f0885c22763dcafff53c00e` and actual inactive #426 head
`46b36e2c887405efc70762297e1087f6d14195f9`. Only its four reviewed
source/test files are selectively integrated; no stacked branch merge.

The first independently reviewable slice adds durable owner/device erasure
barriers and retry of committed deletion intent to the immutable local store.
Normal authority remains caller-supplied and is not authentication. All product
storage entry points remain inactive: the full account/guest authority,
discovery, explicit save/export/delete/recovery UI must land together later.
Existing profile writes, receipt calculations and SDK packages are unchanged.

Local verification passes: 5,271 tests, 20 native groups, build/typecheck/budgets
and 18 required captures. Draft hosted CI and exact-source preview are pending.
Nothing is merged,
published, production-deployed or externally adopted by this slice. SDK merge/npm
publication stays held; L4–L6, Astrofolio and Zodia stay excluded.
[Scope and evidence](evidence/l3-saved-records/README.md),
[activation dependencies](evidence/l3-saved-records/ACTIVATION-DEPENDENCIES.md).


## Previous release checkpoint — L2b released and production-verified

Owner approved PR #481 at `370fddf7224053ca42d0942945d850ab5b8d608c`.
Candidate/main identities were unchanged; all 14 candidate jobs, exact-source preview
and current-edition freshness remained valid. Marked ready and merged as
`dfeae5f9178a6d887209710083c2a74fae258236`, whose tree
`8dc403a558a83fae15950fc54f8a5978c6da7b13` exactly equals the approved tree.

Pre-release production `dpl_44tNRbymWxhKRRhUwg92gv945paY` is the recorded,
owner-authorized rollback baseline. Production deployment
`dpl_QmGqNQr8KuWEQYkaRfe34c6MMg6x` is READY on apex and www at the exact merge
source. Live chart/Moon date policies, reference values, Today/Profile uncertainty,
current editions and bounded runtime-error checks pass. No regression found.
Automatic post-merge [CI 34773522987](https://github.com/ZodiacsOfficial/site/actions/runs/34773522987)
passed all 14 jobs on the exact production source, including 5,211 tests in 424 files,
required native/date/caller checks and all performance/widget gates. Final main and
production still identify the approved tree. Rollback baseline remains READY; no
rollback, manual rerun or budget waiver was needed. Release verification is complete.
[Production evidence](evidence/l2b-production/README.md).
SDK merge/npm publication remains held; L3–L6, Astrofolio and Zodia remain excluded.
The [pre-release checkpoint](STATUS-2026-09-14-pre-l2b-release.md) retains the earlier draft state.

## Historical L2b draft — superseded by release above

The owner authorizes one bounded L2b draft from current main
`87f18e0a101b96abf847be58e8a0c31a691992f8`. The retained interval algebra is now
consumed only to adjudicate unknown-time local reference membership when the
native complete-transition contract is available. An immutable enumeration trace
stays temporary; no coverage metadata enters calculations, receipts or storage.
Missing/failed completeness retains a qualified Intl-verified reference. Detected
provider contradictions refuse it. Known-time and no-city UTC Moon paths remain
unchanged; no alternative reference or Sun/Moon sign certainty is inferred.

Draft [#481](https://github.com/ZodiacsOfficial/site/pull/481) is delivered at
`370fddf7224053ca42d0942945d850ab5b8d608c`, tree
`8dc403a558a83fae15950fc54f8a5978c6da7b13`. Final main remains `87f18e0a`;
GitHub's tested merge tree equals the candidate tree. All 14 jobs pass in
[Site Check 34768985284](https://github.com/ZodiacsOfficial/site/actions/runs/34768985284).
The [exact-source protected preview](https://zodiacs-oz3qdp29g-zodiacsofficial.vercel.app/birth-chart/)
is READY and verified for known/unknown reference replacement, skipped-date refusal
and recovery, repeated/disconnected dates and retained uncertainty. Existing
preview authentication/protection is unchanged. No retry or gate waiver was needed.

L2b is implemented, tested, preview-verified and ready for draft review. It is not
merged or production-deployed; external adoption is unclaimed. The remote source
stays fixed while final closeout records are committed locally and mirrored to the
shared checkpoint, with final results in the PR description.
[Runtime/date policy contract](evidence/l2b-date-coverage/CONTRACT.md),
[verification record](evidence/l2b-date-coverage/README.md),
[preview observations](evidence/l2b-date-coverage/PREVIEW.md).

Native completeness is conditional on the host transition contract and timezone
model. Missing/failed coverage remains unresolved; detected provider contradictions
refuse. Whole-date Sun/Moon certification remains unimplemented. There is no
remaining draft-delivery blocker. SDK merge/npm publication remains held;
L3–L6, Astrofolio and Zodia remain excluded.

## Previous release — L2a production-verified

The owner approved site-only PR #480 at `2e7b676d5026aaeaa78fc9b541b01972a7c81424`.
Head and main were unchanged, all 14 candidate jobs passed, and the exact-source
preview evidence remained valid. Marked ready and merged as
`87f18e0a101b96abf847be58e8a0c31a691992f8`; tree
`0305b08b378d6c9ae470e0f621a9ce1ecb532f98` equals the approved tree exactly.

Production `dpl_44tNRbymWxhKRRhUwg92gv945paY` is READY on zodiacs.org and www.
Live known/unknown-time chart replacement, neutral automatic naming, Today, Profile,
uncertainty copy and exact current-edition publication checks pass. Numerical and
receipt comparisons reuse valid unchanged-source evidence. No release regression
found; rollback baseline `dpl_DRnrXu34g9od11bzmgoYCb368QYr` was recorded before merge.
Automatic [post-merge CI](https://github.com/ZodiacsOfficial/site/actions/runs/34765077240)
passed all 14 jobs. Production verification and release closeout are complete.

[Release evidence](evidence/l2-production/README.md).
SDK merge/npm publication remains held. Complete-date intervals stay inactive in production;
L3–L6, Astrofolio and Zodia remain excluded. L1 remains released and verified.
The [pre-release checkpoint](STATUS-2026-09-13-pre-l2-release.md) retains the earlier draft status.

## Historical L2a draft delivery — superseded by release above

Draft [#480](https://github.com/ZodiacsOfficial/site/pull/480) is delivered at
`2e7b676d5026aaeaa78fc9b541b01972a7c81424`, tree
`0305b08b378d6c9ae470e0f621a9ce1ecb532f98`, against unchanged main
`0490c4f8a92f045417d7f81ed502f0789e8ecdc2`. GitHub's tested merge tree equals the
candidate tree. All 14 hosted jobs pass in
[Site Check 34759307903](https://github.com/ZodiacsOfficial/site/actions/runs/34759307903),
including 5,145 tests, 15 visual cases, 30 Lighthouse routes and both widget gates.
No hosted retry or budget waiver was needed. The exact-source
[protected preview](https://zodiacs-5btqxmpa6-zodiacsofficial.vercel.app/birth-chart/)
is READY and verified for known/unknown chart replacement, neutral automatic naming,
Today, Profile and Russian Profile. Existing authorization/protection was preserved.

L2a is implemented, tested, preview-verified and review-ready. It remains a draft,
unmerged and not production-deployed. Calculation receipts and contact receipt strings
are unchanged; newly saved forecast text intentionally gains uncertainty wording.
Complete-date interval activation remains separate. SDK merge/npm publication remains
held; no L3–L6, Astrofolio or Zodia work is included. Two inherited moderate development-only
Vitest/mocker advisories remain below the unchanged gates; production audit is clean.

[Evidence](evidence/l2-reference-sun/README.md),
[preview observations](evidence/l2-reference-sun/PREVIEW.md), [remaining work](REMAINING.md).
Final closeout records are committed locally and mirrored to the shared checkpoint;
the remote PR stays on the exact verified source with final results in its description.

## Current delivery state

- **L1:** merged and production-verified, all post-merge jobs passed.
- **L2a:** owner-approved, merged and production-verified; all 14 post-merge jobs passed.
- **L2b:** owner-approved, merged and production-verified; all 14 post-merge jobs passed.
- **Complete-date coverage:** conditionally active under the native provider contract; no whole-date Sun/Moon certainty claim.
- **SDK:** vendored rc.6 engine and optional read-only ownership SDK preserved;
  merge/npm publication held. External adoption is unclaimed.

[Finite remaining checklist](REMAINING.md), [PLAN](PLAN.md),
[DECISIONS](DECISIONS.md), [EVIDENCE](EVIDENCE.md).
The [pre-L2 checkpoint archive](STATUS-2026-09-13-pre-l2.md) preserves earlier
pending-release/outage states as historical evidence, superseded by this checkpoint.
