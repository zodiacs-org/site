# Market Lens local continuation

Updated: 2026-10-07, Asia/Bangkok. Local chat: `01a10797-8c9a-7902-bae0-9bc0a5186f51`.

## Scope and constraints

Continue existing draft PR [#619](https://github.com/zodiacs-org/site/pull/619): verify the private v2 study and offline recovery; implement a versioned cross-asset catalog, provider/session/risk support and migrations; prepare a separate expanded study; verify a protected preview where access allows; update beta and licensing documentation. Keep the PR draft. Production release, merging, real trades, purchases and new external outreach remain unauthorized. Preserve v1 evidence and frozen v2 bytes. Raw market/state data stays outside this public repository.

## Checkpoint status

| Checkpoint | Implemented | Freshly tested | Remotely verified | Outstanding |
| --- | --- | --- | --- | --- |
| 1. v2 study and recovery | Existing private workflow preserved | Safe restore; query + digest signatures; two repeat cycles preserve every original byte | Run 37492139845: all cycle steps succeeded; Git b00969a persisted archive contents | First scheduled cycle 7 October 07:17 Bangkok is not due at verification |
| 2. Cross-asset catalog and UI | 52 versioned instruments, search/favorites, schema-2 migration, currency-aware journal | 99 Lens unit checks; 5 cross-asset browser scenarios; 18 existing Lens checks | New protected preview pending | Live coverage and measured eligibility require provider evidence |
| 3. Providers, sessions and sizing | Coinbase and gated Twelve Data adapters; calendars, adjustments, native sizing | Holidays/DST/splits/FX/futures/currency/rights tests pass | Rights remain absent | Verified grants, credentials and source mappings before live acceptance |
| 4. Expanded study | Separate v3 draft, runtime, raw acquisition bundle, serialized scheduler, recovery | 5 runtime/scheduler/recovery tests; isolated minimal install and two empty synthetic cycles pass | Not activated | Real provider/session/eligibility receipts and prospective live acceptance |
| 5. Protected preview and beta | Existing protection retained; OIDC driver ready | Local disabled/synthetic browser acceptance passes | Authenticated access verified; refresh pending | Deploy new source, run actual hosted driver, then owner-authorized beta |

## Evidence and continuity

- This checkpoint is public-safe. Private recovery paths, downloaded state, raw snapshots and full signature verification logs belong in the separate private recovery workspace.
- v1 partial recovery was previously verified; full original v1 protocol and decision bytes remain unavailable. Do not present reconstructed payloads as original receipts or deploy partial v1 over v2.
- Initial local checkout is clean and detached at `5cc7d70d503e9110a6be9af7f1e4aefffb0c3a10`, predating Market Lens. PR #619 is attached to this chat. Actual current PR state still requires fetching.
- Initial sandboxed GitHub checks could not connect to api.github.com. Authentication status under that restriction is not evidence that credentials are invalid; retry through authorized network access before requesting new credentials.

## Next action

Publish the reviewed implementation to the existing draft branch, refresh the protected preview through an explicit preview deployment without changing main-only/spend guards, and run the actual authenticated deployed driver. Record exact source/deployment/CI IDs below. No production release or beta invitations.

## Checkpoint 1 — independently verified 6 October 2026, 23:38 Bangkok

The private repository remains private. Initial workflow run 37492139845 executed bootstrap, minimal dependency installation, protocol validation, record/witness, Git persistence, packaging and upload successfully. All restored archive files match persisted Git commit `b00969a74c9ee316537b94953594f11d649455d8`.

- GitHub ZIP (artifact 11425373618) SHA-256: `32d6e25c86cd62f0afc64a083c07b0f7e981e18a39e47b040286155e00f563c5`. This is the user-supplied hash.
- Enclosed tar.gz SHA-256: `61a19632f855084cea828ee4c4041a3af1185c4fc6ff976a24a5be6426daa4a4`, matching its included checksum.
- Isolated restore validates the protocol and frozen sources using Node 22.22.2/npm 10.9.7 and only the minimal ops installer. Both original-query and decision-digest RFC3161 checks pass with the preserved CA. Independent witness: 6 October 23:00:18 Bangkok; lead to first execution: 28,782 seconds (required 900).
- Two cycles on the isolated restore report one recorded and witnessed decision, no errors and no due settlements. All original protocol/source/receipt/report bytes remain unchanged. Only new reports were appended.
- Frozen window: 7 October 2026 07:00 through 5 April 2027 07:00 Bangkok, end exclusive. No settlement or later scheduled run is due yet. Backup expires 4 January 2027; a separate local offline copy and full restore audit now exist outside this public repository.
- Actual app PR HEAD was `be2e4259`; checkout continues that exact draft. Historical integration run 36912430037 independently verified successful across all 19 Site Check jobs. Those checks do not validate new changes.

Next: cross-asset catalog, session/provider boundaries, native-currency sizing and migrations. GitHub authentication works via authorized network access; no new token is needed.

## Checkpoints 2–4 — implementation in progress, 7 October Bangkok

Catalog, navigation/search/favorites, schema-2 migration, native-currency cash risk, session/corporate-action boundaries, server-only Twelve Data discovery/adapter and rights configuration are implemented. All 99 focused Lens tests pass; Astro check reports zero errors/warnings. Broader study draft/runtime is separate and blocked from freezing without verified inputs. See CROSS-ASSET.md and research/market-lens/v3/README.md for exact coverage limits. V3 runtime unit checks initially pass (3). No v3 activation or changes to v2.

Full build stopped at the correctly enforced stale daily-publication guard (1 October content on 6 October UTC). Refreshing through supported builders; do not weaken freshness or deployment guards. Fresh production audit identified four advisories; security updates and a new full validation are pending. Authenticated Vercel CLI identity works. No local automation bypass secret is bound. Shareable-access creation was rejected by automatic approval review; an authenticated, non-sharing CLI path is being tested instead.

## Preview access and validation follow-up — 7 October, 00:17 Bangkok

Existing Vercel CLI authentication succeeded as zodiacs-org. Authenticated CLI and short-lived same-project OIDC requests both reached the **old** preview's Lens function and returned `503 display-disabled`, JSON, without a public share link or protection changes. The driver now supports the short-lived origin-scoped OIDC header. New-deployment acceptance remains pending.

The first full test run overlapped a build, invalidating several built-file checks; those results will be replaced by a sequential run after the final build and regenerated captures. Other failures exposed Node ESM import suffixes (fixed), a changed response-validation message (fixed), macOS `/private` path canonicalization, and tiny architecture-dependent floating-point snapshot differences in unchanged engine/scene/wheel tests. Do not change the frozen engine or blindly regenerate those unrelated golden outputs. Production advisories were fixed with compatible lockfile updates; development-only Vitest/mocker/tinypool findings require a major test-runner upgrade and are not silently represented as resolved.

## Fresh local acceptance — 7 October, 00:30 Bangkok

- Build, generated provenance, static links and unchanged bundle limits pass: Lens 31.8/32 KB, maximum chunk 50.1/60 KB, engine 31.4/31.6 KB. Engine pin is unchanged. All 18 Phase 1 captures refreshed through the supported driver.
- Astro check: 0 errors, 0 warnings, 20 existing hints. Focused Lens/v3/API-runtime checks: 115 passed. Cross-asset browser: 5 passed with clearly labeled synthetic/disabled responses. Existing Lens flows: 18 passed. Web own-chart/calculator ownership: 17 passed; this is not native iOS validation.
- Full sequential suite: 6,482 passed, 4 skipped, 4 failed. The i18n built-payload timeout passes alone (11 tests). Three unchanged strict engine/example/scene/wheel numeric golden comparisons still fail on this macOS environment; frozen engine and golden files were not modified. Hosted Linux validation is pending; do not call the full suite green.
- Current production audit: zero findings after compatible lockfile patches. Three development-only test-runner findings remain; resolving them requires a separately verified major Vitest upgrade.
- Separate v3 synthetic archive restored into an isolated directory, installed only its two pinned runtime packages, verified the frozen source/protocol and ran two serialized cycles with zero due tasks/errors. It contains the standalone acquisition bundle, original CA and scheduler. No live v3 dates or decisions were frozen. Original v1/v2 bytes remain untouched.

## Protected preview checkpoint — 7 October, 00:42 Bangkok

Draft commit `5c0c6054bd1a35c6ca101a7c722dddcf65241c09` was published. Manual preview deployment `dpl_9ncYRfaFtjHA7AMC95mLvZ3nr458` is READY at https://zodiacs-94jc7vriu-zodiacsofficial.vercel.app. The actual deployed driver passed all five groups through a short-lived origin-scoped OIDC binding, including 14 cross-asset disabled API requests, validation/method checks, real calendar shards, private journal persistence and noindex research. No fixtures, public access links or protection/guard changes. Stable alias is not yet moved because main integration is in progress.

The shared original Git store contains a macOS cloud-offloaded 1.5 GB pack whose reads block. All implementation files and staged index remain preserved there. A fresh isolated publishing copy at `/private/tmp/lens-publish-20261007` reproduces the exact parent/tree and was used to push. No reset or shared pack deletion occurred.

Current main (`55871059`) has 2,155 changed paths since this draft's integration base, including engine rc.17. The user delegated the choice; integrate main so the draft receives normal PR checks, keep frozen v1/v2 untouched, and revalidate the still-unfrozen v3 against the current app engine. Direct CI run 37505199451 tests the pre-integration checkpoint; it is not a final integrated-source acceptance.

## Main integration — 7 October, 00:51 Bangkok

Integrated main `55871059` into the isolated review copy after preserving the pre-integration draft. All 41 conflicts concern generated files, lockfile and budget settings. Current main supplies the generator inputs and approved engine budget; the Lens 32 KB limit remains unchanged. The app now follows main's rc.17 pin. Only the unfrozen v3 draft/minimal dependency/source manifest follow rc.17; frozen v1/v2 sources, protocols and witnesses remain unchanged. Generated evidence, security audit, full tests, browser checks and the final preview must be rerun on this integration.
