# Assistant saving staging — 16 October 2026

Status: database and public OAuth clients prepared; hosted connection tests pending.

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

The new hook has not yet been selected in Auth. Creating its function alone
does not change either live preview. The account allowlist is not enabled yet.

## Public OAuth clients

The owner explicitly approved creation of both staging clients. Both use PKCE
without a client secret:

| Client | ID | Exact callback |
| --- | --- | --- |
| ChatGPT · Zodiacs Account Saves | `bc20c0be-2688-4b12-95b1-ab9a0ad261bb` | `https://chatgpt.com/connector_platform_oauth_redirect` |
| Claude · Zodiacs Account Saves | `ddccf28a-7cee-4fc7-904d-93d08ad6cd2d` | `https://claude.ai/api/mcp/auth_callback` |

The owner created the reviewer account directly. Verified that it exists, has
a confirmed email and has a password. No password was read or recorded.

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
