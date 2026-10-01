# Market Lens launch checkpoint

## Revised extension — 2026-10-01

All seven revised checkpoints are implemented. See
[REVISED-CHECKPOINTS.md](REVISED-CHECKPOINTS.md) for the chart lifecycle,
transit/house conventions, private planner, official schedules, descriptive
comparisons, optional score and their verification/limitations.

The final production build passes the unchanged route/chunk budgets: Lens
26.9 KB gzip / 32 KB, chart 50.1 KB / 60 KB, engine closure 31.4 KB / 31.6 KB.
Astro check reports 0 errors, 0 warnings and 19 hints. All 18 current Phase 1
visual captures pass. Full suite: 6,470 passed, 4 skipped, 0 failed (512 passing
files, one skipped file). Built production UI passes all 30 browser checks
(12 original, 18 revised), including dense calendars, both supported assets /
intervals, private source lifecycle, risk revisions and cross-tab conflicts.
Final evidence is in revised-acceptance.json; price-free synthetic calendar
and setup screenshots are in screenshots/.

CI follow-up: the first hosted Build & Check run stopped at the natal-engine
discovery assertion in `tests/chart-ownership-drive.mjs`. Its whole-site scan
counted the separate Lens worker alongside the calculator. Discovery now
follows the built birth-chart calculator's static/literal dynamic module
imports and still requires exactly one native calculation in that graph.
All 17 native browser ownership cases pass against the unchanged built assets.
A disposable-copy negative control adds a second calculation to the reachable
entry and confirms that the assertion rejects it. This test-only correction
does not change engine or product code; hosted CI must rerun on the new commit.

The official schedule snapshot has 38 verified events, seven-day freshness,
2026 coverage and an explicit unavailable Fed April period. Prices, economic
releases and traditional scores provide different kinds of context; economic
actuals/consensus and public market forecasts remain unavailable.

The paper report at 2026-10-01T15:20:25.371Z still reports
`awaiting-first-execution`: one recorded future decision, zero due/completed
days or settled trades. Protocol hash remains
`c9185d2a42d8fcbb2ba2a9358340406e03367f7b486ef773e3727fd513ad0ca5`.
New personal hypotheses are not inserted into this frozen protocol.

No new deployment, purchase or provider message occurred. The protected preview
below contains the initial scope. Hosted prices remain disabled, the secure
bypass value remains absent, and durable paper scheduling/storage/witnessing
remains external work. The provider request now includes derived historical
metrics and comparisons. Existing main-only deployment cost guards are intact.

## Initial launch evidence

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
