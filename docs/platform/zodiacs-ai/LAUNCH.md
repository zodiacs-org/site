# Release gates and rollback

Review candidate updated 2026-10-02. Staging and host testing have advanced;
production remains disabled and no app directory submission or listing exists.
[CHECKPOINTS.md](./CHECKPOINTS.md) and the evidence files distinguish tested work
from remaining acceptance requirements.

## Completed continuation (dated rc.15 host evidence retained)

- The homepage chart accessibility blocker is fixed without changing pinned
  marker geometry. The 44px labelled selector exposes all 41 marks. Homepage
  Lighthouse accessibility is 100; the 242-check browser drive passes.
- Both Codex candidates are installed and enabled through the actual CLI local
  marketplace. Pinned developer dependencies, all eight SDK tools and recipes
  pass. The three installed skills were followed to build an engine-only
  disposable synthetic project with five passing tests. Three fresh desktop Codex routing trials select the intended sky/developer
  skills and avoid them for an unrelated JavaScript prompt; their dated rc.15
  evidence is retained in `evidence/fresh-codex-routing.json`. The installed
  candidate is refreshed to rc.16 with actual server checks.
- The sky ZIP imports in ChatGPT. The web host presents the portable plugin as
  desktop-only; a separate connected MCP app exercises the five hosted tools.
  Five positive and three negative cases, timezone ambiguity, unsupported kinds,
  native global/thread seven-day UTC entrypoints, display-zone changes and
  widget refusal recovery are recorded under `evidence/chatgpt/`.
- Real host testing exposed misleading date-control labels. The generated widget
  now accurately labels start-exclusive, end-inclusive UTC boundaries. The final
  staging app accepts the refreshed schema/resource and corrected labels. The
  host’s “Enforce CSP for custom apps” setting was enabled and remains enabled;
  final rendering, timezone refusal and recovery pass under enforcement.
- Vercel CLI and connector authentication are available for the existing Pro
  project `prj_nRTO3q3aNYLfaM3dotAowOc028fO`. Preview SSO remains enabled. Short-lived
  deployment-bound share authentication works in ChatGPT; no credential is
  committed. No production alias or Firewall configuration was changed.

## Current rc.16 staging

The stable staging alias now targets `dpl_CSFWTPqDyZ3ZF4e32wSXsFnMfspM`,
source `5468423bac0675336949ab16839f40ac5def3e92`. Twelve HTTPS acceptance
checks and six SDK tool calls pass; concurrency and measured resources are in
`evidence/staging-*-rc16.json` and [COST.md](./COST.md). Complete Site Check
and Browser Evidence on that runtime source both pass.

The existing ChatGPT development app still stores the earlier deployment-bound
share token. After this staging alias update, its native entrypoint reports
“App unavailable” and Refresh tools reports “Couldn't update the app. Try again”.
The settings expose name/description edits, not server-URL edits. No replacement
app was created: that form requires a new user acknowledgement, which the owner
reserved. The earlier five/three host tests and capture reel remain dated rc.15
evidence; rc.16 protocol/widget tests do not establish a new actual ChatGPT host
invocation. Reconnect with the current temporary preview credential and repeat
the native calendar/version check before presenting rc.16 host evidence.

## Historical rc.15 HTTPS staging

Exact allowed hostname:
`zodiacs-org-git-codex-zodiacs-ai-integrations-zodiacsofficial.vercel.app`.
Enabled deployment `dpl_2QWjfr3xzkNp2qt4xFg3Lpz2JUrg` builds source
`a6947f71dce4adb7635060a6edfceb3ae7060e41`, including the reviewed main merge
and devalue 5.9.4 production security patch. The MCP runtime bundles are unchanged.
It sets `ZODIACS_MCP_ENABLED=1` and the exact `ZODIACS_MCP_STAGING_HOST` above.
The reusable `tests/ai-staging-drive.mjs` requires HTTPS preview `/mcp` and a
private cookie file; twelve checks and six calls pass on the patched deployment
(`evidence/staging-acceptance-patched.json`). Health, both slash forms,
schemas, native empty arguments, UI resource, canary refusal, malformed JSON,
16 KiB size refusal, Origin/query/method restrictions and recovery are covered.

Existing Firewall version 6 has active valid fixed-window compute (40/60s/IP)
and events (10/60s/IP) rules. Two independent sequential clients observe shared
compute 429 with Retry-After 60/no-store and event refusal after ten successes,
including retryAfterSeconds 60 for both clients. A twelve-call concurrent event
burst completed without refusal. This observed overshoot means the quota test
is not a strict concurrency or public-capacity guarantee. Counters are also
per-region under Vercel's documented contract. Missing/unavailable rules are
covered by local fail-closed tests; active rules were not deleted to simulate it.
See the two staging quota evidence files and the
[Vercel SDK contract](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk).

## Rollback

A second preview deployment with `ZODIACS_MCP_ENABLED=0` was built from the same
source. Switching only the staging alias to that deployment must return 503
`disabled`, Retry-After 3600 and no-store for both health and POST. Restore the
alias to the enabled deployment and verify health 200. Alias changes can invalidate temporary credentials and require reconnecting the
ChatGPT test app. An immediate request after restore still reached the disabled
target; health was verified again after propagation. The recorded live result
is in `evidence/staging-rollback.json`. Deployment-bound share credentials must
match the target deployment; a stale token returns protection 401 before the
application runs and is not application rollback evidence.

For production rollback, disable/unset the switch and redeploy. Existing compute
API and local MCP remain unaffected. If removing this candidate, remove only its
four MCP rewrites, compatibility dispatch and integration files; retain engine
pins and existing Firewall counters. Host connections can be disconnected.

## Remaining release gates

1. Require complete exact-head Site Check and Browser Evidence success. The
   rc.16 source commit and final documentation/package commits are recorded
   separately in the evidence. Historical or scoped macOS checks do not replace
   complete Linux CI.
2. Review measured representative latency, marginal cost and the small shared
   capacity in [COST.md](./COST.md). Eighteen serial calls pass; provider start
   types distinguish the hot/prewarmed serial sample from a 60%-cold calendar
   burst. The quota overshoot is fixed by atomic admission; staged bursts
   admit 10/12 events and 38/48 general tools, with SDK protocol overhead.
   These measurements do not accept a public SLA, per-user fairness or a total
   spend limit. Provider-average rate-card estimates are distinct from invoices
   and individual cold-call attribution.
3. Run the [consenting beta packet](./BETA_REVIEW.md) after owner-directed
   recruitment. Consent, usefulness and repeat-use aggregates do not exist yet;
   no participant has been contacted. The prepared worksheet is not feedback.
4. Owner identity documents and attestations still block OpenAI publisher
   upload. No domain challenge has been issued. Prepare its exact-byte response
   only when supplied and verify the eligible hostname without replacing an
   existing plugin token. [SUBMISSION.md](./SUBMISSION.md) inventories the
   proposed listing, packaged five/three cases, dated recording URL, version
   scope and final approval record. Confirm any stricter video requirement in
   the verified portal, then finish connection, scans and review details.
5. Obtain final owner approval of the concrete packet before submitting,
   merging or activating production. A protected 23-hour preview share does
   not provide a stable directory-review endpoint. Keep production disabled
   until the accepted gates and reviewer access are ready.

## Personal release and measurement

The existing synthetic Personal Week Ahead uses an arbitrary unknown-time chart
with no houses/angles and tests concept output only. Real personal transit tools
require accepted import/handoff, unknown-time semantics, privacy, host retention
and consenting beta evidence before implementation or release.

Before activation establish aggregate useful completions by operation/week,
categorized refusals, elapsed time/cost, contextual referrals and reported repeat
use. No new user identifiers or activity trails are implemented. A chat answer
must remain useful without a site click; distribution and ranking benefits are
not measured or promised.

## Current atomic quota and submission packet

Approved main `65d800c5` is integrated; active bundles and developer dependencies
use published rc.16. The former twelve-call overshoot is reproduced in retained
rc.15 evidence and addressed by a separate atomic service-wide database quota.
Database-clock fixed windows admit at most 40 admitted MCP and ten expensive calls
per minute in each trusted preview/production scope. Real 48-way PostgreSQL and
REST contention checks pass; see [QUOTAS.md](./QUOTAS.md). These low shared
ceilings bound work, not per-user fairness or useful model completions.

[SUBMISSION.md](./SUBMISSION.md) provides the proposed listing, file inventory,
walkthrough scope and exact domain-response procedure. [BETA_REVIEW.md](./BETA_REVIEW.md)
is ready for owner-directed consenting recruitment; no participant was contacted.
Owner identity verification and attestations still block portal upload. No
challenge has been issued. Production, directory submission and PR merge require
owner approval of the final concrete packet and accepted release gates.
