# Market Lens local continuation

Updated: 2026-10-07, Asia/Bangkok. Local chat: `01a10797-8c9a-7902-bae0-9bc0a5186f51`.

## Scope and constraints

Continue existing draft PR [#619](https://github.com/zodiacs-org/site/pull/619): verify the private v2 study and offline recovery; implement a versioned cross-asset catalog, provider/session/risk support and migrations; prepare a separate expanded study; verify a protected preview where access allows; update beta and licensing documentation. Keep the PR draft. Production release, merging, real trades, purchases and new external outreach remain unauthorized. Preserve v1 evidence and frozen v2 bytes. Raw market/state data stays outside this public repository.

## Current checkpoint — 7 October 2026, 08:40 Bangkok

| Checkpoint | Verified status | Remaining |
| --- | --- | --- |
| v2 | Initial and subsequent manual cycle, two signed decisions, Git persistence, both artifact checksums, isolated restore and repeat operations verified; every initial archive byte preserved | Cron execution has not yet been observed; first settlement is due 8 October 07:05 Bangkok |
| App | 52 candidate instruments, provider/session/risk support, explicit journal migration, search and favorites implemented | Written rights and verified coverage before live prices |
| Local validation | Build/static/budgets pass; 7,036 tests pass, 5 skip; 5 cross-asset + 18 Lens + 17 ownership browser checks; 18 refreshed captures | Actual hosted acceptance passes; GitHub checks are linked from draft PR #619 |
| v3 | Separate rc.17 draft/runtime; synthetic minimal-runtime restore and two repeat cycles pass | Provider grants, credentials, mappings/calendars, eligibility and live acceptance before activation |
| Beta | Stable protected alias refreshed and tested; review kit updated | Owner decision to release/invite; zero invitations or feedback |

The user delegated the engine choice. The app and unfrozen v3 follow integrated main `8e0b849e`; original v1/v2 sources and receipts retain rc.15 unchanged. Legacy paper tests now run unchanged sources against the committed rc.15 archive in an isolated test directory. The main-only automatic deployment and production/spend controls remain unchanged.

The stable protected alias now serves validated application `54fd2609`. Actual deployed acceptance passes through both its individual URL and the stable alias; authentication remains enforced. Subsequent changes are test assertions, generated evidence and documentation only. No licensed live-market acceptance is claimed.

## Evidence and continuity

This is the current public-safe checkpoint. Dated sections below preserve prior evidence and superseded status, including earlier failed tests and unavailable access. Private raw state, signatures and recovery logs are retained outside this public repository. The partial v1 archive is not deployable and has never replaced v2. The isolated publishing checkout avoids a blocked cloud-offloaded pack in the original shared Git store; no original files or Git pack were deleted.

## Release prerequisites

Written provider rights, secure credentials, accepted symbol/action/session mappings and dated eligibility/liquidity evidence are required for live prices and v3. The prepared request in PROVIDER-REQUEST.md has not been sent. V3 remains inactive until live acquisition/timestamp/scheduler/restore acceptance and future start dates are approved. Owner decisions are still needed for release and beta invitations; no outreach, purchases, trades or production release occurred.

GitHub cron delivery remains unobserved; the unchanged manual v2 cycle and downloadable recovery are verified. Check the private workflow's subsequent scheduled runs and preserve failures/receipts without backfilling. The first settlement becomes eligible 8 October 07:05 Bangkok.

## Final validation links

Draft PR #619 carries the current GitHub check results. Application source is `54fd2609`; test/provenance follow-ups do not change the deployed application. Exact hosted evidence is in deployed-cross-asset-acceptance.json. Durable independent checkout: `/Users/chiburashka/.codex/recoveries/market-lens-local-2026-10-07/site`.

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

## Subsequent v2 recovery — 7 October, 08:08 Bangkok

Manual run [37554752309](https://github.com/zodiacs-org/market-lens-paper/actions/runs/37554752309) completed every cycle/persistence/backup step. Persisted Git: `c500b46fb808150cce12a0772ac362ccaaad8330`. The scheduled 00:17 UTC run had not appeared; this manual run is not evidence of cron execution. Two decisions are now independently witnessed, with leads of 28,782 and 82,854 seconds. No settlement is due yet. All initial archive files and all new original files survive two isolated repeat cycles byte-for-byte.

Artifact `11453749981` ZIP SHA-256: `5c10a3f81b62e3c81eae21bd6d151d4b8fd47acaa17407276bfa90de20877d45`. Enclosed tar SHA-256: `4138bd4cb81012e6470dd7324c2e310e35c87605b60a7a6569ba54e7fdbe0069`. The independently downloaded backup matches persisted Git and is retained offline. Expires 5 January 2027.

## Integrated local acceptance — 7 October, 08:13 Bangkok

Main `8e0b849e` integrated; fresh build, static check (0 errors/warnings, 40 hints), 7,036 passing tests / 5 skipped / 0 failures. The legacy frozen-study test harness is isolated with its rc.15 vendor archive; production study sources are unchanged. Browser checks: 5 cross-asset, 18 existing Lens, 17 ownership; 18 supported Phase 1 captures refreshed. Lens 31.8/32 KB, max chunk 50.1/60 KB, engine 32.4/main-approved 32.598046875 KB. No protected paths differ from current main, so no scope exception is needed.

The rc.17 v3 synthetic recovery archive (`72ce1fbee11e42594152b208f2ac8dc25b242b81370096764e45b10852970230`) restores, installs only its minimal engine/ephemeris graph, verifies the source seal and completes two empty prospective cycles without changing protocol bytes. This is synthetic recovery acceptance, not live activation.

## CI budget follow-up — 7 October, 08:25 Bangkok

Integrated preview `dpl_7pkHah1FuTpNCZ3jGNt7VowJ2S9x` at application `19f424f4` passed all five actual deployed acceptance groups, with prices disabled, authenticated OIDC access, no fixtures, no personal payload transmission and no protection changes. The stable alias awaits the final budget-fix deployment.

GitHub's production-feature build exposed a small compatibility-page overrun at its unchanged 36 KB limit. Commit `613ac801` reuses the existing chart resolver instead of duplicating conversion logic; all 26 compatibility unit/recovery tests and the complete production-feature build/budget checks pass. Default build/captures/full tests are being refreshed. No budget or deployment guard was relaxed. Fresh CI: run `37556918440` (supersedes the earlier failed budget run).

The full working project and independent Git history are also saved outside temporary storage at `/Users/chiburashka/.codex/recoveries/market-lens-local-2026-10-07/site`. The original checkout has a continuation pointer; its original files and Git pack remain intact. This copy excludes reinstallable dependencies, build caches and environment bindings.

## Stable protected preview — 7 October, 08:40 Bangkok

Deployment `dpl_39XunjH1rDqsUQmVRUYUxV1bDgHQ`, application `54fd2609`, is READY. Both the individual URL and stable review alias pass all five real hosted groups (cross-asset disabled responses, validation, actual calendar shards, private journal persistence, noindex research). Unauthorized requests still return 302 to authentication. No access sharing, protection change, production release, price-gate enablement or budget relaxation occurred. Beta kit updated; zero invitations and zero feedback.

The compatibility refactor preserved timed/untimed privacy behavior. Its source-scanning privacy assertion now follows the shared resolver instead of requiring the removed duplicate expression; all 55 focused caller/i18n checks pass. A disk-heavy i18n test timed out during a concurrent full-suite/upload run and passes in isolation; the final full suite is rerun with four workers. Historical failures above remain dated records.
