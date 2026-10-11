# Repository status

Orientation as of 2026-10-12. Read [CLAUDE.md](CLAUDE.md) first; it is
authoritative. This map supplements it and should be updated at work closeout.

## What this repository is

This is zodiacs.org, the Astro site in `zodiacs-org/site`: free astrology
guides, calculators and saved charts, plus daily sky, horoscope and email
publishing. Astrofolio is the official Zodiac token collection experience;
the Terminal holds market tools and research, and the Registry holds canonical
token identities and verification. See [docs/STRATEGY.md](docs/STRATEGY.md).

The site also serves the hosted MCP endpoint `/mcp` and portable AI plugins.
The separate `zodiacs-org/engine` provides astronomical computation, consumed
here as a pinned vendored package. The separate `zodiacs-org/sdk` provides
read-only registry and ownership interfaces; it is not the chart engine.
Sources: [CLAUDE.md](CLAUDE.md), [package.json](package.json),
[vendor/README.md](vendor/README.md), [public/sdk/index.html](public/sdk/index.html).

## Directory map

- `src/`: Astro pages, layouts, content, Preact islands, chart adapters, AI tool sources and committed data.
- `api/`: Vercel functions and helpers for MCP, computation, calendar, assistant, registry, email and push.
- `scripts/`: Generators, publishing and delivery tools, integrity checks and script-level tests.
- `plugins/`: Portable Zodiacs Sky and Zodiacs Developer plugins, skills and local MCP runtime.
- `integrations/`: Generated AI panels, distributable plugin ZIPs and ChatGPT submission material.
- `promo/`: Remotion sources and assets for promotional video production.
- `supabase/`: Versioned database migrations and SQL tests for accounts, delivery, quotas and previews.
- `docs/`: Strategy, contracts, owner decisions, release runbooks and dated acceptance evidence.
- `tests/`: API, browser, MCP, benchmark, visual and feature acceptance drives; other unit tests live beside sources.

## Build and verification

Commands below exist in [package.json](package.json). Its Node requirement is
22.x. Run checks appropriate to the change; the normal release suite is:

```sh
npm run build
npm run check
npm test
```

- `build`: Astro output, search index/UI, assistant UI, WebMCP and sky API; npm automatically runs `prebuild` and `postbuild` too.
- `check`: Consumer boundary, shared footer consistency and Astro type checking.
- `test`: Vitest unit and integration suites.
- `prebuild`: Shared footer/navigation sync; daily verification, 30-day replay and same-day freshness; horoscope verification/freshness; all transit and event verification; Registry research checks; people evidence/copy/data checks; wing generation and feature stamping; OG and Astrofolio identity verification.
- `postbuild`: Season/style/footer/service-worker processing; widget, dist, people and locale integrity; disclosure and schema checks; enforced bundle budgets; Phase 1 build receipt.
- `npm run ai:check`: Generated AI runtime/manifest drift, integration validation and packaged ZIP drift.
- `npm run ai:test`: AI tool tests, integration driver and Developer plugin examples.
- `npm run mcp:build:check` and `npm run mcp:pack:check`: Standalone MCP adapter source and packed-artifact drift.
- `npm run test:mcp:protocol`, `npm run test:mcp:host`, `npm run test:mcp:benchmark`: Protocol, host and benchmark drives for the standalone adapter.
- `node scripts/check-dist.mjs`: Recheck an existing build's links and artifacts; already part of `postbuild`.

Builds run generators and can change committed output. See [CLAUDE.md](CLAUDE.md)
for source ownership, and [PLAN.md](PLAN.md), "Release evidence required at
every phase close", for broader release requirements. No full build was run
for this documentation change.

## Workflows

These descriptions come from the linked workflow definitions. Times are UTC;
schedule declarations do not guarantee runner start times. Live delivery also
depends on protected environments and release flags.

- [daily-horoscopes.yml](.github/workflows/daily-horoscopes.yml): Daily at 00:00, with a 04:23 backstop, publishes verified Daily Sky and horoscope artifacts, attempts the assistant window and Registry outlook, proves the live edition, pings IndexNow and retains a receipt.
- [push-daily.yml](.github/workflows/push-daily.yml): Daily at 07:00, sends eligible sky-event push alerts behind `PUSH_ENABLED`, after event and live-publication verification.
- [daily-email.yml](.github/workflows/daily-email.yml): Hourly at :13, sends eligible daily email cohorts behind `DAILY_EMAIL_ENABLED`; currently the workflow fixes the cohort to the test list and requires the live edition.
- [transits-monthly.yml](.github/workflows/transits-monthly.yml): On the 25th at 05:41, commits next month's computed transits and opens a twelve-sign editorial reminder, without writing the monthly prose.
- [registry-market-snapshot.yml](.github/workflows/registry-market-snapshot.yml): After Daily Sky and daily at 06:53, publishes the paired UTC market snapshot, outlook, research drafts/approved feeds and regenerated catalogue pages.
- [pulse-refresh.yml](.github/workflows/pulse-refresh.yml): Mondays at 06:17, commits the Wikipedia/Google Trends Pulse snapshot, retaining prior Trends values on fetch failure.
- [distribution-refresh.yml](.github/workflows/distribution-refresh.yml): Mondays at 06:31, commits ownership-distribution data and regenerated Registry profiles, retaining prior values on RPC failure.
- [weekly-digest.yml](.github/workflows/weekly-digest.yml): Mondays from 06:00 with bounded Monday/Tuesday recovery runs, sends opted-in weekly email behind `DIGEST_ENABLED`.
- [race-season-close.yml](.github/workflows/race-season-close.yml): Daily at 00:23, appends a closed season's immutable Trophy Hall record when a season boundary has passed.
- [race-weekly-recap.yml](.github/workflows/race-weekly-recap.yml): Mondays at 08:11, commits recap drafts and standings history and opens a review issue; posting is manual.
- [status-archive.yml](.github/workflows/status-archive.yml): Daily at 03:41, retains public incident-feed copies as 90-day artifacts for the Mercury retrograde study, without committing them.
- [deltat-monitor.yml](.github/workflows/deltat-monitor.yml): Fridays at 06:23, compares the engine's frozen Delta T model with IERS and opens/updates a refresh issue, without changing data.
- [compat-invite-sweep.yml](.github/workflows/compat-invite-sweep.yml): Hourly at :17, closes expired invitations and prunes retained evidence; publishes no site content.
- [account-deletion-receipt-cleanup.yml](.github/workflows/account-deletion-receipt-cleanup.yml): Hourly at :37, prunes expired account-deletion capabilities; publishes no site content.
- [db-backup.yml](.github/workflows/db-backup.yml): Mondays at 05:41, retains an encrypted production database restore bundle as a 90-day artifact.
- [lighthouse-collection.yml](.github/workflows/lighthouse-collection.yml): Mondays at 07:23, measures the flag-enabled Registry Collection route; publishes no site content.
- [site-check.yml](.github/workflows/site-check.yml): Every PR, main push and manual dispatch, runs build/type/unit/browser/drift/security/budget gates, including production-flag builds; this is CI, not a scheduled publisher.

Other event-driven workflows: [browser-evidence.yml](.github/workflows/browser-evidence.yml)
captures requested PR evidence; [checkpoint23.yml](.github/workflows/checkpoint23.yml)
runs scoped accuracy gates; [preview-api-smoke.yml](.github/workflows/preview-api-smoke.yml)
probes ready Vercel previews; [assistant-eval.yml](.github/workflows/assistant-eval.yml)
manually evaluates the live assistant. These publish checks/evidence rather than content.

## Current state and open work

Main includes the engine 1.0.0 / MCP adapter 0.1.0-rc.19 adoption, merged in
[PR #710](https://github.com/zodiacs-org/site/pull/710), commit `e710e574`.
Developer plugin 0.3.7 accompanies it. Sources: local Git history,
[package.json](package.json) and
[the adoption record](docs/platform/evidence/site-engine-1-0-0/README.md).
The adoption record distinguishes package verification from deployment and
external acceptance; a merged version alone does not prove those gates.

Owner-provided open-work pointers follow. Remote PR state and implementation
details were not rechecked for this orientation; inspect each PR before resuming.

- [#683](https://github.com/zodiacs-org/site/pull/683): Time-critical horoscope publication stopping in May 2027 and late 2028; check this before extending publication coverage.
- [#674](https://github.com/zodiacs-org/site/pull/674): Plan for distribution to AI assistants.
- [#619](https://github.com/zodiacs-org/site/pull/619): Market Lens, identified as a draft.
- Other pointers: [#691](https://github.com/zodiacs-org/site/pull/691), [#684](https://github.com/zodiacs-org/site/pull/684), [#672](https://github.com/zodiacs-org/site/pull/672), [#640](https://github.com/zodiacs-org/site/pull/640), [#649](https://github.com/zodiacs-org/site/pull/649).
- Older draft pointers: [#434](https://github.com/zodiacs-org/site/pull/434), [#435](https://github.com/zodiacs-org/site/pull/435), [#436](https://github.com/zodiacs-org/site/pull/436), [#437](https://github.com/zodiacs-org/site/pull/437), [#438](https://github.com/zodiacs-org/site/pull/438), [#469](https://github.com/zodiacs-org/site/pull/469).
- Dependabot PRs also need review; check the current queue and advisory gate rather than assuming they are safe to merge.

[PLAN.md](PLAN.md) controls the product program and its evidence gates.
[HANDOFF-STATUS-rc16.md](HANDOFF-STATUS-rc16.md) is historical local work from
September 30 / October 1, not the current engine adoption status. Dated handoffs
and evidence files retain their original scope; verify newer decisions before
treating an unchecked item or old flag state as current.

The hosted `/mcp` is enabled in production with `ZODIACS_MCP_ENABLED=1`, per
[CLAUDE.md](CLAUDE.md). Sky Watch remains a separate authenticated private
preview that refuses production enablement; see
[docs/platform/zodiacs-ai/SKY_WATCH.md](docs/platform/zodiacs-ai/SKY_WATCH.md).
Server-dependent features default off with useful static fallbacks under
[PLAN.md](PLAN.md); this design rule is not an inventory of live settings.

## Guardrails for agents

[CLAUDE.md](CLAUDE.md) is authoritative for repository work. In particular:

- Preserve the `ZodiacsOfficial` organization and redirects. Never create `site` or `sdk` repositories there; new links use `zodiacs-org`.
- Keep consumer copy free of token/market language except the exact sanctioned wing lanes, records links, navigation and legal disclosures described there.
- Keep the Cosmic Void design, shared footer, self-hosted fonts and plain voice; do not reintroduce Warm Gilt.
- Edit generator sources, not generated output, and commit regenerated output with source changes. Keep historical archives immutable and committed Registry Aura output flag-off; plain Node generators need flags in the shell.
- Preserve engine bundle isolation and the supported local-time resolver. Run engine tests after engine changes; do not hand-roll time-zone offsets.
- Preserve network-first HTML and wing pages in the service worker, and never cache Registry identity JSON as an authority fallback.
- Leave the Fable-authored assistant persona to Fable. Do not delete or rename root documents without checking test references.

Operational guardrails: never deploy production from a local branch. Vercel
production follows reviewed `main`; automatic Git deployments are restricted to
`main`. Sources: [CLAUDE.md](CLAUDE.md) and
[docs/vercel-build-costs.md](docs/vercel-build-costs.md).
Never change production settings, enable release flags or activate public AI
distribution without owner approval. Follow the concrete release gates in
[docs/platform/zodiacs-ai/LAUNCH.md](docs/platform/zodiacs-ai/LAUNCH.md);
[docs/growth/README.md](docs/growth/README.md) separately requires a human
release path for growth work.

Never commit secrets or put credentials, recipient data or capabilities in
logs, commands, issues, screenshots or chat. Live delivery secrets belong in
the appropriate protected, default-branch-only Actions environment, not broadly
accessible repository/organization secrets. See
[docs/WEEKLY-DIGEST.md](docs/WEEKLY-DIGEST.md). Prepare and verify work locally;
production configuration and release evidence require their own authorized gates.
