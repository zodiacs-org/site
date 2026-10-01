# Zodiacs AI integration checkpoints

Continuation dated 2026-10-02 on `codex/zodiacs-ai-integrations`,
[PR #618](https://github.com/zodiacs-org/site/pull/618). Existing work is preserved;
approved main `6ca4269a` is merged. The site and both candidates still use published
`@zodiacs/engine` 0.1.1-rc.15. Engine and SDK source repositories are unchanged.

| Checkpoint | Scope | Status |
| --- | --- | --- |
| 0 | Repository, release and host contracts | Verified against official guides and portable 1.0.0 schemas |
| 1 | Shared hosted tools and bounded remote MCP | Implemented; local protocol and authenticated HTTPS checks pass |
| 2 | ChatGPT experience and developer plugin | Both installed; installed developer server and real ChatGPT tested |
| 3 | Synthetic evaluation, build and review packages | Local checks pass; final exact-head site CI required |
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
| `ai:check`, `ai:test` | Pass; 26 unit/protocol checks, eight stdio tools and recipes |
| `ai:eval` | 40/40 preselected synthetic cases; not LLM accuracy certification |
| `ai:widget` | Pass desktop/mobile, injection, links, refusal recovery and both synthetic host bridges |
| Build | Pass; 4,344 pages and dist/schema/bundle budgets |
| Typecheck | Zero errors/warnings; 18 existing hints; Linux CI also passes |
| Installed Codex plugins | Developer and sky enabled through the real CLI marketplace; pinned developer dependencies installed |
| Installed developer server | All eight official-SDK tool calls and recipes pass |
| Three developer skills | Followed in this chat; disposable engine-only integration builds and passes five tests |
| Homepage browser / contracts | 242 browser checks and 23 unit/layout checks pass |
| Homepage Lighthouse | Three accepted samples; worst 99 performance / 100 accessibility / 100 SEO |
| Phase 1 captures | 18/18 pass on merged source |
| Darwin visual comparison | 15/15 pass after three reviewed homepage baseline updates |
| Linux unit / acceptance drives | Pass on `93e6adcc`; full CI stopped at three intentional homepage baseline differences |
| HTTPS staging | 12 checks and six official-SDK calls pass on deployed `45b0d4ce` |
| Actual ChatGPT | Five positive, three negative cases; ambiguity, unsupported events, native global/thread calendar, timezone and refusal recovery recorded |

The documented accessibility blocker is fixed. [REGRESSIONS.md](./REGRESSIONS.md)
records its historical reproduction, focused fix, reviewed Linux candidate
provenance and macOS exact-fixture limitations. Full exact-head CI remains the
site release authority; earlier local or historical results do not replace it.

Codex installation is no longer blocked by a read-only cache. The installed
skills were read and followed while creating a disposable synthetic integration.
Automatic model routing to newly installed Codex skills in a fresh host session
has not been independently exercised. The ChatGPT portable sky ZIP imports, but
the web host offers that portable plugin as desktop-only; the hosted MCP app was
separately connected and exercised with actual ChatGPT tool selection.

## Actual host and release evidence

[evidence/host-readiness.json](./evidence/host-readiness.json) distinguishes real
host results from SDK simulation. [evidence/chatgpt/](./evidence/chatgpt/) contains
synthetic public-sky outputs and screenshots only. No credentials, birth details,
private chat sidebar, invitation list or raw provider request log is included.

Final native global/thread rendering and refusal recovery also pass with the
host’s CSP enforcement enabled, which remains enabled. The final thread requested
the calendar twice; single model invocation is not guaranteed and must be included
in capacity/cost review. Widget initialization makes no automatic calculation call.

Vercel CLI and connector authentication are available. Staging uses the existing
Pro project and exact preview hostname. Preview SSO stays enabled; the ChatGPT
connection uses a deployment-bound share credential expiring after 23 hours.
Those credentials remain outside the repository. The existing Firewall rules
were inspected without changing their counters. Production is not activated.

The authenticated publisher portal opens, but uploading is blocked by
“Complete identity verification.” No exact domain challenge has been issued and
no public submission, approved listing or publication exists. Consenting beta
participants and feedback, reviewer video delivery, cold/warm billing evidence,
capacity acceptance and resolved quota/retention observations remain release
gates. Follow [LAUNCH.md](./LAUNCH.md) and [BETA_REVIEW.md](./BETA_REVIEW.md).

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
