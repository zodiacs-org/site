# Google Connected Apps: gap analysis

Written 1 November 2026, before any Google console step. It compares the live
`https://zodiacs.org/mcp` (version 0.5.1, thirteen read-only tools, the same
server already submitted to the OpenAI and Claude directories) with Google's
Connected Apps Platform requirements. The platform serves the Gemini app and
Search. It is in preview: Google admits developers through an interest form.

Related: [LISTING.md](LISTING.md) (what to type into the console),
[SUBMIT-CHECKLIST.md](SUBMIT-CHECKLIST.md) (the owner's steps). The OpenAI
and Claude records are [`../RESUBMISSION-0.5.0.md`](../RESUBMISSION-0.5.0.md)
and [`../claude-directory/LISTING.md`](../claude-directory/LISTING.md).

## Sources read

All read on 1 November 2026:

- [Overview](https://developers.google.com/connected-apps)
- [MCP server](https://developers.google.com/connected-apps/mcp)
- [Server optimization](https://developers.google.com/connected-apps/mcp/server-optimization)
  (transport, versions, annotations, responses, MCP Apps)
- [OAuth 2.1 guide](https://developers.google.com/connected-apps/mcp/oauth)
- [UI and card design](https://developers.google.com/connected-apps/mcp/guidelines)
- [Quality guidelines](https://developers.google.com/connected-apps/mcp/quality)
- [Vertical user journeys](https://developers.google.com/connected-apps/mcp/vertical-journeys)
  (categories)
- [MCP flow](https://developers.google.com/connected-apps/mcp/mcp-flow)
- [Developer Mode usage](https://developers.google.com/connected-apps/mcp/dev-mode/usage)
- [Prerequisites](https://developers.google.com/connected-apps/gpc/prerequisites)
- [Register, test and publish](https://developers.google.com/connected-apps/gpc/perform-the-steps)
- [Policy](https://developers.google.com/connected-apps/connected-apps-policy)

## Live probes, 1 November 2026

Run from this workspace against production, with `User-Agent: Google` (the
header Google says its products send):

| Probe | Result |
| --- | --- |
| `initialize` with protocol `2025-11-25` | 200, `text/event-stream`, server `zodiacs` 0.5.1, protocol `2025-11-25` agreed, capabilities `tools` and `resources`, no session id (stateless) |
| `tools/list` | 13 tools, 110,349 bytes; saved as [`tools-list.live-2026-11-01.json`](tools-list.live-2026-11-01.json) |
| `tools/call get_sky` | ok; one `text` content item holding the full result as JSON, plus `structuredContent` |
| `resources/list` | 24 resources (4 current panels and their earlier versions) |
| `GET /mcp` | 405, which Google accepts for stateless servers |
| `POST /mcp` with `Origin: https://gemini.google.com` | 403 `origin-not-allowed` (see gap 6) |
| `/.well-known/google-connected-apps` | 404 before this change (see gap 2) |
| `/.well-known/oauth-authorization-server` | 404 (only matters if sign-in is ever offered to Google) |

## Summary

| Area | Status |
| --- | --- |
| Transport (Streamable HTTP, one global endpoint, protocol at most 2025-11-25) | Meets |
| Public tools without sign-in | Meets: answer "No" to "Does your server require authorization?" |
| Accounts OAuth (`save_to_zodiacs`, Sky Watch) for Google | Does not meet; off in production, so not offered (gap 4) |
| Tool annotations | Meets: every flag explicit on all 13 tools |
| Tool schemas | Meets: flat, typed, enums, required fields marked; one level of nesting in `get_compatibility` |
| Tool descriptions and server instructions | Review risk (gap 7) |
| Tool results | Meets for the model: full JSON in text content |
| MCP Apps panels | Unverified: likely empty in Gemini until checked (gap 5, blocker to verify) |
| Domain verification | Added by this branch; needs the owner's token (gap 2) |
| Category | **Blocker:** no category fits, and the choice is permanent (gap 1) |
| Quality bar (signed-out, read-only) | Review risk (gap 3) |
| Privacy policy names the app's hosts | Needs a wording update before review (gap 8) |
| Rate limits on Google's shared addresses | Risk at scale (gap 9) |
| Versioning of tool definitions | Process change needed (gap 10) |

**Blockers before "Send for review":** gap 1 (category), gap 5 (panels in
Gemini, checked in Developer Mode) and gap 2 (the verification token, which
only the owner can download). Gaps 3, 7 and 8 are review risks the owner
should decide on before review.

## 1. Category (blocker, owner decision)

The console asks for a category when the app is created, and it **cannot be
changed later**. Google lists nine: Music, podcasts and audiobooks; Content
creation; Grocery and food delivery; Real estate; Local services and
reservations; Events and ticketing; Productivity; Business and CRM; Small
business finance. Each brings predefined capabilities that are shown above
ours and cannot be edited.

None describes astrology or the sky. Picking one anyway would put another
category's capabilities (for example "Create a design from a description") on
the Zodiacs listing, which the policy treats as misleading ("Connected Apps
must not contain false or misleading information"). Google says more
categories are coming.

Recommendation: do not create the app until a fitting category exists, or
ask the Google contact from the preview programme which category they expect
for a reference or lifestyle app. The OpenAI listing uses Education; the
Claude listing uses Media and Entertainment plus Education.

## 2. Domain verification (added; token pending)

Google downloads a `google-connected-apps.json` file from the console and
fetches `https://zodiacs.org/.well-known/google-connected-apps`, which must
answer HTTP 200 with that JSON and no redirect.

This branch adds:

- `public/.well-known/google-connected-apps`: a checked-in static file, today
  `{"verification_tokens": []}`. No token is invented. The owner's token goes
  into the list (or the downloaded file replaces it whole) in a small PR.
- `vercel.json`: a header rule for that exact path only:
  `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`,
  like the OpenAI challenge file beside it.
- The routing receipt (`docs/owner-review/return-visits-phase3-2026-10-04/vercel-routes.json`)
  gains the rule's compiled pattern, `^/\.well-known/google-connected-apps$`,
  which the official `@vercel/routing-utils` 6.6.1 `getTransformedRoutes`
  produces.
- `tests/api/google-connected-apps.test.ts`: the file is JSON with only a
  `verification_tokens` list of unique printable strings; the JSON headers
  reach only the exact path; no redirect (the trailing-slash rule excludes
  `.well-known`) and no rewrite reaches it.

Why a checked-in file and not an environment variable: the token is public
by design (Google fetches it anonymously), the OpenAI challenge is already
handled the same way, a static file needs no function, and a token change is
reviewable in git. An empty list answers 200 but fails Google's check until
the token is added, which is the intended placeholder behaviour.

No redirect can reach the path: the only catch-all redirect (adding a trailing
slash) skips `.well-known`, the Astro build is static (`trailingSlash: 'ignore'`)
and the site has no middleware. Requests for `www.zodiacs.org` are not part of
this; Google checks the endpoint's own host.

## 3. Quality bar (review risk)

Google's quality page says a connected app should be "better with sign-in"
(personalised by the account, **or improved when users share details in
their prompt**) or offer "live context and actions" (create, save, book). It
also says a connected app is not "generic, signed-out information that
doesn't change the answer users could already get from Gemini or Search".

Zodiacs is signed out and read-only. Its case:

- answers change with what the person shares: a birth date, time and place
  give their own chart, comparison, milestones and personal week;
- it computes positions, retrogrades and Moon phases from its own engine for
  the person's time zone, rather than repeating general information;
- it publishes dated horoscopes Gemini does not have;
- Chart Studio is an interactive panel.

"Account linking via OAuth 2.1 should be live or on the near-term roadmap."
The saved-charts sign-in (`save_to_zodiacs`, `ACCOUNTS.md`) exists but is
off, and is not ready for Google (gap 4). Expect the reviewer to ask about
this.

## 4. Authentication

**Public tools.** All thirteen tools work without sign-in today and declare
`securitySchemes: [{ type: "noauth" }]`. In the console's **Provide access
credentials** step the answer is **No**, then **Confirm**. No test account is
needed (that step is only for user-delegated auth).

**Accounts OAuth** (`ZODIACS_ACCOUNTS_ENABLED`, off in production) and the
Sky Watch preview (`ZODIACS_SKY_WATCH_ENABLED`, private) do not yet meet
Google's OAuth 2.1 guide. Nothing here changes them; this is the list for when
the owner wants sign-in in Gemini:

| Google needs | Zodiacs today |
| --- | --- |
| Authorization server metadata (`/.well-known/oauth-authorization-server` or `openid-configuration`), answering 200, with `authorization_endpoint`, `token_endpoint`, `response_types_supported` including `code`, `code_challenge_methods_supported: ["S256"]` | The issuer is Supabase Auth's OAuth 2.1 server, named in RFC 9728 protected resource metadata. Whether Google follows RFC 9728 to that issuer is not documented; the zodiacs.org root answers 404, and Google stops at the first 404. |
| Authorization code with PKCE S256 | Yes |
| A `registration_endpoint` for dynamic registration, or a pre-registered client ID and secret typed into the console | Dynamic registration is deliberately off. A pre-registered client for Google would work if Supabase accepts Google's redirect URIs. |
| Redirect URIs `https://oauth-redirect.googleusercontent.com/r/*` and `/a/*`, and the `-sandbox` and `-test` variants | Only the ChatGPT and Claude callbacks are registered. Supabase must accept these wildcard patterns, which is unverified. |
| Refresh tokens that are not rotated | Supabase rotates refresh tokens. Google asks for the same refresh token with a longer expiry. |
| One answer for the whole server (the console asks once whether the server requires authorization) | Mixed: one signed-in tool among anonymous ones. The console documents no per-tool setting; the `securitySchemes` field is an OpenAI convention. |
| Exact audience (RFC 8707) for the host the app uses | Yes, `https://zodiacs.org/mcp` |
| A seeded test account without two-factor sign-in | The reviewer account exists for other hosts; it would need sharing with Google. |

## 5. MCP Apps panels in Gemini (blocker to verify)

Google supports MCP Apps (beta in the console's **UI resources** tab), binds
them with `_meta.ui.resourceUri`, renders them in sandboxed iframes, and
accepts the `text/html;profile=mcp-app` MIME type our four panels use. Sizes
are well inside the limits (largest panel 1.0 MB against 15 MB; all 24
resources 11.0 MB against 100 MB). CSP: `connectDomains` is empty and
`resourceDomains` is only `https://zodiacs.org` (artwork); scripts are inline,
which is what Google requires.

The open question is the data. Google's server optimization page says
`structuredContent` is "not yet supported" and asks for JSON in text content.
Our tools already put the full result as JSON in their text content, so the
**model** sees everything. But every panel reads its data only from
`structuredContent` of the `ui/notifications/tool-result` message
(`src/ai-tools/occasions-panel/app.tsx`, `horoscope/app.tsx`, `widget.ts`).
If Gemini does not pass `structuredContent` to the iframe, the sky calendar,
horoscope and occasions panels will open empty. Chart Studio takes no tool
data and should work.

Check first in Gemini Developer Mode (`gemini.google.com/devmode`, no
registration needed). If panels are empty, the fix is a fallback in each
panel bridge that parses `content[0].text` when `structuredContent` is
missing. That changes the panel HTML, so it needs new panel addresses, which
changes `_meta.ui.resourceUri` in `tools/list`: a release decision that also
reaches the OpenAI and Claude listings, outside this branch. Google snapshots
UI resources when tools are synced, so fix it before the first sync.

Design guidance to expect in review: inline cards should have short titles,
at most one primary and one secondary action, no inner scrolling, and host
colour tokens with light and dark support; carousels need 3 to 8 cards of
identical size; "interactive, branded UI is for interactive and transactional
moments, or when the user asks for your app by name". Our cards are taller
than Google's inline guidance and use their own palette.

The `openai/*` metadata keys on tools and resources are harmless extras for
Gemini.

## 6. Transport and network

- Streamable HTTP over one global HTTPS endpoint, POST for JSON-RPC, SSE or
  JSON replies, GET answers 405: meets. The legacy HTTP+SSE transport is not
  used.
- Protocol: Gemini's maximum is `2025-11-25`; the SDK (2.3.1) supports it and
  agreed it live.
- Google's addresses: Zodiacs does not filter by IP, so the allowlist step is
  not needed.
- `User-Agent: Google` passes. The usage counter files it under `other`
  (`src/ai-tools/usage.ts`), so Gemini traffic is not counted separately.
  Adding a `google` family is a later, optional change (it needs a database
  migration for the counter's allowed values).
- **Origin:** the server refuses any browser `Origin` outside ChatGPT, Claude
  and zodiacs.org. Google's own servers normally send no `Origin`, so this
  should not matter, but if Developer Mode or the Gemini panels call `/mcp`
  from a browser page, they will get 403. Developer Mode's Event Log will show
  it; the fix is adding the exact Gemini origin to `ALLOWED_ORIGINS` in
  `src/ai-tools/http.ts`.

## 7. Tool definitions and instructions (review risk, no change allowed)

Meets: snake_case verb_noun names; titles; typed parameters with enums
(`sign`, `period`, `focus`, `kind`); ISO date formats in descriptions; no
`oneOf`/`anyOf` anywhere; every annotation explicit (`readOnlyHint: true`,
`destructiveHint: false`, `openWorldHint: false`, `idempotentHint`), so no
confirmation prompts.

Risks against Google's "security guidance for descriptions":

- several descriptions instruct the model ("Do not call this tool for stock
  picks", "Lead with those personal lines", "If you can schedule tasks for
  the person, offer once"), where Google asks for declarative wording and no
  cross-tool routing;
- the server instructions describe how to answer as well as what the server
  does, where Google asks for what the server does, without relisting tools.

These were written for, and accepted by, the other hosts. This branch keeps
them byte for byte (proved below). If Google's review flags them, the fix
belongs in a new tool version for every host.

## 8. Privacy, terms and support

- Privacy policy `https://zodiacs.org/privacy/` (200): it says "The Zodiacs
  app for ChatGPT and Claude needs no account". Google's policy requires the
  privacy policy to disclose how the connected app handles data. Before
  review, the wording should name Gemini (or say "AI assistants"); the claim
  `priv.ai-occasion-tools` in `docs/claims/ledger.json` covers that paragraph.
  Not changed here.
- Terms `https://zodiacs.org/terms/` (200).
- Google's policy asks for help on how users manage and delete their data:
  the privacy page covers it (nothing is kept).
- The console documents no support field; `admin@zodiacs.org` stays the
  contact.

## 9. Rate limits on shared addresses (risk at scale)

All Gemini calls come from Google's addresses. The per-address Firewall rules
(40 and 10 per minute, `QUOTAS.md`) and the shared daily quota then apply to
many Gemini users at once. Google's policy prohibits apps that "consistently
return errors". This is the same situation as ChatGPT's and Claude's own
egress, but worth watching in the first week (`USAGE.md`).

## 10. Versioning

Google snapshots tool definitions when they are synced and says changing them
"may break the integration and may cause the application to be disabled";
each published version is locked to its snapshot and Google recommends a new
endpoint path per version (`/mcp/v2`). Zodiacs has so far changed descriptions
in place on `/mcp` (for example R44, #840). Once published on Google, any
change to `tools/list` at `/mcp` should go with a new console version, or the
Google app should point at a versioned path that stays frozen.

## 11. Other requirements

| Requirement | Status |
| --- | --- |
| Name for `@` mentions | `Zodiacs` |
| Description: one sentence under 30 words | Prepared, 24 words ([LISTING.md](LISTING.md)) |
| Icon 512 × 512, PNG or JPEG, at most 1 MB | `public/assets/ai/brand/zodiacs-avatar-v2.png`, 512 × 512 PNG, 13,463 bytes |
| At least 3 capabilities, no leading numbers | Prepared, 8 |
| At least 3 example prompts, 2 starting `@Zodiacs`, 1 naming Zodiacs mid-sentence, no numbers or quotation marks | Prepared, 6 |
| Tool context (`user_locale`, location) | Not requested; the tools take a time zone argument and Google warns that over-requesting fails review |
| Server error codes | Recoverable errors are returned as normal results (`isError` with a plain message), which Google accepts |
| Testers | `@gmail.com` accounts only; owner supplies them |

## Schema identity (this branch)

This branch does not touch `src/ai-tools/`, `src/mcp/` or the generated
runtime. Proof, 1 November 2026: `api/_ai/runtime.mjs` of this branch was
served locally by `/workspace/repos/mcp051-tools/local-mcp-server.mjs` with
the production switches, and `compare-tools.mjs` compared its `tools/list`
with the live one saved above:

- whole `tools/list` result byte-identical (110,349 bytes; SHA-256 of the
  compact result `c89b6ee6…13a5c3c5`);
- 13 tools, same names and order;
- every tool's `name`, `title`, `description`, `inputSchema`, `outputSchema`,
  `annotations`, `_meta` and `icons` byte-identical, and the same key sets.

The full output is [`schema-identity.txt`](schema-identity.txt).
