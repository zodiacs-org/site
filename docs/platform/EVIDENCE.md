# Platform evidence ledger

## Current checkpoint — L3b/c saved calculation records, released and deployed, inactive by flag

The owner replaced human engineering review with evidence-based automated
adversarial review on 2026-09-16 ([D-2026-09-16](DECISIONS.md)). Three bounded
reviewers ran concurrently in isolated worktrees against `ed585d3c`. **This is AI
review and is recorded as AI review**; no human, practitioner, attorney, customer
or independent-auditor signoff exists or is claimed.

They produced two release-blocking findings and one merge blocker, each
reproduced in a real browser before it was fixed: the build flag gated cleanup as
well as writing, so a rollback stranded records while destructive account actions
reported success; an armed destructive confirm never expired and no cancel
gesture reached it; and the Phase 1 scope allowance was pinned to a base main had
moved past. All are closed, each with a test that fails without the fix.
Dispositions: [REVIEW-2026-09-16](evidence/l3-saved-records/REVIEW-2026-09-16.md)
and [the product review](evidence/l3-saved-records/REVIEW-2026-09-16-product.md).

[#490](https://github.com/ZodiacsOfficial/site/pull/490) merged as
`52ae6eeb2bfc0e5d2697e7a50205025b3f5d65b9` with all 19 checks green on
`0f5b76f3`, through the existing protected workflow with nothing bypassed,
skipped or loosened. Superseded draft #486 was closed unmerged after verifying
its tip is an ancestor of the merge. Production `dpl_CZsZBKawNkeiKMuF1NwJSWwsdsAS`
is READY from the merge commit. `dpl_Fj7nBapUmw4vshEy8HycqKRXNQRy` (main
`7fd42661`) was recorded beforehand as the pre-merge baseline, and is a valid
rollback target only while the flag has never been `1` in production: it predates
the retained-data path, so once records exist it would strand them. `52ae6eeb` is
the version floor, and the incident procedure is in
[ROLLBACK §3](evidence/l3-saved-records/ROLLBACK.md).

Live verification, not inferred from the merge: `/profile/` in en, es and ru and
`/birth-chart/` return 200 with no records surfaces, and the deployed
`/_astro/SavedRecordsPanel.--giIpmA.js` is byte-identical (SHA-256
`64f41d8c…eec71f`) to the build the browser drives ran against. A browser session
against the production origin was not run from this environment, whose egress
proxy re-terminates TLS.

Gates on the released tree: 5,320 unit tests, 31 native storage groups, 17
lifecycle checks in Chromium and 17 in Firefox 151, 6 account-coordinator
journeys, 4 rollback phases across four builds and one persistent profile, 18 of
18 Phase 1 captures, check-dist, consumer-boundary, footer, astro check and the
bundle and engine-isolation budgets.

`PUBLIC_SAVED_RECORDS_ENABLED` remains unset, so no visitor sees the feature.
Activation is a Vercel project setting this environment cannot write:
[ACTIVATION](evidence/l3-saved-records/ACTIVATION.md). Engine npm publication
stays blocked on a missing credential:
[the engine release record](evidence/engine-release/README.md). Nothing here
establishes activation, npm publication or external adoption.

## L2b candidate — conditional complete-date coverage

The owner authorizes one bounded L2b draft from current main
`87f18e0a101b96abf847be58e8a0c31a691992f8`. The retained interval algebra is now
consumed only to adjudicate unknown-time local reference membership when the
native complete-transition contract is available. An immutable enumeration trace
stays temporary; no coverage metadata enters calculations, receipts or storage.
Missing/failed completeness retains a qualified Intl-verified reference. Detected
provider contradictions refuse it. Known-time and no-city UTC Moon paths remain
unchanged; no alternative reference or Sun/Moon sign certainty is inferred.

[Runtime/date policy contract](evidence/l2b-date-coverage/CONTRACT.md).
Implementation and local verification are in progress; hosted CI and exact-source
preview remain pending. This is not merged or production-deployed. SDK merge/npm
publication remains held; L3–L6, Astrofolio and Zodia remain excluded.

## Current checkpoint — L2a released and production-verified

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
The [pre-release checkpoint](EVIDENCE-2026-09-13-pre-l2-release.md) retains the earlier draft status.

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

[Earlier integrator ledger](EVIDENCE-2026-09-13-pre-l2.md) preserves the full pre-L2 checkpoint history.

## Historical records (original source and authorization scope)

Checkpoint: **2026-09-07 18:39 UTC** (2026-09-08 Asia/Bangkok). Stage A.
This records observed results, including intermediate failures. Final full-site tests and browser acceptance passed below. No merge, npm publication,
manual preview deployment, or production deployment has been performed.
GitHub created automatic SDK example previews for draft PR #6, recorded below;
these are not a deployment of the changed Zodiacs.org site.

## Reproduction context

- Site: `/Users/chiburashka/.codex/worktrees/4806/site`, branch
  `codex/platform-stage-a`, based on
  `7f953e3fca0e7d5009e5602a1dad69edff0f54cc`. Stage A source/evidence checkpoint:
  `40d3f9647a31afc20db007b7cd5269eb4ef73b6a`. Tests describe the source in
  that commit; it has not been merged or released. B03 changes follow separately.
- SDK: `/private/tmp/zodiacs-platform-sdk`, branch `codex/platform-stage-a`,
  based on PR #5 head `cced011659d48877b8b73b8a85796815234cf741`.
  Final candidate source: `03bf77990f3014b9125eed4976d7a41200aac80d`.
  [Draft SDK PR #6](https://github.com/ZodiacsOfficial/sdk/pull/6) is a review
  artifact; it does not close PR #5's hold or establish release approval.
- Main runtime: macOS arm64, Node **22.23.2**, ICU **78.2**, tzdata **2026a**,
  TypeScript **5.9.3**, pnpm **9.15.0**. SDK uses Vitest **2.1.9**; site uses
  **3.2.6**. Node 24.19.0 / ICU 78.3 / tzdata 2026b also ran the independent
  numeric report. Initial default Node 26.4.0 is not the site CI runtime.
- Shell commands used the isolated Node 22 runtime on `PATH` and
  `COREPACK_HOME=/private/tmp/zodiacs-platform-corepack`. SDK npm subprocesses
  use a writable scratch cache after an inherited-cache permission failure.
- Durable selected receipts are under [evidence/](evidence/). Copied logs have
  terminal controls/trailing whitespace removed; [raw/stored digests](evidence/log-normalization.json)
  record this presentation-only normalization. Other raw logs
  remain in `/private/tmp/zodiacs-platform-evidence`; these temporary paths
  are session diagnostics, not a guarantee of future availability. UTC JSON
  gate timestamps are authoritative; printed Vitest start times depend on `TZ`.

## A01 — Refreshed baseline and release state

Repository and connector reads occurred approximately 17:47–17:52 UTC:

| Operation | Observed result |
| --- | --- |
| Initial site `git status --short`, current-main fetch and isolated branch | Clean at initial `95ccfc67`; refreshed to `7f953e3fca0e7d5009e5602a1dad69edff0f54cc`. |
| SDK main reference read | `b49e0f14f9f17bc84db39486f2c4bb075e0ae3ff`. |
| PR #5 description, comments, reviews and review threads | Open/draft, head `cced011659d48877b8b73b8a85796815234cf741`; **do not merge, do not publish**. No submitted reviews or subsequent hold resolution found. |
| GitHub CLI and connector access | Initial sandboxed `gh auth status`/network access failed. **Escalated `gh` authentication and API access subsequently worked**, enabling draft PR creation. Connector writes returned 403; connector repository/PR/CI reads worked. This is not a blanket missing-credentials condition. |
| Branch-protection reads, both repositories | Connector 403 `Resource not accessible by integration`; ruleset collections returned `[]`. Empty collections do not prove absent protections. No protection change was made. |
| Vercel deployment read for `zodiacs.org` | READY production `dpl_BrntzbFYa2gzetKWgeq91GFeaM6W`, source site `7f953e3fca0e7d5009e5602a1dad69edff0f54cc`, ready `2026-09-07T15:59:50Z`; project `prj_nRTO3q3aNYLfaM3dotAowOc028fO`, Node 24.x. |
| `shasum -a 256 vendor/zodiacs-engine-0.1.0.tgz` | Matches `8da3e0f2eb3818fe2c5833e05331be61da9b605ffa118a8462182821412e7cbe`. Old artifact retained unchanged. |
| `npm view @zodiacs/engine version dist.integrity --json` | Public registry E404 at lookup. This does not establish publication authority or a public installation. A separate widgets lookup also returned E404; no engine/widgets publication occurred. |

Historical remote checks were read, not rerun by this session:
[site main Site Check](https://github.com/ZodiacsOfficial/site/actions/runs/34140792853),
[SDK PR #5 CI](https://github.com/ZodiacsOfficial/sdk/actions/runs/29404837473),
[SDK PR #5 App CI](https://github.com/ZodiacsOfficial/sdk/actions/runs/29404837548),
[SDK main CI](https://github.com/ZodiacsOfficial/sdk/actions/runs/27708704771), and
[SDK main App CI](https://github.com/ZodiacsOfficial/sdk/actions/runs/27708706831)
were successful. They are not CI receipts for PR #6 or the site candidate.

Later CLI inspection of SDK PR #6 found primary Vercel preview success
[`8EEqL6pQp2bULUAHWiA68exxzgaw`](https://vercel.com/zodiacsofficial/sdk-zodia/8EEqL6pQp2bULUAHWiA68exxzgaw)
and auxiliary Vercel failure
[`9z1JhGiczbtfenBWWgd1AMxgRYBz`](https://vercel.com/zodiacsofficial/sdk-zodia-launch/9z1JhGiczbtfenBWWgd1AMxgRYBz).
SDK/App GitHub Actions did **not run** for PR #6: their PR trigger targets
`main`, while this draft is based on `codex/engine-expansion`. Final package
gate evidence is local; the successful Vercel example build does not replace it.

Latest SDK GitHub release read was
[`v1.0.1`](https://github.com/ZodiacsOfficial/sdk/releases/tag/v1.0.1), whose
annotated tag resolves to `ec0ea3a7f4a2e48c3feccdfb8de9b377f34bf17a`: the
optional ownership SDK, not an engine release. No engine/widgets GitHub
release was found; site GitHub releases were empty.

Concurrent inventory included SDK #4 (ownership disclosure/shared release
docs), site #289 (footer/developer surfaces), and site #413 (birthday/routes/
sitemap/assistant context), plus unrelated Guide, markets, Registry, games,
content and dependency branches. These branches were not overwritten; their
existence does not imply another session is running.

## A02 — Baselines, reproductions and repairs

Focused runs used the baseline or evolving candidate tree, before the final
commit. They are not substitutes for the final gates below.

| UTC time / source | Command or operation | Observed result and receipt |
| --- | --- | --- |
| 17:54, SDK `cced0116` | Vitest focused run of `engine.test.ts` and `geo.test.ts` | **Passed: 27 tests / 2 files.** [SDK baseline](evidence/sdk-baseline.log). |
| 17:54, site `7f953e3f` | `npm run test -- src/lib/engine/engine.test.ts src/lib/engine/package-integration.test.ts` | **Passed: 56 tests / 2 files.** Raw `site-baseline.log`. |
| 17:55, old engine plus new polar regression | Vitest `packages/engine/src/houses-regression.test.ts` | **Failed as intended: 6/6.** [Polar reproduction](evidence/sdk-polar-red.log): the site correction had not reached shared source. |
| 17:56, old artifact plus new public/site parity assertion | Site `package-integration.test.ts` | **Failed as intended: 1 failed / 3 passed.** Raw `site-public-parity-red.log`. |
| 17:56, after shared axis correction | Focused engine, geo and house regression run | **Passed: 33 tests / 3 files.** [Polar repair](evidence/sdk-polar-green.log). Correction now precedes house assembly. |
| 17:56, before strict input fix | `corepack pnpm exec vitest run packages/engine/src/public-input.test.ts` | **Failed as intended: 42 failed / 31 passed.** [Input reproduction](evidence/public-input-red.log). |
| 17:59, after input fix | Same public-input run under `TZ=UTC` and `TZ=America/New_York` | **Passed: 77/77 in each timezone.** [UTC result](evidence/public-input-green-utc.log); raw `public-input-green-new-york.log`. |
| 18:02, before historical-year fix | `corepack pnpm exec vitest run packages/engine/src/geo.test.ts` | **Failed as intended: 9 failed / 7 passed.** [Year reproduction](evidence/geo-years-red.log): 0000–0099 rejected; 0100/0999 mislabeled as DST gaps. |
| 18:05, before required-timezone guard | Geo run under `TZ=America/New_York` | **Failed as intended: 16 failed / 24 passed.** Raw `geo-required-input-red.log`: missing zone could select host timezone; wrong types were coerced or failed inconsistently. |
| 18:06, after geo fixes | Geo run under `TZ=UTC` and `TZ=America/Los_Angeles` | **Passed: 40/40 in each timezone.** [UTC result](evidence/geo-required-input-green-utc.log); raw `geo-required-input-green-los-angeles.log`. |

The input suite covers Date/epoch milliseconds, strict explicit-offset strings,
Gregorian leap years and early/expanded years, invalid calendar fields, excess
string precision, runtime settings and reused chart inputs. Geo cases cover
UTC year 0000's leap day, 0099/0100 and offset year boundaries, Mexico City LMT,
New York gap-forward/fold-earlier behavior, explicit zones, and unknown-time
local noon. These are defined cases against host ICU, not universal historical
tzdb verification. `/geo` settings/provenance limitations remain in the
candidate README; no new DST-choice policy was added.

The final SDK suite also passes **15 return-bound and 14 crossing tests**:
nonadvancing steps, overflow, a 10,000-sample work cap, exact roots, direction,
interior touches and zero plateaus. Endpoint roots use only one-sided evidence;
they do not establish crossing rather than tangency outside the window.
Finite-step scans are not exhaustive event searches.

Legacy saved-chart tests now use frozen summaries from the unchanged 0.1.0
artifact instead of asking the new package to produce legacy output. That
fixture labels itself migration evidence, not an independent numerical oracle.
Birth data, identity, timestamps and storage remain preserved; stale known-input
calculations recompute instead of relabeling old receipts. An intermediate
focused run had **1 failed / 274 passed** because its test still assumed an old
unknown-time receipt was current; final site verification is recorded below.

## A03 — Candidate bytes and clean consumer

| Field | Final candidate |
| --- | --- |
| Package | `@zodiacs/engine@0.1.1-rc.1` |
| Source | SDK `03bf77990f3014b9125eed4976d7a41200aac80d` |
| Artifact | `vendor/zodiacs-engine-0.1.1-rc.1.tgz` |
| SHA-256 | `f95c887deedb55f64b185ed4dd406b580b6d3287656ab5ec0557215fc02e5d17` |
| npm integrity | `sha512-WX6wQmnvNvfxSdyWL/YaiGm+fZTNl8GMUGY8Ir8j3I8CvrXHD24Qjc3AMn9MjOt2lrjiPL2IRIoVEPV1Htm4Kg==` |
| Pack contents | 18 files; 21,374 packed bytes; 70,343 unpacked bytes; no bundled dependencies. [Exact inventory](evidence/engine-rc1-pack.json). |

`rc.0` remains a distinct immutable candidate, SHA-256
`4b16eeac2e8c82e5fb3a5b3756b2ed31f8fec93a37728a722b9ef81ce8f5c20d`.
After footer-source and documentation corrections, `rc.1` was cut rather than
overwriting those bytes. Site manifest, lockfile, checksum and tests pin the
final artifact; no dependency on an unavailable public npm version is added.
See [vendored provenance](../../vendor/README.md).

At approximately 18:21 UTC,
`corepack pnpm --filter @zodiacs/engine consumer:smoke /private/tmp/zodiacs-platform-evidence/zodiacs-engine-0.1.1-rc.1.tgz`
**passed** in a newly created consumer directory: actual npm tarball install,
strict NodeNext type resolution (TypeScript 5.9.3), public root and `/geo`
examples, input-error cases, notices, no workspace symlink, and absence of
optional React/ownership dependencies. The executable example replaces `fetch`
with a throwing function to detect calculation-time network calls.
[Exact consumer receipt](evidence/packed-consumer-rc1.log). This is clean local
artifact use, not a public-registry installation.

## Required SDK checks

The [final gate receipt](evidence/sdk-final-gates.json) records commands,
start/end timestamps, exit statuses and raw log paths. Runs at
**18:18:46–18:20:00 UTC** used the final candidate working tree subsequently
committed as `03bf7799`:

| Command | Result |
| --- | --- |
| `corepack pnpm typecheck` | **Passed**, including examples. |
| `corepack pnpm test` | **Passed: 295 tests / 26 files.** [Full test log](evidence/sdk-final-test.log). |
| `corepack pnpm pack:dry-run` | **Passed**, engine/widgets/ownership sequence; package prepack builds executed. |
| `corepack pnpm package:contents` | **Passed.** |
| `corepack pnpm exports:smoke` | **Passed**, including Node16, NodeNext and Bundler resolution. |
| `corepack pnpm docs:engine` | **Passed**, TypeDoc regenerated. |
| `corepack pnpm format:check` | **Passed.** |

Earlier implementation-tree checks passed `corepack pnpm lint`,
`corepack pnpm registry:checksum`, `corepack pnpm neutrality:guard`, and
`corepack pnpm build` (full workspace and examples). That full build predates
final documentation/version edits and is not represented as a repeated full
workspace build of `rc.1`. [Build log](evidence/sdk-build.log),
[registry checksum](evidence/sdk-registry-checksum.log),
[neutrality guard](evidence/sdk-neutrality-guard.log).

The initial aggregate run overlapped intentional red geo tests and unformatted
edits; those test/format failures were intermediate. Initial pack/content
checks failed with `EPERM` against the inherited npm cache. A writable scratch
cache resolved that environment failure; the final receipt records passing
reruns. No failed result is silently relabeled as successful.

## A04 — Independent numeric evidence and limits

`node scripts/platform-engine-report.mjs` ran against the installed final
`rc.1` bytes on Node 22.23.2 and Node 24.19.0 at approximately **18:29 UTC**.
Both reports **passed**, pinning candidate/reference/policy hashes:
[Node 22](evidence/independent-node-polar-node22.json),
[Node 24](evidence/independent-node-polar-node24.json).

| Observed maximum over the recorded corpus | Value |
| --- | --- |
| True-node longitude residual | 0.001685456325 degrees |
| True-node speed residual | 0.000350604032 degrees/day |
| Polar ASC/MC residual | 0.000434824069 degrees |
| Whole-house cusp residual | 0 degrees in these cases |

The corpus contains **three node epochs and three polar locations**, with both
requested house systems. Existing predeclared tolerances and the direction
deadband are preserved. Product Placidus fallback is compared with independent
whole-house output, not the provider's different fallback. References and
conventions remain in the existing
[Swiss node/polar record](../engine-validation/swiss-node-polar/README.md).
Reference SHA-256 `022fbc030185b84aa0954411aab266577cd75f50a1947dc4717e92d8a9db9260`
and policy SHA-256 `7742cb2bc7cd0932a344ddcb708e45dad07b91cb653ea1f55538c2d73fa18e96`
are unchanged. No provider library/ephemeris binary was added to the package,
and reference acquisition/generation was not rerun in this session.

These are finite-corpus observations, not a global error bound, licensing
opinion, proof at exact poles/tangencies, or validation of all accepted
historical dates. Earlier `rc.0` reports on Node 22/24/26 remain raw diagnostics;
they are not substituted for final-artifact reports. Package/site parity uses
shared code and is compatibility evidence, not an independent numerical oracle.

## Site gates — intermediate results and final acceptance

The first full `npm run test` returned **11 failed / 4,386 passed / 13 skipped**
(3 failed, 399 passed, 1 skipped files), in raw `site-test.log` and
`site-gates.json`. Nine failures read missing `dist` HTML because tests ran
before a successful build. The other two were a Phase 1 evidence fingerprint
mismatch and the Kahlo scene snapshot mismatch. Record final disposition after
the final build/test sequence; this ledger does not assume all are pre-existing
or all fixed.

`npm run check` initially detected overwritten engine-documentation footer CSS.
The upstream TypeDoc stylesheet and site output were repaired in SDK
`5f78aea64ea698fad6b415efeea5774321645419`; review confirmed the custom CSS diff
returned to empty. Initial `npm run build` failed the daily publication
provenance-manifest hash after the dependency change. These are intermediate
failures (`site-check.log`, `site-build.log`), not reasons to weaken gates.

`npm run build` against `rc.1` then **passed** (`site-build-rc1.log`, completed
approximately **18:24:58 UTC**): **4,318 HTML files**, 1,134 search entries,
intact Registry, **1,192 JSON-LD documents / 4,531 graph nodes / zero schema
errors**, and bundle budgets passed. Engine lazy chunk: **21.1 KB / 25 KB**;
package/homepage isolation clear. Build receipt:
`bac22f2c6c15d496a354543eb2434afe20dad8e07ba5cf9d4f281c4a293beff4`.
This is local build evidence, not a deployed commit.

The subsequent final build including the saved-calculation type fix and
corrected public reference copy also **passed** (`site-build-rc1-final.log`),
with build receipt
`fd5c1f252fe4d9e538378261d704122b3d106c4dc8cd14139c982386d2f589d0`.
The earlier TS2367 literal-version comparison error was fixed without treating
legacy receipts as current; final `site-check-final.log` reports **zero errors,
zero warnings, 11 hints** over 1,024 files.

| Final operation at this checkpoint | Status |
| --- | --- |
| `npm run check` after `currentSavedCalculation` fix | **Passed.** Raw `site-check-final.log`: zero errors, zero warnings, 11 hints. |
| Final `npm run build` including that fix and corrected public reference copy | **Passed.** Raw `site-build-rc1-final.log`; final receipt above. |
| `npm test -- --maxWorkers=2` after build | **Passed: 4,410 tests / 403 files, no skips**, 73.53 seconds; 18:37–18:39 UTC. [Final log](evidence/site-test-final.log). |
| Browser acceptance of changed calculation/sharing journeys | **Passed**: `node tests/t17-positions-share.mjs` against the existing preview. Desktop/mobile known-time and unknown-time calculations, keyboard/modal focus, reduced motion, positions-only versus opt-in detail/preview links, prepared image/native-share paths and encoder-failure handling. [Transcript](evidence/site-t17-rc1.log). Separate high-zoom/widget privacy review remains open. |
| Phase 1 acceptance harness | **Passed 18/18** at 360 and 1280 pixels using Chromium 152.0.7977.76. [Capture manifest](../acceptance/phase1/screenshots/manifest.json), [log](evidence/site-phase1-rc1.log). Existing preview selected through `ZODIACS_TEST_BASE_URL` after a single-preview conflict. Actual captures inspected; no numerical reference or design baseline was loosened. |
| Changed-site preview/production endpoint and deployed-artifact verification | **Not performed.** Automatic SDK example preview is separately identified above. |

## Security, review and release holds — A05

`corepack pnpm audit --prod --json` on the unchanged SDK dependency lock found
**21 high, 37 moderate, 1 low, zero critical** vulnerability counts across the
broader workspace. The
[dependency audit summary](evidence/sdk-dependency-audit-summary.json) maps
advisories to existing app/example and ownership-SDK paths. This is not a new
engine dependency finding or a claim that the workspace is secure; those
pre-existing issues need separately scoped remediation. The earlier `rc.0`
clean engine consumer's `npm audit --omit=dev --json` reported zero known
vulnerabilities ([receipt](evidence/packed-consumer-audit.json)). A fresh audit
of the exact **`rc.1` clean consumer also passed with zero known vulnerabilities**
([final receipt](evidence/packed-consumer-rc1-audit.json)). An advisory-free audit
is not a complete source/security review.

Auxiliary Vercel `sdk-zodia-launch` fails on SDK main and PR #5 with the same
freshly read build-log error: no `public` output directory. Main deployment
`B4ShFKehyN5pf5FEhdaYfCrMVL6y` and PR deployment
`BtViat59CX9UNMqaJEncqTiAUw4t` establish the pre-existing configuration failure.
Primary `sdk-zodia` deployments succeed. No auxiliary configuration or unrelated
application was changed to make this slice appear green.

Real separately delegated agents supplied numerical/security/input and release
reviews, alongside the integrator's adversarial review. These independent model
workstreams found upstream polar drift, time coercion/year/host-zone issues,
search bounds, endpoint wording and footer drift. They are **agent review**,
not human practitioner review, legal review, external adoption, or approval
that closes an explicit hold. Independent numeric references are a different
kind of evidence from another agent's opinion.

PR #5's merge/publication hold remains open. Draft PR #6 and packed bytes make
the candidate reviewable; they do not establish authority to merge or publish.
No package was published, no production deployment made, no outreach sent,
and no independent adoption claimed. Stage A has implemented/tested source
and a clean-installable candidate; release readiness remains conditional on
the remaining numerical-scope and applicable review/authority gates. Keep
**implemented, tested, release-ready, published, deployed, verified in
production, and adopted externally** distinct in later receipts.

### Final-check corrections and additional runtime evidence

- `corepack pnpm test` on Node **20.20.2**, the SDK CI major, passed
  **295 tests / 26 files** at approximately 18:35 UTC.
  [Node 20 log](evidence/sdk-node20-test.log).
- First final site run: 4,408 passed / two failed. One daily-manifest test still
  hard-coded 0.1.0; it now checks the installed public `ENGINE_VERSION`. The
  catalog byte-regeneration test timed out at five seconds while full tests
  and browser checks ran concurrently. The final rerun uses two workers after
  browser completion; no catalog fixture or timeout was changed.
- T17's initial 250 ms delayed signature-encoding test could finish before
  its pending-state assertion. An explicit release latch keeps the old render
  pending until the privacy toggle changes. The same existing functional
  assertions then passed; production sharing code was not changed.
- Manual browser CLI verified the homepage and birth-chart form without page
  errors. [Birth form capture](evidence/birth-form-desktop.png). Browser images
  are UI evidence, not numerical or privacy oracles.

## B03 — Shared-sky freshness slice

The next dependency-ready slice reuses the current static API. A single literal
`src/lib/sky-api/examples/today.mjs` is both executable and rendered on the
developer page via a raw import, avoiding example/source drift. It checks HTTP
success, the payload kind and fields it consumes, the current UTC edition and
canonical noon snapshot before any display. A current-day noon snapshot remains
valid before noon. Fetch has a ten-second deadline. This is narrow validation
of consumed fields, not a general JSON Schema validator.

The same source templates now distinguish edition date, computed snapshot, build
time and scheduled publication. Existing deployment headers remain unchanged:
300-second today JSON, 3,600-second index, 86,400-second remaining API files.
Separately cached payloads can differ from the index; successful HTTP and a fresh
build timestamp do not prove current astronomical data. Live reads confirmed
the documentation mismatch, with no current stale-data incident.

At 18:42 UTC, Node 22 / site Vitest 3.2.6 passed **39/39** focused tests:
`npm test -- scripts/sky-api-quickstart.test.mjs scripts/sky-api.test.mjs src/lib/edition-freshness.test.ts`.
The literal example has 21 cases covering error HTTP, wrong/empty/malformed
payloads, UTC midnight, stale dates with recent build times and valid pre-noon
snapshots. Final generated build/check/browser results follow when complete.

### Refreshed integration requirements

Working `gh` CLI protection reads supersede the connector's earlier access gap.
Site main requires the PR path, enforces administrators, disallows force pushes,
dismisses stale reviews and records zero required approving reviews; required
status checks are null. SDK main responds **Branch not protected (404)**. These
settings do not remove the owner's reviewed-PR requirement or the explicit SDK
PR #5 do-not-merge/do-not-publish hold. No setting was changed.

Fresh PR #289 head `de9bb3b58240286923f3437d32c7b5590490a78a` is open; its
current file list does not include the developer page or sky-api sources. The
B03 slice avoids its footer/Base/package edits and PR #413's Vercel changes.

B03 final build/check passed: zero errors/warnings (11 hints), normal full build
gates and unchanged engine bundle budget. Build receipt
`90a74dfcc3017c8020a16013091abaa2182f7fe248bfd983d5cbf136ca0f10b6`.
[Build](evidence/site-b03-build.log), [check](evidence/site-b03-check.log).
The mandatory Phase 1 capture refresh passed **18/18** against that receipt;
[log](evidence/site-b03-phase1.log) and the current [manifest](../acceptance/phase1/screenshots/manifest.json)
replace the earlier source fingerprint with actual captures, not invented hashes.

The exact standalone example also passed against the live public API at
approximately 18:43 UTC ([output](evidence/b03-live-quickstart.log)). Refreshed
HTTP/cache/CORS/edition fields and payload hashes are recorded in the
[live API receipt](evidence/b03-live-api.json). All four endpoints returned 200
and the September 7 edition; this demonstrates an internal run, not an external
onboarding session or adoption.

Browser CLI checked `/developers/` at 1280 and 390 pixels. The
[displayed-source/overflow receipt](evidence/developers-dom.json) matches the
source example byte for byte, page width equals viewport width (390), and the
code area scrolls internally (617 pixels inside 348 pixels). No error overlay
or browser errors. Actual [desktop](evidence/developers-desktop.png) and
[mobile](evidence/developers-mobile-code.png) captures preserve the approved
site design. Combined suite passed: **4,431 tests / 404 files, no skips**, 73.34 seconds
(18:46–18:48 UTC); [final combined log](evidence/site-b03-test.log).
The final page adds a labeled focusable code region. An initial keyboard probe
used an incorrect link URL and later lost its active tab; those probe results
do not establish a pre-change accessibility defect. The corrected isolated
harness targets the actual accessible link name and passes below.

At **18:56:20 UTC**, `node tests/platform-developers-drive.mjs` passed using
isolated Chromium **152.0.7977.83** contexts at 1280 and 390 pixels with reduced
motion. The exact rendered source matches, Tab focuses the named code region,
ArrowRight scrolls it on mobile, page width stays within the viewport and no
page errors/overlay occur. [Machine receipt](evidence/developers-browser.json),
[log](evidence/b03-browser.log), [desktop](evidence/developers-1280.png),
[mobile](evidence/developers-390.png). Build and check passed again after the
attribute-only accessibility refinement; source fingerprint remains unchanged.
The earlier full 4,431-test suite remains applicable to unchanged calculation,
example and guide sources; this final page refinement has its own browser proof.

## Review delivery and remote follow-up

Both source increments are committed and pushed in
[site draft PR #415](https://github.com/ZodiacsOfficial/site/pull/415):
Stage A `40d3f9647a31afc20db007b7cd5269eb4ef73b6a`, B03
`73e253e924428aabb0e1c62ca635f5ea68ce5546`. SDK draft PR #6 links the
companion and remains held. No merge or production release occurred.

The exact candidate was downloaded **without credentials** from the public
[immutable site commit](https://raw.githubusercontent.com/ZodiacsOfficial/site/40d3f9647a31afc20db007b7cd5269eb4ef73b6a/vendor/zodiacs-engine-0.1.1-rc.1.tgz),
SHA-256 verified, then installed in another new consumer on Node 20.20.2.
Public ESM/type/examples/invalid-input/notices/isolation checks passed again
([receipt](evidence/public-candidate-consumer.log)). This is publicly retrievable
review-candidate distribution through GitHub, **not npm publication** or adoption.

Initial remote [Site Check run 34153727971](https://github.com/ZodiacsOfficial/site/actions/runs/34153727971)
compared PR head `73e253e9` with main `7f953e3f`. Build & Check stopped before
installation at the Phase 1 protected-scope guard: 86 generated engine-reference
paths. Other SQL/legacy checks had passed; browser jobs were still running.
The existing base-pinned exact-file allowance records authorization from the
activated Stage A mandate; the guard and release hold remain unchanged. The
local guard and its tests passed ([receipt](evidence/platform-scope-guard.log)).
This is a diagnosed CI integration omission, not a calculation-test failure or
authority to waive review.

Automatic preview `dpl_HbtEtWm3z3VceuCagn2rn3id4NCw` for `73e253e9` was
building at the first check, URL
`https://zodiacs-nm6pslv5v-zodiacsofficial.vercel.app`. Production lookup still
identified `dpl_BrntzbFYa2gzetKWgeq91GFeaM6W` / `7f953e3f` with the
`zodiacs.org` alias. Follow-up scope-correction CI and preview verification
are linked in the [draft PR's validation record](https://github.com/ZodiacsOfficial/site/pull/415).
Inspect that exact commit/run before any integration; this checkpoint does not
presume their success.

### Remote preview and diagnosed CI corrections

Preview `dpl_HbtEtWm3z3VceuCagn2rn3id4NCw` reached READY for `73e253e9`.
At 19:07:45 UTC the actual isolated Chrome 152.0.7977.83 developer-page drive
passed at 1280/390 pixels with temporary protected-preview access: literal
example equality, keyboard focus/scroll, reduced motion, no page overflow or
page errors. [Receipt](evidence/preview-developers-browser.json),
[desktop](evidence/preview-developers-1280.png),
[mobile](evidence/preview-developers-390.png),
[log](evidence/remote-preview-browser.log). Access tokens/cookies are excluded.
The later scope/docs-only head `2cd8c088` also reached READY as preview
`dpl_E2T28FXaoopSGYo3UJug4Sw2cd4R`; the browser evidence above identifies the
earlier app-identical source rather than claiming a second browser run.
These are preview deployments, not production release.

[Site Check 34154096120](https://github.com/ZodiacsOfficial/site/actions/runs/34154096120)
at `2cd8c088` passed the corrected scope guard, install/zero-advisory gate,
default build/check, full unit suite, reference vectors, acceptance evidence,
SQL/legacy checks and several real browser jobs. Two integration failures
remain in that historical run:

- Push-enabled Today initial JavaScript: **22,029 bytes**, existing limit
  **22,016**. Reproduced locally with Node 22 and fixture-only flags
  `PUBLIC_WEB_PUSH_ENABLED=1 PUSH_ENABLED=1 PUBLIC_VAPID_KEY=AQIDBA npm run build`.
  [Before closure](evidence/today-bundle-before.json).
- Ask browser migration fixture imported the current engine while asserting
  it was 0.1.0. [Exact failed job output](evidence/site-ci-build-check-failed.log).
  The browser test stopped at fixture construction, before the legacy journey.

The bounded correction defers unchanged contact arithmetic alongside the
existing transit import. Its red baseline failed two eager-load assertions;
focused loading/arithmetic/state tests then passed **25/25**, including either
dependency failing and concurrent request start. The full fixture-flags build
now passes all budgets; Today measures **21,480 bytes**, 536 below the unchanged
limit. Final browser/default-build and capture verification are recorded below.

The legacy browser corpus contains 96 synthetic quarter-hour results from the
SHA-256-verified archived 0.1.0 package. All 24 overlapping north-polar hourly
records exactly match the earlier corpus. Fixture SHA-256:
`eedff84d838cea3b56164b6c848eddfea704baad5e99847bf2d143b723194c0f`.
[Generator and provenance](../../tests/fixtures/generate-legacy-polar-browser.mjs),
[reproduction log](evidence/legacy-browser-reproduce.log). Browser drives read
the frozen JSON and retain the full original quarter-hour selection coverage.
Already-rising inputs remain unchanged; supplied positions-only receipts stay
0.1.0, while recomputed results identify the installed public engine version.

Final correction verification on Node 22.23.2, September 7 UTC:

- Full suite **4,447 tests / 405 files, no skips**, passed in 82.98 seconds
  at 19:30–19:31 UTC: `npm test -- --maxWorkers=2`
  ([log](evidence/site-ci-correction-test.log)).
- Normal build and required check passed: 0 errors/warnings, 11 hints,
  all route/chunk budgets retained. [Build](evidence/site-ci-correction-build.log),
  [check](evidence/site-ci-correction-check.log),
  [push-enabled build](evidence/site-push-flags-after.log),
  [measured Today closure](evidence/today-bundle-after.json).
- Actual Chrome normal/flags-on journeys: Today **59 checks**, fixture-only
  push **25**, Guide **45**, compatibility/legacy/composite **962**, solar
  return **46**, all passed. No real push enrollment or outgoing message.
  [Today](evidence/today-flags-browser.log), [push](evidence/push-flags-browser.log),
  [Guide](evidence/site-ci-correction-ask.log),
  [compatibility](evidence/site-ci-correction-compatibility.log),
  [solar return](evidence/site-ci-correction-solar.log).
- Phase 1 **18/18** captures and evidence checks passed against normal-build
  source fingerprint `1d5c7568a8219b906b3c39565fbd817974179a61fec3fa851d67ae4f4c32a486`.
  [Captures](evidence/site-ci-correction-phase1.log),
  [receipt validation](evidence/site-ci-correction-evidence.log).

One local compatibility invocation could not connect because its fixed-port
preview conflicted with this task's existing Astro daemon. Stopping only that
daemon and setting `ASTRO_PREVIEW_BACKGROUND=0` let the unchanged driver own
its port; the actual journey then passed. This was a local harness setup issue.
The next exact-head CI result belongs in the linked PR validation record;
historical failed runs above are not relabeled successful.


## Developer entry and frozen starter checkpoint — September 7, 20:03 UTC

B01 replaces the top of the existing developer page with four explicit paths
and adds a ten-row support matrix, immutable candidate/source/evidence links,
and a privacy-aware discrepancy report path. The existing sky example and
canonical layout/footer remain. Public data/widgets are available; local engine
is an unpublished candidate; personalized hosted computation remains planned.
The optional read-only ownership SDK stays separate.

- Node 22 build and check passed (0 errors/warnings, 11 hints):
  [build](evidence/site-b01-build.log), [check](evidence/site-b01-check.log).
- Candidate/archive/boundary focused suites: **62/62**, passed
  ([log](evidence/b01-boundary-candidate-tests.log)). Narrow developer SDK links
  use the existing exact source/destination bridge list; vocabulary, external
  venues, consumer pages and other wing routes remain guarded.
- Actual Chrome 152 desktop/mobile checks passed: four destinations, literal
  sky example, Tab/ArrowRight scrolling, support table keyboard focus, canonical
  footer, no horizontal overflow/page errors, reduced motion. Support matrix
  also passes CSS zoom 2 at 1280 pixels; this does not certify native browser
  zoom controls. [Receipt](evidence/b01-developers-browser.json),
  [desktop](evidence/b01-developer-entry-1280.png),
  [mobile](evidence/b01-developer-entry-390.png),
  [support mobile](evidence/b01-developer-support-390-zoom1.png).
- The Phase 1 source fingerprint is unchanged from `1d5c7568…a486`; previous
  18 acceptance captures continue to describe that protected render boundary.
- Exact Stage A head `4bb0d70eaaf21ea950a8fe708a0e1a91f8fb1f4f` preview
  `dpl_E98V1wNWvdVq6TT4H5z8DiSCpZY9` is READY. Actual remote Today drive
  passed **59 checks** ([log](evidence/correction-remote-today.log)).
  CI run 34156030961 had reached Lighthouse at this checkpoint; its final
  conclusion must be recorded separately. Production remains the earlier head.

B02 source and private example archive are prepared at `examples/platform/`
and `public/examples/`. Three pages use only public engine exports, synthetic
inputs and no account; natal/transit calculation stays in the loaded browser,
while the publisher widget makes an explicit optional hosted request.

Starter **0.1.0-rc.2**, SHA-256
`d409a395966e78b3ddc0604d75d4a836477987d99814ff786f55aee9e464e420`, contains
engine **0.1.1-rc.1** unchanged. Fresh isolated Node 22 extraction/install/build
and **24 tests** passed in **7.79 seconds**, with zero npm advisories
([receipt](evidence/b02-fresh-consumer-rc2.log)). This is internal machine timing,
not a builder study or complete onboarding time. [Pack inventory](evidence/b02-pack-rc2.json).

The first unshipped example rc.1 (SHA-256 `49683fa954927e63905d8cbd5933ce9fd90b78c31407b71d60b127d5d80e6e99`)
failed the real 390px browser check because fieldset intrinsic sizing overflowed.
Explicit minimum inline sizing fixes the layout in rc.2. That earlier example
was never pushed/published. Browser rerun, anonymous public-archive installation,
and the public onboarding page remain pending at this checkpoint. Neither
archive distribution nor internal tests resolve npm, production or external
review/adoption gates.


### Stage A final CI and refreshed release state

[Site Check 34156030961](https://github.com/ZodiacsOfficial/site/actions/runs/34156030961)
at exact `4bb0d70eaaf21ea950a8fe708a0e1a91f8fb1f4f` completed successfully:
**all 14 jobs**, including visual regression, Lighthouse, widgets, browser
journeys, SQL and advisory gates. [Machine receipt](evidence/site-stage-a-ci-success.json).
Draft PR #415 validation now identifies this final result and the matching
READY preview's 59 passed remote Today checks. Earlier failed runs remain
historical failed runs.

[Release refresh at 20:05 UTC](evidence/b01-release-refresh.json) confirms the
same site/SDK main heads and explicit PR #5 hold with no submitted reviews.
Public unauthenticated npm reads still return 404 for engine/widgets and
`1.0.1` for the separate ownership SDK. PR #289 remains at `de9bb3b5`;
PR #413 currently `bf8268d2` has no developer-page overlap, with an additive
sitemap entry that must be retained during later integration. No main merge,
production release, package publication, external review or adoption occurred.

The complete starter is publicly downloadable without credentials from
https://raw.githubusercontent.com/ZodiacsOfficial/site/80dff5f16ec17045bcb52110a8105a9ad3492a99/public/examples/zodiacs-platform-starter-0.1.0-rc.2.tgz .
Anonymous HTTP 200, 40,481 bytes and SHA-256 `d409a395966e78b3ddc0604d75d4a836477987d99814ff786f55aee9e464e420`
match all 20 local source/archive files. Fresh isolated configuration/cache
installation, build and 24 tests passed in **7.21 seconds including download**.
[Receipt](evidence/b02-public-consumer.json). This internal automated check is
not the complete timed page walkthrough, population usability evidence or npm
publication. The browser and literal displayed-command checks follow below.


### B01/B02 final local and public-archive acceptance — 20:22 UTC

The final developer front door links to `/developers/examples/`, with one
rendered setup block and three complete success/failure/privacy paths. The
block runs in a POSIX subshell with `set -eu`; failed mkdir/download/checksum
cannot continue into extraction or npm. It neither enables an npm release nor
promises a complete portable receipt schema.

- Full Node 22 suite: **4,493 tests / 407 files, no skips**, passed in 96.21s.
  [Tests](evidence/site-b02-final-tests.log),
  [build](evidence/site-b02-final-build.log),
  [check](evidence/site-b02-final-check.log), 0 errors/warnings, 11 hints.
  Two earlier full-suite failures identified the generated route inventory's
  old 690/51 counts; the new routes require 692 consumer routes/53 static pages.
  The mandated generator changed only three developer inventory lines in
  `api/_assistant/context.ts`; persona is untouched. PR #413's nearby birthday
  inventory/sitemap addition must be retained in later integration.
- Source/metadata/pack drift and adversarial archive checks pass, including
  exact starter commit, digest, public exports, all source bytes and lockfile
  integrity. The displayed Node hashing import is narrowly recognized by the
  consumer boundary; surrounding promotional vocabulary and destinations stay
  checked. No directory-wide exemption was added.
- Final actual developer-page browser checks passed at 1280/390 with reduced
  motion and CSS zoom 2 at 1280: navigation, canonical footer, Tab/ArrowRight
  scrollers, exact setup identity, no overflow/page errors.
  [Receipt](evidence/b02-developers-browser.json),
  [front door](evidence/b02-developer-entry-1280.png),
  [examples desktop](evidence/b02-developer-examples-1280-zoom1.png),
  [examples mobile](evidence/b02-developer-examples-390-zoom1.png).
- Fresh rc.2 starter browser: **185/185** checks passed in actual Chrome
  152.0.7977.83 at 1280/390. Calculators made zero requests/API calls during
  recalculation, retained no local/session/IndexedDB/CacheStorage/service-worker
  state or cookies, rejected malformed/empty/offset-free inputs, preserved
  offset-equivalent instants and unknown-time qualification, and recalculated
  offline after load. Widget dark/light requests returned HTTP 200, showing
  the current UTC date `2026-09-07` at 20:01 UTC; contrast ≥4.5, attribution
  and fallback remained keyboard-reachable. The blocked-frame scenario uses
  an explicitly synthetic response. [Receipt](evidence/b02-starter-browser.json),
  [setup timing](evidence/b02-starter-setup.json),
  [widget mobile](evidence/b02-starter-widget-390-light.png),
  [initial rejected rc.1 mobile](evidence/b02-rc1-rejected-mobile.png).
- The exact setup text extracted from the rendered page was executed unchanged
  in a new folder with isolated empty npm/curl configuration and empty npm
  cache. Public download/hash/install, **24/24 tests**, build and the local
  server passed; each of three served pages was HTTP 200 and byte-equal to
  that consumer's build. **2.841 seconds** for those automated steps, including
  startup and HTTP verification. [Receipt](evidence/b02-literal-onboarding.json),
  [literal text](evidence/b02-literal-rendered-setup.sh),
  [success log](evidence/b02-literal-success.log).
  Separate existing-directory, simulated HTTP-failure and genuine checksum
  rejection checks all stopped before tar/npm. Only owned temporary process
  groups were stopped, with disappearance verified. This timing does not
  include a human reading the page or interacting with the charts, and is not
  evidence about unfamiliar developers or external adoption.

The first B01/archive commit `80dff5f16ec17045bcb52110a8105a9ad3492a99`
was pushed without merge, making the exact example bytes publicly available.
Its automatic review preview `dpl_HMB36sGh7emiAFHFTvb6tmEYW9g3` is READY.
The final onboarding-page commit, its separate draft PR, exact-head CI and
remote preview verification remain the next release-evidence steps.


### B01/B02 review delivery and actual remote preview

[Draft PR #417](https://github.com/ZodiacsOfficial/site/pull/417) is stacked on
#415; final source is `8343f173e4db2e8ab6628bd04590e41b056872ce`.
Exact preview `dpl_6okY3r99rF7qVw5Emkaod8XLh31V` is READY at
https://zodiacs-bxcsjv13g-zodiacsofficial.vercel.app . At 20:29 UTC actual
Chrome ran all three developer-page journeys at 1280/390, with canonical
footer, correct public starter link/setup, reduced motion, focus/scroll and
CSS zoom checks passing. [Receipt](evidence/b02-preview-developers-browser.json),
[front door](evidence/b02-preview-developer-entry-1280.png),
[mobile examples](evidence/b02-preview-developer-examples-390-zoom1.png).
Temporary access file and browser wrapper were deleted; no bearer URL or
cookie was saved in repository evidence. Exact-head CI [34159295138](https://github.com/ZodiacsOfficial/site/actions/runs/34159295138) passed all 14 jobs; [result](evidence/b02-ci-success.json).
Production remains `7f953e3f` / `dpl_BrntzbFYa2gzetKWgeq91GFeaM6W`.
New concurrent PR #416 (`f1293bbb`, Astrofolio verification status only)
has no file overlap; no other contributor branch was changed.

### C02 civil imports and explicit timezone boundary — final local gates

Base source `8343f173e4db2e8ab6628bd04590e41b056872ce`, branch
`codex/platform-civil-inputs`. A synthetic v1 birth-share token containing
`2001-02-29` was accepted and calculated as March 1 with a false DST-gap flag.
The public engine rejects the original invalid ISO string, but cannot recover
it after an adapter has normalized it to a valid Date. The
[original reproduction](evidence/c02-civil-input-analysis.md) preserves source
hashes, exact synthetic input and failed-before/passed-after evidence.
Trailing-newline inputs already failed on the baseline; they are controls.

The import-free Gregorian parser now rejects impossible dates and clock
rollover at both share decoding and local-time resolution. Share v1 shape,
1800–2199 window, unknown-time behavior, labels and house settings stay intact.
The resolver preserves astronomical years 0000–0099 using setUTCFullYear and
explicit Gregorian/Latin/era fields; this is syntax/time handling, not an
extension of numerical accuracy claims. Missing/coerced/unsupported timezones
cannot select the host zone. Errors do not echo submitted values or invoke
untrusted coercion hooks. Invalid stored inputs keep their original cached
receipt without recalculation, re-versioning or storage mutation.

Reproduction commands from the site root with installed Node 22 toolchain:

```sh
TZ=Asia/Bangkok node node_modules/vitest/vitest.mjs run src/lib/time/civil-date.test.ts src/lib/time/localToUtc.test.ts src/lib/share.test.ts src/lib/profile/polar-repair.test.ts
npm run build
npm run check
ASTRO_PREVIEW_BACKGROUND=0 npm run test:phase1:acceptance
ASTRO_PREVIEW_BACKGROUND=0 node tests/platform-share-boundary-drive.mjs
npm test
PUBLIC_WEB_PUSH_ENABLED=1 PUSH_ENABLED=1 npm run build
T17_SHARE_EVIDENCE=1 ASTRO_PREVIEW_BACKGROUND=0 node tests/t17-positions-share.mjs
ASTRO_PREVIEW_BACKGROUND=0 npm run test:compatibility:browser
node docs/platform/evidence/c02-civil-review-probe.mjs
TZ=UTC node docs/platform/evidence/c02-timezone-review-probe.mjs
TZ=America/Los_Angeles node docs/platform/evidence/c02-timezone-review-probe.mjs
```

The two C02 probes load the site's own resolver of their day, which #723
replaced with `@zodiacs/engine/geo` on 2026-10-12. They run from a checkout
before that change, such as `ec0451ff`, and say so otherwise.

- Final focused suite: **201/201** on Node 22.23.2 with Bangkok host and Node
  24.19.0 with UTC host. [Node 22](evidence/c02-final-focused-node22.log),
  [Node 24](evidence/c02-final-focused-node24.log).
- Full suite: **4,624 tests / 408 files, no skips**, 66.91s.
  [Tests](evidence/c02-final-tests.log). Full
  [normal build](evidence/c02-final-build.log),
  [push-enabled build](evidence/c02-final-push-build.log) and
  [check](evidence/c02-final-check.log) pass, 0 errors/warnings, 11 hints;
  existing bundle limits unchanged and passing.
- **18/18** exact-width Phase 1 captures pass. Final images are byte-identical
  to the base; the manifest records the new source fingerprint
  `3998a3896d8408b2dc0b73d29c85f0822cd294c228be679c83bc08e400282cf1`.
  [Capture log](evidence/c02-final-phase1.log). An intermediate capture had
  slight yearly-image raster differences; the final run returned the base bytes.
- **12/12** actual Chrome 152.0.7977.83 journeys at 1280/390: impossible dates
  and 24:00 produce no result, form population or calculation event; valid
  leap-day known/unknown inputs still calculate. No overflow/page errors or
  saved-profile writes. [Receipt](evidence/c02-share-boundary-browser.json),
  [rejected import](evidence/c02-share-rejected-390.png),
  [unknown-time control](evidence/c02-share-unknown-390.png).
  The same driver is now a required Site Check step and its output falls
  within the existing browser-artifact upload path.
- Existing birth-chart export/sharing passed, including native-share and
  zoom controls: [log](evidence/c02-final-t17.log),
  [current 33% chart-sheet capture](evidence/c02-chart-sheet-33-percent.png).
  The driver regenerated the older general T17 capture; its current rendering
  is archived here while the pre-existing historical capture remains unchanged.
  No chart-renderer source was modified in this slice.
- Existing compatibility/composite browser drive: **962 checks, ALL PASS**.
  [Log](evidence/c02-final-compatibility.log).
- A second tool-backed reviewer found and then verified the explicit timezone
  guard. The portable probes were rerun against final source by the integrator:
  **148,800 calendar cases, 3,344 known-instant checks across 418 runtime zones**,
  plus Lord Howe half-hour fold/gap, Apia day gap and Mexico City LMT controls.
  [Final corpus](evidence/c02-civil-review-node22.json). Each separate UTC and
  Los Angeles host run passed **26 rejection cases and 9 valid controls**, with
  zero coercion hooks: [UTC](evidence/c02-timezone-review-utc.json),
  [Los Angeles](evidence/c02-timezone-review-los-angeles.json). Runtime ICU 78.2,
  tzdata 2026a. These finite same-runtime checks are not independent historical
  tzdb verification or human review. Normalized terminal log hashes and the
  exact normalization are [recorded](evidence/c02-log-normalization.json).

The shared candidate archive and ownership SDK bytes are unchanged. The
[separate remote receipt defect and withdrawn fix](evidence/c02-remote-house-analysis.md)
remain explicit: actual whole-sign results can retain a Placidus summary label,
but changing that single field discards the requested setting through rerun/sync.
Its two original synthetic JSON records are preserved; no account operation or
migration was performed. C02 is partially implemented, not a completed portable
receipt contract. Review PR/CI/preview delivery follows these local gates.

### C02 review delivery and remote boundary proof

[Draft site #418](https://github.com/ZodiacsOfficial/site/pull/418) is stacked
on #417 at exact source `a4284d8d6289ed6abfe30d2da883ad07edcfc7bd`.
The unchanged scope guard passes all 42 paths against its exact base, with
protected scope untouched. Preview `dpl_8SPSZP4ETeK4qdzpYiSsW7r9QrKD` is READY,
source a4284d8d, at https://zodiacs-c03uosfvw-zodiacsofficial.vercel.app .
At 21:08 UTC actual Chrome passed all twelve imported-share journeys at
1280/390, including invalid input rejection, valid known/unknown calculations,
no overflow/page errors and no saved-profile writes.
[Remote receipt](evidence/c02-preview-share-boundary-browser.json),
[rejected mobile import](evidence/c02-preview-share-rejected-390.png).
Temporary access file and browser wrapper were removed; no bearer URL/cookie
is saved in repository evidence. Exact-head Site Check [34161649806](https://github.com/ZodiacsOfficial/site/actions/runs/34161649806) passed all 14 jobs, including visual, Lighthouse and widget gates.
[Final result](evidence/c02-ci-success.json).

### A02/A03 separate GeoNames recovery candidate

A rejected optional GeoNames index/shard request previously prevented a later
explicit call from retrying. Eight expected baseline failures cover rejected
transport, HTTP 503, JSON parsing and caller-bound injected aborts. Matching
rejected cache entries are now evicted while retaining shared pending work,
successful/unrelated entries and the original rejection reason. No automatic
retry loop, timer, new cancellation API or live GeoNames request was added.

[SDK draft #7](https://github.com/ZodiacsOfficial/sdk/pull/7) is stacked on #6.
Source commit `0da0941e23035df3be95e5aa40f4f270222b57dd`; artifact/evidence
commit `abefc7c347ed22708a6743713d58c843d7166d8e`. This separate engine
`0.1.1-rc.2` archive has **18 files / 21,946 packed bytes / 72,108 unpacked
bytes**, SHA-256 `b5c0c63bddc8c1ccfc717551bdd57b1bfe7c439568851780575c8586456e0826`.
[Immutable archive](https://raw.githubusercontent.com/ZodiacsOfficial/sdk/abefc7c347ed22708a6743713d58c843d7166d8e/artifacts/zodiacs-engine-0.1.1-rc.2.tgz)
was anonymously downloaded with matching bytes/digest at 21:15 UTC:
[receipt](evidence/geo-public-artifact.json). Site and public starter retain rc.1;
no existing package version's bytes were changed.

All required SDK lint/typecheck/format/checksum/test/build/export/pack/contents/
neutrality and TypeDoc gates passed. Full suite **305 tests / 27 files** on
Node 20.20.2 and 22.23.2. Clean isolated Node 20/22 consumers installed the exact
archive, compiled public TypeScript 5.9.3 imports, and passed examples, notices,
optional-dependency isolation and retry through the packed geo export. Isolated
consumer audit: zero advisories. A second real reviewer passed eleven additional
strict-unhandled-rejection probes, including immediate concurrent retry waves,
non-Error reasons and stale-eviction protection. Ninety-six synthetic public
chart combinations exactly match rc.1 mathematical output after excluding
engineVersion. This is parity, not independent astronomical accuracy evidence.

[Durable SDK commands/logs/receipts](https://github.com/ZodiacsOfficial/sdk/blob/abefc7c347ed22708a6743713d58c843d7166d8e/docs/platform/EVIDENCE.md)
include actual failures and finite review limits. SDK CI currently triggers only
for main-targeting PRs, so no passing CI run is claimed for stacked #7. The
known auxiliary SDK preview failure and broader app dependency findings remain
separate. Structurally invalid but parseable GeoNames JSON remains cached in
both versions; a deliberate validation/cache-policy follow-up is still needed.
SDK #5's explicit release hold remains. No npm publication, main merge,
production operation, external review, outreach, spending or adoption occurred.

### A04/C02 additive natal codec delivery

[SDK draft #8](https://github.com/ZodiacsOfficial/sdk/pull/8) delivers engine
`0.1.1-rc.3` separately from the site's rc.1 pin. Runtime source:
`aaade67d0d49e8b10d1bc5c59cf345d6106dc270`; frozen artifact/evidence commit:
`2000377b1b537c1b08c873889059acc8edacc4fe`; final browser/delivery checkpoint:
`b0d7f02549187a9c4a0ca5baa97cf3342fc60707`. The optional `/receipt` entry
preserves full natal results, requested and actual houses, explicit absent-house
reasons, original ISO spelling when captured, unknown-time references and
optional local-resolution assertions without consulting current timezone data.

The Zodiacs draft validates a 64 KiB/depth 12/4,096-value envelope, rejects
duplicate decoded JSON keys and unsupported versions/features, and emits fixed
errors/redacted diagnostics without birth details, arbitrary metadata or stable
hashes. Captured provenance remains an unauthenticated claim. It does not migrate
account sync v1 or infer legacy intent. [Draft and two synthetic fixtures](https://github.com/ZodiacsOfficial/sdk/blob/2000377b1b537c1b08c873889059acc8edacc4fe/docs/platform/receipt-draft-v1.md).

**429 tests / 29 files** pass on Node 20/22, with all required SDK gates and
TypeDoc. Two actual clean packed consumers pass public TypeScript 5.9.3 imports,
core examples, package isolation, GeoNames retry, receipt replay and privacy.
The isolated consumer has zero reported advisories; broader SDK app findings
remain. Ninety-six synthetic chart cases match rc.1 exactly after excluding
engineVersion; replay normalizes absent optional input.flags to an empty list.
No numerical rounding or broader accuracy claim is involved.

Separate tool-backed review and final integrator reruns cover 60 codec controls,
21,500 JSON differential cases and three corrected counterexamples. Actual
Chrome 152 passes 23 offline codec assertions with Intl/storage blocked, no
network/capability attempts, no cookies and only lightweight receipt chunks.
This browser probe recreates synthetic Chart values without ephemeris execution.
[All SDK logs, source hashes, corrections and limits](https://github.com/ZodiacsOfficial/sdk/blob/b0d7f02549187a9c4a0ca5baa97cf3342fc60707/docs/platform/EVIDENCE.md).

The [immutable rc.3 archive](https://raw.githubusercontent.com/ZodiacsOfficial/sdk/2000377b1b537c1b08c873889059acc8edacc4fe/artifacts/zodiacs-engine-0.1.1-rc.3.tgz)
was anonymously downloaded at 22:05 UTC, **32,079 bytes / 22 files**, SHA-256
`aeab68793129517abe7498c5f5a17197d387eed7cbdaa9614f3b8cd939b11a17`.
[Download receipt](evidence/receipt-public-artifact.json). No successful stacked
SDK CI is claimed: its workflow targets main PRs only. The explicit #5 hold,
required human/external review and release/publication authority remain.
No merge, npm publish, production operation, account migration, outreach,
spending or external adoption occurred. The active subsequent slice integrates
this candidate into a new standalone natal starter; acceptance is pending.

### B04 publisher widget accessibility and privacy completion

The existing immutable starter rc.2 was tested in actual isolated Chrome
152.0.7977.83; all 20 archive files match source. **74 browser matrix assertions**,
three focused native-zoom/scroll cases and four privacy controls pass. Native
200%/400% Chrome zoom is independently confirmed by CSS viewport/DPR, rather
than CSS zoom. Keyboard reaches attribution and fallback, Page Down exposes
remaining iframe content, and no horizontal overflow occurs. Reduced-motion
documents have no active animation; conflicting host CSS does not penetrate
the frame. Real offline failure leaves a reachable fallback and honestly reports
only that the widget was requested, without promising offline navigation.

No request occurs before activation, no submitted birth data is involved, and
post-activation requests contain no synthetic parent query/fragment. Referrer
exposes only origin; parent/frame storage and cookies are empty. The observed
hosted dark document returned HTTP 200 with SHA-256
`809285f1b6bb071465a6d2f5c56dc896e41aa495ad9e5a863cba3fa5b0bc8169` and the then-current
2026-09-07 UTC date. It has its own existing deployment, not a new widget release.

[Independent review and exact scope](evidence/b04/REVIEW.md),
[results](evidence/b04/summary.json),
[native 400% dark keyboard focus](evidence/b04/nativeZoom4-dark-attribution-viewport.png),
[native 400% light scrolled content](evidence/b04/nativeZoom4-light-pagedown-viewport.png).
The integrator visually inspected both captures. Earlier clipped full-page
screenshots were harness artifacts and excluded; raw viewport captures are the
accepted evidence. Browser/server cleanup is recorded. No source defect was
reproduced and no immutable archive was rewritten. This finite Chromium corpus
is not all-browser or assistive-technology certification. A changed starter will
receive affected functional/browser checks again.


## Standalone natal receipt source — September 7, 22:38 UTC

The next starter is `0.1.0-rc.3`, containing the immutable SDK engine
`0.1.1-rc.3` from distribution commit `2000377b1b537c1b08c873889059acc8edacc4fe`
and runtime source `aaade67d0d49e8b10d1bc5c59cf345d6106dc270`. The site application's
rc.1 pin, account records and existing starter archives remain unchanged.

The natal example exports actual local JSON files, imports bounded strict UTF-8
files as unverified stored results, retains exact unknown-time references and
full numeric precision, and emits an allowlisted redacted diagnostic. Imported
records never refill the birth form or trigger recalculation. Generation guards
prevent older asynchronous reads replacing a newer calculation, selection,
cancellation or import. Imported extensions survive export but are not rendered;
errors do not include filenames or file content. Explicit full exports contain
birth details; redaction is not described as anonymity.

- All **39 Node checks** pass with the actual loopback server. The initial
  restricted invocation had one `listen EPERM` failure; it is retained separately
  from the successful authorized local-server run.
- All **231 actual Chrome assertions** pass in the final pre-pack source run:
  ordinary natal/transit flows, 320/1280 receipt controls, actual downloaded
  bytes, 08:30 unknown-time import/re-export, mixed-version unverified claims,
  malformed/oversized files, overlap races, revoked Blob URLs, offline operation,
  no automatic storage/URL disclosure, and widget branding/fallback keyboard use.
  The two raw receipt-control viewport captures were visually inspected.
- The first browser run reported **222/223** checks, missing mobile dark widget
  focus. The original cause did not recur in focused comparisons; it is not
  labeled a proven product or timing defect. The harness now waits a bounded
  interval for exact iframe/credit focus after the first Tab, then for fallback
  focus after the second Tab, and records focus samples. It does not press extra
  Tabs or programmatically focus the credit. Initial evidence is preserved.
- **113 synthetic archive-fixture tests** pass for the decoupled verifier. The
  authoritative candidate belongs to the starter; exact archive/source bytes,
  provenance, repository paths, dependency lock, public exports, notices and
  tar/path limits remain checked. This is not yet a real rc.3 archive check.
- Independent build review caught a rejected nested ephemeris bundle being
  written before provenance validation. Build now uses `write: false`, checks
  the actual bundled module path against the locked installation, then writes.
  All six good/bad controls pass; all eight pre-existing output files remain
  byte-identical on rejection. Receipt ephemeris facts identify actual locked
  version 2.1.19, separately from the engine's dependency range.

[Evidence inputs and original hashes](evidence/starter-receipt/checkpoint-inputs.json),
[39 tests](evidence/starter-receipt/tests-local-final.log),
[final source browser](evidence/starter-receipt/browser-final-source.json),
[initial browser](evidence/starter-receipt/browser-prepack-initial.json),
[build correction review](evidence/starter-receipt/build-review-final.md),
[all-output preservation](evidence/starter-receipt/build-rejection-output-stability.json).
All chart data is synthetic. These are finite local/source checks, not fresh
archive acceptance, external developer adoption, human expert review, npm
publication or production deployment.

Fresh repository reads at this checkpoint still show site main `7f953e3f` and
SDK main `b49e0f14`. SDK #5 remains OPEN/draft at `cced0116`, zero submitted
reviews and an explicit merge/publication hold.


## Immutable receipt starter and draft #419 — September 7, 22:47 UTC

Runtime/source commit **`7da2bdb3a5bc6d65921997ba1cb79609f330c765`** was
frozen before packing. Distribution commit
**`dd5d83cdf2a2a5d7096175f01ce985b47824a376`** contains the new archive;
**`83bd8aad212e846815eebb07bd3b59fa1c28e1c1`** points setup metadata to it.
Site [draft #419](https://github.com/ZodiacsOfficial/site/pull/419) is stacked
on delivered #418. No existing artifact was replaced.

`zodiacs-platform-starter-0.1.0-rc.3.tgz` has **21 files, 56,135 packed bytes,
113,407 unpacked bytes**, SHA-256
`facafd75a8366a69dfae7397c9c2c68ee636987fb25d479ef380533408bd8d8a`.
The [immutable anonymous download](https://raw.githubusercontent.com/ZodiacsOfficial/site/dd5d83cdf2a2a5d7096175f01ce985b47824a376/public/examples/zodiacs-platform-starter-0.1.0-rc.3.tgz)
was fetched at 22:41:50 UTC and matches local bytes exactly. This supersedes
`publicDownloadVerified: false` in the earlier pack-time identity record.
[Pack inventory](evidence/starter-receipt/pack-rc3.json),
[source identity](evidence/starter-receipt/artifact-rc3.json),
[public verification](evidence/starter-receipt/public-artifact.json).

| Gate | Exact result |
| --- | --- |
| Archive verifier | Offline CLI and **113/113 tests** pass on the real rc.3 archive, including adversarial synthetic mutations of these bytes. |
| Fresh consumer | Isolated Node 22.23.2/npm 11.17.0 install, all **39 tests** and build pass; npm reports zero vulnerabilities. 3.127 seconds is internal automated timing only. |
| Packed browser | All **231 assertions** pass in actual Chrome against that fresh consumer and the exact archive hash. No fatal errors. |
| Developer pages | Actual Chrome passes all three journeys at 1280/390, keyboard focus, responsive sizing and explicitly labeled CSS zoom. Root inspected the mobile example capture; Cosmic Void styling remains intact. |
| Literal public setup | Download/checksum/install/test/build and all three own-server pages pass; **39 tests**. Existing-directory, simulated HTTP failure and deliberate expected-hash mismatch stop before tar/npm. Success took 2.2 seconds internally. Owned process group is closed. |
| Full site | **4,699 tests / 408 files** pass. Build, bundle budgets and check pass; **0 errors, 0 warnings, 11 hints**. Assistant context regenerated with no resulting source drift. |
| Preservation | Scope guard against #418 passes; protected scope untouched. Phase 1 build fingerprint remains `3998a3896d8408b2dc0b73d29c85f0822cd294c228be679c83bc08e400282cf1`. Site engine/ownership pins and account storage are unchanged. |

[All source-to-evidence paths and hashes](evidence/starter-receipt/archive-checkpoint-inputs.json),
[packed browser receipt](evidence/starter-receipt/browser-archive.json),
[literal setup receipt](evidence/starter-receipt/onboarding/onboarding.json),
[site tests](evidence/starter-receipt/starter-rc3-site-tests.log),
[site build](evidence/starter-receipt/starter-rc3-site-build.log),
[site check](evidence/starter-receipt/starter-rc3-site-check.log).

The widget focus investigation's fixed corpus did not reproduce the original
failure. Its strict positive control passes; an intentionally untabbable credit
correctly fails even when fallback focus succeeds. This validates the stronger
assertion without establishing a cause for the historical failure.
[Review](evidence/starter-receipt/focus/REVIEW.md),
[positive/negative control](evidence/starter-receipt/focus/strict-focus-control.json).

Production was read again and remains READY `dpl_BrntzbFYa2gzetKWgeq91GFeaM6W`,
`zodiacs.org`, source `7f953e3fca0e7d5009e5602a1dad69edff0f54cc`. These gates
do not represent npm publication, production release, human expert approval or
external adoption. Remote CI/preview and native-zoom checks are recorded next.


### Exact review preview and native zoom — 2026-09-07 22:53 UTC

Automatic preview **`dpl_9VqGRZZm9sXhvHe86ZjfUaaCCKQt`** is explicitly READY
for delivery source `83bd8aad212e846815eebb07bd3b59fa1c28e1c1`:
[open review preview](https://zodiacs-8ok1gtu0v-zodiacsofficial.vercel.app/developers/examples/).
Actual Chrome passes all three developer-page journeys at desktop/mobile widths
and CSS zoom. The preview's rendered setup is byte-identical to the literal
public setup already executed. Root inspected the actual desktop preview capture.
Temporary access was held in memory; the private access file was removed after
the browser closed. No access URL, cookie or browser profile is archived.
[Deployment identity](evidence/starter-receipt/preview-deployment.json),
[browser receipt](evidence/starter-receipt/preview-browser.json),
[setup equality](evidence/starter-receipt/preview-setup-equality.json).

A separate actual Chrome native-zoom run passes **40 checks** on the exact
21-file installed archive at 200% and 400%. Native settings readback, CSS viewport
and DPR establish zoom; CSS zoom remains 1. Keyboard actions reach and activate
the new export, file chooser, import and diagnostic controls, with visible focus
and no horizontal overflow. PageDown reaches the diagnostic's end; reduced-motion
preference is active. Root inspected raw 400% file-focus and final-reading
captures. The file chooser was triggered by keyboard and supplied synthetic
bytes by Playwright; this is not a manual OS-dialog test.

Both earlier harness stops are preserved: strict floating-point equality against
Chrome's 3.9999999999999996 readback, and sampling native PageDown before scroll
settled. The accepted probe uses a narrow numeric tolerance plus exact viewport/
DPR controls and 400 ms scroll settling. No product edit or extra matrix run
followed the passing result. The report records fractional layout tolerance,
exact raw captures, source/archive hashes and owned-browser/server cleanup.
[40-check receipt](evidence/starter-receipt/zoom/result.json),
[method and limits](evidence/starter-receipt/zoom/REVIEW.md),
[original input mapping](evidence/starter-receipt/zoom/normalization.json).

CI run **34167746529** targets `83bd8aad`: 13 jobs currently pass and Build &
Check remains running. A passing whole-run result is not claimed at this
checkpoint. Browser Evidence is conditionally skipped, distinct from the actual
local and remote browser checks recorded above.


## GeoNames schema/cache candidate delivery — September 7, 23:13 UTC

The next independent A02/A03 correction is delivered in SDK
[draft #9](https://github.com/ZodiacsOfficial/sdk/pull/9), stacked on #8. Source
`d190d97c981c7cacc6eb4ab6a49bdb8451ca3459` validates compact v1 JSON before cache
fulfillment and returns metadata array snapshots. Malformed successful responses
can be retried explicitly, while valid/in-flight caches and original transport
errors are preserved. The root/ownership code and site's engine rc.1 and starter
engine rc.3 pins remain unchanged.

Separate engine **0.1.1-rc.4**, **22 files / 33,669 packed / 112,949 unpacked
bytes**, SHA-256
`0146fdff7abb6b937cf4d66b4cdaf0c80ecf238ea71f1f4f9fb27eae687a0d20`, is distributed
at `9ad6a73984e69b897a6422429fab1970a7c89450`. The
[immutable public artifact](https://raw.githubusercontent.com/ZodiacsOfficial/sdk/9ad6a73984e69b897a6422429fab1970a7c89450/artifacts/zodiacs-engine-0.1.1-rc.4.tgz)
was anonymously verified at 23:08 UTC.

All **496 workspace tests / 30 files** pass on Node 20/22. Required build,
typecheck/lint, format, checksum, neutrality, TypeDoc, exports/contents/dry-pack
gates pass. Two clean packed consumers pass public TypeScript, ordinary engine/
receipt behavior and new HTTP-200 recovery/mutation controls; isolated audit is
zero. The 96 exact chart comparisons match rc.3 apart from version. All 33,934
checked-in rows validate, with baseline results/metadata/request order retained
in 27 sampled queries. Nine independent strict-unhandled-rejection probes and
20 actual Chrome packed-consumer controls pass.

[Complete SDK evidence at its browser checkpoint](https://github.com/ZodiacsOfficial/sdk/blob/ef846c82dd284559f1574f69ee901a221a7a722a/docs/platform/EVIDENCE.md#geonames-schema-and-cache-integrity-candidate)
retains pre-fix failures, exact hashes, commands, model review and harness
corrections. All browser responses are synthetic. Fixed GET resource paths omit
full query/birth data but reveal the normalized initial through shard selection.
Validation cannot authenticate geographic facts or detect in-range table indices
from another dataset generation; a concrete mismatch is tested/documented.
No host-dependent timezone rejection, automatic retry, eager requests, new
response-size budget or custom-fetch sandbox is claimed.

Fresh 23:08 UTC reads retain site main `7f953e3f`, SDK main `b49e0f14` and SDK
#5's OPEN/draft/zero-review merge-publication hold at `cced0116`. Npm engine/
widgets return 404; optional ownership remains 1.0.1. No merge, npm publication,
production operation, external outreach or adoption occurred. Stacked SDK CI
does not trigger; passing local evidence is not called CI success.


### Receipt starter exact-source CI complete — 2026-09-07 23:21 UTC

Site Check run [34167746529](https://github.com/ZodiacsOfficial/site/actions/runs/34167746529)
completed successfully for delivery source
**`83bd8aad212e846815eebb07bd3b59fa1c28e1c1`**: **all 14 jobs pass**. This
supersedes the running-job snapshots above. The long Build & Check job completed
its existing source, numerical, fresh-consumer, cross-page, visual, performance
and widget acceptance steps; it was not cancelled to push evidence updates.
[Exact source/job outcomes](evidence/starter-receipt/ci-final.json).

Subsequent site commits only record verification and the separately delivered
SDK candidate. They do not change this tested runtime, archive or metadata.
The exact READY preview already tested uses the same `83bd8aad` delivery source.
The conditionally skipped Browser Evidence workflow is not counted as a passing
browser run. No merge or production deployment is implied by all-green CI.


## Stage A public flags and civil settings — SDK rc.5

Delivered [SDK draft #10](https://github.com/ZodiacsOfficial/sdk/pull/10), stacked
on #9, from `codex/platform-input-flags`. Source
`97f5e8d01828f4b85ffa845825dee9acff4695e4`; archive carrier
`333369256af683c560603dd1e6411dd7a07adb1f`; final acceptance evidence
`785e3ea154c28e890ecc97ce2284ee3e9f48a4a7`. The
[anonymous immutable artifact](https://raw.githubusercontent.com/ZodiacsOfficial/sdk/333369256af683c560603dd1e6411dd7a07adb1f/artifacts/zodiacs-engine-0.1.1-rc.5.tgz)
was verified at 23:49:36 UTC: 23 files, 36,065 packed / 121,212 unpacked bytes,
SHA-256 `1809c1686843a6be148eb185535e32059a20c35896e29ccfc7583a6b2738da65`, integrity
`sha512-XUmtZ+mOwMJxElr6hbhQ59cPatvsPa8/XrLfihZfdsQnMZgptlTZSV6YBRVr+Nqps0No64HUpYLXNhUoeCVzNA==`.

Correct typed no-time/polar-fallback echoes previously duplicated result flags
and failed receipt creation. Malformed/private/contradictory flags could enter
result metadata, and civil/public settings were not consistently captured after
validation. The original-source final regression suite reproduced 61 failures
with 5 valid controls. The implemented compatibility policy preserves the five
public values, bounds raw arrays at 64 data entries, deduplicates valid claims,
checks derived assertions, and records canonical semantic metadata once.
Public/civil settings are captured once; invalid civil settings reject before
Intl. Supplied Charts receive flag consistency checks and optional shallow
normalization, retaining canonical identity and numerical references.

Root executed all required SDK gates; build/typecheck ran sequentially. **562
workspace tests / 31 files pass on Node 20.20.2 and 22.23.2**. Two actual fresh
packed consumers pass TypeScript 5.9.3, exports/notices, optional isolation,
existing GeoNames/receipt examples and the new flags/settings/identity controls.
Isolated audit is zero. Installed rc.4→rc.5 matches **480** synthetic numerical
cases excluding only engineVersion; **480** extra duplicate/result echo cases
and receipt replay pass with ephemeris 2.1.19 on both.

An independent tool-backed reviewer passed 14 frozen-source adversarial controls,
including Saturn costs: ordinary inputs add zero natal calculations, explicit
raw polar assertions add one to verify actual fallback, and supplied Charts add
none. Actual Chrome 152 passes **26 aggregate packed-browser acceptance checks**,
including 14 API groups. All 23 installed archive members match. Optional geo/
receipt graphs exclude ephemeris/ownership; root excludes optional code. Four
static GET resources load, then all API cases run offline with zero observed
fetch/storage attempts, cookies or browser/console/CSP errors. Privacy observers
are proven with negative controls. Valid civil cases intentionally use Intl.
Owned browser/server resources are closed.

[Exact source, commands, raw logs, controls, graphs, captures and limits](https://github.com/ZodiacsOfficial/sdk/blob/785e3ea154c28e890ecc97ce2284ee3e9f48a4a7/docs/platform/EVIDENCE.md#public-flags-and-civil-settings-candidate).
Original harness errors are retained: baseline Intl spy corrected before the
final red suite; first real pack failed inherited npm cache EPERM before an
archive existed and succeeded with isolated configs/cache; first browser session
name exceeded macOS's socket limit and was shortened before candidate execution.
No source or test tolerance was changed to hide those environment/harness errors.

Time flags remain historical claims; precomputed numerical values are not
authenticated. Same-realm executable getters/proxies are not sandboxed. Finite
parity is not an astronomical accuracy guarantee. Dependency lock, receipt schema, numerical formulas, older archives and
ownership behavior are unchanged by the new wrapper validation. The site retains engine rc.1 and starter
rc.3 retains engine rc.3 at this checkpoint. A new site pin is being prepared
separately; no account storage/wire migration is active.

Remote refresh at 23:41 UTC still shows site main `7f953e3f`, SDK main `b49e0f14`,
SDK #5 draft at `cced0116`, zero submitted reviews, explicit merge/publication
hold, engine/widgets npm 404, ownership 1.0.1 and unchanged READY production
`dpl_BrntzbFYa2gzetKWgeq91GFeaM6W`. No merge, npm publication, production release,
external adoption, outreach, spending, access change or destructive action.

## C02 local request loss and old-writer counterexamples

An independent synthetic in-memory probe at site `921cd0d1` imports the actual
engine/profile store/read/handoff and account wire/fingerprint functions. Its
save projection mirrors and checks the current calculator source mapping; it
does not claim to drive the calculator UI. **Two expected assertions fail**:
polar requested Placidus saves/reruns as Whole, and a subsequent explicit Whole
request updates the same record instead of retaining two distinct requests.
**Three controls pass**, proving old writers hide/overwrite a same-key version
bump, discard additive metadata on ordinary re-save, and produce identical v1
wire bytes/fingerprints for the different requests. Zero account/network calls,
real browser storage writes or shared source edits occurred.

[Probe command and exact qualification](evidence/c02-next/README.md.log),
[observations/source hashes](evidence/c02-next/observations.json.log),
[executed synthetic probe](evidence/c02-next/probe.test.ts.log),
[versioning comparison](evidence/c02-next/DESIGN.md.log).
Decision C-006 chooses a version-owned source with explicit legacy/downgrade
behavior. First integrate the existing SDK receipt capability through a tested
site artifact adoption; do not duplicate its schema or infer missing legacy
intent. Active storage/access/export/delete/sync wiring remains engineering work,
with future server capability/CAS/idempotent-replay handling separately reviewed.


## Site rc.5 adoption and current-edition integration

Site `codex/platform-engine-rc5` starts at delivered #419 `ba65375a`. Source
`4c93a104` adopts the exact SDK archive; `7266b131` merges main `d4d5717d`.
[Artifact identities and finite numerical evidence](evidence/site-engine-rc5/README.md),
[247-check author acceptance](evidence/site-engine-rc5/implementation/REVIEW.md.log),
[fresh independent review](evidence/site-engine-rc5/independent-review/REVIEW.md.log).

The independent reviewer executed 291 bounded checks on each Node 22.23.2 and
24.19.0, including 133 site chart comparisons, 192 scanner value comparisons,
72 house configurations, graph/export isolation and 85 hostile metadata cases.
All 23 installed members, four immutable evidence files and 265 preservation
files match. The anonymous SDK archive and immutable source documentation were
fetched again. This does not independently rebuild SDK source or authenticate
imported receipt claims. The twelve frozen reviewed source hashes remain equal.

Root regenerated current September 8 provenance with `npm run editorial:daily:build`.
Only the engine version and generator hash changed; publication and astronomy
bytes are preserved. All other upstream content files are byte-identical to
main; [hash record](evidence/site-engine-rc5/release/upstream-integration.json).
The exact one-time protected-scope allowance covers twelve inherited Registry
pages against stacked base `ba65375a`; no scope-guard logic was changed.

Node 22: **4,717 tests / 408 files pass** with file parallelism disabled;
`npm run build`, `npm run check` (zero errors/warnings, 11 hints), and exact-base
scope pass. The unchanged capture driver produced 18 current-edition images at
360/1280. Six are byte-identical to the prior edition; one image's height changes
with daily content. No baseline threshold, fixture or numerical policy changed.
[Commands/timing/logs](evidence/site-engine-rc5/release/gates.json),
[image comparison](evidence/site-engine-rc5/release/phase1-image-comparison.json).
The carried preceding full attempt (4,712 passes, five stale-evidence/timeouts)
is retained as a qualified observation in git history; its unarchived temporary
log was lost with the environment reset and is not represented as a raw receipt.

Desktop/mobile developer pages and all 12 share journeys pass. New native zoom
acceptance found an actual 320px overflow from the long inline terminal URL.
A single `.dev-note code { overflow-wrap: anywhere; }` rule corrects it without
changing shared design or code-panel scrolling. The rebuilt candidate passes
30 actual Chrome 200%/400% checks, with eight captures, zero page errors and owned
profile/preview cleanup. Native viewport widths are 640/320, DPR 2/4, and CSS
zoom remains 1. The regular developer driver now covers 320px as well.
[Native result](evidence/site-engine-rc5/release/native-zoom/result.json).

Preserved harness failures: the new archived-reference link invalidated an old
Tab predecessor; the driver now follows the real final link. The new native
harness assumed a 2px outline for both regions, whereas the unchanged shared
CSS specifies 1.5px and support specifies 2px; it now checks both exact values.
A diagnostic launched alongside another owned Astro preview failed its shared
preview lock before page execution, then ran sequentially. Original results,
captures and harnesses remain under the release evidence directory.

The whole-site macOS visual command reports 15 mismatches against existing
baselines. It is **failed, not passed**; a separate prior-candidate control is
in progress. No baseline update or blanket release-ready claim is made. CI and
preview verification remain pending. Production/source/package states were
refreshed through read-only operations in
[release-refresh.json](evidence/site-engine-rc5/release/release-refresh.json).


### Independent classification of macOS visual failures

The control starts from exact delivered #419 `ba65375a`, installs rc.1 from its
unchanged archive with separately copied dependencies, inherits the same 22-file
September 8 upstream update, and regenerates its own rc.1 manifest. Its full
build passes. The original visual suite reproduces **all 15 failures**, with
exactly the same dimensions as the rc.5 candidate. **13 PNG pairs are byte-identical**;
all **15 pairs score zero differing pixels at the unchanged pixelmatch 0.1
perceptual threshold**. The original 0.1% maximum-difference gate was retained.
The two home desktop pairs have raw channel differences, mostly 1/255 and at
most 20; no cause is invented. Four corresponding images and raw distributions
are included, alongside hashes/results for every case.

[Control source, commands and qualification](evidence/site-engine-rc5/visual-control/REVIEW.md.log),
[copy manifest](evidence/site-engine-rc5/visual-control/manifest.json).
No baseline is replaced or represented as passing. This finite comparison shows
no new scored drift on those routes; it does not approve new baselines or certify
unexamined routes. The actual developer-note overflow is separately corrected
and passes 320px and native 400% acceptance.

Draft [#422](https://github.com/ZodiacsOfficial/site/pull/422) is delivered at
`8ee0e0183a3c4437af902858b1d76678d3e961a3`. CI run 34186236252 is active;
13 jobs currently pass and Build & Check is still running. Exact-source preview
verification is active. All four newly public site evidence URLs were downloaded
without credentials and matched the immutable carrier bytes; see
[public evidence verification](evidence/site-engine-rc5/release/public-evidence-verification.json).


### Exact-source #422 preview acceptance

Vercel deployment `dpl_BsA6EAM83MD2vyAHiSAsVNzTwPm9` is **READY** for exact
runtime source `8ee0e0183a3c4437af902858b1d76678d3e961a3` at
https://zodiacs-kanwjkp9y-zodiacsofficial.vercel.app. Actual Chrome 152 passes
**13 checks**: all three developer routes at 1280/390/320, support keyboard
focus/current artifact/version/archived links, synthetic birth-chart results
identifying rc.5 with no saved profile, and the September 8 shared-sky endpoint.
[Deployment receipt](evidence/site-engine-rc5/preview/deployment.json),
[browser result](evidence/site-engine-rc5/preview/result.json).

The initial unauthenticated browser received Vercel's login page and failed
its site-footer expectation. It is retained as an access failure, not product
acceptance. Temporary Vercel access was used in an isolated browser; auth URLs
and cookie values are excluded from evidence, the browser closed, and the
mode-600 credential file was deleted. No production/account operation occurred.

A later read at 04:20 UTC finds site main `75d036ae`: the scheduled updater
refreshed 18 Registry files after #422 was pushed. No daily/calculation code
changed; this candidate leaves all 18 paths unchanged relative to common
ancestor `d4d5717d`, so they must retain the newer main version on integration.
This is a separate upstream evolution, not a candidate deployment or permission
to overwrite Registry records. The next slice stays on the reviewed stack.


## C02 optional portable calculation boundary

Owner coordination refresh: separate Astrofolio draft
[#416](https://github.com/ZodiacsOfficial/site/pull/416) is at `b17d6804960b6b30bb48208aff0f783b03768152`.
Its actual changed paths are confined to the isolated view, local verification
modules, scoped tests and `docs/astrofolio-trust/`. Shared-file proposals are
stored as unapplied patches in that documentation directory. This is a path
inspection, not a content approval or integration. Root keeps the platform and
shared-file role; no direct communication with the other session is assumed.
[Exact draft/path checkpoint](evidence/coordination/astrofolio-20260908.json).
Its verification release remains reviewable independently of the SDK hold.

Branch `codex/platform-portable-calculation` starts at delivered #422 evidence
head `6ab85278bea708337e20947966a54a5072ad0627`. The exact four-file source
patch SHA-256 is `69a5fa55efbf961bb2760bffec4edfdc16ee6df575a84045961fe4e9ee5bbb45`.
`computePortableChart` executes public `natalChart` once, supplies that complete
Chart to the existing SDK codec, and uses the shared pure mapper for the legacy
compact shape. Full.ts preserves original input identity and angle/house/aspect
references. The optional module is outside existing eager math/UI/account graphs.

The validated receipt supplies canonical requested settings and an ISO-string
instant, so replay input does not lose Placidus intent on Whole fallback or an
explicit unknown-time 08:30 instant. Receipt/snapshot JSON is recursively frozen
and detached from mutable chart/Date/flag/context branches. Explicit source/time
context is validated after calculation; it is not an atomic entry-time snapshot
across executable caller getters or authenticated historical provenance. Errors
have fixed message/code without inspecting or retaining private raw exceptions.
No active store, export UI, account protocol, migration or hosted route is added.

[Author source and exact commands](evidence/portable-calculation/implementation/README.md.log),
[independent review](evidence/portable-calculation/independent-review/REVIEW.md.log),
[raw copy manifest](evidence/portable-calculation/copy-manifest.json).
Author: 80 focused checks and strict TypeScript pass. Independent bundled Node
review: 11 actual probe groups pass, no fake engine/receipt results. Root repeats
80 focused checks on the actual installed package. Earlier scratch dependency
symlink resolution failure and the byte-identical local dependency copy are
retained; no implementation or tolerance was changed to hide that failure.

Root full suite: **4,738 tests / 409 files pass** on Node 22.23.2. Full production
build passes, including budgets and engine isolation. Regenerating daily evidence
produces no changed data/provenance bytes. The original acceptance driver refreshes
the source fingerprint to `fae58360fb1dcb1c320061c0705580637359fbc3ac5ab9fc44677dd750a7c7e7`;
all 18 captured PNGs are byte-identical to base `6ab85278`.
[Release commands/results](evidence/portable-calculation/release/gates.json),
[exact capture equality](evidence/portable-calculation/release/capture-parity.json).
Root check passes with zero errors/warnings and 11 hints; exact stacked scope
protection and all 12 chart-share browser cases pass. The affected three chart
visual cases reproduce their pre-existing dimension failures. Two images are
byte-identical to rc.5 source `8ee0e018`; all three have zero scored differences
at original threshold 0.1. The ordinary desktop pair has 53,050 raw differing
pixels (maximum channel delta 24), with both images retained. No new masks,
tolerances or baseline replacement were used.
[Chart comparison](evidence/portable-calculation/release/chart-visual-parity.json),
[original failing gate](evidence/portable-calculation/release/visual.log).
Actual Chrome 152 acceptance passes **12 browser groups and 42 observer negative
controls**. Native precise coverage measures exactly one `computePortableChart`,
public `natalChart`, internal `computeChart` and `createNatalEnvelope` call for
the measured calculation, without replacing their implementations. All 23
installed package members match rc.5; the real 11-module bundle excludes geo
and ownership code. Three static local GETs load the harness, then all cases
run offline with zero observed runtime network/storage/cookie/Intl activity
and no page/console errors. Empty storage/cookies and owned cleanup are verified.
These are synthetic isolated-module cases, not active save/account acceptance.

[Browser scope and exact source identities](evidence/portable-calculation/browser/README.md.log),
[30-file raw copy manifest](evidence/portable-calculation/browser/copy-manifest.json),
manifest SHA-256 `8bdcc73e9544c58727bb2e1a884e89fe25b673e95b36894e6b18408b6e2de464`.
The first successful narrower-observer run, final strengthened run and
post-interruption cleanup verification are retained. The tested four source
files still match the independent frozen patch. Draft [#425](https://github.com/ZodiacsOfficial/site/pull/425)
is delivered at `dcc4e437a99f812666cd19dc85e6d781dbb3bedc`. Its exact-source
CI run 34187725308 is in progress. Exact-source Vercel preview
`dpl_5X7uR9haSVZFWS8aNqYt9MtJBJ8z` is **READY** at
https://zodiacs-qi1su4rwh-zodiacsofficial.vercel.app and passes **13 browser/API
checks**: developer paths at 1280/390/320, keyboard/current artifact/archived
reference checks, synthetic chart output on rc.5 without saving a profile, and
the actual September 8 sky endpoint. The changed compact adapter executes in
those actual chart journeys; the optional receipt module's actual browser
acceptance is the separate synthetic offline harness above.
[Preview receipt](evidence/portable-calculation/preview/deployment.json),
[actual results](evidence/portable-calculation/preview/result.json).
Temporary protected-preview access was isolated; cookies/auth values were not
archived, the browser closed and its credential file was deleted. Publication,
production deployment and external adoption are not claimed.

## C02 saved-record dependency and implementation direction

The refreshed independent investigation runs **nine Node controls and four
native Chrome controls** against twelve unchanged boundary-source files. It
reproduces an allowed old-writer interleaving where both saves report success
but one chart is lost; an invented global key escapes actual account handoff,
isolation and deletion. Native IndexedDB demonstrates atomic transaction/cap
behavior, the incompatibility of upgrading the existing Living Chart database
for old version-1 readers, and that closing a database inside an active
transaction still allows that transaction to commit.

[Exact contract and activation dependencies](evidence/saved-record-design/DESIGN.md.log),
[reproductions and native evidence](evidence/saved-record-design/EVIDENCE.md.log),
[34-record manifest](evidence/saved-record-design/manifest.json), SHA-256
`63f1401aa3a940208f8caf89ab5d1321f5e5bd45495abc8e8d504343c82096ee`.
These are synthetic counterexamples and a bounded architecture decision, not
implemented account lifecycle coverage. A separate author is implementing
Decision C-008's optional immutable profile store on source `dcc4e437`, without
UI/account activation or changing existing databases. The next review must
exercise actual transaction aborts, capacity, corruption, owner/epoch changes
and stale completion behavior before integration.


### Completed rc.5 adoption CI

Exact-source run [34186236252](https://github.com/ZodiacsOfficial/site/actions/runs/34186236252)
completed successfully: **all 14 jobs pass** at runtime source
`8ee0e0183a3c4437af902858b1d76678d3e961a3`, including the full build/browser/visual/
performance gates on the hosted runner. This does not relabel the separately
recorded local macOS baseline failures as passed, or transfer source CI to later
documentation-only heads without qualification.
[Final job/step receipt](evidence/site-engine-rc5/release/ci-34186236252-final.json).

### Saved-record draft review, before integration

Root captured the unfrozen first record implementation at SHA-256
`4538cb6400bdb6059e257cd8c8680f77cdbd9d8e1fe4b1f277c8170748c16074` and executed
it with the real installed engine/receipt functions. Unlabeled creation succeeds
but reread fails because the parser counts one too many required keys; labelled
control succeeds. A future `v10` record is misclassified as corrupt while `v2`
is recognized as unsupported. Both findings were sent to the author for fixes
and regression tests before source integration.

Root's static suspicion about a trailing newline in IDs was **disproved**: the
existing JavaScript expressions reject it without multiline mode. The initial
probe wrongly expected acceptance, failed that assertion, and is preserved as
a harness/reviewer mistake. The corrected probe records both negative controls;
there is no claimed pre-existing UUID vulnerability.
[Actual draft probe](evidence/saved-records/root-review/result.json),
[raw evidence manifest](evidence/saved-records/root-review/manifest.json).
This early review is not final saved-store acceptance or active lifecycle coverage.


### Completed portable-calculation CI

All 14 jobs pass in exact-source [CI run 34187725308](https://github.com/ZodiacsOfficial/site/actions/runs/34187725308)
at `dcc4e437a99f812666cd19dc85e6d781dbb3bedc`, alongside its previously verified
READY preview. [Final job receipt](evidence/portable-calculation/release/ci-34187725308-final.json).
Later documentation heads are distinct from this tested runtime source.

### Frozen saved-record store acceptance

Root integrates the exact four-file patch
`5d61510dec09e42ad2196c173da5a88f206a85af5809a27562b1daf0cc2f83a5`
onto `c761a49c55d125bca48ff38d81b0a9ff6fd5adcf`. The optional profile store
uses its own owner-indexed IndexedDB database, immutable validated SDK receipt
strings, fresh UUIDs and a 40-record limit enforced with insertion in one
transaction. It exports the stored envelope without local record/owner metadata.
There is no eager database open, v1 write, legacy projection, UI/account
activation, remote sync or shared-file/Astrofolio change.

It passes **74 focused tests** (49 new / 25 existing), strict TypeScript and
**22 independent actual Chrome cases**. Native review proves transaction abort
before commit, honest `mayHaveCommitted: true` after a real commit, prompt
revoked-open settlement while another deletion stays blocked, late connection
cleanup, native concurrent capacity, owner partition, future/corrupt rows and
controlled quota rollback. The quota override is limited to one disposable
origin and verified restored; no disk filling or user data is involved.

[Author evidence](evidence/saved-records/implementation/EVIDENCE.md.log),
[27-file manifest](evidence/saved-records/implementation/copy-manifest.json), SHA-256
`1b7e7cee56516cd13510b6cfa5b3134643cfced1abae716fb14ce07b64761ef2`.
[Independent review](evidence/saved-records/independent-review/REVIEW.md.log),
[45-file manifest](evidence/saved-records/independent-review/manifest.json), SHA-256
`8d6e5fdb5fffb5907b434fc3057f9a486f632a3b577836b89a7f5defc4a9c4ec`.
Initial parser failures, type-invocation omission, logical-open hang and the
disproved newline suspicion remain preserved and correctly attributed.

Root full acceptance: **4,787 tests / 411 files**, production build, check of
1,038 files (zero errors/warnings, 11 hints), exact-base protected-scope guard,
and 18 fresh captures. All PNGs are byte-identical to the base. Fingerprint
`8adaac8fafb4b52174722e0da00854ae23c5eaa1ef9132de377fccc85eb5d435`.
The first full run was ordered before the required capture refresh and correctly
failed one stale-fingerprint assertion (4,786 other tests passed). Root preserved
it, ran the original build/capture driver, and repeated the full suite to a clean
pass. No assertion, capture policy, tolerance or baseline was changed.
[Commands and exits](evidence/saved-records/release/gates.json),
[exact capture equality](evidence/saved-records/release/capture-parity.json).

A clear consumes only its own handle; another handle may create afterward.
Application authority callbacks are not authentication. Asynchronous inventory,
verified owner/access leases, guest/retained scopes, account handoff/export and
durable deletion/retry must be integrated before active saving. The explicit
local receipt-export UI is a separate next prerequisite, independent of this
store's implementation. This entry does not claim draft delivery, CI or preview
for the saved store, account lifecycle completion, publication or adoption.


### Saved-record draft delivery

Draft [#426](https://github.com/ZodiacsOfficial/site/pull/426), source `a0bf55176dd4df4d27763bfeb2cf97e36abe4d15`,
is pushed on `codex/platform-saved-records`, stacked on #425 at `c761a49c`.
The actual created draft and changed-file list are verified in
[the PR receipt](evidence/saved-records/release/draft-pr.json). Exact-source
CI run 34190846700 and automatic preview are running; neither is yet claimed
passed in this entry. No active saving, production, publication or merge occurred.


### Saved-record CI and exact preview accepted

All14 jobs pass in [exact-source CI34190846700](https://github.com/ZodiacsOfficial/site/actions/runs/34190846700)
at `a0bf55176dd4df4d27763bfeb2cf97e36abe4d15`.
[Final receipt](evidence/saved-records/release/ci-34190846700-final.json).
READY preview `dpl_bhx76pgozg4Djw3mbBayzay7VrxS`,
https://zodiacs-9wi4nsxk8-zodiacsofficial.vercel.app, matches that exact source and
passes13 actual browser/API checks across developer routes at1280/390/320px,
keyboard matrix navigation, synthetic chart/version/no-save and September8 sky.
[Deployment](evidence/saved-records/preview/deployment.json),
[results](evidence/saved-records/preview/result.json),
[driver](evidence/saved-records/preview/verify.mjs.log).
The metadata-only first write failed on JSON null in a Python literal and was
corrected with json.loads; no product or browser acceptance changed. Temporary
preview access was isolated, browser closed and auth file removed.

### Historical time correction delivered in the SDK

Separate [SDK draft #11](https://github.com/ZodiacsOfficial/sdk/pull/11) delivers
engine rc.6, source `fb57af7a2cd7c30983cc8fb655183d5a11f9cf30`, carrier
`51129a197cd3f2a2a8c966fb797ea4da1e147b3d`, evidence head `ac27761e`.
Actual SDK/site baseline minute-only matching missed historical seconds-sized
gaps and reported false folds nearby. The SDK correction keeps Gregorian
formatting and matches seconds/milliseconds, retaining historical offset seconds,
strict guards and existing sampled-offset policies. Root579 tests on Node22/24
and required workspace gates pass; two fresh consumers use the exact23-file
archive, SHA-256 `09c3e63432f8ba2e9df05af137c42f65ab039740a207a89418d9e6470ea3db3e`.
Anonymous public archive bytes match. Independent copied-source review passes
278 Node/37 actual Chrome cases,140/15 expected flag corrections, zero tested
instant/offset/numerical changes and seven receipt/replay controls per runtime.
[SDK raw evidence and limitations](https://github.com/ZodiacsOfficial/sdk/blob/ac27761e6dea138842e6ef5c2c69129ead7af636/docs/platform/EVIDENCE.md#historical-local-time-precision-candidate).
The site remains on rc.5; artifact availability is not npm publication, site
adoption, deployment or human expert review. Existing SDK#5 hold remains.

The independent search separately reproduced incorrect local-date endpoints:
Toronto1919-03-31 starts30minutes too late, Apia2011-12-30 is empty, and the
library's year0000 rollover remaps to1900. These are distinct next engineering
requirements, not fixed by precise birth-time matching. Evidence and the
bounded follow-up plan are retained with the SDK review packet.

## 2026-09-08 — receipt export integration, release gates pending

Source base is #425 documentation head `c761a49c55d125bca48ff38d81b0a9ff6fd5adcf`.
Receipt Freeze 2 patch is `d6639f7bd46ed9adce30c1d1f374394356350593234dacdcc82baa20086fa425`;
Interaction Freeze 1 is `b44a9b79db41a48ededa2e172f44f11512e59b177c4ecb110ab5883e5ad28110`.
Root verifies all 18 frozen source/test bytes after integration; only the exact-base
eight-path localization scope allowance is additional implementation metadata.

Copied payloads are byte-verified against the original sealed deliveries:

- [Author manifest](evidence/receipt-export/author/manifest.json): 153 records;
  SHA-256 `5918aeed0df8514d9bed705d216f5e664210e3353355c42c5be4ecedeb954f7a`.
  126 focused tests, 2,136 same-host zone/extreme compatibility cases, 16 native
  interaction controls, 12 receipt flows and existing Russian route drive pass.
- [Independent browser review](evidence/receipt-export/independent-review/REVIEW.md.log):
  253 records, manifest SHA-256 `7963d05c842b7715a86662ea01cd611216143ee10b25027c1f3ea442b23dd2c7`.
  31 full-site groups plus two native select controls pass, including native 400%
  zoom, all six locales, stale retained clicks, delayed module/revocation, no
  duplicate calculation after serialization failure and actual parsed downloads.
- [Independent bundle review](evidence/receipt-export/bundle-review/REVIEW.md.log):
  28 records, manifest SHA-256 `166f82317e649196e54715445c9d5a03a8a7ecb3b9a54f9458e16cad5355dc0c`.
  All 23 expected outcomes pass: 17 rejections, four positive controls and two
  documented data-flow limits. All 56 archived fixture budget files retain the
  original bytes. [Root iterations](evidence/receipt-export/bundle-author/) retain
  initial failures, 26 final passing fixtures and real-site measurements.

Russian initialization, draft select reordering, escaped/parenthesized/CDN
imports and source whitespace failures were found and corrected. Failed harness
assumptions and raw-build preparation failures remain separately identified.
No tolerance, visual baseline, numerical result or size budget was loosened.
Root production-build/capture/test/check/scope results and draft/preview status
remain pending; independent local source acceptance does not establish them.


Root integrated acceptance now passes: normal build; 4,816 tests / 412 files;
check across 1,038 files with zero errors/warnings and 11 hints; exact #425-base
scope with the eight named locale paths; 18 captures byte-identical to #425;
16 native interaction controls; 12 receipt download groups; 12 existing share
cases; and the full Russian drive (26 public routes plus noindex 404, 360/1280).
The original affected macOS chart visual gate retains three pre-existing
height failures. All three current image hashes match the preceding #425 record;
comparison with the retained rc.5 control scores zero at threshold 0.1, with no
new masks, baseline updates or tolerance changes. The first local browser launch
failed under the filesystem sandbox; the identical driver passed with the normal
isolated Chrome launch permission. No automatic approval rejection occurred.

[Root acceptance](evidence/receipt-export/integration/result.json) and its linked
[raw manifest](evidence/receipt-export/integration/manifest.json) retain exact
source/build/capture identities, scripts, logs, synthetic parsed downloads and
images. Full engine static closure is five chunks, 23.3 KB under the unchanged
25 KB limit. The root reviewed Russian and native 400% screenshots: the receipt
control and sensitive-file note remain visible and keyboard accessible.

Fresh remote reads retain site main `75d036ae365a4c469e234046b0592a80f0dbc311`,
Astrofolio #416 draft head `b17d6804960b6b30bb48208aff0f783b03768152` with only
its assigned isolated paths and unapplied documentation proposals, and SDK #5's
explicit hold at `cced011659d48877b8b73b8a85796815234cf741`. No Astrofolio integration
or shared-source expansion occurs. Production still serves that main release.


Draft [site #427](https://github.com/ZodiacsOfficial/site/pull/427) is delivered
at source `804c70309d2508e67e8462df526b5f9e71a112e9`, base #425 `c761a49c`.
The actual paginated 621-file list matches the local diff exactly, including
19 implementation/test/scope paths. The initial summary API returned only the
first 100 evidence files; the full paginated record is retained in
[release](evidence/receipt-export/release/). Site Check run 34195946291 is in
progress. Preview `dpl_CdGmdz6nP8HhCm4TX8WQ7epja2JH` is building from that exact
source. Neither pending state is a passing hosted acceptance result.


The exact-source #427 [READY preview](https://zodiacs-c3afqubvj-zodiacsofficial.vercel.app)
now passes all 12 receipt groups, including six localized keyboard downloads,
fresh polar fallback, repeated calculation, stale retained click, fixed private
allocation failure/retry, explicit unknown local noon, fixed-offset/history/pole
unavailability and positions-only isolation. Downloaded files pass the actual
rc.5 codec. Observed storage and calculation counts do not change on download;
Blob URLs are revoked. [Preview records](evidence/receipt-export/preview/) retain
synthetic files, screenshots, exact driver/results and source deployment identity.
Remote served-file hashes are explicitly unavailable; the provider's commit
identity is recorded rather than inferred from local build bytes. Contexts closed
and temporary preview credentials were deleted. Hosted CI has 13 passing jobs;
Build & Check remains in progress. No production/account/publication action.


Preview privacy qualification: the hosted site's existing Plausible loader was
requested and blocked by the isolated test harness in each of the 12 contexts;
there were no other recorded external requests or page errors, and no observed
non-GET requests. This is not a claim that the entire hosted site makes zero
external requests or that existing analytics ran in the test. Receipt download
itself adds no analytics or remote endpoint; local and independent observer
checks, with their scope and negative controls, remain the privacy evidence.


The separate [date-coverage review](evidence/local-date-endpoints/review/REVIEW.md.log)
is preserved as 71 byte-verified records; manifest SHA-256
`f3a9c0b7a4fc73d4f32ed0bd3af2754e79f38e241306b4f266aae1f08d146cb8`.
Seventeen actual controls each on Node 22 and Chrome find nine helper mismatches.
Native Chrome Temporal transition enumeration agrees with all 17 interval sets;
this shares host timezone data and is not independent historical evidence.
Two synthetic hidden-transition schedules disprove unconditional completeness
and empty-date claims for hourly Intl sampling. This evidence led to an inactive,
separately authored complete-provider API prerequisite, not a change to #427 or
an activation of unreviewed unknown-time behavior.


## 2026-09-08 — rc.6 site integration underway

Real evidence-only commit `68412f16140f9986b11767d271eda6e14b6aba48` precedes
the runtime adoption and carries the four actual metadata evidence records.
Source8 patch `bb8cfee75e5602da24067f44bdd8e49d295f9025f7ceab4dc8db701305b3dc93`,
#427 receipt companion2 `95f0a05ed8faa02797785c5ead8d42fee3d12e4d3e708b4ad5857b952f70d1cb`,
and coordinated metadata3 `3b361b824a20e94a623a9327ad5fd74afe8ba9e2f334dfbb35eae9b6e5d1ae36`
match their frozen file hashes. Offline installation changed one package; npm
also rewrote unrelated lock metadata. The initial identity check caught it,
the unwanted lock diff was retained, and the exact reviewed lock bytes restored.
Every one of the 23 installed package files then matched the actual archive.

[Author evidence](evidence/site-engine-rc6/author/AUTHOR-REVIEW.md.log) has 80
byte-verified inert records; manifest SHA-256
`c0e147382d479a9f97c6a99f1f2b57290b11b630edabc29ec80d512d241aa63a`.
Both Node versions and Chrome execute 16 corrected historical receipts, nine
civil controls and 96 same-input rc.5/rc.6 numerical comparisons. Native Chrome
also exercises 13 observer controls before zero observed network/storage/cookie
calls. The independent fresh public consumer/declaration record is separately
attributed. [Independent source review](evidence/site-engine-rc6/independent-review/REVIEW.md)
has 36 byte-verified records, manifest SHA-256
`6cc5528ada16af1120c65843a639ec9690067b2c29100c578d23c3857590d48e`.
Each Node version passes 278 retained controls (140 corrected flags and zero
instant changes), 65 additional transitions, 42 boundaries and 19 malformed
inputs. All 385 valid cases match the anonymous actual archive. Forty-one actual
helper controls pass; compiled companion behavior is identical to #427.

Root integration now passes build, 4,859 tests / 413 files, check with zero
errors/warnings and 11 hints, and 18 captures byte-identical to #427. The unchanged
engine budget admits its five-chunk 23.3 KB closure. Root browser acceptance is
pending: an additional deep equality assertion comparing a Chrome receipt to a
Node reference found small derived numerical differences. The raw result is
retained and same-browser/prior-version controls are being investigated before
classification. No original numerical or visual threshold has been loosened.


Receipt draft #427 exact-source [Site Check 34195946291](https://github.com/ZodiacsOfficial/site/actions/runs/34195946291)
now completes successfully with all 14 jobs passing. The final job includes
original visual/performance and existing feature gates. Its exact source remains
`804c70309d2508e67e8462df526b5f9e71a112e9`; the READY preview previously passed
12 real download groups. [Final CI record](evidence/receipt-export/release/ci-34195946291-final.json)
is retained separately from the earlier progress snapshots. No merge, npm or
production release is implied by this passing draft acceptance.


### rc.6 root acceptance and runtime-math diagnosis — 2026-09-08

The exact 13 frozen source files and two standard generated manifests are pinned
in [root-source-identity.json](evidence/site-engine-rc6/root-source-identity.json).
The [root integration manifest](evidence/site-engine-rc6/integration/manifest.json)
SHA-256 `e1ba3dc88b747bf65ba36c6cae2e35cfb1ef660897d55e12d9526fffa3c37d38`
seals 84 original records: build/check/all 4,859 tests, 27 actual browser receipt
groups (all 16 historical fixtures), 13 developer/API checks, 12 existing share
cases, and 18 captures byte-identical to #427. Fingerprint:
`4e9f7975ed00c8d9e6b407824fde1088f34b08c5449ab0bafaa574bc5b2f09ff`.
All three affected chart outputs are also byte-identical to #427 despite the
same existing macOS baseline height failures. No baseline or threshold changed.

The initial extra cross-runtime deep-equality assertion failed and is preserved.
[The controlled diagnosis](evidence/site-engine-rc6/runtime-math/REVIEW.md.log)
proves the root Caracas receipt equals the earlier actual Chrome receipt exactly.
All 16 historical charts retain exact rc.5/rc.6 numerical parity in each runtime.
For Caracas, replaying only Node's cosine/sine/atan2 results in Chrome reproduces
the entire Node chart; all 270,141 Math operation names/arguments and other native
results agree. The first isolated same-input cosine result differs by one final
binary step. ECMAScript permits implementation-approximated transcendental
results; primary sources are linked in the report. This is an author diagnostic,
not a new independent astronomical oracle. Cross-runtime bit equality and a
universal numerical bound are not claimed, and no tolerance was introduced.

The runtime manifest SHA-256 is
`2afc64d1aa2fb5b86d54936aba278c234467bb9d7f29ffdf41cff53ca3734948`:
11 byte-verified delivered records, including the compressed exact raw traces
and retained harness failures with 63 individually hashed uncompressed members.
All 23 installed package files match the immutable rc.6 archive. The unwanted
npm lockfile metadata rewrite was retained and replaced with the exact frozen
reviewed lock bytes; no unrelated dependency change was accepted. Hosted CI,
preview validation, publication, production deployment and external adoption
are distinct and are not established by these local results.


### Inactive local-date interval prerequisite — root acceptance 2026-09-08

The three new files match author Freeze 1 patch SHA-256
`9854a47e9a2d60845cf023f4b12eb16f7defe8b4ca81083f1f6a4ec6d4667e78`.
Root integrates above #428 source `30b41cd8f1a353cce0cee36bc76c1e9fa21b4c14`;
[root identities](evidence/local-date-intervals/root-source-identity.json)
retain the original #427 author base. No active source imports the new API;
existing resolver, calculator, account, locale, SDK and Registry bytes remain
unchanged. The acceptance manifest is refreshed through the established driver.

[Author records](evidence/local-date-intervals/author/AUTHOR.md.log) seal 22
original files under manifest
`4e596e14248a9c6f48c59536ce1f1e7b3c1fd826c7ef2b3bb19be8ec1634f895`.
[Independent review](evidence/local-date-intervals/independent-review/REVIEW.md.log)
seals 30 records under manifest
`f04478c508027ed8fe5d6ac1cb8d8fa842087de155cf7f4c26d01a065768a014`.
Each Node 22/24 run passed 1,500 independent critical-point oracle schedules,
including 1,059 disconnected and 19 empty sets; 20 edge/bound, six cap and five
no-partial-result failure controls also pass. Native Chrome passed 16 explicit
dates, six signed offsets and 4,699 finite Intl membership checks. The deliberately
omitted transition-pair control demonstrates the documented nonconforming-provider
limit. Primary Temporal transition/offset obligations are linked in that report.

[Root integration records](evidence/local-date-intervals/integration/manifest.json)
retain normal build, all 4,938 tests / 414 files, check (1,041 files; zero errors/
warnings, 11 hints), focused 79 tests, strict types, exact-base scope, and 18
captures byte-identical to #428. Fingerprint:
`8153201effc180606aec028b782bb7c65f4c01a9b7c4ae7f5f806c3ac9071240`.
The actual native Chrome driver passes 22 fixtures, 100 first/last/adjacent
membership checks and four signed offsets against the integrated rc.6 offset
reader. Import instrumentation records no Temporal/Intl/storage/network work;
execution records zero observed storage/network APIs and only the two owned
fixture requests. Browser and loopback server close after the run.

Provider completeness is conditional on its trusted contract. Native capability
absence, observed host mismatch and 33rd interior transition return unresolved,
never partial intervals. Finite runtime tests do not certify all timezone history
or whole-date Sun/Moon candidates. No caller activation, production release,
publication or external adoption is claimed by this prerequisite.


### Hosted rc.6 acceptance and inactive-interval delivery — 2026-09-08

Draft #428 exact source `30b41cd8f1a353cce0cee36bc76c1e9fa21b4c14` has READY
preview `dpl_DCmR76jrfuTxvB4M4b5Xfw55iR11` at
https://zodiacs-4qqy7ml63-zodiacsofficial.vercel.app .
[Receipt preview evidence](evidence/site-engine-rc6/preview/REVIEW.md.log)
seals 84 records under manifest
`fdbe6aedd0793514ac0a638857d2922899dc0a4de2c50111231be5041a2a3ba2`:
27 actual groups, 26 downloads, nine screenshots, zero page errors and non-GET
requests. The existing Plausible loader was requested and blocked in all 27
contexts; no other external requests were recorded. Bootstrap is outside this
observer. This is not a whole-site zero-network claim. Provider identity is
exact; remote served-file hashes are unavailable and are not substituted.

[Root hosted evidence](evidence/site-engine-rc6/hosted-integration/manifest.json)
seals 23 original records under manifest
`844e3f224c59fb0239619cf59ed889a1b19b1ba2dd39a44cad222fb703d5d2ca`.
The first developer preview drive failed a zero-footer assertion on an HTTP 200
response; its original driver did not identify which iteration or preserve the
page, so the cause is not established. A subsequent direct diagnostic captured
correct /developers/ content. The unchanged 13 assertions pass on repeat, with
per-page title/location/footer diagnostics added. No product fix, relaxed
assertion or fabricated cause is claimed. All temporary access files were removed
and scoped contexts closed. Site Check 34200151600 currently has 13 successful
jobs and its remaining build/visual/performance job in progress.

Draft #429 exact source `65418003c07efc0c435ce1010e3c9ec05b478eb4` delivers the
inactive interval prerequisite with all 83 actual changed paths matching the
local diff. Site Check 34201151004 is in progress; exact-source preview
`dpl_GLVF1b21yYBFfMo8eWXfGAbMaxBr` is READY and 13 existing-surface browser/API regression
checks pass, without claiming the inactive API is a hosted feature. Neither draft is merged, npm-published,
deployed to production or externally adopted.

### Caller counterexamples — ownership is separate from coverage

[Chart review](evidence/interval-caller-compatibility/chart-review/REVIEW.md)
retains 38 records under manifest
`962ff4ac6291bf1156fa4345d7256d779d74621693b26a4a4d9c81eedb534d90`.
[Independent Moon review](evidence/interval-caller-compatibility/moon-review/REVIEW.md)
retains 22 records under manifest
`6d98a848b6de211380a33f924f0e7c8d95c67f12779993ac5f165a2a3565a850`.
Actual rc.6 calculations reproduce Toronto's omitted Pisces interval and a
fabricated requested-date result for skipped Apia. Extracted current production
closures reproduce delayed old-input commits and retained prior results after
failure; these are source-level controls, not rendered-browser acceptance.

The next bounded ownership fixes leave interval activation and candidate certainty
unchanged. A future coverage release must distinguish empty from unresolved,
validate its representative instant, and address missing native capability and
coherent uncertainty across cards/context/shares. Finite interval membership does
not prove astronomical event completeness. No unavailable case may be relabeled
as an observed Moon sign change. Root owns these product integration decisions;
publication and human review holds remain distinct.


The #429 exact-source READY preview passes all 13 existing-surface checks on
its first run: developer pages/support/examples at 1,280/390/320 pixels,
keyboard table focus, current rc.6 metadata/artifact links, synthetic chart
calculation without profile persistence and the dated sky API. This is hosted
regression acceptance, not execution of the inactive interval API by the site.
[Original driver, page diagnostics and screenshots](evidence/local-date-intervals/release/manifest.json)
are sealed separately. Temporary access was deleted and all contexts closed.


### Moon result ownership — exact reviewed source integration

Root integrates the two-file freeze above #429 source
`65418003c07efc0c435ce1010e3c9ec05b478eb4`, with shared evidence carrier
`11e75bab0f92ea2e02ba38ea8385a7cebed6a64b`. Original author base remains
`30b41cd8f1a353cce0cee36bc76c1e9fa21b4c14`; the island was unchanged between
them. Frozen patch SHA-256:
`ecdc149e2115ee234828f3848b40cab4f6ba2b15074763b28bf936f0abac6858`.

[Author evidence](evidence/moon-result-ownership/author/AUTHOR.md) seals 28
records under manifest
`d4c61a6b445e02d05902fdffccd55ffc4591df5259e1929ec69d3d4a4b13bc9a`.
The same complete rendered fixture gives 18 original ownership failures/two
calculation passes and 20/20 corrected passes across six catalogs. Initial
incomplete fixture failures are retained and distinguished from the final
original-source regressions. Known/unknown calculation-control records match.

[Independent review](evidence/moon-result-ownership/independent-review/REVIEW.md)
seals 29 records under manifest
`91e5923e26c2aa43d549a8999cafeee975619eec5a6afaf2b13c8da9990abfed`.
Its separate actual Chrome driver passes all 13 corrected groups; the original
passes only the prefetch control and fails 12 ownership groups. Eleven groups
use the real module loader and two isolate out-of-order promises. Native controls
cover rejection observation/cache retry, pending shared imports, partial and
replaced place queries, selection/removal, cleared date/time, current failures,
late success/rejection, unmount/remount and rapid pre-paint teardown. No observed
page errors, unhandled rejections or network requests. AST/source comparison
proves the calculation body unchanged after excluding the two ownership guards.

Root verifies all delivered hashes before applying both exact source files.
Before integration, 12 actual production-page controls captured successful result
text and component pixels for six locales at 1,280 and 390 widths. Root's final
normal build/check/full tests, native controls and post-integration page
comparisons are in progress. These are not yet claimed complete by this record.
The interval, endpoint, certainty, account, SDK and Astrofolio scopes remain
unchanged; the separately recorded date-coverage counterexamples remain open.


Moon root acceptance completes build, 4,938 tests / 414 files, check across
1,041 files (zero errors/warnings, 11 hints), exact-base scope, 20 native ownership
groups and 12 actual production-page cases with edits/recovery. Fingerprint:
`3e60d4c18803a51346d35820ff31f256d1cf497bc665237b241e1c05213ab514`.
All 18 Phase 1 captures are byte-identical to #429, and all 12 successful Moon
result texts match the baseline. [Root originals and comparisons](evidence/moon-result-ownership/integration/manifest.json)
preserve the full records and the initial exact-image comparison failure.

Eleven initial component screenshots are byte-identical. The Italian390 image
has 367 differing pixels, all within the unchanged 32px floating Guide portrait
canvas at x318/y1234; the measured difference bounds are x319–348/y1235–1264.
Three subsequent fresh renders of the exact same frozen Moon source all equal
the original baseline image byte for byte. Guide bootstrap/CSS/portrait bytes
also match the baseline. No stable Moon content/geometry drift was observed;
no all-12-initial-byte-identity claim, product correction, new mask, baseline or
tolerance is used. Both the initial variance and all repeat controls are retained.

Root adds only four workflow lines to run the unchanged 20-group native driver
inside the existing Build & Check job, bounded to three minutes. Existing Node,
Chromium, permissions, action pins and artifact upload are unchanged. The
[independent wiring review](evidence/moon-result-ownership/ci-wiring-review/REVIEW.md)
passes for workflow SHA-256
`f7eced0d399caded9cff242c556f54084abea450aecd9df55122b966f40bfaaf`;
98 existing workflow-coupled tests also pass. Normal native failures preserve
result JSON; early compilation failures or timeout can leave only job logs and
partial artifacts. No successful Ubuntu/hosted run is claimed before execution.
Root source identities distinguish the author two-file freeze from this third
integration file. Publication, production, date-coverage and external-adoption
claims remain separate.


### Moon delivery and runtime support correction — 2026-09-08

Actual Moon draft #430 has exact source `4227bb0758d4b34cbd761a3cddd273cbea6c2c1b`;
all 328 paginated changed paths match its local #429-based diff. READY preview
`dpl_J3sNfFzjSA6Q8RjRLW9fXLnZJ9kH` passes 12 actual page groups in Chrome 152:
six locales at 1,280/390 widths, exact local result text, edit clearing/recovery,
no saved profile, one footer and no horizontal overflow. Its [source manifest](evidence/moon-result-ownership/preview/source-manifest.json)
SHA-256 is `fc873f343183390e8328ad8a8ab0e4779861643745b6c2917253d79f33ac4d0c`;
the inert root copy has 29 records and manifest
`bb62eb9b1f7818788eb8756f3397391369ae491354308919aa3d4aa828231d72`.
646 observed GET requests, zero uncaught errors and 12 blocked existing Plausible
loader attempts are recorded; authentication bootstrap is outside that observer.
A cleanup-only default-filename assertion failed after browser checks; the actual
configured hashed loader was verified and the original failure retained. Secret
scans passed, temporary access was deleted, and no local product injection or
whole-site zero-network claim is made. The provider source was checked before
and after execution. Moon's Site Check 34204547574 remains in progress.

The refreshed exact-source #428 run 34200151600 and #429 run 34201151004 both
complete all 14 jobs successfully. Original API results are retained in the
[support integration release records](evidence/runtime-claims/integration/manifest.json).

The exact support patch `2a59e5e721a748178f96e5d653434c0515cc5795d7c37d82cd25338dbe83e581`
is applied above Moon. Resulting file SHA-256 is
`7598fca770c5f5e9c26f92603ee37e48c4cc3d087d744ee1ac3783b068a49cea`.
Prior independent review verified the immutable current carrier records and the
separate actual Node 22/24 SDK installation evidence. Root build/check and all
4,938 tests / 414 files pass; check covers 1,041 files with zero errors/warnings
and 11 hints. Thirteen actual Chrome groups additionally assert the new row and
exact current-carrier consumer URL, retain table keyboard focus and current
candidate artifact checks, calculate synthetic shared charts without profile
persistence and check the dated sky API. Two fresh developer screenshots and the
actual driver are retained. Fingerprint remains
`3e60d4c18803a51346d35820ff31f256d1cf497bc665237b241e1c05213ab514`;
the full-suite evidence check validates the existing Moon18 captures. No new
Phase 1 capture run is claimed for this page-only wording change. The 15-record
integration manifest is `4cf6faf3e43762996599234a071b6b4202f6c280903fcdcb117f5d93ce7c2dfa`.

### Chart ownership Freeze 1 — correction requested

Root read both actual independent reports before authorizing corrections. Main
native controls pass 16/18; separate save/profile controls pass 13/14. Public
positions import reattaches revoked optional mine context; controls retry steals
focus; save-close focus survives mine-only revocation. The first also reproduces
on unmodified production output. The exact fixture/production distinction and
synthetic-reader limitation are retained; no ordinary auth bypass is established.
Numerical AST parity confirms the existing calculation block unchanged without
certifying its known date-coverage defects. Committed stores remain persisted.

[Main evidence](evidence/chart-result-ownership/review-freeze1/REVIEW-FREEZE1.md)
source manifest `cf4546294d6afc03c9ee26a7d6002278a2d8a5b8d93f79b7d2355a979b9eaaa9`
is verified and copied as 46 inert records, root manifest
`539b7c95a627f8269c410244dd3bae00405fc66479769e5bf5f0cee51ee43024`.
[Save/profile evidence](evidence/chart-result-ownership/profile-save-review-freeze1/REVIEW-FREEZE1.md)
source manifest `f60fce9d8ec82e39c3ad311194c7f3a43f0761fa11ab154dc6ddeaab2bd4db72`
is verified and copied as 67 inert records, root manifest
`d4e8e9b76f291c25869c78e2296374822fd06e857196cb0a2a45f2d4a0edebd5`.
No frozen ChartCalculator source is integrated or approved by this checkpoint.

The separate [Moon preview evidence audit](evidence/moon-result-ownership/preview-audit/REVIEW.md) verifies all 28 supplied records, all 12 cases and the actual draft’s 328 paths/blob identities. Its original manifest is `a5cd3261e40ebf5510cfcf7a2216567fb71a97a7bb4b417992355dc585a09124`. GitHub’s large-diff endpoint returned 406; complete paginated files resolved that retrieval limit. This is independent evidence validation, not a second browser execution.


### Support draft delivery and corrected ChartCalculator integration — 2026-09-08

Draft #431 exact `abcf1a44e52040db79a369b49bc9b55d78099b22` has all183 actual
paths/blob identities verified. READY preview `dpl_7TVmbdjnFTVjT1rZrVj5a8Kyj26C`
passes13 actual groups. [Root release records](evidence/runtime-claims/release/manifest.json)
seal24 records under manifest `d546b3d2e73fc2847da6aa666610fca0384613e65a7d0f0ae968effe5536e40b`.
[Independent audit](evidence/runtime-claims/preview-audit/REVIEW.md.log) seals7
payloads and30 verified compressed members under manifest
`0355784ed636d3f6f3bae741d791d16914dcca122f85d3b9e543604687c629de`.
Its fresh100+83 GitHub file pages, current provider and immutable evidence carrier
match. The observer records478 browser GET requests and12 blocked existing
Plausible attempts; authentication bootstrap and the separate sky APIRequestContext
are outside that count. The failed literal-marker scan matched historical public
scanner source, not a secret; the diagnostic and passing credential-like scan
are retained without claiming an exact-secret comparison after deletion.

Moon #430 now completes all14 jobs in exact-source Site Check34204547574,
including its new native driver. Support #431 Site Check34206194928 has13 successful
jobs and Build & Check in progress. Original run records are retained with the
chart integration below; draft descriptions were updated through body files.

ChartCalculator exact corrected patch
`32b7413f9fcce17b192fa9f3fe28847d6b6ec7bfccc39b4437fee60df44a8e9f`
is integrated above #431. Component SHA-256:
`fea737333ea5df9a894dafa99de06cd1dcc8390f3bd43d9e627992b466dfa4d0`.
[Author Freeze1](evidence/chart-result-ownership/author-freeze1/REPORT.md.log)
manifest `265615d918b92c5eb322a452b2174a09ffa857b3736662baacbf466cba006490`
retains6 payloads/130 verified compressed members; its original incomplete
three-case-driver byte-copy limitation remains explicit.
[Corrected author Freeze2](evidence/chart-result-ownership/author-freeze2/REPORT.md.log)
manifest `9f4b0f69175713dfc6dd56e8380e9dc047205a6bf73bdb6124acc8d49626e77d`
retains5 payloads/46 verified compressed members,134 focused tests and17 actual
production-page groups. The intermediate close-generation error and six actual
before-fix assertions are retained, with ordinary-save positive controls.

[Independent corrected source review](evidence/chart-result-ownership/review-freeze2/REVIEW-FREEZE2.md)
source manifest `47c6e0f6e319a077c24fec78bdd532e872e0d33396cbe4ec9cfc0e5bb5c4c112`
has31 records; root’s32 inert copies use manifest
`6ec3a019aeaf4f20c3185e9e6197f095d05d390f4d674c195f078f5036c509af`.
All22 component groups and five unmodified production-build groups pass; the
exact author driver additionally passes17 cases with checkout/output paths
containing spaces. All62 module references and the parsed numerical block match
the original; this does not certify existing whole-date coverage.
[Independent saved-state review](evidence/chart-result-ownership/profile-save-review-freeze2/REVIEW.md)
source manifest `d6cf0faaf014b5f283c7e0e574e0314ea9d0128512c1803526e0369e4d2d0d72`
has66 records; root’s67 inert copies use manifest
`ce73d307eff0f32b39957468fe2a7dcdfb13f3f0928b7ef0af4600acf8805012`.
Its exact callback/actual store/native storage/RAF controls pass18/18 versus6/18
original. Every committed case writes once; denied/prompt-only cases write zero.
These are not relabeled full-component render tests or an ordinary auth bypass.

Root’s separate four-line workflow integration has SHA-256
`74ba1e991909472d7e7d03318e9eb06874df13fc1b1c44059bdcedc20c382ca5`.
The [wiring review](evidence/chart-result-ownership/ci-wiring-review/REVIEW.md)
source manifest `e7a1c6b22fd09cc404aad16d5735414cdf4dc5e2602a4fff22059b3404f2619a`
is copied under7-record root manifest
`12f29d693850a09b951ee8c2ed7e90bcbccf74e5d0a314996438f9b6b0604784`.
The new17-case driver uses existing Node22/pinned Chromium, a5-minute limit and
the existing artifact tree; permissions, secrets, pins and other gates stay the
same. No hosted Linux success is inferred from its source review.

[Root local acceptance](evidence/chart-result-ownership/integration/manifest.json)
seals22 public records and196 verified compressed raw members under manifest
`c861408ca630b13fd4aac9f878ddd90c9317122be513db85f7ac55d823006943`.
The full build/check/4,965tests/415files pass; check covers1,042files with zero
errors/warnings and11hints. Root17 native groups,12 existing sharing cases and
the Russian26-route+404 drive at360/1280 pass. All18 fresh Phase1 captures equal
#431; fingerprint `eceb9de9c5b4fb30bca028951777fd2700350f1a234fe01ee656de41ab0f11ac`.
Engine closure remains23.3KB under25KB; every existing bundle budget passes.

The original and both candidate chart visual runs retain the same three macOS
baseline-height failures. Mobile and ordinary desktop equal the pre-change
images exactly. Reduced motion has53,116 raw differing pixels,52,649 with only
one channel level of difference. The existing threshold scores one pixel,
ratio7.30840290932903e-8, below the unchanged0.001budget, with identical1440×9502
dimensions. A fresh candidate repeat is byte-identical to the first candidate.
The extra exact-byte assertion failure, original images, full pixel diagnostic,
existing-threshold score and diagnostic crops are retained. No cause, all-three
byte identity, normal visual-gate pass, new mask or altered baseline is claimed.
The driver-generated tracked sharing image was preserved in evidence then restored
to its original committed bytes; no captured output was silently discarded.


The [delivery baseline refresh](evidence/chart-result-ownership/release-baseline/manifest.json)
records site main79410401, unchanged SDKmainb49e0f14, actual36 Astrofolio #416
paths atb17d6804 and SDK #5’s explicit do-not-merge/do-not-publish status atcced0116
with no submitted reviews. Two scheduled main commits since75d036ae change18
Registry-only paths; root leaves them untouched and does not claim latest-main
integration. READY productiondpl_gBmYzHCpqwMCCH36DAToDMjRQ21g is source79410401,
from scheduled upstream publication, not this platform candidate. No publication
or production tool was invoked by root.

## Unknown-time local-date reference preparation — 2026-09-08

Root chooses Decision C-014's validated local-date witness over requiring native
Temporal for every ordinary unknown-time calculation. The [main preparation](evidence/local-date-reference/preparation/REVIEW.md)
is retained under the 41-record root manifest
`6537d342374ccc8836c37399759d4806b4ef6b818a5f4272a69bf418d0e6fc46`.
It executes 12 date controls and 28 additional calendar/seconds/identifier/input
controls on each Node 22/24. Modeled orchestration counters are not relabeled
instrumented native natal calls. The private formatter's undefined-zone fallback
is a proposed-helper pitfall; the existing public resolver already validates it.

The [independent real-date controls](evidence/local-date-reference/real-date-controls/REVIEW.md)
have 23 root records, manifest
`2540bcd86d35516a43ad5a13adc53a41828c7d1a7e231a98d0dd1c18973d49fe`.
All 17 Node/native cases retain their actual runtime capability distinction:
Node 22 has no native interval provider and returns unresolved, while Chrome
identifies four empty dates (Apia, Kwajalein, Kiritimati and Guam). Five positive
noon witnesses preserve endpoint defects in Toronto, St Johns and Juneau.
Repeated Apia's 48 hours and Kwajalein's 47 hours are not mislabeled as newly
demonstrated endpoint defects. No nonempty/wrong-noon real case was found in
these 17 controls; that finite result is not an impossibility proof.

The [synthetic addendum](evidence/local-date-reference/synthetic-refusal/README.md)
has nine root records, manifest
`5273b3fbefdd08b3da4ed5fe7ecff6dc34d69535c25196f0ea3faaa03d0c7778`.
An explicitly complete UTC+00 to UTC+15 model yields nine hours of Jan 1 while
the unchanged resolver selects Jan 2 03:00. Actual copied resolver and interval
code execute that model; this is not a claimed IANA-zone event. Refusal of that
nonempty date is an accepted conservative limitation, not proof of emptiness.

[Author Freeze 1](evidence/local-date-reference/author-freeze1/AUTHOR.md.log)
is sealed against source `c7b9eb4a769e39a46aebc0a5ecedcb9fc40949e3`, with
12-file patch `41d49812595e81a56ae1194a598bab65faa6c047806480cbb4438ed6be1bf13e`
and source manifest `328ea15bd192573894639dab699058cb83185e0c61e907dde7f275305cfe48c2`.
Root verified all seven payloads and 135 compressed members under delivery
manifest `eacb17c424d3dc5ad8150a207d5f4a82e49cd927ef2ff1b32bec52c43e4d423a`.
Author 234 scoped tests pass on each Node 22/24, strict types pass, and actual
Chrome passes 35 new caller groups plus the existing 20 Moon ownership groups.
All eight original skipped-date caller results, ten same-browser positive
comparisons and original setup/selector/type failures remain available. The
fixture is an instrumented actual-component/native-engine execution, not a
production graph or approved-design gate. Independent review and root integration
are pending; the separate downstream daily-panel clear-signal finding is open.

## Chart preview delivery and CI follow-up — 2026-09-08

Draft #434 at `c7b9eb4a769e39a46aebc0a5ecedcb9fc40949e3` has 199 actual
changed paths and blob identities matching its exact base. READY deployment
`dpl_2Z94CZozTG7aXCNiEEbCLz2GR27t` retains that source before and after all
nine [actual remote browser groups](evidence/chart-result-ownership/preview/REVIEW.md).
The four EN/RU desktop/mobile flows produce four downloaded receipts and eight
native natal calls; a labeled post-calculation serialization fault/recovery uses
three; delayed replacement uses one; delayed edit and positions controls use
zero. All twelve calls are measured against function Et in the actual served
chart-adapter chunk, SHA256
`20f5ee939b52b2c435ab12f4c3fd20e8a3195f1ec57a727d7933b9356fdbeb95`.
No local product source or replacement response was injected into the preview.

Root reverified the independent reviewer's 78-record delivery manifest
`d08cdb14f146eb23cd6470764073b39627464cee0cbc4a4c4d8b4d6e4d62ab7b`.
The 80-record inert root copy has manifest
`67eb3b2c8a9a3b82a676f479314a070fe057ce355a5b177e930d8acfb1dfe9ea`.
There are 1,023 observed request events, 905 captured same-origin response bodies,
nine blocked Plausible GETs and no observed API/non-GET/uncaught page errors.
Uncaptured responses are not asserted successful. Protected-preview bootstrap
is outside that observer; the original raw-file exact-secret scan and cleanup
are distinct from the later compressed-content audit. Original pre-browser ESM
setup and provider-scope failures are retained without attributing them to product
behavior. These nine checks are not all seventeen local race controls.

The original archive has 140 logical members: 69 served JavaScript payloads,
70 AppleDouble metadata files and one directory. All payload lengths/hashes
match; root additionally hashes all regular members. The [independent supplement](evidence/chart-result-ownership/preview-archive-audit/REVIEW.md)
finds only identical 11-byte com.apple.provenance attributes in those metadata
containers. Its 6-record source manifest is
`4028b3b6e3d369bfd152befe15ab59345d85557a33632f67bd34ffe3cfe6aeb1`;
the 7-record inert root copy is
`69c6603021bf81922c6e3060bba5b370fa3d3ec3650b983f3a2349a5cdb0ceaf`.
All decompressed members, PAX values and tar bytes pass the recorded structural/
credential-pattern scan. This is explicitly not a fresh exact-secret comparison:
the original values had been deleted. All 79 original delivery files remain
byte-identical. The root's initial active-extension and metadata-count copy
assertions stopped before copying; their corrected mapping/classification is
recorded without modifying source bytes or concealing extra archive members.

[Release records](evidence/chart-result-ownership/release/manifest.json) contain
eight payloads, manifest
`099b7a8a64feaafadc97b55c47845632622241220dfac98630c11d4db688240c`.
Support #431's exact-source CI 34206194928 now passes all 14 jobs. Chart #434's
34209606308 snapshot has twelve successful jobs, Build & Check in progress and
one failed post-chart job. Its 1/291 failure expects the displayed-result context
to persist after editing; the remaining visible daily panel also exposes its
cached context. Root requires a separately reviewed clear-signal/listener fix
with actual request/UI regression checks. The original job log is retained.
An initial whole-run log request was unavailable until run completion; reading
the completed job directly resolved that retrieval limitation.

The [completed CI snapshot](evidence/chart-result-ownership/ci-final/ci.json)
subsequently confirms thirteen successful jobs, including Build & Check and its
new birth-chart ownership step. The post-chart job is the sole failure in run
34209606308. Overall CI remains failed until the separate correction is delivered
and the affected gates pass against its exact source.

## Independent local-date reference acceptance — 2026-09-08

The [independent frozen review](evidence/local-date-reference/independent-review/REVIEW.md)
accepts C-014 without a blocking source defect. Source manifest
`8841255c2f15e2fb71dfa4e9cd7083d99116b930bb804a9667d5b7f9a76dc3cc`
contains 50 records; root's 52 inert records use manifest
`d99a3d37c11f006f4a144762a21b73b728565ffc9a8c293df74c06e37e41fe0e`.
All 276 compressed ordinary files were individually verified; there are no
unlisted AppleDouble files. Actual input bytes/identities, transformations,
baseline results and original virtual-entry/disabled-input harness failures remain.

The main reviewer accepts 26 caller controls: 25 passed initially and the one
affected recovery case passed after correcting only the test's disabled-input
interaction. Baseline passes 13 of those 26; nine valid numerical outputs match
exactly. Eight actual skipped-date submissions enter resolution/membership only,
with no submitted numerical/receipt/endpoint work. This qualification excludes
the Moon page's independent current-time banner and prior module loading.
Existing five time functions, 93 module-specifier occurrences and numerical/
caption blocks are unchanged. The fixture is not a production graph or page gate.

The helper reviewer independently passes 92 controls on each Node 22, Node 24
and native Chrome, including internal-slot hostile-object and true cross-realm
checks, calendar/era/second/millisecond boundaries and the nonempty synthetic
refusal. Its source manifest is
`7a5cf412191f3c405cc47b02075d3b486b5584ea611d8245994eb30c171fca31`.
Native import performs no observed Intl/fetch/storage/Temporal work and the
blank test context records no requests/page errors. These finite checks establish
the selected-instant contract; broader date/astronomical claims remain open.

The review's appended corrigendum corrects earlier preparation prose that grouped
both Node runtimes under one ICU/tzdb identity. Original raw records already say
Node 22.23.2 uses ICU 78.2/tzdb 2026a and Node 24.19.0 uses ICU 78.3/tzdb 2026b.
No result/source/counter is changed; the original preparation stays sealed.
This is a SHA-256 copy manifest, not a cryptographic signature or human signoff.

## Downstream context correction intake — 2026-09-08

The [six-file author freeze](evidence/post-chart-clear/author-freeze1/source-freeze.json.log)
is `e64eb26e34b1b5442a1a1e12f851b77a8a17d7d820a0e5a9b2b611c583cdd242`,
patch `391af1a908fece28f57dfffe16ce435d1dce9ead828b9bcc77a505d1b6c0609b`,
based on c7b9eb4. Root verifies all frozen file bytes and clean applicability
without source application. Three-record intake manifest:
`b4c671f9de725b15f3ed637e38431ae8879714428f167f7642ff4e4d175f2620`.
It changes the clear signal, daily controller, email enhancement and scoped tests;
calculator/date, backend, auth protocol, SQL and provider code remain unchanged.
Author 52 focused tests, strict types, check (1,043 files; zero errors/warnings,
11 hints) and 17 native groups pass. The fixture build succeeds but its full-page
browser gate times out at a paused panel. That diagnostic is still open; neither
full-page acceptance nor root integration is claimed by the immutable freeze.

Root's [normal-build controls](evidence/post-chart-clear/normal-build-baseline/manifest.json)
retain ten records, manifest
`380376da2ad0111556edcea90b7e7d9de353b4a6dcb9c05eee28221dab9de822`.
Four initial capture-presence assertions fail because that feature-off build has
no such markup. The correctly scoped EN/RU desktop/mobile controls pass four
absence/chart-edit/recovery cases against unchanged c7b9eb4. Exact drivers, raw
served hashes/requests and screenshots remain. They cannot establish active
capture or managed daily-brief correctness. All non-GET/external traffic is
blocked; synthetic data and owned temporary browser contexts are used.

## Corrected downstream source accepted and integrated — 2026-09-08

Freeze 2 is `fc22bd7c2c6d3efa44022f49f42427545a35915afd49ee66fee6b4d7b6a09cbc`,
patch `7202443237f2bebf826a9a0ef24da3fd8062b4cd2aff2b4edfed02f3a51fc5d8`.
Root applies and individually verifies all six files plus separately reviewed CI
patch `f9ce2b49d843e6d6c65b5bd49155554f63aa82b146b48313e13d90ad6a5cadf4`.
The workflow result is `286ca48156fb294f2af629fdf973d921565c5601142396a4d31fe5f1d95633a9`.

The [author report](evidence/post-chart-clear/author/AUTHOR.md.log) records
52 focused tests, 21 native groups, 294 full-page assertions and six repeated
paused-state controls. Root manifest `bd02cd017cd05ca20625a86fb4e71cdbe34f61986318078cc301d61b5b8b5c61`
contains eight inert records; all 355 ordinary compressed members are verified.
The original failed full-page compiled output was not retained in full before
rebuild; source and requested URLs are retained, and final fixture bytes are
separate. No exact original served-byte claim is made.

The [independent report](evidence/post-chart-clear/review-freeze2/REVIEW.md)
accepts 25 native controller criteria. Byte-identical email source retains its
separate 20/20 result by parity without a redundant execution. Root manifest
`8d9933ae0c7fce5cc23dfb581839c69a4d357914140b040a403ef0fe1fac4638`
contains 71 inert records with 51 individually verified ordinary archive members.
The original rejected freeze remains independently inspectable. The current
signed-out/null and unresolved/undefined cache meanings have positive controls;
no auth provider, client, account format or submitted-write boundary changes.

Root's integrated fixture build and full page gate pass 294/294. Normal-build,
full suite and refreshed remote source/CI/preview acceptance are pending; neither
source review nor fixture success is a release or production claim.


[Root C-012 integration](evidence/post-chart-clear/root-integration/README.md)
passes the normal build, check (1,043files, zero errors/warnings,11hints),
4,969tests/416files,21native groups,294full-page assertions,17existing chart
ownership groups, four correctly scoped normal feature-off controls and exact
#434 base scope. All18 fresh captures are byte-identical to c7b9eb4. Current
render-source receipt is `e85d852a325e93e76a4a5d46249908da0f134819ccd030c13482b7c6457c6c18`.
Root manifest `39a9042e61a61ebe56cadf09e47d228f249d17bcce4bd9392091cff03e4d5102`
contains17records and58individually verified ordinary archive members. The fixture
gate ran first; normal build/captures followed, so the final local build has no
fixture feature activation. No numerical/SDK/API/account authority change.

The read-only [pre-integration refresh](evidence/post-chart-clear/release-start/manifest.json)
retains five public records, manifest
`f695fac63528f81dcaf670b61f9b4d978579b17587c7665ebca772b06319a3fd`.
Site main remains79410401 and SDKmainb49e0f14; actual READYproduction is
dpl_gBmYzHCpqwMCCH36DAToDMjRQ21g at79410401, while this stack has integrated
main only throughd4d5717d. SDK#5 remains open draft with the explicit do-not-merge/
publish hold and no reviews. Actual Astrofolio#416 remains draft atb17d6804 with
36paths; no integration or communication with that separate user session occurs.
Registry-only later-main updates remain untouched and required at eventual merge.

## C-014 root integration and combined actual-page supplement — 2026-09-08

Root fast-forwards the isolated date branch to delivered chart/context source
`3845a04bcea822da3c30a18848ef3d8d133b7b66` and applies the exact accepted12-file
patch `41d49812595e81a56ae1194a598bab65faa6c047806480cbb4438ed6be1bf13e`.
All12 hashes match and all six C-012 source/test files remain unchanged. The normal
build,35native date groups,20existing Moon groups and18fresh approved captures
pass. Captures match3845a04b byte-for-byte. Root suite/check/actual localized pages
and exact-base metadata/release checks remain separate pending steps.

The independent [combined actual-page report](evidence/local-date-reference/combined-page/REVIEW.md)
retains the actual fixture-enabled Astro page with both accepted source freezes.
Root manifest `e87fc9d76faabaf151aa7afcde79aa753de01177db8302aeee18a0209a6fa2ea`
contains71inert records, from source manifest
`83cde38f600bc15dee184718b95d27461cc62eeea6787240d2795e9a58904397`.
All76ordinary compressed browser artifact members are individually verified;
complete generated-site manifest is retained separately, not all7137artifacts.
All11187assembled source records remain unchanged after build/native checks.
Root visually inspects the retained English refusal screenshot.

Actual native selection uses the offline city index/shard for Apia. Initial
seeded saved Mexico chart/pending panel becomes cleared output/actions/context/
panel on edit; skipped2011-12-30 submits only a focused dedicated error; changing
to2011-12-31 recovers Capricorn/current context and the correctly derived
unsaved-chart device-only panel. Preference reads are1→1→2, original profile bytes
unchanged, no profile writes during the measured flow. One natural legacy startup
sync POST is attempted and locally blocked; zero later mutation attempts and zero
external issued/completed writes. Root explicitly rejects delaying auth to create
a false page-lifetime POST0 result. Original recovery-state assertion failure,
optional manual-event diagnostic and setup error remain retained. Two expected
console diagnostics (blocked418, sanitized refusal) are enumerated, with zero
unhandled errors/unexpected endpoints. Synthetic account/response boundaries do
not establish provider authorization, delivery or production behavior.

The separate metadata proposal is retained under
[metadata-proposal](evidence/local-date-reference/metadata-proposal/REVIEW.md.log):
20root records, manifest`6f2b4ab2c689e11551966a6ee92d2ba8509daa06d6cdcae15429104645cddf68`.
Its four-line driver step and exactly six catalog paths pass14author controls.
The marker must become actual3845a04b before root application; unchanged guard
logic checks exact paths/base, while semantic copy approval comes from the source
review. Independent review and final exact-base execution are separate.

## Final local-date root acceptance — 2026-09-08

The [root report](evidence/local-date-reference/root-integration/README.md)
records the exact accepted 12-file implementation plus four separately reviewed
count-test/metadata files. Final manifest
`a26434ea8fcaa586ce4256f8efe5310a304b724bc20859567e6b4bf160d90132`
contains 19 records and 210 individually verified ordinary compressed members.
Build/check (1,044 files, zero errors/warnings, 11 hints), 5,024 tests / 417 files,
35 native date cases, 20 Moon and 17 chart ownership cases, and exact-base scope
pass. All 18 fresh approved captures are byte-identical to 3845a04b. Final source
receipt: `e664d1d35eeae647eff10cc775f058d16e179bea4f0006313a91f3f0d4a3b3b7`.

The first full suite retained two failures for the existing 418-key expectations.
The new localized error makes 419. The independent [supplement](evidence/local-date-reference/catalog-count-review/REVIEW.md)
reproduces 24 passed / 2 failed affected tests, then passes 26/26 with only two
constants and the corresponding title changed. Parity/interpolation assertions
remain exact. Root's 50-record copy manifest is
`a57e79c5ff4495a2172c2f1166cdeb698104a767a24239b57a38e00770206b59`.
Supplement patch `50330a5cc5865f44872f607795b1135bf5c98a0a1ffd06113ccf6cfcebff5922`
and allowance `2f26d0a3b85e651e1b248733adae5a818c213885c227af08b98a699acc440797`
retain exact base3845a04b and add only those two test paths to the six catalogs.
The original six-path review stays intact; its 40-record root manifest is
`404b681b019127884629c05efd94b04150f6e95005892e8eeef372fb373c4915`.
Its accepted workflow remains `5574577652bc6002884647804e6b99fa45c05840accbb3ce442620f5d32732a0`.
The extra paths have new independent acceptance rather than inferred approval.

Actual normal-build page acceptance covers six locales × chart/Moon × two widths.
Twelve Moon groups pass initially; twelve Chart groups initially stop at a guessed
error-on-edit assertion. Byte-identical existing Chart clear/invalidation handlers
retain the old error until submission. The corrected chart-only driver asserts
retained error/current input focus, no old output/actions/context, then successful
retry with error removed. All twelve pass. The final 24 accepted groups come
from those two explicit executions; no single 24/24 run is invented. Accepted
cases show zero overflow, saved profiles, mutation attempts, unexpected console
errors or unhandled errors, with exactly one sanitized refusal diagnostic each.
Real offline Apia selection and two known-time controls remain. Root visually
inspects the Russian chart and French Moon mobile refusal images. Numerical call
counts and signed-in behavior are not inferred from this normal feature-off run.

The combined-page main audit independently rehashes all 69 delivered payloads,
76 browser artifact members and 11,187 assembled inputs, reads actual interception
and four checkpoints, and inspects the refusal image without repeating the child
browser. Root copy manifest `a135f450493b7747257e8b1df45ccbbbbf598f729eb047aa8aa53085f7d4a474`
contains four records. One locally blocked startup sync attempt and one
byte-identical startup profile replacement remain explicit; measured flow has
zero further writes/attempts and zero external writes. Profile bytes never change.

## Refreshed chart/context preview — 2026-09-08

[New preview acceptance](evidence/post-chart-clear/preview/REVIEW.md) is for
exact3845a04b, READY dpl_9PyqUeR6weQFUdYnAREXYEQjUAMZ before/after, target null.
All nine actual browser groups and independent 623-path/blob verification pass.
Root manifest `74f7b6119427429887ca05217d7be5d3e9d050b486c1245f245dd96be5ef2e07`
contains 75 records; all 69 served-JavaScript and 16 source-snapshot ordinary
archive members are individually verified. No AppleDouble metadata is present.
Actual served adapter coverage observes 12 natal calls and 43 data-free native
clear events. The preview renders no chart-linked capture shells; that behavior
is covered by the separately qualified exact-source fixtures, not by this run.

The observer records 993 request events, 874 response records and 871 fully
captured 200 responses; three bodies are unavailable. Nine Plausible GETs are
blocked; no API/non-GET request is observed in the test contexts. Access bootstrap
is separate and unobserved. Temporary access is deleted after an exact private
URL/query-value scan of 155 raw files plus 69 decompressed members finds no matches.
No server-side revocation or production network claim follows. Source manifest is
`9f90f684ec8a3492a7352cee5d6c0232fa6e5da3c8c8c1033281691d351f87d7`.
Current Site Check34217870622 has thirteen successful jobs with Build & Check
still running; the earlier c7 post-chart CI failure remains retained separately.

## Delivered C-014, completed C-012 CI and next confidence slice — 2026-09-08

The preceding in-progress CI statement is superseded by exact3845a04b Site Check
34217870622 completing successfully with all14 jobs. The [final snapshot](evidence/post-chart-clear/ci-final/ci.json)
has manifest `30f51fe4919db38626be625d49c8d1911e98893bc6c28677dd0239a33869fc6e`.
The six release refresh records have manifest
`9d1a8e064dcfa492770040425ed183cd01120ef47beff82e2dfd3d6a93c0b75c`.
The original c7b9eb4 failure and exact3845a04b nine-group preview remain distinct.

Draft #435 is delivered atf803d2543ad81343b22d49326b8b46d0e2ea03a0 above
3845a04b. Root and independent review verify all314 actual paths/blobs, including
16 source/test/metadata paths and298 documentation paths. Six release refresh
records use manifest `52a4ef21f721df069185f9ebf7ef1d3fdeb3edaa5bcf924bb963d5771058225e`.
Site Check34220407271 has13 successful jobs with Build & Check running in the
retained [in-progress snapshot](evidence/local-date-reference/ci-in-progress/ci.json),
manifest `fbf5b9f3f9af0eb4d130542e165e465ac2ee0320f54c9b525cd514968f196314`.

The [exact-source READY preview](evidence/local-date-reference/preview/REVIEW.md)
is dpl_HAJ4JzQd5wyNRPicr2YX6cLDqi7u before/after. Ten actual browser groups pass:
eight English/Russian Chart/Moon ×1280/390 real-city Apia refusal/recovery groups,
plus no-city UTC Moon and public positions; two nested English known-time gap
controls preserve point behavior. Four downloaded receipts identify rc.6 and the
valid Dec31 unknown-time reference. Eighteen screenshots,71 remote JavaScript
modules and two real city payloads are retained. No numerical-call count is
claimed. Existing Moon phase/date-wide copy is outside acceptance, with unchanged
source proof. A driver declaration syntax failure predating browser work remains.

The observer records819 request events and782 complete200 bodies,70 data-free
clear events, zero page errors/API/non-GET requests, eight expected sanitized
refusal diagnostics and ten blocked Plausible requests. Access bootstrap is
separately unobserved. Exact private URL/query scan of187 raw files plus94
decompressed members finds zero matches before local access deletion; no server
revocation claim follows. Root verifies101 records under manifest
`3827ab7fa098f606464ecdd338bbd442d0b2320aacadfbdc02b8bd52abb2dfd3`,
including all71 remote and23 source ordinary members, without AppleDouble files.
Source manifest: `967aa76a23f4410c44aa795b33d72251b46a1a8660351c14fd67cf8c8b49156d`.

The separate [normal-page audit](evidence/local-date-reference/normal-page-audit/REVIEW.md)
reconciles36 executed/24 accepted cases,72 screenshots,131 unique served files
with108 common byte-identical files,18 recorded source identities and18 release
captures. It does not claim a second browser run. Root verifies78 records under
manifest `0dce7662febeb4a75955924d19ddd181901cc20f13218073225ac99aafc045aa`.

Root selects C-015's conservative unknown-time confidence policy from the
[actual caller preparation](evidence/reference-confidence/preparation/REVIEW.md.log).
Toronto and Juneau member witnesses contradict current singleton Moon candidate
claims. The admitted reference numerics are preserved in policy controls while
empty candidates remove established Moon context and Moon-specific advice. No
false Sun sign is demonstrated. Root verifies nine records and all74 ordinary
archive members under manifest
`2327dd8a2f3d1fde364e95493077a5683c0bd5b5acc3798dc24b535b41298c00`.
Actual extracted caller execution is not actual DOM or independent astronomy
oracle evidence. The [scope record](evidence/reference-confidence/README.md)
keeps Moon phase/reference labels and downstream reference-Sun semantics open.
Author implementation and independent preparation proceed separately; root
product still matches deliveredf803d254 at this checkpoint. Nothing is published,
production-deployed, externally adopted or human-reviewed by these records.

The [independent C-015 preparation](evidence/reference-confidence/independent-preparation/REVIEW.md)
separately executes actual member/longitude/consumer modules atf803d254. Three
unknown-time controls, two known-time positives and skipped Apia establish the
finite policy consequences, with exact numerical JSON/receipt/token/in-memory
saved-projection preservation. It does not render the component or write storage.
Toronto's direct primitive differs in the final floating-point digits from the
caller-body figure; the raw results and separate paths are retained without a new
tolerance or cross-path bit-equality assertion. Root verifies nine records and97
ordinary compressed members under manifest
`6931df177a16619b141b831ac3535cd22401a1632ca456290a17398eca6a77d6`;
source manifest is`8c8ad6a933a5774494286c54341fecccf6f1cfaffdb49e4a3d18a4b0f161a309`.

## C-015 frozen implementation and root local acceptance — 2026-09-08

[Author Freeze2](evidence/reference-confidence/author-freeze2/REVIEW.md.log)
contains16 source/test files overf803d254. Identity
`54cd5acbc7f69c7b3935943a9380be10bb18e8ca2b5a90c1d1766625d8bca55c`
and patch`b13527901ee962d462b0ddd2bdbc16f82763ffa8ad7486d797358b46f76fd0a4`
are verified on root. Product scope is Chart confidence, six one-key catalog
additions and endpoint-helper comments; eight tests/drivers retain the changed
confidence and unchanged numerical/ownership contracts. Author93focused controls
pass on each Node22/24,20native,35date,17ownership,sharing,build/check and strict
types pass. The final author suite has5039pass and one stale capture-fingerprint
failure. Original path/setup/selector/count/comparator failures are retained.
The same-byte eight-file dependency copy resolves the two scratch module errors
reproduced on baseline; all67 previously blocked numerical controls then execute.

Root copy manifest`1f14d99624f3e94a6e104fab03b51bd5d434f2376cafddf95bafa8034985958e`
contains nine records and individually verifies all148 ordinary content-addressed
archive members and303 losslessly mapped original records. Source delivery
manifest: `8850dc1120eac72d8ac953bbbda4bc87bc0f3675c7a88572b7d435a2396b1c99`.
Early native driver identity fields read after subsequent edits are explicitly
superseded by retained execution snapshot mappings; the final driver is unchanged
during its accepted run. No original failure is relabeled a pass.

[Independent preservation](evidence/reference-confidence/preservation-review/REVIEW.md)
accepts19 actual component/native controls,15 exact numerical comparisons and12
immutable envelope comparisons. Native Blob receipt and stable fields of actual
local saves match baseline. A captured save writes the original chart once after
an edit while old UI stays cleared; a profile-boundary revoke before loading
suppresses primary work. Forty-two functions, two run spans and all other Chart
bytes reconstruct exactly after the named confidence delta; executable endpoint
helper AST is unchanged. Its fixture graph removes only that helper and adds no
input. These controlled cases are not actual backend or production-page evidence.
Root manifest`cdbb5cb2dcf721f6522ce1343f35b60aeb8396dbaf9b2b90dfdedd381daa4ed5`
contains13 records and285 individually verified ordinary members, from source
manifest`7074f314f7dc0bde290926233d1a603c7ba2083260d13e36a18b72cae88be6ef`.
Child consumer/counterexample acceptance remains separate and pending here.

The [metadata proposal](evidence/reference-confidence/metadata-proposal-review/REVIEW.md)
and [frozen compatibility supplement](evidence/reference-confidence/metadata-review/REVIEW.md)
accept precisely the four-line CI step and exact-base eight-path allowance.
Ten direct guard controls include old-base and missing/extra-path rejection;
the actual unchanged CLI passes18changed/8protected in the independent checkout.
Node22 parses the frozen driver; existing setup/browser/artifact/permission/pin
wiring remains unchanged. Runtime failures produce their result record; early
setup failures may leave only partial artifacts and job logs. Root manifests
are`57b990fa4590a1aa480056d1075d5a7e5c10c979d6ed68a2b09b878cd6510c5f`
(21records) and`9d47126aa388f49a31dbb5511b02173a7835e44685dbfad40bc5358d1e7eb21f`
(18records). Accepted patch`408d373d7221f7b8caf796a0e67e6ee7f458fcab0ca5ceac628b3a71dbfbb2a4`
is applied and root exact-base scope passes. No broad protected-scope exemption.

[Root local acceptance](evidence/reference-confidence/root-integration/README.md)
passes build/check (1045files,zero errors/warnings,11hints),5040tests/418files,
20native confidence,35date,17chart ownership and actual sharing. All18 fresh
approved captures are byte-identical tof803d254. Source receipt
`50d93d27c1409e48300103ba6608a24b7e5dd630debc5c8a66826420a6a73b26`
closes the stale fingerprint; no root dependency change or exception is needed.
The default native run omits the optional baseline directory; baseline equality
claims remain attached to their separate author/independent executions.

Twelve actual localized chart-page groups pass from ten initial plus two affected
English reruns. The original broad marker count also included the unchanged
English ReadingPath; scoping only the hero count fixes the harness. No product
source changes. Each accepted group covers unknown-time notice/withheld link,
real-city Apia refusal/recovery and known-time positive; all109 distinct served
build files match archived bytes. Root inspects the Russian phone recovery image.
No saved profile, non-GET, unhandled/unexpected console error or overflow is
observed; one expected sanitized refusal diagnostic per case remains. Original
fourteen executed cases and failed screenshots are preserved. Root manifest
`bfd3a7ec0e212060b5a7ac25e22d19552625a165f7a7b9f18ea97a2cf0feaa34`
contains20 records and248 ordinary objects preserving265 original records.

The [C-014 final CI snapshot](evidence/local-date-reference/ci-final/ci.json)
supersedes its pending statement: all14 jobs in34220407271 pass at exactf803d254.
Manifest:`40dcdafdbea98e52c7763804ee3ec84783990797fa30f0737c1a98e17fee11f7`.
The existing #435 description is updated without a source push, merge or deploy.

[Release-start refresh](evidence/reference-confidence/release-start/manifest.json),
five records under`254ceccdeeb2ee21147138fb30c8615f159c8fbbcffb07fbac0f392a784f2710`,
finds site main3d769698d387a7fbdbb5d57935b75cb7431d58ee and READY production
dpl_ABQQ4PctrxuPN6R9eyTDFuMf6YRg at that Registry-archive commit. Root remains on
the reviewed stack rather than overwriting those concurrent records. SDK main
remainsb49e0f14; SDK#5 stays draft atcced0116 with explicit no-merge/no-publish hold.
Astrofolio#416 remains draftb17d6804 with36actual paths, inspected and isolated;
its shared integration patches remain unapplied. The Vercel durable projection
keeps release identity fields and omits unnecessary creator/account metadata.
No C-015 draft, preview, hosted CI, publication, deployment or adoption yet follows.

The subsequent [frozen consumer review](evidence/reference-confidence/consumer-review/REVIEW.md)
accepts its separate scope. Its exact AST-bounded confidence span passes four
unknown-time and two known-time controls on Node22/24, with32 distinct actual
Inspector/share-dialog/ReadingPath/positions HTML artifacts identical across
runtimes. Twenty-four source/artifact checks and eight signature/context checks
pass, with all six420-key catalogs checked for the one added unverified sentence.
This advances from an in-memory policy model to the actual frozen branch and
actual server-rendered consumers. The body/projection comparisons do not claim
persistence, full component DOM or a full-date/ephemeris oracle. Baseline positive
Moon readings make the removal checks meaningful. Qualified scratch compilation
warnings are retained separately from root's successful full build/check.

Root verifies all197 source records with inert code copies; the199-record root
manifest is`46495f35edd85a782576d73b73dc971be890f3b5ce35f577089da755c799e7be`,
source manifest`a1cd83f207c7490037a3078038a0b21191b548e18648edd01433bdd667b88d1e`.
This completes the consumer review left pending in the earlier sealed reports.
Exact C-015 source is now accepted for isolated draft delivery, with hosted,
human-review, publication, deployment and adoption states still separate.

## C-015 draft delivery — 2026-09-08

Draft[#437](https://github.com/ZodiacsOfficial/site/pull/437) delivers
`9d180c9f1a2f66893ccd6d73fcda106cb3894674` above exactf803d254. Root verifies the
paginated actual534-file response against local status and Git blob identities:
all match,18 non-documentation paths and516 documentation paths. The response
SHA is`627824e590dca19da0ca32ab3cac50aff94eb7a551abfc77735eb7de1d94d8d8`.
[Release records](evidence/reference-confidence/release/pr-verification.json)
preserve the actual metadata, body, pagination and current run identification.
Site Check34225181572 is in progress; exact-preview work proceeds independently.
Root opens the separate reference-caption branch from this delivered source so
the candidate remains immutable while C-016 preparation continues. No merge,
production deployment, npm publication or external adoption is performed.

## C-016 preparation and implementation decision — 2026-09-08

[Author preparation](evidence/reference-captions/preparation/REVIEW.md.log) runs
ten actual extracted Moon-caller controls and four three-point phase-date controls
on Node22/Chrome152; the same browser outputs match with Temporal unavailable.
Four native caption fixtures establish hidden or absent qualifications. Khartoum
2000-01-15 resolves the requested12:00 to actual13:00 local while passing C-014;
the existing phase/position remains calculable. Three date controls change lite
phase category during the day. An additional same-instant lite/full category
boundary is retained as an existing separate algorithm issue, not silently fixed.
Actual share helpers, local OG HTML and clockless Inspector also assert noon.
One initial CSS bundle-path failure and its correction remain retained.

Root verifies nine records under manifest
`dc474a6626f077118e67b7fce5cbf4000ce594c7c3ef3700bfce426ed075dd90`,
including126 ordinary objects preserving127 original records. Source manifest:
`00412e89d5edf1a302f899e9ddee255116149939557433edd2ab17d9dc0c70a9`.
The [scope map](evidence/reference-captions/preparation/scope-map.json.log) is
explicitly selected in Decision C-016:23 product/copy sources plus necessary
tests, with root-owned generation/metadata and exact frozen review. Server scope
is exactly two existing output strings, without route/schema/header/privacy
changes. Three canonical translation counterpart keys have specific scope;
the earlier C-015 allowance does not authorize them by implication.

[Independent boundary preparation](evidence/reference-captions/independent-preparation/REVIEW.md)
uses exact9d180c9f and four helper/SSR controls. Valid no-angle tokens from06:17
and18:43 UTC contain no clock but produce12:00 OG captions. Supplied-time and
hidden-detail controls pass; clockless Inspector is distinct from the actual
public receiver, which already says positions only and does not open Inspector.
The local HTML handler is invoked directly, not over the network; no PNG raster
or complete component-browser claim. Original fixture build/setup failures are
retained, followed by a warning-free final build and passing controls.
Root verifies118 inert records under manifest
`64bae37ba4cf95c7f0980e15514a8b2c36b5913f638ad0143bb66c08a5a646fd`,
source manifest`eebd3b26ffd427767ce98ced83edcf6eeae86e027c4a5ef838f21d588c7eff52`.
Author implementation proceeds separately; no C-016 source is applied on root
or accepted yet. No new provenance field, numerical tolerance, provider, account,
SDK, canonical Registry/Astrofolio or publication change is authorized here.

## C-015 exact preview acceptance — 2026-09-08

The [independent preview review](evidence/reference-confidence/preview/REVIEW.md)
accepts exact9d180c9f at READY `dpl_DCezqWrsukzWV3F7NotmTQCq4ENp`,
`https://zodiacs-et5nq8c46-zodiacsofficial.vercel.app`, unchanged before/after.
Eight distinct EN/RU chart/positions groups at1280/390 pass across two executions:
six initially, then two affected English groups with the hero-only selector.
The original broad selector also counted unchanged ReadingPath markup; all
original failures and the complete three-part harness correction remain.
Actual offline Toronto/Juneau controls withhold unsupported certainty, a known
Toronto control preserves Registry/receipt behavior, and Apia refusal/recovery
clears and restores the current result. Sixteen native downloads parse as rc.6
receipts and match byte-for-byte across locales/widths for each of four inputs.

All68 distinct deployed JS payloads, four actual city payloads and28 selected
exact-source blobs are retained. Four status200 image bodies were unavailable
at context teardown; this is not complete HTTP-body capture. Twenty-six native
screenshots include original failures. The separate read-only evidence audit
reconciles all groups, source/driver identities,144 run-specific JS/city files
and16 receipts; it does not claim another browser execution. Main reviewer’s
exact private-value scan covers261raw files and96decompressed members with zero
matches, followed by local access removal. Bootstrap traffic remains unobserved;
no independent secret re-scan, server revocation or production activity is claimed.

Root verifies all144 source payloads and96 ordinary archive members, including
28 blobs against exact Git9d180c9f. The146-record root manifest is
`be74bdc516a0ef7dd7c51a2348f1762d16a15969ac6b3becd971a9ce1598ed5e`;
source manifest`dd97557038ccd0796cf0d3ca89a2996c80d960ad5b9916dcf5590801bc88c387`.
The child audit’s40-record seal is`7eec0908161dc6fe5397c99075fd55b578859c532025c2edcfe6c2cb1e15e8ae`.
Site Check34225181572 still has13 successful jobs and the build job running at
the subsequent read. Preview acceptance does not complete CI or human review,
merge, npm publication, production deployment or external adoption.

## C-016 frozen implementation and local integration — 2026-09-08

Root verifies and applies the exact33-file [author Freeze1](evidence/reference-captions/author-freeze1/REVIEW.md.log),
23 approved product/copy files and10 scoped tests. Identity:
`c055e55985284904cb82e39fa1eca53a035aa337a3a49a752240fcd5c7d21644`;
patch:`0371de7d739a8526f342e49c3fdb623fa646d8d405a91db4f7623cba5b835b36`.
All root starting files match exact9d180c9f before application; all frozen bytes
match afterward. Root's unchanged additions generator changes exactly one
English default line. The separate allowance/CI proposal is still unapplied.

The author seal retains142 focused controls on each Node22/24,227 expanded
affected controls,34 native caption/image groups,35 historical caller groups,
20 Moon-ownership groups and successful strict/Astro checks. Its full-suite
attempt is explicitly incomplete: absent dist, generated manifest/capture
currency, an obsolete comment anchor and external-symlink package loading were
not falsely presented as success. The test-only alias/anchor corrections and
incorrect optional historical-baseline invocation remain retained. Matching
before-C014 catalogs and byte-identical package-path isolation resolve those
scoped controls without changing product/dependency bytes.

Root verifies seven source payloads and154 ordinary archive members preserving
172 original paths. Its nine-record manifest is
`642988c2385726533517c3a72a215ab6bbcb83dab1ebeb2d6782160c6c2006be`;
source seal:`0948ba4c7cbf34559acca885976e83ae3ad69eab16d96acf317176c161ca8326`.
Root's fresh build/check passes (1,047 files; zero errors/warnings,11 hints),
followed by all5,091 tests in420 files. All18 fresh approved captures remain
byte-identical. Actual normal-build pages pass24 groups across six locales,
two widths and both Moon-tool and Chart Moon-mode routes. The historical
Khartoum reference, supplied/local and supplied/UTC captions, label transitions
and edit clearing pass; root visually inspects English desktop/Russian phone.
The root's own native caption/date/Moon-ownership gates pass34/35/20 groups;
optional baseline comparison was omitted here and remains separately attributed.
Final sharing and independent/metadata acceptance continue; no draft delivery,
human review, publication, production or adoption follows from this checkpoint.

## C-016 completed local and independent acceptance — 2026-09-08

[Root local acceptance](evidence/reference-captions/root-integration/README.md)
is sealed under`f2219750f04a88c1b69c05b1c59b0c4dd44a0cab30f43b07aebf33b94a451273`:
14 records and321 ordinary objects preserve340 original evidence paths. All33
frozen sources stay exact; generated manifest plus two metadata files are the
only root source additions. Build/check/5091tests,24 actual six-language page
groups,34caption/35date/20Moon native groups,sharing and18 byte-identical approved
captures pass. All104 served files rehash. Root inspects two screenshots and
retains48 actual-page images. Native optional baselines are not supplied here;
paired baseline correctness belongs to the separately attributed executions.

The actual sharing flow passes. Its deliberately regenerated33% sheet differs
from an older trackedAug20 sample, whose preceding C015 run recorded
`zoomEvidence:null`; it is not a fresh9d18 baseline. Both files, the prior log,
diagnostic comparison and exact three-change module reconstruction are retained.
Root restores only this owned generated output to9d18. A preflight method-field
bug was corrected before the first normal-page execution, and an archival
manifest-path mistake was corrected after its retained failure. No product
assertion or numerical tolerance is changed.

[Main preservation review](evidence/reference-captions/preservation-review/REVIEW.md)
passes24 actual lookup pairs (12 perNode22/24),15 distinct native groups across
initial14/15 plus correctedRU1/1,18 paired native comparisons and48 source checks.
The full known/unknown Chart/envelope strings remain exact without stripping
fields; endpoint/alternate metadata removal is separated from primary values.
Root verifies12 payloads and368 ordinary archive members; its14-record manifest
is`b89dd28a65e3aba6e9c1a5a6735a8121acb597cf09a7567fc3de632aecda30c2`,
source`81e2baa15e9abca55dea69ea41e4604485c872f0f24d7b38f6dc1ccbe7cfecdb`.

[Independent consumer review](evidence/reference-captions/consumer-review/REVIEW.md)
passes26 scoped source/copy and23 output comparisons, all six420-key catalogs,
four actual non-noon/supplied controls per source, five unchanged invalid-domain
responses and eight native PNG downloads. Its fresh supplied-time opt-in sheet
pair is byte-identical; numeric JSON, tokens and headers are unchanged. Actual
clockless Inspector is kept distinct from the positions-only public receiver.
The missing-catalog fixture and locale-order audit failures remain qualified.
Root verifies all271 source payloads; its273-record manifest is
`36834fae7a591a067e22f9b6e22be58bb61664742c8f86d9f028587fd106d7cf`,
source`6ac061cfde7b0755cb752f303910f516681b673369ac544996f383236acd2334`.
Root's initial copy attempt mistook the numeric count for the file list and
failed before copying; the actual schema was inspected and all bytes verified.

[Separate metadata/generator acceptance](evidence/reference-captions/metadata-review/REVIEW.md)
passes23 controls and independently regenerates the exact one-line output.
Root27-record manifest:`3ab151872658928ab6b90972ea063485feebac328140b21d7d457a3419ec7a0f`;
source`1517480331f5da4715d52b46fce3e3ca41c3d25b81920ad1f81a08be5164d499`.
After applying the accepted two-file patch, actual scope CLI passes13 protected
paths at exact9d18 and136 affected metadata tests pass. Root accepts this bounded
candidate for separate draft delivery; exact hosted evidence and human gates
remain distinct. Read-only phase-category preparation may continue separately.

The [C-015 final CI snapshot](evidence/reference-confidence/ci-final/ci.json)
now records all14 jobs in34225181572 successful at exact9d180c9f. Manifest:
`e8c53017ab54493ce712ccd27eb58794ae33eff641465b7843dcb7c66bb5993a`.
Its existing draft description is updated with completed CI/preview; no source
push, merge, npm publication or production promotion is performed.

## C-016 evidence audit and isolated delivery — 2026-09-08

[Normal-page evidence audit](evidence/reference-captions/normal-page-audit/REVIEW.md)
accepts114 recorded assertions and rehashes all14 root payloads,340 original
records/321 ordinary archive objects,104 served files and33 frozen sources.
Root verifies its20 unchanged payloads; the22-record root manifest is
`a24dc52e5d65046b6b457615f2fdf6a06206f883167e082fd2a76d33fb392510`.
[Sharing supplement](evidence/reference-captions/sharing-evidence-audit/REVIEW.md)
accepts18 scoped assertions, including the prior actual null zoom capture,
restored image bytes and exact three-change rendering-module reconstruction.
Its22-record root manifest is
`0578a82a20e364a32612206b0104150bfc632ddeb72cc6e3b48a30b7379d8891`.
No new browser execution is claimed by either audit. Their corrigendum supersedes
only the causal wording in the sealed root README: old/new images differ, and the
old sample is not a fresh baseline; the cause of that difference is unproven.
The August history is root-recorded, since independent Git reads stalled.

Shared read-only Git operations now stall on a locally dataless packed-object
index. A bounded cat-file probe times out, while config and rev-parse work. Root
stops only its identified read-only checks and clones exact remote9d180c9f into
an isolated temporary delivery checkout. No shared Git repair, metadata deletion,
concurrent process termination or source rollback is performed. Source-equivalent
delivery must match all accepted hashes and actual changed paths.

## C-016 finite closeout — 2026-09-12

Draft[#438](https://github.com/ZodiacsOfficial/site/pull/438) remains at9912e37
above9d180c9f. All722 actual path/status/blob identities match, with36 accepted
non-documentation files. [Exact hosted preview](evidence/reference-captions/hosted-preview/REVIEW.md)
passes14 groups;28 screenshots and72 served bodies verify, with four unavailable
image bodies and unobserved isolated access bootstrap explicitly retained.
Root manifest:`3645221710fd195c5d79500f612e3ce9fe62f2ca5a6efbb6951c10be58468f89`.
No prior unchanged numerical/preservation matrix or full local suite is repeated.

[Initial hosted CI](evidence/reference-captions/hosted-ci-initial/README.md) has
13 passing jobs and two failed performance samples in its build job. Six original
Lighthouse member records justify one unchanged-source retry; full archive
verification is not claimed for range retrieval. Attempt2 fails on newly reported
production dependency advisories. [Preserved maintenance proposal](evidence/reference-captions/release-blockers/REVIEW.md)
clears audit gates but cannot complete a fresh build without current paired
publication data, which exposes three Registry research test failures. It is
preserved and restored out of the candidate; no source, threshold or gate is
weakened. Blocker manifest:`f427f88d0cc3f8b7c147216b8c0b762f90bc90952ea1a003f757a6ac0b19583c`.

[Final closeout](evidence/reference-captions/closeout/README.md) records implemented,
locally tested and preview-verified status, with hosted release acceptance still
blocked. SDK#5 remains explicitly held. [Finite checklist](REMAINING.md) separates
release blockers, later work and external authority/evidence. No C017, new audit,
merge, npm publication, production promotion or external adoption follows.


## R1/R2 maintenance verification — 2026-09-12

The owner explicitly authorized completing R1 and R2 together, from the preserved
minimum-version proposal and existing failures. The new draft stays stacked on
C-016; R3 and L1–L6, merges, publication and production deployment are excluded.
[Maintenance record](evidence/r1-r2-maintenance/README.md) tracks the corrected
source, evidence reuse, new failures and required hosted results.

### R1/R2 closed — 2026-09-12

Draft #469 at `35301d24907b6eb7117a1f4b0ae690ca42c57de6` passes all 14 hosted
jobs (34688849189), including the unchanged performance and widget gates.
Final local build/typecheck, 5,091 tests and 18 captures pass; the exact preview
passes 22 groups and five served-artifact comparisons.
[Complete evidence and qualifications](evidence/r1-r2-maintenance/README.md).
R1/R2 are complete for review. R3 and L1–L6 remain untouched, and all owner,
human and publication gates remain. Final documents are local/mirrored; no
documentation-only hosted rerun is requested and no release is performed.

## R3 refreshed evidence — 2026-09-12

See [R3 release integration](evidence/r3-release-integration/README.md) for fresh source identities, conflict resolutions, dependency/artifact proofs, rollback, local checks and hosted results. Historical evidence is not relabeled as final-tree evidence.


## L3a inactive saved receipt prerequisite — 2026-09-14

[Current verification record](evidence/l3-saved-records/README.md) records the
refreshed main and actual #426 identities, selective integration, immutable
receipt/legacy checks and new native durable erasure cases. Previous L2b release
and post-merge checks are complete; their durable closeout is restored from
[evidence/l2b-production](evidence/l2b-production/README.md), not rerun.
Current L3a draft/hosted/preview checks are pending; no active storage or release
claim is made. See [activation dependencies](evidence/l3-saved-records/ACTIVATION-DEPENDENCIES.md).


## L3b/c candidate and usability fixes — 2026-09-14

[Candidate record](evidence/l3-saved-records/L3BC-README.md) lists the branch
identities, support matrix, mechanism deviations and the verification actually
run on the final source: unit suites, 30 native storage groups
(`native-result.json`), the 12-check flag-on journey drive
(`lifecycle-result.json`), and the flag-off gates. The adversarial review and
each disposition are in [REVIEW-2026-09-14](evidence/l3-saved-records/REVIEW-2026-09-14.md);
usability reproductions and re-verification in
[usability-2026-09-14](evidence/usability-2026-09-14/README.md). No hosted
check, preview or release claim is made for this candidate.
