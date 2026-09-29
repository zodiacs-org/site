# Owner setup runbook

Status: production observations below were recorded on 2026-08-27. Legal-source
and email-product guidance were reconciled against repository `main` on
2026-09-05; that source review does not reverify dashboard settings. This
runbook is for the **Zodiacs.org website only**.

## 0. Authority and production-preservation rule

This document identifies work that only the owner can decide or perform. It is
not authorization for an agent or this remediation PR to:

- buy or upgrade a plan;
- publish a firewall rule, DNS record, deployment, or production setting;
- create, rotate, reveal, or change a secret or environment variable;
- apply a production migration or change live data;
- create or delete a Supabase project;
- enable, disable, expand, or roll back a live feature; or
- insert a legal identity, jurisdiction, address, governing law, or venue.

Each such action needs a separate, explicit owner instruction. Never paste a
secret, database connection string, backup passphrase, token, or private key
into chat, a command line, a log, a commit, a screenshot, or an artifact. Move
secret values directly between the relevant dashboard and password manager.

### Production state to preserve

Read-only checks on 2026-08-27 found the following pilots live. “Preserve” means
leave their current dashboard configuration unchanged; it does **not** mean set
their flags off.

| Surface | Observed production state | Source contract | This run |
| --- | --- | --- | --- |
| Terminal venue at `/terminal/markets/` | Live | Committed output is flag-off, but a Vercel production build defaults the venue on when `PUBLIC_REGISTRY_EXCHANGE_ENABLED` is absent. An explicit `0` is a rollback. | Preserve; do not add, remove, or change the variable. |
| Registry Collection / Cabinet of Twelve | Live | Committed Registry Collection/Aura output remains flag-off. Production uses the exact collection flag, with the legacy Aura name still accepted. | Preserve live production and committed flag-off bytes. |
| Compatibility invitations | Live | UI, server authorization, Supabase access, and canary/public authorization are separate controls. | Preserve; no launch or rollback. |
| Zodiac Games joining and standings | Live | The public build flag, Supabase configuration, and the server session secret are all required. | Preserve; no launch or rollback. |
| Daily email | Frozen test cohort only | Real delivery is hard-frozen to `DAILY_EMAIL_COHORT=test`. | Do not expand the cohort. |
| Web push | Not part of this remediation | Public UI, server delivery, VAPID material, Supabase access, and workflow scheduling are separate controls. | No changes. |

The old `PUBLIC_REGISTRY_TRADE_ENABLED` setting no longer controls Registry
profiles; their purchase panel is retired. Do not use it as a proxy for Terminal
state. Do not hand-edit generated Registry or Terminal output. Run the owning
generator and commit source plus generated output together whenever a later,
separately authorized change requires it.

## 1. Owner decisions

### 1a. Paid-plan decisions

The owner must decide whether to move the Vercel project from Hobby to a plan
that permits the site's use and supports the intended Firewall configuration.
Check the current terms and price in Vercel before deciding; this runbook does
not approve the purchase.

Supabase leaked-password protection may remain deferred while authentication is
magic-link-only. Before any website password sign-in is released, the owner must
decide whether to use a Supabase plan that supports the protection and then
enable it. The current security-advisor warning is accepted until then.

### 1b. Legal identity, jurisdiction, and address

The committed Terms and Privacy pages, updated 29 August 2026, already identify
**Zodiacs LLC**, a New Mexico limited liability company, as the site operator
and data controller. The Terms' “Operator and applicable law” section preserves
mandatory laws and non-waivable rights; it does not select an exclusive
governing law or dispute forum. These pages are the current source of truth:
`src/pages/terms/index.astro` and `src/pages/privacy/index.astro`. The operator
identity is no longer a pending placeholder.

Before an email release, verify the current legal pages are deployed and that
the message uses a valid owner-approved postal address. The published identity
does not establish that the email postal setting is present, current, or
approved for that use. Any change to the operator/controller identity,
jurisdiction, address, governing-law wording, or dispute forum still requires
the owner's exact facts and explicit authorization. Do not infer them from a
domain registration, a filing, a payment account, or a registered agent.

A PO box or registered-agent address is **not automatically sufficient**. The
owner must confirm that the chosen address is genuinely usable for the operator
and applicable jurisdiction and can receive required mail. Obtain legal advice
if that is uncertain.

The published legal identity must remain deployed before any new public
standalone email capture is enabled. An account-digest canary separately
requires the genuinely valid, owner-approved postal address printed in the
message footer.

If the owner authorizes a later legal change, that separate legal PR must:

- update the operator, controller/contact, applicable-law, and venue text;
- update the visible `updated` date on every legal page it changes;
- update `modifiedAt` in each changed English structured-data block in
  `src/pages/terms/index.astro` and `src/pages/privacy/index.astro`; and
- leave `DAILY_EMAIL_POSTAL_ADDRESS` unchanged until the owner separately
  authorizes the matching dashboard update.

The ES/FR/IT/PT privacy pages are Phase 1 protected. That legal PR must replace
the spent `.github/phase1-scope-allowance.json` with a fresh version pinned to
the exact PR base commit. Its sorted `protectedPaths` must equal exactly the
protected locale files changed, selected from:

- `src/pages/es/privacy/index.astro`
- `src/pages/fr/privacy/index.astro`
- `src/pages/it/privacy/index.astro`
- `src/pages/pt/privacy/index.astro`

Do **not** list `src/pages/terms/index.astro` or
`src/pages/privacy/index.astro`; the English legal files are not protected by
that guard, and an allowance that lists them is invalid. A prior allowance on
`main` is already spent and cannot be reused. This runbook records the required
mechanics; it is not authorization to make the legal edits.

## 2. Encrypted database backup and restore drill

The weekly workflow is `.github/workflows/db-backup.yml`. Until the owner adds
both required secrets to the exact-`main` `database-backup-production`
environment, every scheduled or manual run fails visibly without creating an
artifact:

- `SUPABASE_DB_URL`: the Session pooler value copied directly from the Supabase
  dashboard into the GitHub Actions secret form; and
- `BACKUP_PASSPHRASE`: one control-free line containing 32–1024 random bytes,
  generated and retained in the owner's password manager.

Do not show either value to an agent or place either value in a shell command.
The workflow converts the database URL into protected libpq inputs rather than
passing a password-bearing URL to PostgreSQL processes. Encryption uses GnuPG
loopback pinentry with the passphrase supplied through a protected file
descriptor, never a process argument.

### Owner setup and first run

These are owner-only actions and need explicit authorization before execution:

1. Confirm the restore workstation has PostgreSQL 17 client tools, GnuPG with
   loopback pinentry support, Node.js, and GNU tar. On macOS, install GNU tar as
   `gtar`; the wrapper rejects BSD tar. The wrappers remain compatible with the
   system Bash 3.2. The workflow also uses `pg_dump` and `pg_restore`.
2. Confirm `main` is protected, create the `database-backup-production`
   environment with an exact-`main` deployment-branch policy, and add the two
   environment secrets there. Keep repository- and organization-level Actions
   secrets empty. Do not echo or validate secret values in a workflow log.
3. Dispatch **Actions → Database Backup** once and require a green run.
4. Download the encrypted artifact without renaming or unpacking it. The
   repository wrapper validates the bundle metadata and member list and removes
   its protected decrypted workspace on exit. Do not write an ad hoc decrypt or
   restore command.

The bundle uses one exported repeatable-read snapshot for every application
schema currently present (`public` and, if released later, `private` and
`living_chart_private`), the complete migration-ledger schema, `auth.users`,
and `auth.identities`. It restores Auth identities before application data and
foreign-key validation. Generated pre-data/data/post-data sections retain the
project's RLS, policies, ownership, GRANT/REVOKE ACLs, default ACLs, and
SECURITY DEFINER function contract. A snapshot-generated replay section also
preserves the special `public` schema ACL that `pg_dump` omits. Because the
ordered Auth dump does not yet cover MFA, passkey, SSO, SAML, registered OAuth
clients, OAuth user consents, or custom-OAuth configuration, the exporter
fails instead of producing a partial artifact if any detected durable table is
nonempty. The fresh-target guard independently requires every detected Auth
relation to be empty except the managed `instances`, `schema_migrations`,
`users`, and `identities` relations; residual sessions, refresh tokens,
flow state, OAuth client state, or WebAuthn challenges stop the restore before
mutation.

### Mandatory first-month restore drill

A successful decryption is not recovery acceptance. With separate owner
authorization, create a **fresh throwaway Supabase project**, restore only into
that project, and delete it only after evidence is saved. Never test a restore
over the live project. Do not run `supabase db push` or otherwise initialize
`supabase_migrations` first; the wrapper requires that ledger schema to be
absent and recreates the source ledger inside the restore transaction.

Run the repository procedure from a clean checkout, passing only the encrypted
artifact path (which contains no credential):

```sh
bash scripts/restore-db-backup.sh /absolute/path/to/zodiacs-db-....tar.gz.gpg
```

The wrapper prompts invisibly for the passphrase and fresh-project database URL,
places them in mode-0600 inputs, and never passes either through process
arguments. It refuses the known production project, runs a read-only
fresh-project preflight, and then requires the exact confirmation `RESTORE`
before any schema change. That confirmation is not a substitute for the
separate owner authorization required by this runbook. Keep the throwaway
target traffic-disabled for the entire drill. The final transaction repeats
the destructive emptiness/Auth compatibility guard and holds exclusive Auth
table locks through commit so the interactive confirmation gap cannot admit a
new account.

The generated restore uses `psql -X`, `ON_ERROR_STOP=1`, and one transaction;
any generated section or acceptance failure rolls the target back. Its order is:

1. application and migration-ledger pre-data;
2. Auth users;
3. Auth identities;
4. application and migration-ledger data;
5. application and migration-ledger post-data, including constraints,
   policies, and ACLs;
6. the snapshot-generated `public` schema ACL replay; and
7. manifest and authorization acceptance before commit.

The drill passes only when all of the following are recorded:

- source and restored row counts and canonical content digests match for every
  included application table, so same-count mutation fails acceptance;
- every application sequence restores its definition plus the sampled
  `last_value` and `is_called` state;
- restored Auth user and identity UUID digests match the source manifest;
- the fresh target's managed Auth column contract exactly matches the source
  before any schema change;
- every application foreign key links to its restored parent, including Auth
  UUIDs, and no orphan remains;
- all application and migration-ledger constraints exist and are validated;
- every expected table has the correct RLS/forced-RLS state and policies;
- schema, table, sequence, routine, schema-scoped default ACLs, and relevant
  application-owner global default ACLs match, including no unintended
  `PUBLIC EXECUTE` on SECURITY DEFINER functions;
- `anon`, `authenticated`, and `service_role` behavior matches the application
  authorization contract, including denied operations;
- restored users must reauthenticate and can access only their own rows; and
- the fresh-project application smoke test passes before any recovery plan is
  considered usable.

Keep these interim tradeoffs explicit:

- **RPO:** a successful weekly cadence can lose up to seven days of changes;
  failed or skipped runs extend that window until the next successful backup;
- **retention:** GitHub keeps each artifact for 90 days;
- **public-repository exposure:** the encrypted artifact can be downloadable
  from a public repository, so the passphrase is the confidentiality boundary;
- **excluded Auth state:** sessions, refresh tokens, and Auth audit rows are
  deliberately excluded, as are short-lived OAuth authorization/flow rows, so
  reauthentication is expected; detected durable MFA, passkey, SSO, SAML,
  OAuth client, OAuth consent, or custom-OAuth rows make export fail until
  their ordered recovery boundary is implemented; and
- **restore target:** fresh-project-first only, never an untested live overwrite.

## 3. Vercel Firewall rate limits

This section is owner-only because it may require a plan purchase and publishing
production Firewall changes. Do not execute it from this remediation PR.

The API uses `@vercel/firewall` SDK rate-limit IDs. For each rule, the **If**
condition must be `@vercel/firewall` with the exact Rate limit ID below, set to
the limit in the table using the default client-IP key. Leave the rule's
**Then** action at its SDK-rule default. A path-matched Deny rule is wrong: it
would return 403 instead of letting the endpoint return 429 with `Retry-After`.

| Rate limit ID | Endpoint | Limit |
| --- | --- | --- |
| `zodiacs-email-subscribe` | `/api/email/subscribe` | 10 requests per 60 seconds |
| `registry-aura-holdings-v1` | `/api/aura-holdings` | 10 requests per 60 seconds |
| `zodiacs-wallet-birth` | `/api/wallet-birth` | 10 requests per 60 seconds |
| `zodiacs-transit-calendar` | `/api/calendar/transits` | 10 requests per 60 seconds |
| `zodiacs-compute-api` | the six compute endpoints, `/api/v1/{chart,positions,houses,events,time,sky-fact}` (served by `api/compatibility.ts`) | 60 requests per 60 seconds |

The compute API's limit is higher because programs call it in batches and most
requests take a few milliseconds; its largest request (a 366-day events window
with every body) took about 0.6 s warm in the measurements in
`docs/platform/evidence/compute-api-2026-09-29/`, so one address at the limit
costs at most about 40 function-seconds a minute. Until the rule exists, the
SDK reports `not-found` and the API fails open, as the transit calendar does.
To switch the API off without removing it, set `COMPUTE_API_ENABLED=0` for
Production and redeploy: every compute endpoint then answers 503 with
`Retry-After`. Leave it unset, or anything but `0`, to keep it on.

After the owner explicitly authorizes and publishes the rules, verify the email
rule without a recipient or email body:

```sh
for attempt in $(seq 1 12); do
  curl --silent --show-error --max-time 10 \
    --output /dev/null \
    --dump-header - \
    --request POST \
    --header 'Origin: https://zodiacs.org' \
    --header 'Accept: application/json' \
    https://zodiacs.org/api/email/subscribe
done
```

The final responses must visibly include an `HTTP/... 429` status line and a
`Retry-After: 60` header. Without the `Origin` header the same-origin guard
returns 403, which does not test the Firewall rule.

### 3a. Sky data API: keep `/api/v1/` reachable for scripts and agents

The sky data API (`/api/v1/`, documented at `/developers/`) is public, keyless
static JSON meant to be fetched by scripts and AI agents, so no Deny, Challenge,
or Attack Challenge Mode rule may ever cover that path.

Observation recorded on 2026-09-07: an agent sandbox on a shared cloud egress
received intermittent `403 Forbidden` responses carrying
`x-vercel-mitigated: deny` on every path, including `/`, while the same
requests from GitHub-hosted runners, Anthropic's fetcher, and Vercel's own
fetcher all succeeded. That is Vercel's system-level IP mitigation reacting to
the shared egress, not a project rule. The Daily Sky workflow now requires
`/api/v1/sky/today.json` from production on every run
(`scripts/verify-live-daily.mjs`), so a regression that reaches a neutral
client fails that workflow visibly.

Owner-only diagnostic: in the project's Firewall tab, filter traffic to the
path `/api/v1/` and the action Denied. If legitimate clients appear there,
publish one custom rule:

| Field | Value |
| --- | --- |
| Name | `sky-data-api-bypass` |
| If | Request path matches the regular expression `^/api/v1/.*\.[^/]+$` |
| Then | Bypass, with "bypass system-level mitigations" enabled |

Bypass removes DDoS mitigation for the matched paths, so keep it scoped to the
static files under `/api/v1/` (small, edge-cached, every one named with an
extension) and keep the plan's bandwidth allowance in view; on a plan with
rate limiting, a generous per-IP rate-limit rule for the same paths can sit
above it if abuse ever appears. Do not widen it to every path starting with
`/api/v1/`: since 2026-09-29 that prefix also holds the six compute endpoints,
which run a function on every request and must keep the platform's
mitigations. The expression is the one `vercel.json` uses for the static
files' cache header, which no compute path can match.

Verify from any non-residential network after publishing:

```sh
for attempt in $(seq 1 12); do
  curl --silent --show-error --max-time 10 --output /dev/null --dump-header - \
    https://zodiacs.org/api/v1/index.json \
    | grep -iE '^(HTTP/|access-control-allow-origin|x-vercel-mitigated)'
done
```

Every attempt must print `HTTP/2 200` and `access-control-allow-origin: *`;
no attempt may print `x-vercel-mitigated`.

## 4. Account weekly digest: supported, but keep the schedule off

The supported weekly digest is for signed-in account holders who enabled it in
`/profile/`. It queries account preferences in Supabase; it is not a sender for
the standalone public Resend Segment.

Keep the GitHub variable `DIGEST_ENABLED` unset or false until every acceptance
step below passes. The sender caps each process at 80 provider attempts and the
database delivery ledger enforces 80 non-cancelled slots for the whole Monday
edition across retries and concurrent runs. Confirm the provider's current
quota still leaves sufficient headroom before enabling the schedule.

### Owner-only prerequisites

Do not perform these without separate owner authorization:

1. Apply the narrowly scoped weekly-unsubscribe capability migration to the
   production Supabase project. No live send may run before it exists.
2. Create the `weekly-digest-production` GitHub environment, restrict it to the
   repository's default branch, and store exactly these three environment
   secrets there: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a dedicated
   random `EMAIL_CONFIRM_SECRET` of at least 32 bytes. Do not leave repository-
   or organization-scoped copies readable by untrusted branches.
3. In GitHub Actions variables, verify `PUBLIC_SUPABASE_URL` and
   `DAILY_EMAIL_POSTAL_ADDRESS`; optionally set `DIGEST_FROM_EMAIL` and
   `DIGEST_BASE_URL`. The postal address must be the exact owner-approved value
   from §1b.
4. In Vercel, the unsubscribe function may use only the existing public
   `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy public
   anon-key fallback is supported). Do not put a service-role key or weekly
   envelope-sealing secret in Vercel.

`DIGEST_UNSUBSCRIBE_SECRET` is obsolete and must not be added. Secret values
must move through dashboard secret forms, never chat or command-line arguments.

### Safe enable order

1. Confirm `DIGEST_ENABLED` is unset/false.
2. Add the repository secret `DIGEST_CANARY_TO` holding the owner-controlled
   canary address (a secret form, never chat or a dispatch input). Dispatch
   **Weekly Digest** with `canary=true` and `dry_run=true`. The run narrows this
   week's candidates to that one address or refuses to send to anyone, and
   prints `weekly-digest: canary receipt sent=0 recipient=sha256:<prefix>` — a
   hash prefix, never the address. Addresses, chart names, personalized
   bodies, and unsubscribe capabilities must remain absent from the public
   Actions log.
3. Confirm the canary address is opted in. With explicit approval for one live
   email, dispatch `canary=true` and `dry_run=false`; the sender forces
   `limit=1` and refuses `--limit`, `--fixture`, and `--recovery-only` in this
   mode, so a typo cannot widen the send. The receipt line must read
   `sent=1`.
4. Check the received message's sender, content, postal footer, and unsubscribe
   link. A GET of that link must be read-only. Submit the page's explicit POST,
   then verify the profile preference became false, the delivery receipt stays
   `sent`, and direct public access to both capability tables remains denied.
5. Only after steps 1–4 pass may the owner explicitly authorize setting
   `DIGEST_ENABLED=true`. Verify the first scheduled Monday delivery and keep
   the hard ceiling at 80 unless a separately reviewed migration changes it.

Only an exact recipient-specific rejection is recorded as a terminal `failed`
slot. Rate limits, provider-wide 4xx responses, 5xx responses, transport
failures, concurrent-idempotency responses, and unknown or unreadable responses
leave the delivery fenced for exact replay or reconciliation because the
provider may have accepted it. Do not reset or rerender that receipt; follow the
recovery and reconciliation procedure in `docs/WEEKLY-DIGEST.md`.

If any step fails, leave `DIGEST_ENABLED` unset/false and stop. Do not compensate
by adding a broader Vercel database key.

## 5. Standalone public email capture: keep off

The public capture promises a standalone weekly forecast, but this repository
does not contain a Segment-based weekly sender or complete provider-side
unsubscribe/suppression lifecycle. Provider credentials alone therefore must
not render the capture. Keep `STANDALONE_WEEKLY_EMAIL_ENABLED` unset/false.

Resend's current dashboard language is **Contacts → Segments**, not Audiences.
For Resend, a future capture release also requires a valid provider setup and
`RESEND_SEGMENT_ID`, but those values do not make the product complete and this
runbook does not authorize setting them.

A later, separately authorized release may enable capture only after all of the
following exist and pass with an owner-controlled address:

1. the current legal identity from §1b is verified as deployed and the message
   uses the owner-approved postal address;
2. a real Segment-based sender, Resend Broadcast, or Resend Automation sends
   the promised weekly message with a working unsubscribe lifecycle;
3. submitting the capture sends a double-opt-in confirmation but does not add
   Segment membership;
4. confirmation GET remains scanner-safe and does not add membership;
5. the user explicitly submits the confirmation POST, after which — and only
   after which — Contacts → Segment membership appears;
6. a limit-one weekly canary is delivered;
7. unsubscribe removes or suppresses the contact as designed; and
8. a subsequent scheduled test proves the unsubscribed address is not sent to.

Until that lifecycle exists, revise neither the gate nor the public promise.

## 6. Explicitly outside this remediation

Do not add setup or launch steps for these systems here:

- daily email beyond the frozen test cohort;
- web push;
- compatibility-invite or Zodiac Games launch/rollback;
- Registry trade, exchange, collection/Aura, community, push, or daily-email
  feature-flag changes; or
- changes to production DNS, Resend, Supabase, Vercel, GitHub secrets, or live
  data without the separate owner authorization described above.

These are multi-prerequisite systems, not one-flag switches. A later release
must use its feature-specific canary and rollback contract.

## 7. Owner acceptance checklist

- [ ] The owner has made — or explicitly deferred — the Vercel paid-plan
      decision; no purchase was made by this remediation.
- [ ] The owner has supplied and authorized all five legal facts, or legal
      identity remains pending and public standalone capture remains off.
- [ ] A Database Backup run is green, the artifact decrypts locally, and a full
      fresh-project restore drill satisfies every acceptance check in §2.
- [ ] Published Firewall rules visibly return 429 and `Retry-After: 60` under
      the header-printing check in §3.
- [ ] The Firewall traffic view shows no denied legitimate `/api/v1/` clients,
      or the `sky-data-api-bypass` rule in §3a is published and the twelve-attempt
      check there prints only `HTTP/2 200` with open CORS.
- [ ] The digest fixture/redacted dry-run, one-recipient live canary, and
      scanner-safe GET plus explicit unsubscribe POST all pass before
      `DIGEST_ENABLED` is set true.
- [ ] Standalone public capture remains hidden until its Segment sender,
      double-opt-in, and unsubscribe/suppression lifecycle pass end to end.
- [ ] Terminal, Registry Collection, compatibility invitations, Zodiac Games,
      the daily-email cohort, web push, and all Registry/community flags retain
      their pre-remediation production state.
- [ ] No secret, database URL, passphrase, private key, personalized email body,
      chart name, or unsubscribe capability appears in logs, chat, commits,
      screenshots, commands, or artifacts.
