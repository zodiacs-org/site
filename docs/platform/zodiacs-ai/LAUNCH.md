# Release gates and rollback

## Submission metadata — 2026-10-06

Package 0.3.2 retains the corrected submission metadata and adds local record
copying when the embedded host blocks downloads or clipboard access. Runtime
reports 0.3.0; bundle digests identify this UI revision. Endpoints are unchanged.
The advertised Studio resource is v2 to avoid stale host HTML; v1 remains readable
for hosts retaining the previous tool metadata.
[SUBMISSION.md](./SUBMISSION.md) follows the current public-directory
flow, distinguishes private app-reference ZIPs and the local Developer route,
and records the missing current walkthrough, identity and portal scan evidence.
Sky has exactly five positive/three negative cases and three starter prompts.
After initial public publication, eligible hosted MCP updates may go live after
automatic scans, so production server changes require the existing owner review
even when no ZIP upload or separate publish button is needed.

## Chart Studio candidate — 2026-10-06

The latest continuation adds local date/time and offline city entry, with
reviewed conversion and receipt provenance. A separate **Zodiacs Sky Watch
Preview** has been created in ChatGPT, backed by its own Free Plan database and
OAuth-protected test host. Hosted sign-in, refresh and immediate grant revocation
pass with synthetic credentials; a bounded scheduled worker is active.
ChatGPT connected the existing synthetic preview account. Native Chart Studio
rendering, house comparison, repeated-local-time review, time stepping, window
worker completion, local record reproduction and explicit context attachment
passed. Direct downloads were blocked by the host sandbox; local record copying
is now verified in the actual host, including manual copying when clipboard
access is denied. The full displayed JSON matches the copied record. Native
cancellation remains unverified, and no native event subscription is exposed
even after refreshing tools. Actual event arrival and full lifecycle acceptance
remain pending. [Current native evidence](evidence/native-2026-10-06/README.md)
also records the corrected private-preview deployment incident. See [readiness criteria](./READINESS.md) and
[Sky Watch](./SKY_WATCH.md). This is preview infrastructure, not public activation.

Version 0.3.0 packages Time Explorer, possible birth-time windows and local
calculation-record inspection in the existing browser panel. See
[Chart Studio review](./CHART_STUDIO.md). Its standalone local preview is under
review. Both local packages are now installed/enabled at 0.3.0 and the installed
Developer server passes its nine-tool driver. The frozen connected ChatGPT
deployment is unchanged. Sky's existing production URL is not activated by a
local package upgrade.

The owner approved creation and connection of **Zodiacs Chart Studio Preview**.
Actual global calendar/Studio rendering, Sun selection and house comparison
passed on the protected `f8110d71` 0.2.0 deployment. The branded profile has the
company, website, support and legal links. That frozen preview also passed
15 HTTPS checks and seven SDK calls. The earlier calendar connection retains
its own deployment. Thread entrypoints, actual assistant sharing, saved-file
download, beta feedback and publisher verification remain release checks.
Production remains disabled. The new 0.3.0 host is separate; partial native
acceptance above does not establish full lifecycle acceptance or public release.

## Recovery status — 2026-10-05

Main `3491e8e9` is integrated. Complete Site Check (all nineteen jobs) and
Browser Evidence (fifteen visual comparisons, thirty Lighthouse routes and
navigation) pass on `c1977043bbe814f05dd12c5ac3e16ee1c36ad58e`. The later 0.1.1
metadata packages pass `ai:check`; runtime and MCP configurations are unchanged.
Follow the latest PR #618 checks for the final source before release approval.

The refreshed stable staging alias targets `dpl_6FVWjbUkCMM3Wengo4vf8ssb65aH`,
source `39f36c57bbeb8f4910fc1ff26712490fcb840c53`. Twelve HTTPS checks and six
SDK calls pass in `evidence/staging-acceptance-2026-10-05.json`. Its quota
credential remains deployment-only; no persistent production configuration or
schema changed. The owner created **Zodiacs Staging October 5** using the private
23-hour preview connection. It is Connected; fresh native calendar checks pass
rc.16, UTC defaults, Bangkok display, invalid-zone refusal and recovery. Current
host acceptance covers the calendar; older full routing/video remains rc.15.

Eight custom profiles and both local plugins now have company, website, support,
legal and capability metadata. See [PROFILE_METADATA.md](./PROFILE_METADATA.md)
for verification and the original portable cloud profile's desktop update.
The owner confirms no beta testers. Publisher identity and consented feedback
remain pending. Production remains disabled. Final owner approval is reserved
before submission, merge or production activation.

## Historical review status — 2026-10-02

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

## Historical rc.16 staging — 2026-10-02

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
