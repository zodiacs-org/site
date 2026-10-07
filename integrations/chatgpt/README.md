# Zodiacs for ChatGPT — review candidate

Public-sky app: no login or birth data required. Five bounded read-only tools
answer sky questions in place, check claims and offer optional method/calculator
links. An interactive sky calendar supports local times, UTC and coverage
disclosure, with native sidebar/thread entrypoints and inline/fullscreen display.
Exactly `{}` opens seven days from the server instant in UTC; explicit searches
require both bounds. The current OpenAI MCP Extensions guide/spec were verified
on 2026-10-01. The local Codex developer plugin is separate.

```sh
npm run ai:build
npm run ai:test
npm run ai:package
npm run ai:serve
```

Local MCP: `http://127.0.0.1:8787/mcp`. The local service binds only loopback and
enforces development counters (40/minute overall; 10/minute event searches).
It is not reachable from ChatGPT. Use an owner-controlled HTTPS staging endpoint
for actual developer-mode tests. The proposed production endpoint is
`https://zodiacs.org/mcp`; **it has not been deployed or enabled by this change**.

Hosting uses the existing `api/compatibility.ts` function. `/mcp` and `/mcp/health`
rewrite into an underscore-directory bundle, so no new deployed function is
added. Set `ZODIACS_MCP_ENABLED=1` only after staging checks and published Firewall
rules succeed. Missing configuration or unavailable counters fail closed.
Production Host is restricted to zodiacs.org/www.zodiacs.org. For a preview
deployment, set `ZODIACS_MCP_STAGING_HOST` to its exact lowercase hostname;
do not accept arbitrary Host or Origin headers. The anonymous existing compute
and event limits are shared with other users at the same provider address.

Protocol coverage includes stateless 2025 clients and the SDK's newer per-request
entry. Integration tests use the official SDK client, not a ChatGPT session.
No streaming subscriptions, schedules, storage or personal charts are offered.
Arguments are at most 16 KiB; event windows at most 31 days; search loops have
the existing synchronous sample budgets. Oversized responses refuse whole.

Independent older-client verification uses a temporary installation of
`@modelcontextprotocol/sdk@1.29.0`, the version referenced by OpenAI extensions:
`node tests/ai-legacy-sdk-drive.mjs /path/to/that/node_modules/@modelcontextprotocol/sdk`.
Discovery, all five tools, empty-argument calendar launch and UI resource reads
pass. This still does not establish acceptance by the actual ChatGPT host.

Privacy: the assistant provider receives arguments/results; remote calculations
run on Zodiacs infrastructure. The adapter writes no request/result logs or
stores, refuses personal fields, returns fixed errors and uses no-store. Host,
CDN and provider metadata retention still need owner review. Derived natal
positions are also personal; local developer tools do not make the conversation
local. Keep personal data out of URL parameters, screenshots, issues and metrics.

`plugins/zodiacs-sky/` is the current portable package, with a root manifest,
remote MCP connection, public-sky skill, icon, listing metadata and five positive
and three negative review cases. `integrations/packages/` contains review ZIPs
and a reproducible SHA-256 manifest. Codex recognizes both candidates in the
local marketplace. `chatgpt-app-submission.json` retains the earlier Apps SDK
submission guidance shape as a reference. Case expectations remain proposed
until actual host testing; neither artifact is evidence of host acceptance.

Listing preparation:
- Display name: Zodiacs; subtitle: Sky events and fact checks.
- Category: Lifestyle. Support: https://zodiacs.org/developers/support/.
- Privacy: https://zodiacs.org/privacy/. Terms and legal/operator details must
  be reviewed against the published site before submission.
- The existing 512px Zodiacs icon is included in both packages; portable schema,
  listing lengths, icon paths and public legal/support URLs were checked locally.
- Browser screenshots are local widget QA, not screenshots of a ChatGPT session.
- Capture actual ChatGPT examples for week-ahead, timezone ambiguity, a refused
  eclipse query, fact checking and optional follow-through before submission.

See `docs/platform/zodiacs-ai/CHECKPOINTS.md` and `LAUNCH.md` for tested evidence,
explicit unresolved gates and rollback. No listing or approval is claimed.
Complete answers and useful integrations are the adoption goal.
