# Zodiacs AI integration checkpoints

This implements the public-sky ChatGPT app and developer plugin proposed on
2026-10-01. Checkpoints record tested deliverables separately from deployment,
host-account testing, public review and publication.

| Checkpoint | Scope | Status |
| --- | --- | --- |
| 0 | Repository, release and host contracts | Verified; current OpenAI guides and portable schemas inspected |
| 1 | Shared hosted tools and bounded remote MCP | Implemented; local protocol/calculation checks pass |
| 2 | ChatGPT experience and developer plugin | Implemented; local package/browser checks pass |
| 3 | Synthetic evaluation, build and review packages | Implemented; local validation and extracted-package checks pass |
| 4 | Actual hosts, HTTPS activation, beta and directory release | Blocked by existing homepage accessibility and host/account access; no launch claim |

## Checkpoint 1

- Five shared tools: capabilities, exact-instant sky, upcoming events, sky fact
  checking and curated consumer search. No outbound API proxy or personal store.
- Receipts and engine identity survive the adapter; numeric positions and event
  results match the accepted computation modules. `depends` remains distinct.
- Explicit UTC/local display, maximum 31-day windows, existing synchronous sample
  budgets, 16 KiB input and 256 KiB HTTP response ceiling. Exhaustion refuses whole.
- Production defaults disabled. Host/Origin restrictions, fixed errors, no-store
  and the existing incoming compute/events quotas protect the boundary.
- Official SDK client checks list/call/resource reads. Raw requests verify
  2025-03-26, 2025-06-18, 2025-11-25 and 2026-07-28 per-request serving.
- An independent official SDK 1.29.0 client, as referenced by OpenAI extensions,
  validates discovery/output schemas, calls all five tools, opens the calendar
  and reads its UI resource. Results remain direct structured objects.
- Canary checks cover JSON and SSE SDK diagnostics, application logs and URLs.
  Oversized chunked requests are refused while preserving the connection.
- Local development health and SDK smoke pass; the service returns 429 after
  its 40/minute development quota. The development listener was stopped.

## Checkpoint 2

- `integrations/chatgpt/` contains connection/review instructions and the official
  submission artifact shape, with five positive and three negative cases.
- One self-contained sky calendar shows timezone, UTC, version and coverage.
  Desktop and 360px Chromium checks cover text injection, URL restrictions,
  refusal recovery and zero external requests. Screenshots are under `evidence/`.
- Native global/thread entrypoints accept exactly `{}` for seven days from the
  server instant in UTC. Explicit searches require both bounds. Inline/fullscreen
  metadata, initial-result rendering and form updates through both host bridges
  pass SDK/browser checks. This is synthetic host evidence, not ChatGPT acceptance.
- `plugins/zodiacs-developer/` contains the manifest, local marketplace entry,
  three skills, eight read-only MCP tools and runnable sky/calendar recipes.
  A separate clean temporary installation passes recipes and SDK tool calls.
- Both candidates have portable Agent Plugins manifests, packaged 512px icons
  and required support/privacy/terms URLs. The developer retains older Codex
  compatibility files. Current Codex CLI discovery recognizes both candidates;
  installation fails at the read-only plugin-cache mount.
- `plugins/zodiacs-sky/` combines the remote connection and public-sky skill, with
  five positive and three negative proposed review cases. Two deterministic ZIPs
  and member SHA-256 digests are under `integrations/packages/`. The extracted
  developer ZIP passes dependency installation, recipes and all eight tool calls.
- Pinned external dependencies remain inspectable. Engine notices and licenses
  are copied unchanged; site-derived code retains the site's license.
- Added one developer review page and its sitemap entry, plus accurate hosted
  versus local privacy text. Existing browser calculators keep their privacy
  boundary; tests explicitly reject browser imports of the server adapters.

## Checkpoint 3: local evidence

| Check | Result |
| --- | --- |
| `npm run ai:check` | Generated bundles, portable/compatibility manifests, ZIP drift, versions, routes and links pass |
| `npm run ai:test` | 26 unit/protocol tests, eight-tool SDK drive and engine recipes pass |
| Clean plugin `npm ci`, recipes and SDK drive | Pass outside the repository |
| `npm run ai:eval` | 40/40 preselected synthetic adapter cases pass |
| `npm run ai:widget` | Desktop/mobile, injection, links, recovery and both interactive host bridges pass |
| `npm run build` | Pass; 4,344 Astro pages, dist/schema/bundle budgets pass |
| `npm run check` | Pass; zero errors/warnings, 18 existing hints |
| `npm test -- --maxWorkers=3 --minWorkers=1` | 6,377 pass, four skipped, zero failures |
| Existing Phase 1 browser acceptance | Refreshed; 18/18 exact-width captures pass |
| Existing terminal/Registry navigation browser drive | Pass; stale centre assertion updated for the approved profile shortcut, with target and overlap checks |
| Existing Markets mobile browser drive | 106/106 checks pass |
| Existing mobile frame cadence | 3/3 pass at 60fps under 4× CPU throttling; no frames over 34ms |
| Existing Linux visual regression | 15/15 pass against independently generated clean-main baselines; strict 0.1% threshold retained |
| Existing foreign-origin widget browser and Lighthouse gates | Pass; all three embed routes exceed the 95 performance/accessibility floor |
| Existing full Lighthouse gate | 29/30 routes pass across 90 samples; homepage accessibility fails identically on clean main |
| Claims ledger and consumer boundary | Pass with new adapter coverage and evidence |
| `git diff --check`; engine/sdk working trees | Clear; engine/sdk unchanged |

The stale homepage test now asserts the approved “Your horoscope” action and its
actual destination. This work changes no homepage source. The branch includes
the latest approved navigation change from main (`450f0fd9`). Regenerating the assistant index for the
new developer route also resolves the stale generated-context failure observed
during onboarding. Privacy-date and route-count assertions now reflect the
reviewed change; no accuracy or browser privacy gate was removed.

The first GitHub run passed 18 jobs, then exposed a second stale browser
assertion: the mobile lockup was tested against the old two-action bar. The
approved #606 profile shortcut adds a third action. The test now checks a 44px
profile target, its accessible label/destination, nonoverlapping actions, and
centering in the space between menu and profile. The complete terminal drive
passes locally. Navigation source and styling are unchanged.

The original 11 visual failures also match clean main pixel for pixel. Linux
baselines were generated independently on main; the strict budget is preserved.
The full Lighthouse gate exposes an existing homepage chart-demo accessibility
failure, reproduced separately on clean main. See [REGRESSIONS.md](./REGRESSIONS.md)
and its evidence for the site-wide CI blocker; local AI checks are not a claim
that every existing site release gate passes.

`evidence/evaluation.json` includes local timing and explicitly excludes LLM
routing, accuracy-reference, load, production cost and real-host acceptance.
`evidence/synthetic-personal-week.json` is an arbitrary unknown-time chart
demonstration with four computed reference-chart contacts, not a personal release.

## Checkpoint 4: release prerequisites

Resolve the existing homepage accessibility failure described in
[REGRESSIONS.md](./REGRESSIONS.md) before treating the site-wide CI gate as passed.

Follow [LAUNCH.md](./LAUNCH.md) for owner-controlled HTTPS staging, actual ChatGPT
and Codex installation, hosting retention, latency/cost, consenting beta and
submission review. This cloud environment has no Vercel token/project binding
or ChatGPT publisher session, and its Codex plugin cache is read-only. The
production health route returned 404 before deployment. Production remains
disabled; no public submission or listing exists. These gates are not passed.

Recommended implementation model remains GPT-6.1 Sol High, with xhigh for
architecture, time semantics, privacy and final release review.

## Checkpoint 0

- Site uses the published `@zodiacs/engine` 0.1.1-rc.15. Engine HEAD rc.16
  remains a separately reviewed candidate; this work does not adopt it.
- Existing local MCP remains stdio-only. Add a separate hosted adapter.
- Reuse compute operations and receipt constructors directly, avoiding an
  outbound proxy through the anonymous public API's shared egress quota.
- Preserve existing compute/event Firewall counters on incoming requests.
  Provider egress addresses can still be shared; this limits an anonymous
  beta and does not establish capacity for public directory traffic.
- Reuse the existing Vercel compatibility function through a rewrite so the
  integration adds no deployed function or paid service.
- OpenAI's official plugin examples describe Codex bundles. ChatGPT app
  examples describe hosted MCP tools and optional widgets. Installation,
  testing in the real host, listing review and publication are separate gates.
- Source and bundled data licenses remain unchanged. Developer skills are
  distributed under this site's terms; dependencies retain their own licenses.

## Documentation evidence

- https://github.com/openai/plugins/blob/main/README.md
- https://github.com/openai/openai-apps-sdk-examples/blob/main/README.md
- https://github.com/openai/plugins/blob/main/plugins/openai-developers/skills/build-chatgpt-app/SKILL.md
- https://github.com/openai/plugins/blob/main/plugins/openai-developers/skills/chatgpt-app-submission/SKILL.md
- https://developers.openai.com/plugins/build/extensions
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/deploy/submission
- https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/docs/spec.md
- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json

The linked extension page initially returned proxy 403, then became accessible;
its current contract and the official SDK specification were inspected. The
implementation uses the already locked MCP server/client SDK 2.0.0, whose
HTTP entry supports both modern and stateless 2025-era clients.
