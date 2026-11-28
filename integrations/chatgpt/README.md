# Zodiacs for ChatGPT — review candidate

Note added 11 November 2026: most of this file describes the 0.5.0
candidate of October and is kept as written. Today the hosted server reports
0.6.6 and offers 19 read-only tools, and Zodiacs 0.6.6 is in OpenAI review
(`docs/platform/zodiacs-ai/RESUBMISSION-0.6.0.md`). The privacy paragraph
below is out of date on links: since 0.6.1 a link never carries a birth year,
a birth time, a birthplace or the names you give, and a birthday link carries
only the month and day.

Note added 13 November 2026: the hosted server now reports 0.6.7. 0.6.6 is
still the version in OpenAI review, and 0.6.7 goes in only after that review
ends, with Dias's yes.

Note added 18 November 2026: Zodiacs 0.6.8
(`integrations/packages/zodiacs-sky-0.6.8.zip`) is the version prepared for
the resubmission. It ships the invented examples in the tools' field
descriptions, and two review cases in `chatgpt-app-submission.json` now use
invented details too: the Mercury question comes from a reader in Mexico City,
and the wedding card is for 18 September 2027 at 16:30 in Lisbon, Portugal. No
tool, schema or behaviour changes. Nothing has been submitted; that waits for
the OpenAI review of 0.6.6 to end and for Dias's yes.

The 0.5.0 candidate has thirteen read-only tools. The six released in 0.4.0
are capabilities, sky positions, events, sky fact checks, horoscopes and Chart
Studio. The seven new ones share the occasions panel
(`ui://zodiacs/occasions-v1.html`): `get_compatibility` compares two charts,
`find_chart_twins` and `get_famous_chart` read the people Zodiacs publishes,
`get_birthday` gives a birthday's sky and solar return, `get_occasion_sky`
makes a card for a day that matters, `get_life_milestones` lists planetary
returns, and `get_sky_calendar` gives the link to Zodiacs' published .ics feed.
They are offered only where `ZODIACS_OCCASIONS_ENABLED=1`, which production
sets right before submission. They compute from bundled data, score compatibility
out of 100 and rate the dates people name, always with the astrological
reasons, never guarantee outcomes, and never invent a famous person's chart. Links to zodiacs.org in results end in `?ref=chatgpt`
or `?ref=assistant`. No login is required.
The horoscope panel uses an explicit Sun sign and the reader’s local date.
Chart Studio starts with birth details and offers the unknown-time path. An interactive sky calendar supports local times, UTC and coverage
disclosure, with native sidebar/thread entrypoints and inline/fullscreen display.
Exactly `{}` opens seven days from the server instant in UTC; explicit searches
require both bounds. The current OpenAI submission and plugin guidelines were checked on
2026-10-07. The local Codex developer plugin is separate.

```sh
npm run ai:build
npm run ai:test
npm run ai:package
npm run ai:serve
```

Local MCP: `http://127.0.0.1:8787/mcp`. The local service binds only loopback and
enforces development counters (40/minute overall; 10/minute event searches).
It is not reachable from ChatGPT. Use an owner-controlled HTTPS staging endpoint
for actual developer-mode tests. The existing production endpoint is `https://zodiacs.org/mcp`. The portal
shows the 0.3.4 package in review and not published on 2026-10-07; that review
was cancelled when 0.4.0 merged (#681). The 0.5.0 candidate is prepared locally;
it is not merged or submitted.

Hosting uses the existing `api/compatibility.ts` function. `/mcp` and `/mcp/health`
rewrite into an underscore-directory bundle, so no new deployed function is
added. Set `ZODIACS_MCP_ENABLED=1` only after staging checks and published Firewall
rules succeed. Missing configuration or unavailable counters fail closed.
Production Host is restricted to zodiacs.org/www.zodiacs.org. For a preview
deployment, set `ZODIACS_MCP_STAGING_HOST` to its exact lowercase hostname;
do not accept arbitrary Host or Origin headers. The anonymous existing compute
and event limits are shared with other users at the same provider address.

The handler (`src/ai-tools/http.ts`) applies two separate allowlists, Host
first, then Origin:

- **Host.** The request's `Host` must be `zodiacs.org` or `www.zodiacs.org`,
  plus `ZODIACS_MCP_STAGING_HOST` when it is set and valid. Anything else gets
  403 `host-not-allowed`, whatever its Origin.
- **Origin.** When a request carries an `Origin` header, it must be exactly one
  of `https://chatgpt.com`, `https://chat.openai.com`, `https://claude.ai`,
  `https://claude.com` or `https://zodiacs.org`. Any other origin gets 403
  `origin-not-allowed`, including a CORS preflight (`OPTIONS`). So a browser on
  a website outside those five domains cannot call `/mcp`. This is intended,
  not a bug, and the list is not to be widened for convenience.
- **No Origin header.** The Origin check is skipped. Server-side callers and
  MCP clients that send no `Origin` (desktop and command-line clients, the
  official SDK client, curl) are unaffected by the Origin rule; the Host rule
  still applies.

`ZODIACS_MCP_STAGING_HOST` for a preview deployment:

- Set it to that preview's exact hostname, lowercase, with no scheme, port,
  path, trailing dot or wildcard, for example
  `zodiacs-org-abc123xyz-zodiacsofficial.vercel.app`. The handler ignores a value
  that is not a lowercase hostname (capital letters, `*.vercel.app`,
  `https://…`, `host:443`, a path or surrounding spaces), and the preview then
  answers 403 `host-not-allowed`, exactly as if the variable were unset.
- Add it in the Vercel project with Preview scope only. Never set it for
  Production; production answers only zodiacs.org and www.zodiacs.org.
- It adds one exact hostname and nothing else: it never matches a subdomain,
  another preview or any other `*.vercel.app` address. The Origin allowlist
  does not change with it, so a page served from the preview's own address
  that calls `/mcp` from a browser is still refused.
- Git preview deployments are off for branches other than `main`, so a branch
  preview is a deployment made on purpose, and the variable names that
  deployment's own hostname. The account and Sky Watch sign-in paths
  (`src/ai-tools/accounts/service.ts`, `src/ai-tools/watch/oauth.ts`) read the
  same variable and also require a `*.vercel.app` hostname and
  `VERCEL_ENV=preview`.

Protocol coverage includes stateless 2025 clients and the SDK's newer per-request
entry. Integration tests use the official SDK client, not a ChatGPT session.
The public server offers no streaming subscriptions, schedules or chart storage.
Chart Studio computes inside its browser panel. Arguments are at most 16 KiB;
event windows are at most 92 days; search loops have
the existing synchronous sample budgets. Oversized responses refuse whole.

Independent older-client verification uses a temporary installation of
`@modelcontextprotocol/sdk@1.29.0`, the version referenced by OpenAI extensions:
`node tests/ai-legacy-sdk-drive.mjs /path/to/that/node_modules/@modelcontextprotocol/sdk`.
The earlier five-tool package passed discovery, empty-argument calendar launch
and UI resource reads with this client. Rerun against 0.5.0, with the occasion
tools switched on, before applying that result to the new tool set. This still does not establish acceptance by the actual ChatGPT host.

Privacy: the assistant provider receives arguments/results; remote calculations
run on Zodiacs infrastructure. The adapter writes no request/result logs or
stores, refuses personal fields on the public-sky tools, returns fixed errors and
uses no-store. The 0.5.0 comparison, chart-twin, birthday, occasion and
milestone tools accept birth dates and, if given, times, zones, coordinates,
places and first names for that call only; their card links carry those
details after the `#`, which browsers do not send to the server. Host,
CDN and provider metadata retention still need owner review. Derived natal
positions are also personal; local developer tools do not make the conversation
local. Keep personal data out of URL parameters, screenshots, issues and metrics.

`plugins/zodiacs-sky/` is the current portable package, with a root manifest,
remote MCP connection, onboarding skill, icon, listing metadata and five positive
and three negative review cases. In 0.5.0 the positive cases keep one sky and
one horoscope scenario and cover comparing two charts, chart twins with a famous
chart, and an occasion card; thirteen tools cannot all fit in five cases.
`integrations/packages/` contains review ZIPs
and a reproducible SHA-256 manifest. Codex recognizes both candidates in the
local marketplace. `chatgpt-app-submission.json` retains the earlier Apps SDK
submission guidance shape as a reference. Case expectations remain proposed
until actual host testing; neither artifact is evidence of host acceptance.

Listing preparation:
- Display name: Zodiacs; subtitle: Sky, horoscopes and charts.
- Category: Entertainment (Education & Research until 0.6.3). Support: https://zodiacs.org/developers/support/.
- Privacy: https://zodiacs.org/privacy/. Terms and legal/operator details must
  be reviewed against the published site before submission.
- The existing 512px Zodiacs icon is included in both packages; portable schema,
  listing lengths, icon paths and public legal/support URLs were checked locally.
- Browser screenshots are local widget QA, not screenshots of a ChatGPT session.
- Capture the five positive and three negative cases in the current manifest
  on the actual hosts, with the occasion tools switched on, before submission.
  The demo recording in the manifest is still the 0.4.0 walkthrough; record a
  0.5.0 one that shows the occasions panel. See `AUDIT-0.4.0.md` for the last
  audited evidence.

See `docs/platform/zodiacs-ai/CHECKPOINTS.md` and `LAUNCH.md` for tested evidence,
explicit unresolved gates and rollback. No listing or approval is claimed.
Complete answers and useful integrations are the adoption goal.
