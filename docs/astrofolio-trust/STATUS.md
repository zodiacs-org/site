# Astrofolio verification checkpoint

2026-09-08 Asia/Bangkok. [Draft PR #416](https://github.com/ZodiacsOfficial/site/pull/416).
Branch: `codex/astrofolio-verification`. Base/main:
`7f953e3fca0e7d5009e5602a1dad69edff0f54cc`. This bounded workstream does not
restart the platform program and has performed no production merge/deployment.

## Implemented slice

- `/registry/verify/`: one noindex Astrofolio verification destination in the
  approved Registry wing, using the shared Base, footer, fonts and sign artwork.
  `/astrofolio/verify/` was rejected because it is outside the approved consumer carve-out.
- All 24 network-specific identifiers derive from Registry 0.2.0; no second
  canonical address list. Static records and embedded JSON share the same model.
- Ten qualified claims preserve operator statements, July 2024 mint creation,
  original July 2026 receipt review, unresolved rights and source contradictions.
  Exact-source pins fail closed on source drift; rebuilding never renews a claim.
- Each check fetches and validates the same-origin Registry and its raw SHA-256.
  Failure, changed bytes, wrong network, malformed input, unsupported network,
  non-match and match remain distinct. Input edits/cancellation erase old results.
- Existing address parser is reused. Solana is case-sensitive; Unicode is rejected;
  Base is a hexadecimal-byte membership check without mixed-case checksum validation.
  Tests explicitly distinguish that behaviour from SDK 1.0.1 validation.
- No wallet, signature or transaction. Pasted identifiers enter no URL, request,
  analytics event or persistent storage. Same-origin cookies may accompany the
  Registry request for site/preview authentication, as disclosed on the page.
- No separate JSON endpoint or root crawler change: complete machine facts live
  inside the same noindex HTML and retain qualifications, source links and unknowns.

## File-ownership manifest

Owned only:
`src/pages/registry/verify/**`, `src/registry/astrofolio-verification/**`,
`tests/astrofolio-verification/**`, `docs/astrofolio-trust/**`.

Read-only dependencies: canonical Registry JSON, origin receipts, EN disclosure
statements, About/Terms/thesis records, shared wallet parser, Base/SEO/footer/fonts,
all engine/SDK/API/developer-platform sources, package/lock, configuration,
Registry generators, global navigation, sitemap and AI guides. No tracked changes
outside owned paths. The manifest coordinates ownership; it is not a lock.

Shared proposals are unapplied in [integration/](integration/README.md):
1. Exact-base, one-route Phase 1 allowance using the existing mechanism.
2. One contextual link in the Registry generator, with its generated hub output
   reserved for the primary integrator. Both patches pass `git apply --check`.
No new source-boundary exceptions, dependency changes or weakened checks.

## Actual validation

Application source: `4704acc5c7a0625dedd7601009b9c17207892ba9`.
Checker reference including preview authentication:
`59923241f49942025add0463b56984cdd0c5c668`.
The later evidence/harness/checkpoint commit changes no application source.

With Node 22.23.2 on PATH, from this repository:

```sh
npm run build
npm run check
node node_modules/vitest/vitest.mjs run --maxWorkers=2
node tests/astrofolio-verification/browser.mjs
node scripts/phase1-scope-guard.mjs --base 7f953e3fca0e7d5009e5602a1dad69edff0f54cc
```

- Full build passed, including prebuild publication/drift checks and postbuild
  links, schemas, widgets and bundle budgets. Check passed: zero errors/warnings,
  eleven existing hints. See [build](evidence/build-node22.log) and
  [check](evidence/check-node22.log).
- Full suite: **4,484 tests / 406 files passed, no skips**, with two workers;
  includes **75 new scoped tests** (48 checker, 22 evidence, 5 rendered).
  [Final log](evidence/tests-node22.log). The first default-worker run had three
  unrelated five-second timeouts under concurrent load; preserved in
  [first failure](evidence/first-test-timeouts.log). No timeout or test was weakened.
- Chromium 152.0.7977.83: **11/11 local browser scenarios passed**, desktop1280,
  mobile390/320, measured key-text contrast, reduced motion, keyboard/focus/copy,
  no-JS records, request/URL/storage privacy, changed/failed source, interrupted
  requests and actual service-worker offline retry. [Report](evidence/browser-results.json).
- Local served HTML SHA-256:
  `3b3ad38c6ad766cfc455444bef9a38779697b555405990c97b749d36ac0506d0`.
  [Desktop](evidence/verification-1280-hero.png),
  [mobile](evidence/verification-390-hero.png),
  [320px](evidence/verification-320-hero.png),
  [expanded records](evidence/verification-records-390.png).
- Six existing shared shell assets miss offline; exact URLs remain in the browser
  report. Cached page facts stay labeled as a snapshot, and Registry checks fail
  honestly offline. Their unrelated caching is not changed here.
- Earlier browser findings (narrow overflow, a no-JS test locator, expected offline
  resource diagnostics) are preserved in [initial findings](evidence/browser-initial-findings.json).
- The Phase 1 scope gate intentionally still rejects the one new Registry route:
  [local output](evidence/scope-guard.log), [CI excerpt](evidence/ci-scope-excerpt.log),
  [exact application-head job](https://github.com/ZodiacsOfficial/site/actions/runs/34159982069/job/101859539467).
  This shared allowance remains the primary integrator's change. The draft is not
  represented as green release CI or production-ready.

## Answer evaluation

[Twenty fixtures](evaluation-fixtures.json) cover identity, dates, evidence status,
rights, counterfeit implications, normalization, failed sources and candidate releases.
A separate Codex subagent received only the prompts and emitted evidence model,
without inherited conversation or the answer rubric. Exact runtime model ID was
not exposed; first answers are preserved with environment/date/source conditions.

[Source-grounded result](evidence/source-grounded-evaluation.json): requested
identifiers correct; no invented positive identity/rights/endorsement claims.
Fourteen answers met all reviewed requirements; five had citation gaps and two
omitted requested qualifications (overlapping counts). The page now links the
checker source directly. Answers were not rerun after that correction. The
integrator's assessment is not independent certification. Unprimed public discovery
remains pending; a protected preview is not evidence of search visibility or adoption.

## Refreshed platform boundaries

Final live GitHub refresh: 2026-09-07 20:44:28 UTC. Main and all three heads below
were unchanged; complete paginated file lists were compared again.

- Site PR #415 remains open at `4bb0d70eaaf21ea950a8fe708a0e1a91f8fb1f4f`;
  its actual `docs/platform/STATUS.md` was read, not edited.
- New [PR #417](https://github.com/ZodiacsOfficial/site/pull/417),
  `codex/platform-developer-entry`, remains open at
  `8343f173e4db2e8ab6628bd04590e41b056872ce`; its branch status was also read.
  Completed 211-file / 83-file comparisons find **zero owned-file overlap**:
  [evidence](evidence/upstream-overlap.json).
- SDK draft PR #6 remains open at `03bf77990f3014b9125eed4976d7a41200aac80d`;
  publication/merge hold is unchanged. Old SDK publications are distinct from the
  new engine candidate. Primary-session test reports are not this session's tests.
- PR #413 concerns sitemap/routes/assistant; #289 footer; #226/#227 transaction
  surfaces. These shared areas remain untouched. Repository evidence does not
  reveal unpushed work or prove another task's current activity.
- README's Warm Gilt text conflicts with newer CLAUDE.md; the implementation
  follows the latter's Cosmic Void design and preserved content boundary.

## Material questions and next action

[Evidence gap queue](EVIDENCE-GAPS.md): independent entity/rights provenance;
applicable token-holder grants; scope of economic interests/administrative control;
exact trademark or affiliation evidence only if such claims are intended. Private
supporting documents belong in owner/counsel review, not this public PR.

Next: primary integrator reviews the page and two integration patches, recomputes
any combined allowance against the actual integration base, and runs CI after
applying approved shared changes. Keep noindex and SDK holds. This task must not
merge, publish packages or deploy to production.

## Preview

[Application preview](https://zodiacs-lkqoi56y1-zodiacsofficial.vercel.app/registry/verify/)
is **READY**, built by the existing Vercel Git integration from application commit
`4704acc5c7a0625dedd7601009b9c17207892ba9`. Deployment
`dpl_7YCQjVMJXoQAdJmV4YVfZNJywvLG`, project
`prj_nRTO3q3aNYLfaM3dotAowOc028fO`, preview target (`null`), PR #416 and exact
source SHA were verified through the Vercel connector. No production alias changed.

Final anonymous Chromium reached **Log in to Vercel**; its first layout scenario
stopped at authentication, and the other remote product scenarios were not run.
See [actual result](evidence/browser-preview-results-layout-1280.json).
This is a deployment-access limitation, not a passing remote product test. Local
desktop/mobile captures and all eleven local scenarios remain the tested evidence.

Automatic approval review rejected the proposed authenticated remote browser run
because it treated stored browser authorization as a sensitive payload to an
unverified destination. A non-secret inspection then found the state file empty
(zero cookies, zero origins); a fresh anonymous run was used as the safer option.
The verified deployment still requires authentication. No authenticated retry or
alternative transmission was attempted after that rejection. Temporary access
material stayed outside the repository and was removed. Completing protected
remote browser verification requires permission to use temporary Vercel preview
authentication scoped to this exact deployment; no personal browser profile is
needed. Public unprimed discovery remains pending until suitable public release.
