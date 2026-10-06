# Private Sky Watch operations

This recipe documents the dedicated test project only. It is not a production
migration or an instruction to enable events on an existing website project.
Apply the six migrations in SKY_WATCH.md first. Enable `pg_cron` and `pg_net`
through the test project's extension controls. Store the preview worker bearer
secret in Supabase Vault as `sky_watch_preview_worker_key`, using the same value
as the server-only deployment setting. Never paste that value in committed SQL,
logs, tickets or plugin archives.

After verifying the exact preview alias, schedule this query in the test project:

```sql
select cron.schedule('sky-watch-preview-worker', '*/5 * * * *', $worker$
select net.http_post(
  url := 'https://zodiacs-sky-watch-test.vercel.app/worker',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name='sky_watch_preview_worker_key'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
)
where exists (
  select 1 from sky_watch.subscriptions where active and expires_at>now()
)
or not exists (
  select 1 from sky_watch.worker_state
  where singleton and last_finished>now()-interval '24 hours'
);
$worker$);
```

The deployed job is ID 1, active on 6 October 2026. A successful cron row only
proves the database query ran. Inspect the corresponding `net._http_response`
status and `sky_watch.worker_state` completion separately. Do not print request
headers, Vault secrets, callback destinations or account details. Idle five-minute
checks return zero rows; maintenance invokes HTTP at least daily while the database
and host are running. There is no delivery SLA, and Free Plan pauses can interrupt it.

To pause scheduling without deleting subscriptions, an operator can run:

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname='sky-watch-preview-worker'),
  active := false
);
```

Disconnect in the preview account page revokes an application's grant. The MCP
and worker check live authorization, including before every delivery. To disable
all access, disable the preview endpoint and schedule together. Do not rotate the
callback encryption key as a shutdown mechanism; existing encrypted destinations
would become unreadable. Preserve the old deployment and key for rollback.

Before replacing the preview, run the OAuth signature tests, real PostgreSQL
lifecycle tests, anonymous-denial checks and synthetic provider sign-in/refresh/
revocation checks. Review exact deployment target and alias, then verify the
native ChatGPT subscribe/arrival/refresh/stop flow. No successful native delivery
has yet been recorded. Production activation remains reserved for owner review.

## Preview bundle preflight

Build the dedicated host with `node scripts/build-sky-watch-preview.mjs` and an
empty output directory outside this repository. Install that directory's pinned
dependencies, then verify its actual wrapper export before deploying:

```sh
node --input-type=module -e "import assert from 'node:assert/strict'; import {createWatchPreviewHandler} from './api/_watch/runtime.mjs'; assert.equal(typeof createWatchPreviewHandler, 'function');"
```

Run this from the prepared deployment directory. The general
`integrations/generated/sky-watch.mjs` bundle is not the OAuth/account/worker
wrapper; copying it over `api/_watch/runtime.mjs` breaks the entry point. A
private deployment on 6 October exposed that mistake, was rolled back, and was
replaced with the dedicated build. Preserve this preflight in the deploy runner.

Verify the deployment is Ready before moving the test alias. Its unique Vercel
hostname is deliberately rejected by the exact-host guard; use that only to
check that the wrapper loads, not as an OAuth URL. After assigning the approved
test alias, protected-resource metadata and account configuration must return
200, and unauthenticated MCP and worker POSTs must return 401. Refresh the
private plugin and test its actual panel. Keep the preceding working deployment
available for alias rollback. The original Chart Studio 0.2.0 preview and
production aliases are separate and remain unchanged.
