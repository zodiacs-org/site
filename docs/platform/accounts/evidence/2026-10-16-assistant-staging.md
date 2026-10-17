# Assistant saving staging — 16 October 2026

Status: native saving, duplicate checks and revocation exercised in both hosts; profile-reading fix, fresh shared Sky Watch sign-in and owner privacy review verified on hosted staging. The remaining native isolation and account-lifecycle checks are listed below.

The owner delegated the capacity decision after the two free database slots were
found occupied. Reuse the existing Sky Watch test database with distinct client
allowlists and deployments. No paid capacity was purchased.

## Database

Staging project: `vdunxhdbnosuqqsyicim` (Zodiacs Sky Watch Test).
Applied successfully, in this order:

1. `20261008074758_zodiacs_mcp_usage_counts.sql`
2. `20261013144500_zodiacs_mcp_usage_occasion_tools.sql`
3. `20261015090000_saved_pages.sql`
4. `20261015150000_zodiacs_accounts_assistant_saves.sql`
5. `20261015150100_zodiacs_mcp_usage_save_tool.sql`
6. `20261016090639_shared_preview_access_token_hook.sql`

Verified RLS on saved pages and the private account authorization tables. The
security advisor reported no errors; existing Sky Watch default-deny RLS notices
and the existing unavailable leaked-password protection warning remain.

The shared hook is now selected and enabled in staging Auth. Both new account clients are enabled in the
account allowlist for `https://zodiacs-accounts-test.vercel.app/mcp`. The two
existing Sky Watch clients remain in their original, separate allowlist.

## Public OAuth clients

The owner explicitly approved creation of both staging clients. Both use PKCE
without a client secret:

| Client | ID | Exact callback |
| --- | --- | --- |
| ChatGPT · Zodiacs Account Saves | `bc20c0be-2688-4b12-95b1-ab9a0ad261bb` | `https://chatgpt.com/connector/oauth/3hCcdQiy23Tg` |
| Claude · Zodiacs Account Saves | `ddccf28a-7cee-4fc7-904d-93d08ad6cd2d` | `https://claude.ai/api/mcp/auth_callback` |

The owner created the reviewer account directly. Verified that it exists, has
a confirmed email and has a password. No password was read or recorded.

ChatGPT's private connector form now supplies a unique callback,
`https://chatgpt.com/connector/oauth/3hCcdQiy23Tg`. The provider callback was updated to that exact address with the owner's approval.

## Hosted preview

- Dedicated Vercel project: `zodiacs-accounts-test`.
- Source: `d03fd5e2` on `codex/accounts-setup-050`.
- Preview deployment: `dpl_4bXjN91hZDc3KQ6t6dX59X8apyyC`.
- Alias: `https://zodiacs-accounts-test.vercel.app`.
- Settings are deployment-only; no persistent Preview variables were added.
- Local build used Node 24.19.0; the deployed package engine selects Node 22.
- The new project initially lacked the on-demand `zodiacs-compute-api` firewall
  rule, so the handler correctly failed closed before calling the database.
  Added the staging rule at 30 requests per IP per 60 seconds, matching the
  existing production rule. No production firewall changes were made.
- A protected diagnostic independently confirmed the staging database quota
  RPC returns HTTP 200 and `true` from the hosted Node 22 runtime.
- All six hosted pre-authentication checks passed: exact resource/issuer,
  shared consent configuration and CSP, thirteen anonymous tools plus one OAuth
  save tool, anonymous capability call, sign-in challenge on anonymous saving,
  and refusal of an invalid bearer. See `2026-10-16-hosted-preauth.json`.
- Both private host connections were created and authorized with the reviewer
  account. The consent page lists both clients. Each host saved a chart, and
  both rows appear in the staging profile with summaries and assistant labels.
- The shared provider Site URL now uses the accounts preview, with authorization
  path `/oauth/consent/`. Added consent and website callback return paths while
  preserving the Sky Watch entry. No signing keys or existing clients changed.
- Claude initially connected anonymously with "Sign in when needed". Its first
  save refused correctly, but no automatic sign-in control appeared. Explicit
  disconnect/reconnect in connector settings completed OAuth successfully.
  Record this limitation when assessing host sign-in usability.
- The saved synthetic chart link restores its original date, time and place,
  computes locally, and matches the stored Sun/Moon/rising summary.
- All four save kinds succeeded in both hosts. Six synthetic records exist: two
  charts, two comparison variants, one wedding and one weekly forecast. Repeated
  saves returned the original record without changing its timestamp.
- Download as JSON contains all six rows and their full `detail` values.
- Disconnecting each client on the consent page blocked its next save. Claude
  displayed a reconnect request. ChatGPT returned a generic internal tool
  failure instead of a sign-in prompt; explicit reconnect in settings restored
  saving and returned the existing chart (`alreadySaved: true`). Claude also
  saved successfully after explicit settings reconnection, returning the same
  comparison ID and original save time with `alreadySaved: true`.
- The native weekly link opened the general horoscope page, and a comparison
  without coordinates opened the sign-pair guide. The profile now offers an
  on-demand saved reading for every assistant row. It displays the stored
  content directly and clears it on an account change. Source: `d03fd5e2`;
  hosted UI verification passed for chart, comparison, occasion and week.
  The weekly dates and time zone, comparison score and caveats, and wedding
  local time and rating are all visible directly in the profile.
- Existing Sky Watch capability calls still succeed after the shared hook
  change. A fresh OAuth grant for the synthetic reviewer account also passed
  in the existing private Sky Watch preview. The original connection stayed
  connected; the reviewer has zero watches, and no watch or reminder was made.
- A hosted read-only RLS query authenticated as another synthetic account
  returned zero of the reviewer's saved rows. A native second-account profile
  check and the full destructive account lifecycle matrix remain unverified.
  The PostgreSQL 17 suite covers those database contracts; this is not a
  substitute for native host evidence.

## Shared provider rollback baseline

- Site URL: `https://zodiacs-sky-watch-test.vercel.app`
- Authorization path: `/oauth/consent`
- OAuth server on, dynamic registration off.
- Existing hook: `sky_watch.access_token_hook`.
- Existing enabled Sky Watch clients: `78090876-95cf-4eae-a66d-f94bc447edd8`
  and `47749961-f3e9-480f-ad14-8c9915976220`, both for
  `https://zodiacs-sky-watch-test.vercel.app/mcp`.

Do not switch the provider until the replacement consent page is deployed.
Preserve the existing redirect URLs, signing keys and worker scheduler.

## Local verification

- PostgreSQL 17 assistant SQL suite, including both original hooks and the
  shared dispatcher, passed. Website claims stay unchanged; disabled, unknown
  and ambiguous clients receive no new preview claims.
- All 269 AI tool tests and the integration drive passed.
- Final focused account/flag-off tests: 19 passed. With accounts disabled,
  responses still match the submitted fixture byte for byte.
- `npm run check`: no errors or warnings (44 hints).
- Generated runtime and consent files rebuilt with `npm run ai:build`.

No assistant-account production migration, flag, submission or rescan was made.

Profile reading follow-up: 30 focused tests pass, including real saved-result
rendering, markup escaping, bounded parsing and current-account query isolation.
The full build, distribution checks and bundle budgets pass; type checking
reports 0 errors, 0 warnings and 44 existing hints.

## Native evidence and remaining checks

- `2026-10-16-native-account-saves.json` records observed host outcomes and
  explicitly separates pending checks from passes.
- `2026-10-16-saved-week.png` shows the saved weekly reading in the profile.
- `2026-10-16-assistants-reconnected.png` shows both restored grants.
- The owner approved the enabled privacy wording on 16 October 2026.
- The fresh Sky Watch authorization passed. Its screenshot stays in the local
  release evidence because it displays test-account addresses; it is not
  included in this public pull request.
- Native second-account isolation, the full hosted revocation and deletion
  matrix, anonymous-save inline sign-in in ChatGPT, and email-link/cancel
  paths remain pending. Do not mark all staging gates passed yet.
- The directory remains In review. With the owner's explicit approval, its
  description was replaced by the current submission description and its
  displayed tool list was synced from six to thirteen. No new submission,
  further scan, carousel upload, or email was made in this verification.
