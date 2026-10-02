# Zodiacs AI integration checkpoints

Continuation dated 2026-10-02 on `codex/zodiacs-ai-integrations`,
[PR #618](https://github.com/zodiacs-org/site/pull/618). Existing work is preserved;
Approved main `65d800c5` (rc.16 and consumer release) is integrated. Active
AI candidates use published `@zodiacs/engine` 0.1.1-rc.16. Dated rc.15 staging
and host evidence is retained with its original version and source. Engine and SDK source repositories are unchanged.

| Checkpoint | Scope | Status |
| --- | --- | --- |
| 0 | Repository, release and host contracts | Verified against official guides and portable 1.0.0 schemas |
| 1 | Shared hosted tools and bounded remote MCP | Implemented; local protocol and authenticated HTTPS checks pass |
| 2 | ChatGPT experience and developer plugin | Both installed; installed developer server and real ChatGPT tested |
| 3 | Synthetic evaluation, build and review packages | Local checks pass; final head status is recorded in PR checks |
| 4 | HTTPS, actual hosts, beta and directory release | Staging and host evidence recorded; remaining release gates below |

## Implemented contracts

Five shared tools cover capabilities, exact-instant sky, upcoming events, sky
fact checks and curated consumer search. The developer adds natal, comparison
and calculation-record tools. All are read-only. No personal store or outbound
compute API proxy is added. Versioned receipts, `depends`, unknown-time behavior,
UTC boundaries and “tested, not proven” event completeness are preserved.

The remote boundary requires an exact allowed host, approved Origin, no-store,
16 KiB input, 256 KiB output, bounded 31-day searches and the existing compute /
events Firewall rules. Missing or unavailable limits refuse. Production defaults
disabled. Four `/mcp` and health rewrites now survive the site's trailing-slash
redirect. The existing compatibility function serves the adapter.

Native calendar entrypoints accept exactly `{}` for seven days from the server
instant in UTC. Explicit searches require both bounds. The actual host review
exposed incorrect date labels; generated widgets now label the engine's
start-exclusive, end-inclusive interval correctly. Both portable ZIPs, icons,
legal links, manifests, SHA-256 members and generated bundles pass drift checks.

## Validation and installed plugins

| Check | Result |
| --- | --- |
| `ai:check`, `ai:test` | rc.16 passes; 35 unit/private-state checks, eight stdio tools and recipes |
| `ai:eval` | 40/40 preselected synthetic cases; not LLM accuracy certification |
| `ai:widget` | Pass desktop/mobile, injection, links, refusal recovery and both synthetic host bridges |
| Build | rc.16 passes; 4,349 pages and dist/schema/bundle budgets |
| Dependency audits | Zero production vulnerabilities and zero high/critical development advisories; two existing moderate Vitest development advisories remain |
| Typecheck | Zero errors/warnings; 19 existing hints; Linux CI also passes |
| Installed Codex plugins | Developer and sky enabled through the real CLI marketplace; pinned developer dependencies installed |
| Installed developer server | All eight official-SDK tool calls and recipes pass |
| Three developer skills | Followed in this chat; disposable engine-only integration builds and passes five tests |
| Homepage browser / contracts | 242 browser checks and 23 unit/layout checks pass |
| Full Lighthouse | 30/30 routes, 90 samples; minimum 97 performance / 100 accessibility / 100 SEO |
| Phase 1 captures | 18/18 recaptured from patched build; five durable-receipt tests pass |
| Darwin visual comparison | 15/15 pass after three reviewed homepage baseline updates |
| Linux visual / navigation helpers | 15/15 comparisons at zero difference on `a6947f71`; corrected locale/Moon helpers pass 185 checks |
| HTTPS staging | 12 checks and six official-SDK calls pass on patched deployment source `a6947f71` |
| Actual ChatGPT | Five positive, three negative cases; ambiguity, unsupported events, native global/thread calendar, timezone and refusal recovery recorded |

The documented accessibility blocker is fixed. [REGRESSIONS.md](./REGRESSIONS.md)
records its historical reproduction, focused fix, reviewed Linux candidate
provenance and macOS exact-fixture limitations. Full exact-head CI remains the
site release authority; follow the latest Site Check attached to PR #618. Earlier
local or historical results do not replace it.
The current production advisory gate exposed devalue 5.9.2. The compatible 5.9.4
patch passes that gate; only its lockfile entry and the deterministic daily
generator provenance hash changed in application inputs. The lockfile also binds
Phase 1 screenshot provenance: all eighteen captures were regenerated from the
patched build and five durable-receipt tests pass. Audit thresholds and engine pins are retained.

Codex installation is no longer blocked by a read-only cache. The installed
skills were read and followed while creating a disposable synthetic integration.
Three fresh desktop Codex chats exercised automatic routing: the sky skill,
all three developer skills and an unrelated negative control. See
[evidence/fresh-codex-routing.json](./evidence/fresh-codex-routing.json). Those
trials used the installed rc.15 candidate; the continuation refreshes the local
installation to rc.16 and tests its actual stdio bundle separately. The ChatGPT portable sky ZIP imports, but
the web host offers that portable plugin as desktop-only; the hosted MCP app was
separately connected and exercised with actual ChatGPT tool selection.

## Actual host and release evidence

[evidence/host-readiness.json](./evidence/host-readiness.json) distinguishes real
host results from SDK simulation. [evidence/chatgpt/](./evidence/chatgpt/) contains
synthetic public-sky outputs and screenshots only. No credentials, birth details,
private chat sidebar, invitation list or raw provider request log is included.

The patched staging deployment also passes native entry, invalid-zone refusal and recovery (`patched-*` captures). A fresh credential issued after alias propagation was required; the Connected badge alone did not establish working invocation.

Final native global/thread rendering and refusal recovery also pass with the
host’s CSP enforcement enabled, which remains enabled. The final thread requested
the calendar twice; single model invocation is not guaranteed and must be included
in capacity/cost review. Widget initialization makes no automatic calculation call.

Vercel CLI and connector authentication are available. Staging uses the existing
Pro project and exact preview hostname. Preview SSO stays enabled; the ChatGPT
connection uses a deployment-bound share credential expiring after 23 hours.
Those credentials remain outside the repository. The existing Firewall rules
were inspected without changing their counters. Production is not activated.

Authenticated Vercel Billing confirms Observability Plus is enabled for this
project, so documented runtime-log retention is 30 days. Preview function metrics
include cold starts, but encompass multiple deployments and deliberate refusal /
rollback tests. Usage aggregates do not isolate cold/warm per-completion charges.
[evidence/provider-log-review.json](./evidence/provider-log-review.json) records
the scope without raw requests, credentials or private billing details.

The authenticated publisher portal opens, but uploading is blocked by
“Complete identity verification.” No exact domain challenge has been issued and
no public submission, approved listing or publication exists. Consenting beta
participants and feedback, reviewer video delivery, cold/warm billing evidence,
public-capacity acceptance remain release gates. The concurrent overshoot
is addressed by the atomic quota and measured staging bursts. Follow [LAUNCH.md](./LAUNCH.md) and [BETA_REVIEW.md](./BETA_REVIEW.md).

## Official contracts inspected

- https://developers.openai.com/plugins/build/extensions
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/deploy/submission
- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json
- https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/docs/spec.md

Official SDK 2.0.0 supplies modern transport. The independent SDK 1.29.0 drive
also accepts five output schemas, all tool calls and the native UI resource.

## Current launch-gate continuation

The atomic database quota reserves service-wide slots in one locked operation,
with unchanged per-address Firewall checks. Real PostgreSQL 17 and live preview
REST tests admit exactly 10/48 events and 40/48 requests. See [QUOTAS.md](./QUOTAS.md).
Both generated rc.16 AI bundles clear inspected engine caches after success,
refusal and injected failure; timezone resolvers are disposed per call.

The signed-in publisher portal is open at organization verification; upload is
still gated by owner identity documents/attestations. No domain challenge or
submission exists. [SUBMISSION.md](./SUBMISSION.md) inventories the concrete
packet and exact-byte domain response procedure. The expanded
[BETA_REVIEW.md](./BETA_REVIEW.md) contains consent wording, task cards, an
aggregate worksheet and proposed criteria. No contacts or consented results
exist and no invitation has been sent. Production remains disabled.


[Staging resource measurements](./COST.md) record eighteen successful serial
calls, a matching 21-invocation provider window and separate concurrent bursts.
The staged event burst admits 10/12; the general burst admits 38/48 plus two
SDK protocol requests. The provider reports hot/prewarmed serial starts and
60% cold starts in the calendar burst. Estimated function-only marginal cost
is about $0.0092 per 1,000 successful tools for this serial mix, with protocol
amortization; database/network/model costs and credits remain unallocated.
Twelve HTTPS acceptance checks and six SDK calls pass on the rc.16 preview.
Production `/mcp/` is still 404 and no production activation occurred.
