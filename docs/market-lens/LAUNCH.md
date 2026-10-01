# Market Lens launch checkpoint

Verified locally 2026-10-01. Scope: read-only research workspace, retrospective
report and prospective paper runner. No public prediction or order execution.

## Completed

- Production lifecycle build, generated drift checks, artifact/link integrity
  and bundle budgets pass. Lens initial JS 27.6 KB gzip; chart dynamic chunk
  50.1 KB. Global budgets remain unchanged.
- Astro check: 0 errors, 0 warnings, 18 hints.
- Full suite: **6,441 passed, 4 skipped, 0 failed** (509 passing files,
  one skipped file). Focused Lens/research/routing/affected checks: 105 passed.
- Required Phase 1 visual acceptance: 18/18 captures pass and current receipt
  verifies. Production UI browser acceptance: all 12 workflows pass using
  the real local same-origin API for both assets and intervals.
- Preserve the owner-approved “Your horoscope” CTA from merged PR #614 and
  update its stale test/reference. Regenerate October assistant context using
  the documented builder; do not edit the persona.
- Owner confirmed no display license. DATA-RIGHTS.md includes official-source
  findings, pricing limits, a concrete recommendation and an owner-send request.
  Hosted prices return a noncached `display-disabled` 503 pending a grant.
- Prospective protocol is frozen for 180 days. The actual CLI initialized
  outside the checkout and recorded its first decision before the October 2
  execution. `paper-first-decision.json` contains only its timestamp/hashes;
  source prices and individual actions remain private. Zero outcomes scored.
- Reusable cloud startup instructions now include Node's HTTPS proxy, the
  optional local Lens API and the hosted display switch. Draft save confirmed;
  configuration publication and native iOS validation are separate.

## Preview verification

[Draft PR #619](https://github.com/zodiacs-org/site/pull/619) has a successful
[protected preview](https://zodiacs-n9fiyargf-zodiacsofficial.vercel.app/terminal/lens/).
Application source is `3bf75a5f`; deployment source is `19913767`, which added
only a temporary branch-specific preview allowance. The final commit restores
the original main-only automatic-deployment and ignored-build cost controls.
No production deployment occurred. See deployment.json for the full receipt.

The existing [trusted-main function smoke](https://github.com/zodiacs-org/site/actions/runs/36863601046)
passed against this deployment with its existing GitHub automation credential.
It does **not** probe the new Lens route. This cloud runtime's direct Lens
API/browser acceptance hit Vercel Authentication (HTTP 302) before the handler;
no deployed Lens routing or browser pass is claimed. The secure environment
draft now declares `VERCEL_AUTOMATION_BYPASS_SECRET` for the two specific
preview hosts; its value is absent here. After it is supplied, run:

```sh
BASE_URL=https://zodiacs-n9fiyargf-zodiacsofficial.vercel.app \
  NODE_OPTIONS=--use-env-proxy node tests/market-lens-deployed-drive.mjs
```

Hosted prices remain disabled. This driver verifies the disabled contract and
calendar/journal; the enabled upstream path still needs a display grant,
redeployment and real BTC/ETH hourly/daily acceptance.

## External requirements

1. Obtain a suitable written data-display grant using DATA-RIGHTS.md; the
   owner has not purchased a subscription. CoinAPI standard paid access does
   not establish public display rights. No X API is needed for this version.
2. For the 180-day study, arrange durable private storage, daily scheduling,
   backups and independent prospective decision-hash witnessing. The current
   session is not a managed, persistent research service. See
   ../../research/market-lens/PROSPECTIVE.md for commands and limits.
3. Do not present this pilot or the inconclusive retrospective results as
   validated astrology predictions. Public model forecasts remain disabled.

Detailed build/test logs and raw research files are in the session's private
`/workspace/.onboarding/` directory. Price-bearing development screenshots are
retained there for private review while display rights are unresolved.
