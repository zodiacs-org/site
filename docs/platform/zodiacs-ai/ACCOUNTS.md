# Save to my Zodiacs account

Built 2026-10-15 on branch `plugin-accounts`, for the first update after the
0.5.0 submission is approved. Default off. Nothing here is applied to any
database, deployment, environment or secret. The 0.5.0 submission stays a
No Auth app until the owner completes the steps below.

## What it does

One new tool, `save_to_zodiacs`, saves something Zodiacs worked out in the
conversation to the person's own zodiacs.org account:

| kind | worked out again with | what is kept |
| --- | --- | --- |
| `chart` | one side of `get_compatibility` (birth details or `{ famous }`) | Sun, Moon and rising signs, birth date, time and zone if given |
| `comparison` | `get_compatibility` | both people, the score out of 100 with its areas, verdict and headline, the contact lines, notes and links |
| `occasion` | `get_occasion_sky` | the card words, the rating with its reasons, the Sun and Moon signs, Moon phase, retrogrades, best days if searched, card link |
| `week` | the personal week of `get_horoscope` | the dated forecast lines and their dates in the person's zone |

The assistant passes `kind` and, under the same name, exactly the arguments the
earlier tool was given. The server runs the same code again and saves that
result. Only the optional label comes from the assistant, as plain text up to
80 characters. Nothing else the model writes can be stored, so a forged score or
reading cannot be saved.

Saves go into the site's own `public.saved_pages` table
(`20261015090000_saved_pages.sql`, the "Save to your profile" feature behind
`PUBLIC_ACCOUNT_SAVES_ENABLED`). There is one table and one list. Each
assistant save is a row with `source = 'assistant'`, holding:

- a title;
- a same-site `href`, listed on `/profile/` under "Saved to your profile" with
  Remove;
- a one-line `summary`;
- the worked-out result as `detail`.

Kinds and links:

| tool kind | `saved_pages.kind` | link |
| --- | --- | --- |
| `chart` | `chart` | `/birth-chart/#c=…` with a birthplace; `/people/<slug>/` for a famous chart; otherwise `/birth-chart/#saved=<digest>` |
| `comparison` | `compatibility` | the comparison link `/compatibility/#a=…&b=…` when both sides have a place; otherwise the sign-pair page with `#saved=<digest>` |
| `occasion` | `occasion` | the card link `/occasions/#…`; without coordinates, `/occasions/#o=…&d=…` |
| `week` | `week` | `/horoscopes/#week=<date>&saved=<digest>` |

The `#saved=` part is the first 16 hex characters of a SHA-256 of the worked-out
result. It only keeps different results apart, because `saved_pages` keeps one row
per account and link. Those pages ignore it, and the summary and `detail` hold
the result.

The `detail` record has schema `zodiacs.assistant-save.v1`. Every string is plain
text (no control characters, markup, brackets or backticks) and at most 600
characters. Every link is a zodiacs.org page. The record is at most 8 KB of compact
JSON. Assistant and site saves share saved_pages' limit of **100 items per
account**. Saving the same link again keeps one row and changes nothing.

Browsers keep saved_pages' column-limited insert grant (`user_id, kind, title, href`),
so only the server's RPC can write `source`, `summary` or `detail`. A site row
stays a compatibility or occasion link exactly as before; only the RPC can write
`chart` and `week` rows. The profile can also download every saved row as JSON
("Download as JSON"), which is the export for saved pages. Deleting the account
deletes them (`on delete cascade`).

Every other tool stays anonymous and unchanged. The assistant cannot read, change
or delete anything already in the account. No conversation text is stored.

## How sign-in works

The design is the Sky Watch preview's, moved into a shared module
(`src/ai-tools/auth/oauth.ts`) without changing Sky Watch's behaviour:

- Supabase Auth's OAuth 2.1 server issues the token. Clients are predefined
  public clients using authorization code with PKCE S256. Dynamic registration
  stays off.
- The access-token hook adds the exact audience (`https://zodiacs.org/mcp`, or
  the exact staging host's `/mcp`) and the separate `profile:save` permission,
  only for clients listed in `zodiacs_accounts_private.oauth_clients`. `openid`
  is the identity scope. Website sign-in tokens pass through unchanged, and the
  hook returns the claims unchanged on any error, so it cannot break sign-in.
- The server verifies the signature (ES256 or RS256 through the project's
  JWKS), issuer, exact audience, expiry, `iat`/`nbf`, role, non-anonymous user,
  `openid`, the permission, and UUID user, session and client. The client must be
  in `ZODIACS_ACCOUNTS_OAUTH_CLIENTS`.
- It then checks live authorization in the database: an enabled client for
  that exact resource, an unexpired OAuth session of that user and client with
  `openid`, an unrevoked consent, an undeleted client and an undeleted, unbanned
  account. The save RPC repeats this check inside the save transaction.
- Hosted Auth tables cannot grant SELECT onward, so invoker triggers keep a
  projection of those facts in `zodiacs_accounts_private.auth_state`, written in
  the same transaction as Auth's own writes. Website sessions without an OAuth
  client are not projected. No email, password or token is copied.

Mixed authentication follows the MCP authorization spec and the Apps SDK:

- `tools/list` shows every existing tool with `securitySchemes: [{ type: "noauth" }]`
  and `save_to_zodiacs` with `[{ type: "oauth2", scopes: ["openid"] }]`.
- A request without a token is anonymous. An anonymous `save_to_zodiacs` call
  returns an error result whose `_meta["mcp/www_authenticate"]` carries
  `Bearer resource_metadata="https://zodiacs.org/.well-known/oauth-protected-resource/mcp", scope="openid", error="insufficient_scope", …`.
  ChatGPT shows its sign-in prompt from it. Nothing is computed or saved.
- A request with a token that fails any check gets HTTP 401 with
  `WWW-Authenticate: Bearer resource_metadata="…", scope="openid", error="invalid_token"`.
- `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`
  serve RFC 9728 metadata naming the Supabase issuer.
- `/oauth/consent/` serves the consent page Supabase's OAuth server sends the
  person to. It uses the site's own Supabase client settings, so a person signed
  in on zodiacs.org is already signed in. Otherwise it sends the site's usual
  email sign-in link back to the same page, or accepts a password for accounts
  that have one, such as the reviewer account. It shows the client name and
  what the client can do, and has Allow, Cancel and a Disconnect list. It returns
  only to ChatGPT's and Claude's OAuth callback addresses. The script and style
  are inline with CSP hashes, and the page is `noindex`.

## The switch

`ZODIACS_ACCOUNTS_ENABLED=1` (server env) turns it on. The save tool is offered
only with `ZODIACS_OCCASIONS_ENABLED=1`, because it recomputes with those tools.
With the switch on, the server also requires `PUBLIC_ACCOUNT_SAVES_ENABLED=1`, so
nothing is saved unless the profile lists and removes it. It refuses with 503
`accounts-unavailable` otherwise.
Any other value, including unset, `0`, `true` or ` 1`, leaves the server as it
is. Sky Watch's preview requires a token for every request, so the two are
refused together.

Off, the hosted `/mcp` answers `initialize`, `tools/list`, `resources/list`,
`get_capabilities` and a call to `save_to_zodiacs` byte-for-byte as the 0.5.0
server does, for both released and 0.5.0 tool sets, and ignores a bearer token
as before. `src/ai-tools/accounts/flag-off.test.ts` checks this against
`flag-off.fixture.json`, captured from the base branch before any account
code existed. The three new routes answer 404 `not-found` while off. These are
the only differences off, and only for those three addresses. The privacy page
renders its current wording unless `ZODIACS_OCCASIONS_ENABLED`,
`PUBLIC_ACCOUNT_SAVES_ENABLED` and `ZODIACS_ACCOUNTS_ENABLED` are all `1` at
build time.

On, `get_capabilities` adds one privacy sentence and replaces "no … account
access" in its limitations. Usage counts add the name `save_to_zodiacs` (tool
name and host family only).

## Files

- `src/ai-tools/auth/oauth.ts`: shared claim checks and Supabase resource (Sky Watch now uses it)
- `src/ai-tools/accounts/`: contracts, save, service, consent page and tests
- `src/ai-tools/http.ts`, `server.ts`, `tools.ts`, `usage.ts`: switch, routes, mixed auth, tool registration, wording, counting
- `src/ai-tools/features/compatibility.ts`: `computePersonChart`, one side as `get_compatibility` computes it
- `scripts/build-accounts-consent.mjs` → `integrations/generated/accounts-consent.mjs` (through `npm run ai:build`)
- `api/_ai/handler.ts`: loads the consent page only when asked for, so the MCP runtime bundle does not carry it
- `vercel.json`: three rewrites to the existing function
- `supabase/migrations/20261015150000_zodiacs_accounts_assistant_saves.sql` (OAuth clients, Auth projection, hook, the assistant columns and kinds on `saved_pages`, the save RPC) and `supabase/tests/zodiacs_accounts.sql`
- `src/lib/profile/saved-pages-config.ts`, `saved-pages-cloud.ts`, `src/islands/SavedPagesPanel.tsx`, `src/styles/account.css`: the profile lists assistant rows with their summary and "from your assistant", and offers "Download as JSON"
- Merged from `site-accounts` (d39ba2044): `public.saved_pages` and the profile list, which this builds on
- `supabase/migrations/20261015150100_zodiacs_mcp_usage_save_tool.sql` and `supabase/tests/zodiacs_mcp_usage_save_tool.sql`
- `src/pages/privacy/index.astro` and `docs/claims/ledger.json` (`priv.ai-accounts-save`)

## What the owner must do

1. **Review and approve both migrations.** They follow the usage-count
   allowlist pattern (`20261013144500_zodiacs_mcp_usage_occasion_tools.sql`)
   and the Sky Watch OAuth adapter. The accounts migration extends
   `public.saved_pages`, so it needs `20261015090000_saved_pages.sql` first.
   Run `scripts/test-phase6-assistant-sql.sh` and `scripts/test-saved-pages-sql.sh`
   (PostgreSQL 17 in Docker). Together they apply every migration, replay the
   new ones and run both new SQL tests plus the saved-pages contract.
2. **Create or choose a staging Supabase project** separate from production,
   with the existing migrations applied, including the two usage-count
   migrations. Apply `20261015090000_saved_pages.sql`, `20261015150000_…` and
   `20261015150100_…` there in that order. Do not apply them to production yet.
3. **Configure Supabase Auth on staging:**
   - Use asymmetric JWT signing keys (ES256 or RS256). The server refuses HS256.
   - Enable the OAuth 2.1 server. Keep dynamic client registration off.
   - Set the site URL to the staging host and the authorization path to `/oauth/consent/`.
   - Register one public client each for ChatGPT and Claude, with exactly the
     callback the host shows when connecting. Today that is
     `https://chatgpt.com/connector_platform_oauth_redirect` and
     `https://claude.ai/api/mcp/auth_callback`. Insert each client ID and its exact resource
     (`https://<staging-host>/mcp`) into `zodiacs_accounts_private.oauth_clients`.
   - Enable the Custom Access Token hook and set it to
     `zodiacs_accounts_private.access_token_hook`. A project has one access-token
     hook. If production already has one when you reach step 7, merge the two
     functions; do not replace it.
   - Add `https://<staging-host>/oauth/consent/**` to the redirect allow-list so
     the email sign-in link can return to the consent page.
4. **Set up a reviewer test account.** Create an account with an address you
   control, for example `review+openai@zodiacs.org`. Confirm it, and give it a
   strong password through the Supabase dashboard or admin API. Reviewers use
   the consent page's "Sign in with a password" option because they cannot
   receive the email link. Put the credentials only in the OpenAI submission's
   test-account fields, never in the repository. Save a few items with it so
   reviewers see a non-empty account.
5. **Deploy a staging preview first.** Use the exact
   `ZODIACS_MCP_STAGING_HOST`. Set these on that preview deployment only:
   - `ZODIACS_MCP_ENABLED=1`, `ZODIACS_OCCASIONS_ENABLED=1`, `ZODIACS_ACCOUNTS_ENABLED=1`, `PUBLIC_ACCOUNT_SAVES_ENABLED=1`
   - `ZODIACS_ACCOUNTS_OAUTH_CLIENTS=<client UUIDs, comma-separated>`
   - `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for the staging project
   - Leave `ZODIACS_SKY_WATCH_ENABLED` unset.

   The privacy page and the profile read these switches at build time, so set them before the
   build. `VERCEL_ENV` must report `preview`. The site's global
   Content-Security-Policy in `vercel.json` lists only the production Supabase
   host in `connect-src`. Check the consent page's response headers on staging.
   If a staging Supabase host is blocked, add it to that header for the staging
   build only.
6. **Run the staging verification below.** Record evidence the way
   `evidence/sky-watch/hosted.json` does.
7. **Production.** After the 0.5.0 approval and a passing staging run:
   - Apply the three migrations to production. If `saved_pages` is already live,
     apply only the two newer ones.
   - Repeat step 3 for production, with resource `https://zodiacs.org/mcp` and
     site URL `https://zodiacs.org`.
   - Set `PUBLIC_ACCOUNT_SAVES_ENABLED=1` (if not already set) and
     `ZODIACS_ACCOUNTS_ENABLED=1` in production, and redeploy. Then submit the
   update to OpenAI and Anthropic with the auth details and reviewer account.
   Publishing an OAuth tool changes the app's listing, so it needs the owner's
   approval and a new submission.

Rollback: unset `ZODIACS_ACCOUNTS_ENABLED` and redeploy. The server returns to
the 0.5.0 bytes, which the flag-off test pins. To stop a client without a
deploy, set `enabled = false` on its row in
`zodiacs_accounts_private.oauth_clients`. Every token from it fails the next
live check, and the hook stops granting the permission. Saved items stay with
their owners.

## Release gates still open

1. Native ChatGPT and Claude connection, sign-in, save, repeat save, disconnect
   and reconnect, recorded as evidence. Unit and SQL tests are not host evidence.
2. Owner review of the privacy wording as rendered with all three switches on.

The profile list, Remove, the JSON download and deletion with the account come
from `public.saved_pages`, so the earlier gate for a separate saved-items surface
is closed. The v2 account export (`account_v2_export`) does not include saved
pages, for site saves or assistant saves. The profile's JSON download is their
export.

## Staging verification checklist

Mirrors [SKY_WATCH.md](./SKY_WATCH.md#verification). Use synthetic accounts and
synthetic birth details only.

- [ ] Off build of the same commit: `tools/list` and `initialize` bytes match
      `flag-off.fixture.json`. The three account routes return 404. No
      `WWW-Authenticate` header appears.
- [ ] On: `GET /.well-known/oauth-protected-resource/mcp` returns the exact
      resource, the staging issuer, `scopes_supported: ["openid"]` and `bearer_methods_supported: ["header"]`.
- [ ] On, anonymous: every existing tool works without a token. `tools/list`
      shows `noauth` on each, and `oauth2` with `openid` on `save_to_zodiacs` only.
- [ ] Anonymous `save_to_zodiacs` returns `isError` with `mcp/www_authenticate`.
      ChatGPT shows its sign-in prompt.
- [ ] Sign-in: the consent page shows the client name. Email-link sign-in
      returns to the same request. Password sign-in works for the reviewer
      account. Allow returns to ChatGPT. Cancel returns with an error. A
      non-listed client is refused.
- [ ] Token: the audience is exactly the staging `/mcp`, and the token carries
      `zodiacs_permissions: ["profile:save"]`. A website sign-in token has
      neither and is refused with 401 `invalid_token`.
- [ ] Save each kind once. Each row appears under "Saved to your profile" with
      its summary, "from your assistant", a working link and Remove, for that
      account only, under RLS. Another account sees none. A repeat save returns
      `alreadySaved: true` and leaves the row unchanged. "Download as JSON"
      includes the rows with their `detail`.
- [ ] Forged inputs: extra fields such as a `result` or `score`, markup in the
      label, a famous name Zodiacs lacks, and an oversized window are refused.
      Nothing is saved.
- [ ] Revocation: Disconnect on the consent page, then the next call returns
      401. Also check consent revocation, session sign-out, a banned user, a
      deleted client and `enabled = false`. Each stops saving at once. Both the
      old and the refreshed token fail.
- [ ] Limit: with site and assistant saves together, the 101st returns
      `account-full` from the tool and "full" on the site.
- [ ] Account deletion removes the account's saved items and projected facts.
- [ ] Website sign-in still works with the hook and triggers installed:
      magic-link sign-in, sign-out and token refresh on zodiacs.org staging.
- [ ] Usage counts show `save_to_zodiacs` rows with no identifiers.
- [ ] Privacy page built with both switches shows the account wording. Built
      with either off, it shows the current wording.

Protocol references (not re-fetched for this change; verify current host callbacks when connecting):
[MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization),
[OpenAI Apps SDK authentication](https://developers.openai.com/apps-sdk/build/auth),
[Supabase OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server).
