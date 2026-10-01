# Release gates and rollback

Review candidate updated 2026-10-02. Staging and host testing have advanced;
production remains disabled and no app directory submission or listing exists.
[CHECKPOINTS.md](./CHECKPOINTS.md) and the evidence files distinguish tested work
from remaining acceptance requirements.

## Completed continuation

- The homepage chart accessibility blocker is fixed without changing pinned
  marker geometry. The 44px labelled selector exposes all 41 marks. Homepage
  Lighthouse accessibility is 100; the 242-check browser drive passes.
- Both Codex candidates are installed and enabled through the actual CLI local
  marketplace. Pinned developer dependencies, all eight SDK tools and recipes
  pass. The three installed skills were followed to build an engine-only
  disposable synthetic project with five passing tests. Automatic skill routing
  in a fresh Codex conversation remains unverified.
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

## HTTPS staging

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

1. Require exact-head Site Check success after refreshed Phase 1 receipts and
   the two browser assertions adjusted to the approved main UI. The patched
   preceding browser run passes all fifteen Linux visual comparisons with zero
   pixel difference and all thirty Lighthouse routes (ninety samples), minimum
   97 performance / 100 accessibility / 100 SEO. The corrected locale/Moon
   helpers pass 185 local browser checks. The complete Linux driver remains the
   release authority; macOS native Home-key behavior does not replace it.
2. Complete actual cold/warm per-completion billing/capacity measurements.
   Thirty-two inspected provider request rows contain no application message or
   synthetic private-body canary. Raw request metadata stays outside the repository.
   There are no configured log drains. The team is Pro with Fluid Compute in iad1;
   Authenticated Billing confirms Observability Plus enabled and zodiacs-org
   included, establishing the documented thirty-day runtime retention. Preview
   compatibility-function metrics show 6.2% cold starts and 230ms average
   duration across 209 invocations in twelve hours. That aggregate includes
   multiple deployments and intentional negative/rollback tests; it is not an
   isolated completion measurement. Usage exposes project totals, not per-request
   or cold/warm billing. Warm SDK elapsed times include network and are not
   classified cold starts, cost or capacity. See `evidence/provider-log-review.json`.
   See [runtime logs](https://vercel.com/docs/logs/runtime) and
   [Observability Plus](https://vercel.com/docs/observability/observability-plus).
3. Resolve the concurrent event overshoot and assess provider-address sharing
   before treating existing quotas as sufficient for directory traffic. The final
   thread also requested the calendar twice although each widget renders its
   supplied initial result without automatic computation; account for duplicate
   host/model selection in capacity and cost acceptance. Do not
   silently increase counters, activate production or invent usage/cost evidence.
4. Run the [consenting beta kit](./BETA_REVIEW.md). No panel, consented contacts,
   usefulness or repeat-use results exist yet. No invitations have been sent.
5. The authenticated OpenAI portal blocks upload with “Complete identity
   verification.” A verified developer identity and suitable publisher organization
   are required. No domain challenge has been issued: implement the exact plain
   challenge only after it appears. A labelled 40-second reel of actual host captures is available in
   `evidence/chatgpt/host-capture-walkthrough.mp4`; it is not continuous screen
   recording or a portal-approved submission video. Complete any stricter video
   requirement shown by the portal and provide an accessible reviewer URL. Upload, scan, domain verify,
   submit and publish only through the authorized verified publisher account and
   after platform approval. Do not present local stdio as remote HTTP.
   [Official submission requirements](https://developers.openai.com/plugins/deploy/submission).

These are concrete unresolved release inputs, not a missing Vercel token or
read-only local cache. Available sign-ins already worked without user intervention.

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
