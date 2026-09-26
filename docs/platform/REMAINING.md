# Finite remaining platform checklist

Current checkpoint: 2026-09-16. L2a, L2b and L3b/c are released and production-verified. The saved-records feature is merged and deployed but inactive: activating its flag is a Vercel project change this environment cannot make.
Historical source-specific evidence remains linked from [STATUS](STATUS.md).

## Completed release work

- [x] **R1/R2:** dependency/current-edition maintenance and hosted gates completed in
  [#469](https://github.com/ZodiacsOfficial/site/pull/469).
- [x] **R3:** accepted site/SDK integration drafts verified. Site-only
  [#471](https://github.com/ZodiacsOfficial/site/pull/471) released with pinned rc.6;
  SDK integration remains under its merge/npm hold.
- [x] **L1:** [#476](https://github.com/ZodiacsOfficial/site/pull/476) merged as
  `307c832e662e1996ee904f11fb1678e402808a03`; production verified, all 14 post-merge
  jobs passed. The subsequent L2a release preserves the L1 runtime.
  [Release evidence](evidence/l1-production/README.md).

## Current bounded L2 work

- [x] **L2a — Downstream unknown-time reference-Sun interpretation.** Withhold
  unverified automatic sign personalization, qualify reference readings and names,
  preserve known-time/manual choices and numerical/receipt bytes. Released [#480](https://github.com/ZodiacsOfficial/site/pull/480)
  at `2e7b676d`: all 14 hosted jobs and exact-source protected preview pass.
  Merged as `87f18e0a`; production flows verified. All 14 automatic post-merge jobs passed.
  [Release evidence](evidence/l2-production/README.md).
- [x] **L2b — Conditional complete-date interval activation (released).**
  [#481](https://github.com/ZodiacsOfficial/site/pull/481) at `370fddf7224053ca42d0942945d850ab5b8d608c`:
  native contract, explicit ordinary/skipped/repeated/disconnected-date policies and
  reference-only caller activation implemented. All 14 hosted jobs and the exact-source
  protected preview pass. No sampled completeness, replacement instant or Sun/Moon
  sign certification. Known-time behavior and numerical/receipt bytes are preserved.
  [Contract and limitations](evidence/l2b-date-coverage/CONTRACT.md),
  [release evidence](evidence/l2b-production/README.md). Owner-approved and merged as
  `dfeae5f9178a6d887209710083c2a74fae258236`; exact approved tree deployed and verified
  on apex/www, with all 14 automatic post-merge jobs passed.
  Runtime absence/failure remains uncertain; broader historical truth and complete
  astronomical sign-range evidence are not established by this date-coverage slice.

## Current L3 work — candidate on branch, inactive by flag

- [x] **L3a — Inactive durable receipt store:** draft #486 (`99d22482`) merged
  verbatim into the candidate branch; its native barriers are superseded by the
  admission-generation protocol below.
- [x] **L3b — Authoritative lifecycle integration (candidate):** durable admission
  generations with two-phase, target-bound erasure (`650768a9`); strict record
  capability derived from the existing lease/grant/marker coordinator across
  guest, account and retained scopes, content-free discovery before the empty-browser
  auto-bind, awaited erasure inside sign-out, hand-off and deletion transitions
  (`f1efe17f`); owner intents pinned to the device generation, store-enforced
  read-only, cross-tab scope announcements (`35da3485`).
- [x] **L3c — Complete user lifecycle (candidate):** explicit keep on the result,
  records panel under Profile (six locales), exact-byte download, per-record and
  listed-namespace removal, recovery of interrupted removals, explicit readmission,
  uncertain-keep reconciliation; 12-check browser journey and a flag-on CI job
  (`b5666134`). Legacy records are never migrated, relabeled or reconstructed.
- [x] **L3 deletion and activation hardening (2026-09-15):** module load
  failure blocks destructive cleanup; absence re-checked under the exclusive
  transition; single removals broadcast; feedback bound to its namespace; real
  bootstrap/panel browser journeys with intercepted auth and backend,
  unknown-time keep, 40-record refusal, Firefox native and lifecycle runs
  ([HARDENING-2026-09-15](evidence/l3-saved-records/HARDENING-2026-09-15.md)).
- [x] **L3 review, merge and release.** Three bounded AI reviewers ran against
  `ed585d3c`; their two release-blocking findings, the merge blocker and the
  product findings are closed, each with a test that reproduces the original gap
  ([REVIEW-2026-09-16](evidence/l3-saved-records/REVIEW-2026-09-16.md),
  [product](evidence/l3-saved-records/REVIEW-2026-09-16-product.md)).
  [#490](https://github.com/ZodiacsOfficial/site/pull/490) merged as `52ae6eeb`
  with all 19 checks green; production deployment
  `dpl_CZsZBKawNkeiKMuF1NwJSWwsdsAS` is READY from that commit and verified live
  as flag-off. Superseded draft #486 closed without merging. The
  off → on → off → on flag sequence is gated
  ([ROLLBACK](evidence/l3-saved-records/ROLLBACK.md)).
- [ ] **L3 activation.** `PUBLIC_SAVED_RECORDS_ENABLED=1` in the Vercel project,
  then redeploy and verify the live journeys. **Blocked here:** the Vercel
  surface in this session has no environment-variable tool — all 37 were
  enumerated and none creates or updates one — there is no Vercel CLI or token,
  and baking the flag into the repository would break the documented
  rollback and turn the flag-off CI build into a flag-on one. Steps, verification
  and the smallest missing action:
  [ACTIVATION](evidence/l3-saved-records/ACTIVATION.md). Still open and recorded
  rather than claimed: no real assistive technology was used (the screen-reader
  findings are measured DOM and ARIA facts); WebKit and real iOS Safari were not
  available, so no Safari claim is made; a hosted preview remains blocked by the
  Vercel production-only build policy.

[Candidate record](evidence/l3-saved-records/L3BC-README.md),
[plan](evidence/l3-saved-records/L3BC-PLAN.md),
[historical dependencies](evidence/l3-saved-records/ACTIVATION-DEPENDENCIES.md).

## Forward backlog — one list (A–E), reconciled with the L-series

The original A–E acceptance letters and the later L-series checklist described
the same programme twice. They are reconciled here once, and this is now the
only forward list. The L numbers are kept as aliases so older evidence still
resolves.

- [ ] **A — Engine release and support contract** (subsumes L4 and the former
  SDK publication hold). Bounded numerical and support work for the advertised
  release: recorded ranges, degenerate angles, invalid inputs, timezone limits
  and bounded return/event searches, validated against independently sourced
  reference cases with matched conventions. Then the release version, exact
  artifact, retained notices and a clean external installation.
  **State:** `@zodiacs/engine@0.1.1-rc.9` is built, vendored and verified
  (artifact SHA-256 matches its record, and a clean external project installs
  the exact tarball and computes an ordinary natal chart through the documented
  public entry points). It is **not published**: `@zodiacs/engine` returns 404
  from the public registry and this environment holds no npm credentials.
  See [the engine release record](evidence/engine-release/README.md).
- [ ] **B — Developer onboarding and existing public data.** Audited against
  each named requirement on 2026-09-17; most of it was already built, two gates
  were missing and are now closed, and one requirement was marked met in error
  and is still open.
  - *Ordinary successful chart first, advanced verification after* — **not met;
    previously marked met in error.** The heading reads "Start with a working
    result", but the first example's actual inputs are December 21 2001 at
    78.2232°N, 15.6267°E requesting Placidus and succeeding through
    `polar-fallback` — an edge-case demonstration, inside the starter artifact
    itself (`src/natal.html` and `tests/calculate.check.mjs` in
    `zodiacs-platform-starter-0.1.0-rc.3`). The claim was made from the heading
    without reading the inputs. **Fixed in B1 below** (starter `0.1.0-rc.4`);
    this entry records the finding, not an open item.
  - *A working demonstration on the real engine, and documented setup verified
    from a clean environment* — met by the platform starter and
    `scripts/verify-platform-starter.mjs`, which installs it in a fresh
    directory in CI.
  - *Freshness, schema, timestamp, coverage, attribution, stale/error* — met.
    `sky-api.test.mjs` validates every payload against its published schema,
    bounds each window by its scan horizon and flags truncated ones; payloads
    carry `generatedAt`, `snapshotAt`, `coverage`, `versioning`, `license` and
    `attribution`; the quickstart rejects HTTP errors before decoding.
  - *Caching* — **was ungated.** The delivery contract lived in `vercel.json`
    alone. `scripts/sky-api-headers.test.mjs` now checks all 59 files the
    builder writes for wildcard CORS, `noindex` and `must-revalidate`, requires
    each of the 43 advertised endpoints to be a file that is actually written,
    and bounds every `max-age` by a limit parsed from that endpoint's own
    `updates` sentence rather than a constant. It pins the tiering so
    `today.json` cannot become the stalest thing in the family and `index.json`
    must stay strictly tighter than the family default.
  - *Embed path private, isolated, attributed* — **was partly ungated.**
    `verify-widgets.mjs` checked three routes while four were building;
    `/embed/sky/light/` shipped with no backlink, tracking or budget check at
    all. Routes are now discovered from the build, with `sky/light` in the
    required floor so a route that stops building is noticed too.
  - *Embed path keyboard-operable* — **was unverified.** The widget drive now
    tabs to the attribution link on every route it discovers from the build, and
    requires a focus indicator that is actually painted — a fully transparent
    outline or shadow fails.
  - *Quick-start ordering* — done. The `/developers/` quick start now leads with
    the one-line `curl`, states the freshness limitation next to it, and keeps
    the hardened fetch example immediately below.
- [x] **B1 — Ordinary first chart in the developer starter.** Done in starter
  `0.1.0-rc.4`: the shipped defaults are June 15 1990 at 13:30 UTC, 51.5074° /
  −0.1278°, requesting Placidus and getting it — `houses.actual: "placidus"`,
  `resultFlags: []`, ASC 191.239748° computed on the starter's own pinned engine
  `0.1.1-rc.3`, not transcribed from the site's newer one. The polar case stays,
  named as an advanced example, in the README, the examples page, both
  clean-consumer test files and the browser drive. `rc.2` and `rc.3` are
  untouched; the manifest points at the new archive. Original scope: The starter's
  `src/natal.html` ships Svalbard defaults (78.2232°N, 15.6267°E, 2001-12-21,
  Placidus) that resolve through `polar-fallback`, and its `calculate.check.mjs`
  and `receipt.check.mjs` use the same case as their primary fixture. Replace the
  default with an ordinary non-polar chart inside the documented support scope,
  keep the polar case as a named advanced example, and keep the docs page, the
  starter defaults, the stated expected output and the clean-consumer tests
  consistent. The archive is immutable and published, so this produces a new
  `rc.4` artifact and manifest; `rc.2` and `rc.3` stay untouched.

- [ ] **C — Narrow hosted beta** (alias L5). Natal-chart and transit-snapshot
  operations only, on the shared validated engine, behind explicit schemas,
  input/date/duration/concurrency limits, authentication or tightly bounded
  demonstrator access, quotas, cancellation and dependency-failure behaviour,
  no secrets in browser bundles, no birth details or credentials in logs, no
  personal responses in public caches, no automatic persistence, measured
  latency and bounded cost, health checks, release identity and tested rollback.
- [ ] **D — First diagnostic and real agent integration** (alias L6). The
  bounded chart-difference explainer over validated receipts, numbers before
  prose, every explanation classified as established from metadata, reproduced
  by controlled recalculation, hypothesis, or unresolved; false confident
  explanations measured, not just successes. Then a thin agent adapter over
  existing functions, verified against an actual supported client, with
  deterministic calculation never routed through a model.
  **State: both halves are now delivered.** The agent adapter landed
  2026-09-17: `zodiacs-mcp-server@0.1.0-rc.1`, a local stdio MCP server over
  the real `natalChart`, the real envelope codec and the real
  `compareEnvelopes` — no copied formula, validator or explanation rule, which
  is why it lives in this repository rather than the SDK's. Three tools,
  stdio only, no listener and no network. Verified in four separate records
  because they are four separate claims: the official SDK client against the
  real server process (70/70), the Claude Code CLI launching it and reporting
  it connected (7/7), a model actually calling the tools through that host
  (one run, verbatim), and a synthetic regression corpus of ten record pairs
  whose expected classifications were committed before the candidate ran
  (10/10 scenarios, 59/59 assertions). Deterministic calculation is never
  routed through a model: the model supplies arguments and reads results, and
  the numbers come from the engine.
  Neither the adapter nor the engine is published; both report
  `unpublished-candidate`. Claude Desktop could not be exercised — macOS and
  Windows only — and that is stated rather than worked around. See
  [what was built and what was established](evidence/mcp-adapter/README.md).

  That corpus also earned its keep on the first run: writing the expectations
  first found `cusps-shape` reported as explained by nothing when an absent
  birth time was its stated cause, and then found that the coverage test which
  should have caught it was unfalsifiable — it counted the unresolved bucket,
  which claims every leftover row by construction. Both fixed, both verified by
  mutation.
  `/developers/compare/` reads two `zodiacs.natal-envelope.draft-v1` receipts in
  the browser, lists every differing value before any prose, and labels each
  offered cause `reproduced`, `reported`, `hypothesis` or `unresolved`. Two
  bounded AI reviews of the first candidate found nine defects, each reproduced
  before it was fixed and each with a regression test verified to fail on
  `fef5f9bf`. See [the method and tested limits](evidence/chart-compare/README.md).

  On *"false confident explanations measured, not just successes"* — partly.
  What exists is targeted adversarial cases, not a rate over a corpus: a
  recalculation may not reach `reproduced` unless it reproduced the rows that
  actually moved and the engine version matches the one the receipt names; an
  explanation may not claim a row it could not have moved, nor may an unrelated
  difference absorb one it could not have caused; and a receipt claiming an
  engine this page does not hold is never re-run and presented as the original.
  Each of those is asserted, and each assertion was checked to fail without its
  fix. **A false-confidence rate over a corpus of real disagreements has not
  been measured**, because the corpus does not exist yet — which is what the
  prepared, unsent feedback request in
  [the announcement draft](evidence/chart-compare/ANNOUNCEMENT-DRAFT.md) asks
  for.
- [ ] **E — Adoption and reference materials.** Source-backed reference and
  contribution materials prioritising chart differences, calculation
  assumptions, uncertainty and integration examples; AI-generated editorial work
  identified as such; an invitation for independent builders through an existing
  approved contact path; onboarding tasks, a feedback template and a prospect
  packet prepared but not sent; an adoption ledger separating prospect, trial,
  independently live, retained and paying.
  **Prepared, not sent:** the five-step trial for three to five independent
  builders is written out with exact inputs and exact expected output for every
  step, measured against the published rc.4 archive rather than the working tree
  — [TRIAL-DRAFT](evidence/mcp-adapter/TRIAL-DRAFT.md). The contact route is the
  established one, issues on the site repository. It has not been sent, no
  recipients are named, and naming them is the owner's call. Nobody outside this
  work has used the adapter; our own drives are ours and are not adoption.

Birth-time sensitivity, broad generated interpretation, new traditions,
marketplaces and large content programmes are later opportunities, not
dependencies of this release.

## Owner and external gates

- [x] **O1/O2/O3 for released site #471 and L1:** exact owner approval and production
  verification recorded; no pending L1 human-review or production gate remains.
- [x] **L2a owner release approval:** exact candidate `2e7b676d` approved and released.
- [x] **L2b release:** exact candidate `370fddf` approved and released through #481.
- [x] **Human engineering review:** superseded on 2026-09-16. The owner replaced
  it with evidence-based automated adversarial review for this programme
  ([D-2026-09-16](DECISIONS.md)). AI review is recorded as AI review; no human,
  practitioner, attorney, customer or independent-auditor signoff is claimed.
- [ ] **Engine npm publication:** authorized by the owner, blocked by the
  environment. Corrected 2026-09-17 — the earlier entry here named two blockers
  and the wrong preferred fix.
  **The blocker is npm authentication, and no workflow substitutes for it on a
  first publication.** `npm whoami` fails with `ENEEDAUTH`, there is no
  `~/.npmrc`, and no `NPM_TOKEN` or `NODE_AUTH_TOKEN` in the environment. This
  entry previously called an npm trusted-publishing (OIDC) workflow the
  preferred fix; that is the right destination and the wrong first step. Trusted
  publishing is configured per package, on that package's settings page on
  npmjs.com, so the package must already exist —
  [`npm/cli#8544`](https://github.com/npm/cli/issues/8544) is the open request to
  allow an initial version over OIDC and states the limitation directly. So the
  first release needs a credential and a maintainer; OIDC can only take over
  from the second. `npm whoami` alone never settled this: it answers whether
  this shell is authenticated, not whether CI could publish.
  **No longer a blocker:** the earlier entry said write access to
  `ZodiacsOfficial/sdk` was denied. The maintainer account holds
  `admin`/`push` on that repository — re-confirmed 2026-09-18 by
  `GET /repos/ZodiacsOfficial/sdk` → `.permissions`. Whether *this session's*
  push path would work is untested (the probe was refused by the local
  permission layer, not by GitHub) and does not matter, since publication is a
  maintainer action.
  **Also worth recording:** from rc.7 the engine is its own repository,
  `zodiacs-org/engine`, and it is on `main` there: the source of
  `@zodiacs/engine@0.1.1-rc.9` is commit `82aad2fc` at the repository root, and
  the archive is committed at `fa1050e0`, both merged in engine #4 (rc.8's,
  `352ea49d` and `a5b7d1d1`, in engine #3; rc.7's, `6e14f3f7` and `f37dcdd6`,
  in engine #2). Up to rc.6
  it was `packages/engine` of `ZodiacsOfficial/sdk`, pinned at `fb57af7a` on
  a branch, never on sdk `main`. There is still no publish workflow anywhere:
  engine `main` has only `ci.yml`, and it references no `npm publish`, token
  or `id-token`. The scope is not a
  blocker — `@zodiacs/sdk@1.0.1` is published, so this is a first publication
  into an established scope, not a new-scope bootstrap.
  The exact sequence is [Card 2](../ACTION-CARDS.md); see also
  [the engine release record](evidence/engine-release/README.md).
- [ ] **Recommended external reviews:** practitioner, outside-counsel and
  native-speaker reviews remain unclaimed and are not release signatures.
- [ ] **O4 — External adoption:** real integrations, feedback and retained use
  remain unestablished. A model testing our own example is not a customer.
- [x] **O5 — Zodia exclusion:** owner-approved exclusion is complete. Astrofolio
  Verification & Provenance remains a separate workstream.
