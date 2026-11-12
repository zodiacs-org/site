\set ON_ERROR_STOP on

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.request_hmac(fill text, version text default 'v1')
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(version || ':' || repeat(fill, 64));
$$;

create or replace function pg_temp.envelope(fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ciphertext', encode(decode(repeat(fill, 64), 'hex'), 'base64'),
    'nonce', encode(decode(repeat(fill, 24), 'hex'), 'base64'),
    'format', 'opaque_v1',
    'key_scope', 'service',
    'key_version', 1,
    'wrapped_key', encode(decode(repeat(fill, 136), 'hex'), 'base64')
  );
$$;

create or replace function pg_temp.provider_entries(
  recipient_hash text,
  fill text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(jsonb_build_object(
    'recipient_hash', recipient_hash,
    'encrypted_payload', pg_temp.envelope(fill)
  ));
$$;

create or replace function pg_temp.positions_wire()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'b', jsonb_build_array(
      15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345
    ),
    'a', jsonb_build_array(100, 190),
    'h', 'w',
    'v', '3.2.1'
  );
$$;

create or replace function pg_temp.terminal_recreation_blocked(
  candidate_user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  begin
    insert into public.profiles (user_id)
    values (candidate_user_id);
    return false;
  exception when insufficient_privilege then
    null;
  end;

  return true;
end;
$$;

create or replace function pg_temp.legacy_inserts_blocked(candidate_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  begin
    insert into public.charts (id, user_id, payload) values (
      '54000000-0000-4000-8000-000000000098',
      candidate_user_id,
      '{"must":"not write"}'::jsonb
    );
    return false;
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.chart_deletions (user_id, id) values (
      candidate_user_id,
      '54000000-0000-4000-8000-000000000097'
    );
    return false;
  exception when insufficient_privilege then
    null;
  end;

  return true;
end;
$$;

select pg_temp.assert_true(
  not has_schema_privilege('anon', 'private', 'usage')
    and not has_schema_privilege('authenticated', 'private', 'usage')
    and has_schema_privilege('service_role', 'private', 'usage'),
  'the private schema must be unavailable to browser roles'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'account_states',
        'account_daily_sun_recipient_aliases',
        'account_consents',
        'account_consent_events',
        'account_sync_devices',
        'account_chart_records',
        'account_chart_secret_envelopes',
        'account_sync_changes',
        'account_sync_tombstones',
        'account_sync_mutations',
        'account_deletion_receipts',
        'account_deletion_provider_cleanup',
        'account_daily_sun_provider_mutation_leases'
      )
      and not pg_class.relrowsecurity
  ),
  'every account v2 table must have RLS enabled'
);

select pg_temp.assert_true(
  to_regclass('private.account_chart_derived_data') is null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'private'
        and table_name = 'account_chart_records'
        and column_name = 'label'
    ),
  'labels and astrological projections must live only inside the full-chart envelope'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_policy
    join pg_catalog.pg_class on pg_class.oid = pg_policy.polrelid
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname like 'account_%'
  ),
  'private account tables must expose zero browser policies'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('private.account_states'),
      ('private.account_daily_sun_recipient_aliases'),
      ('private.account_consents'),
      ('private.account_consent_events'),
      ('private.account_sync_devices'),
      ('private.account_chart_records'),
      ('private.account_chart_secret_envelopes'),
      ('private.account_sync_changes'),
      ('private.account_sync_tombstones'),
      ('private.account_sync_mutations'),
      ('private.account_deletion_receipts'),
      ('private.account_deletion_provider_cleanup'),
      ('private.account_daily_sun_provider_mutation_leases')
    ) as named(table_name)
    where has_table_privilege('anon', named.table_name, 'select,insert,update,delete')
       or has_table_privilege('authenticated', named.table_name, 'select,insert,update,delete')
  ),
  'browser roles must have no private-table privileges'
);

select pg_temp.assert_true(
  not has_table_privilege('service_role', 'private.account_consent_events', 'update,delete')
    and not has_table_privilege('service_role', 'private.account_sync_changes', 'update'),
  'append-only consent and change history must not be mutable'
);

select pg_temp.assert_true(
  has_column_privilege(
    'service_role',
    'private.account_daily_sun_recipient_aliases',
    'locator_ciphertext',
    'update'
  )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'locator_nonce',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'locator_encryption_format',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'locator_key_scope',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'locator_key_version',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'locator_wrapped_key',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'authority_attempt_id',
      'update'
    )
    and has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'updated_at',
      'update'
    )
    and not has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'user_id',
      'update'
    )
    and not has_column_privilege(
      'service_role',
      'private.account_daily_sun_recipient_aliases',
      'recipient_hash',
      'update'
    ),
  'Daily Sun locator upserts must update only encrypted locator columns'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.account_v2_bootstrap(uuid,uuid,text,text,jsonb)'),
      ('public.account_v2_record_consent(uuid,text,text,text,text,uuid,jsonb)'),
      ('public.account_v2_withdraw_chart_sync(uuid,text,text,uuid,jsonb)'),
      ('public.account_v2_put_chart(uuid,uuid,uuid,bigint,uuid,jsonb,text,text,bytea,bytea,text,text,integer,bytea)'),
      ('public.account_v2_delete_chart(uuid,uuid,uuid,bigint,uuid,jsonb)'),
      ('public.account_v2_pull(uuid,uuid,bigint,integer)'),
      ('public.account_v2_get_chart(uuid,uuid,uuid)'),
      ('public.account_v2_export(uuid)'),
      ('public.account_v2_export_legacy_invites(uuid)'),
      ('public.account_v2_list_daily_sun_aliases(uuid)'),
      ('public.account_v2_prepare_deletion(uuid,uuid,jsonb,jsonb,boolean)'),
      ('public.account_v2_terminal_cleanup(uuid,jsonb,jsonb,boolean)'),
      ('public.account_v2_list_deletion_provider_cleanup(uuid,jsonb)'),
      ('public.account_v2_record_deletion_provider_cleanup(uuid,jsonb,text,uuid,boolean)'),
      ('public.account_v2_deletion_status(uuid,jsonb)'),
      ('public.account_v2_finish_deletion(uuid,jsonb)'),
      ('public.account_v2_cleanup_deletion_receipts(integer)')
      ,('public.account_v2_begin_daily_sun_provider_mutation(text,uuid,uuid)')
      ,('public.account_v2_finish_daily_sun_provider_mutation(text,uuid,uuid)')
    ) as rpc(signature)
    where has_function_privilege('anon', rpc.signature, 'execute')
       or has_function_privilege('authenticated', rpc.signature, 'execute')
       or not has_function_privilege('service_role', rpc.signature, 'execute')
       or (select prosecdef from pg_catalog.pg_proc where oid = rpc.signature::regprocedure)
  ),
  'public account v2 RPCs must be service-only SECURITY INVOKER functions'
);

select pg_temp.assert_true(
  to_regprocedure('public.account_v2_bootstrap(uuid,uuid,text,text)') is null
    and to_regprocedure(
      'public.account_v2_prepare_deletion(uuid,uuid,jsonb)'
    ) is null
    and to_regprocedure(
      'public.account_v2_prepare_deletion(uuid,uuid,jsonb,text)'
    ) is null
    and to_regprocedure(
      'public.account_v2_record_deletion_provider_cleanup(uuid,jsonb,text,boolean)'
    ) is null,
  'obsolete bootstrap/deletion overloads must not remain callable'
);

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.account_v2_legacy_sync_allowed()',
    'execute'
  )
    and not has_function_privilege(
      'anon',
      'public.account_v2_legacy_sync_allowed()',
      'execute'
    )
    and (
      select prosecdef
      from pg_catalog.pg_proc
      where oid = 'public.account_v2_legacy_sync_allowed()'::regprocedure
    ),
  'legacy write cutover must use one authenticated-only SECURITY DEFINER boolean'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('private.account_v2_destroy_legacy_invites(uuid,uuid)'),
      ('private.account_v2_destroy_legacy_account(uuid,uuid)'),
      ('private.account_v2_destroy_consent_events(uuid,uuid)'),
      ('private.account_v2_deletion_auth_user_exists(uuid)')
    ) as helper(signature)
    where has_function_privilege('anon', helper.signature, 'execute')
       or has_function_privilege('authenticated', helper.signature, 'execute')
       or not has_function_privilege('service_role', helper.signature, 'execute')
       or not (
         select prosecdef
         from pg_catalog.pg_proc
         where oid = helper.signature::regprocedure
       )
  ),
  'terminal privileged helpers must be service-only SECURITY DEFINER functions'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.proname like 'account\_v2\_%' escape '\'
      and pg_proc.prosecdef
      and not (
        'search_path=""' = any(
          coalesce(pg_proc.proconfig, array[]::text[])
        )
      )
  ),
  'every account v2 SECURITY DEFINER helper must use an empty search_path'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name in ('account_sync_changes', 'account_sync_tombstones', 'account_sync_mutations')
      and (
        column_name like '%birth%'
        or column_name like '%email%'
        or column_name like '%place%'
        or column_name like '%latitude%'
        or column_name like '%longitude%'
        or column_name like '%timezone%'
        or column_name like '%label%'
        or column_name like '%position%'
      )
  ),
  'sync authority must stay payload-free'
);

insert into auth.users (id) values
  ('51000000-0000-4000-8000-000000000001'),
  ('51000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000003'),
  ('51000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Existing v1 rows are seeded as the table owner (the same privilege the
-- service role has). Authenticated insert and update on public.charts are
-- paused; select and delete, and chart_deletions writes, stay available
-- until bootstrap.
insert into public.charts (id, user_id, payload) values (
  '54000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  '{"label":"legacy private payload","birthDate":"1990-01-01"}'::jsonb
);

select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-4000-8000-000000000001',
  false
);
set role authenticated;

insert into public.chart_deletions (user_id, id) values (
  '51000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000099'
);

do $block$
declare
  write_blocked boolean := false;
begin
  begin
    insert into public.charts (id, user_id, payload) values (
      '54000000-0000-4000-8000-000000000198',
      '51000000-0000-4000-8000-000000000001',
      '{"fixture":"must not write"}'::jsonb
    );
  exception when insufficient_privilege then
    write_blocked := true;
  end;
  if not write_blocked then
    raise exception 'assertion failed: pre-bootstrap authenticated chart inserts must be refused';
  end if;
end;
$block$;

with changed as (
  update public.charts
  set payload = '{"fixture":"must not update"}'::jsonb
  where id = '54000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from changed),
  'pre-bootstrap authenticated chart updates must change no rows'
);

reset role;

-- Consent cannot create state for an account that never entered the canary.
set role service_role;
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '51000000-0000-4000-8000-000000000002',
    'chart_sync',
    'withdraw',
    null,
    'web',
    '53000000-0000-4000-8000-000000000020',
    pg_temp.request_hmac('2')
  ) = '{"outcome":"not_bootstrapped"}'::jsonb
    and not exists (
      select 1 from private.account_states
      where user_id = '51000000-0000-4000-8000-000000000002'
    ),
  'non-bootstrapped consent withdrawal must be a zero-write outcome'
);

-- Since 20261111170000 bootstrap no longer reads public.charts; the v1 row
-- is removed here by its owner only so the later legacy assertions keep
-- their original fixture. account_sync_v2_chart_emails.sql covers bootstrap
-- with a v1 row still present.
reset role;
set role authenticated;
delete from public.charts
where id = '54000000-0000-4000-8000-000000000001';
reset role;
set role service_role;

select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    'web',
    repeat('d', 64),
    pg_temp.envelope('d')
  ) @> '{"outcome":"ready","chart_sync_consent":"pending","cursor":0}'::jsonb,
  'bootstrap must bind the opaque Daily Sun HMAC and default to pending consent'
);

-- The successful bootstrap is the atomic per-user end of browser v1 writes.
reset role;
set role authenticated;
select pg_temp.assert_true(
  pg_temp.legacy_inserts_blocked(
    '51000000-0000-4000-8000-000000000001'
  ),
  'post-bootstrap legacy chart and tombstone inserts must be denied'
);

with changed as (
  update public.charts
  set payload = '{"must":"not update"}'::jsonb
  where id = '54000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from changed),
  'post-bootstrap legacy chart updates must return no rows'
);

with removed as (
  delete from public.charts
  where id = '54000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from removed),
  'post-bootstrap legacy chart deletes must return no rows'
);

with changed as (
  update public.chart_deletions
  set deleted_at = clock_timestamp()
  where user_id = '51000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from changed),
  'post-bootstrap legacy tombstone updates must return no rows'
);

with removed as (
  delete from public.chart_deletions
  where user_id = '51000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from removed),
  'post-bootstrap legacy tombstone deletes must return no rows'
);
reset role;
set role service_role;

select pg_temp.assert_true(
  public.account_v2_record_consent(
    '51000000-0000-4000-8000-000000000001',
    'chart_sync',
    'grant',
    'stale-policy',
    'web',
    '53000000-0000-4000-8000-000000000021',
    pg_temp.request_hmac('3')
  ) = '{"outcome":"policy_version_required"}'::jsonb,
  'fresh consent grants must be pinned to the database current policy version'
);

select pg_temp.assert_true(
  public.account_v2_record_consent(
    '51000000-0000-4000-8000-000000000001',
    'chart_sync',
    'grant',
    'chart-sync-2026-08-12.v1',
    'web',
    '53000000-0000-4000-8000-000000000001',
    pg_temp.request_hmac('1')
  ) ?& array['outcome', 'purpose', 'event_id']
    and (
      select count(*)
      from jsonb_object_keys(public.account_v2_record_consent(
        '51000000-0000-4000-8000-000000000001',
        'chart_sync',
        'grant',
        'chart-sync-2026-08-12.v1',
        'web',
        '53000000-0000-4000-8000-000000000001',
        pg_temp.request_hmac('1')
      ))
    ) = 3,
  'consent success must match the API exact outcome/purpose/event_id shape'
);

select pg_temp.assert_true(
  not exists (
    select 1 from private.account_chart_records
    where user_id = '51000000-0000-4000-8000-000000000001'
  ),
  'bootstrap and consent must never copy a legacy v1 chart'
);

create temporary table account_v2_results (
  key text primary key,
  value jsonb not null
);

select pg_temp.assert_true(
  public.account_v2_put_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000002',
      0,
      '53000000-0000-4000-8000-000000000010',
      pg_temp.request_hmac('a'),
    'other',
    'self_declared_v1',
    decode(repeat('10', 68), 'hex'),
    decode(repeat('11', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('12', 68), 'hex')
  )->>'outcome' = 'invalid'
    and public.account_v2_put_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000002',
      0,
      '53000000-0000-4000-8000-000000000011',
      pg_temp.request_hmac('b'),
      'self',
      'unspecified',
      decode(repeat('13', 68), 'hex'),
      decode(repeat('14', 12), 'hex'),
      'opaque_v1',
      'service',
      1,
      decode(repeat('15', 68), 'hex')
    )->>'outcome' = 'invalid'
    and public.account_v2_put_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000002',
      0,
      '53000000-0000-4000-8000-000000000012',
      pg_temp.request_hmac('c'),
      'self',
      'self_declared_v1',
      decode(repeat('16', 68), 'hex'),
      decode(repeat('17', 12), 'hex'),
      'opaque_v1',
      'user',
      1,
      null
    )->>'outcome' = 'invalid',
  'the DB must reject non-self, missing attestation, user keys, and missing wrapped keys'
);

insert into account_v2_results values (
  'saved',
  public.account_v2_put_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    0,
    '53000000-0000-4000-8000-000000000002',
    pg_temp.request_hmac('4'),
    'self',
    'self_declared_v1',
    decode(repeat('aa', 68), 'hex'),
    decode(repeat('bb', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('cc', 68), 'hex')
  )
);

select pg_temp.assert_true(
  exists (
    select 1
    from private.account_sync_mutations
    where user_id = '51000000-0000-4000-8000-000000000001'
      and mutation_id = '53000000-0000-4000-8000-000000000002'
      and request_fingerprint_verifier = 'v1:' || repeat('4', 64)
      and request_fingerprint_verifier <> repeat('4', 64)
  )
    and public.account_v2_delete_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      1,
      '53000000-0000-4000-8000-000000000030',
      jsonb_build_array(repeat('f', 64))
    ) = '{"outcome":"invalid"}'::jsonb,
  'Postgres must persist only versioned server-HMAC verifiers, never raw semantic hashes'
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"saved","revision":1}'::jsonb
   from account_v2_results where key = 'saved')
    and public.account_v2_put_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      0,
      '53000000-0000-4000-8000-000000000002',
      jsonb_build_array(
        'v2:' || repeat('e', 64),
        'v1:' || repeat('4', 64)
      ),
      'self',
      'self_declared_v1',
      decode(repeat('dd', 68), 'hex'),
      decode(repeat('ee', 12), 'hex'),
      'opaque_v1',
      'service',
      1,
      decode(repeat('ff', 68), 'hex')
    ) = (select value from account_v2_results where key = 'saved')
    and public.account_v2_put_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      0,
      '53000000-0000-4000-8000-000000000002',
      pg_temp.request_hmac('5'),
      'self',
      'self_declared_v1',
      decode(repeat('aa', 68), 'hex'),
      decode(repeat('bb', 12), 'hex'),
      'opaque_v1',
      'service',
      1,
      decode(repeat('cc', 68), 'hex')
    ) = '{"outcome":"mutation_conflict"}'::jsonb,
  'same-fingerprint replay may vary randomized envelope bytes, but semantic UUID reuse must conflict'
);

select pg_temp.assert_true(
  public.account_v2_delete_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    1,
    '53000000-0000-4000-8000-000000000002',
    pg_temp.request_hmac('4')
  ) = '{"outcome":"mutation_conflict"}'::jsonb,
  'a PUT mutation UUID cannot be reused for DELETE'
);

select pg_temp.assert_true(
  public.account_v2_put_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000002',
    0,
    '53000000-0000-4000-8000-000000000013',
    pg_temp.request_hmac('6'),
    'self',
    'self_declared_v1',
    decode(repeat('20', 68), 'hex'),
    decode(repeat('21', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('22', 68), 'hex')
  ) = '{"outcome":"chart_limit_reached","limit":1}'::jsonb,
  'the first canary must allow exactly one active self chart'
);

select pg_temp.assert_true(
  public.account_v2_get_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001'
  ) @> '{"outcome":"ready","revision":1,"subject_kind":"self","subject_attestation":"self_declared_v1","encrypted_source":{"format":"opaque_v1","key_scope":"service","key_version":1}}'::jsonb
    and not (
      public.account_v2_get_chart(
        '51000000-0000-4000-8000-000000000001',
        '52000000-0000-4000-8000-000000000001',
        '54000000-0000-4000-8000-000000000001'
      )::text ~ 'label|positions|sun_sign|birth'
    ),
  'chart reads must return one full service envelope and no plaintext projection'
);

insert into account_v2_results values (
  'deleted',
  public.account_v2_delete_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    1,
    '53000000-0000-4000-8000-000000000004',
    pg_temp.request_hmac('7')
  )
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"deleted","revision":2}'::jsonb
   from account_v2_results where key = 'deleted')
    and not exists (
      select 1 from private.account_chart_records
      where user_id = '51000000-0000-4000-8000-000000000001'
    )
    and not exists (
      select 1 from private.account_chart_secret_envelopes
      where user_id = '51000000-0000-4000-8000-000000000001'
    ),
  'chart deletion must destroy the full envelope and retain only tombstone authority'
);

select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000002',
    'ios',
    repeat('d', 64),
    pg_temp.envelope('d')
  )->>'cursor' = '0'
    and public.account_v2_pull(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000002',
      0,
      100
    ) @> '{"outcome":"ready"}'::jsonb
    and public.account_v2_get_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000002',
      '54000000-0000-4000-8000-000000000001'
    ) = '{"outcome":"not_found"}'::jsonb,
  'a new device must start at zero and reconcile create then delete to not-found'
);

select pg_temp.assert_true(
  public.account_v2_put_chart(
    '51000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    1,
    '53000000-0000-4000-8000-000000000005',
    pg_temp.request_hmac('8'),
    'self',
    'self_declared_v1',
    decode(repeat('23', 68), 'hex'),
    decode(repeat('24', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('25', 68), 'hex')
  ) @> '{"outcome":"conflict","current_revision":2,"deleted":true}'::jsonb
    and public.account_v2_put_chart(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      2,
      '53000000-0000-4000-8000-000000000006',
      pg_temp.request_hmac('9'),
      'self',
      'self_declared_v1',
      decode(repeat('26', 68), 'hex'),
      decode(repeat('27', 12), 'hex'),
      'opaque_v1',
      'service',
      1,
      decode(repeat('28', 68), 'hex')
    ) @> '{"outcome":"saved","revision":3}'::jsonb,
  'a tombstone defeats stale resurrection and an acknowledged restore succeeds'
);

insert into account_v2_results values (
  'withdrawn',
  public.account_v2_withdraw_chart_sync(
    '51000000-0000-4000-8000-000000000001',
    null,
    'web',
    '53000000-0000-4000-8000-000000000007',
    pg_temp.request_hmac('a')
  )
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"withdrawn","purpose":"chart_sync"}'::jsonb
     and (select count(*) from jsonb_object_keys(value)) = 3
   from account_v2_results where key = 'withdrawn')
    and not exists (
      select 1 from private.account_chart_records
      where user_id = '51000000-0000-4000-8000-000000000001'
    )
    and not exists (
      select 1 from private.account_chart_secret_envelopes
      where user_id = '51000000-0000-4000-8000-000000000001'
    ),
  'withdrawal must ignore a stale/null client policy and atomically erase the envelope'
);

select pg_temp.assert_true(
  public.account_v2_withdraw_chart_sync(
    '51000000-0000-4000-8000-000000000001',
    'obsolete-client-policy',
    'web',
    '53000000-0000-4000-8000-000000000070',
    pg_temp.request_hmac('0')
  ) = (select value from account_v2_results where key = 'withdrawn')
    and (
      select count(*) = 1
      from private.account_consent_events
      where user_id = '51000000-0000-4000-8000-000000000001'
        and purpose = 'chart_sync'
        and decision = 'withdraw'
    )
    and (
      select count(*) = 1
      from private.account_sync_changes
      where user_id = '51000000-0000-4000-8000-000000000001'
        and entity_type = 'consent'
        and operation = 'withdraw'
    )
    and not exists (
      select 1
      from private.account_sync_mutations
      where user_id = '51000000-0000-4000-8000-000000000001'
        and mutation_id = '53000000-0000-4000-8000-000000000070'
    ),
  'repeated withdrawal with a fresh UUID must be a bounded no-op'
);

select pg_temp.assert_true(
  public.account_v2_export('51000000-0000-4000-8000-000000000001')
    @> '{"outcome":"ready","schema":"zodiacs.account-sync-v2.export.v1","daily_sun_aliases":[{"recipient_hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","encrypted_locator":{"format":"opaque_v1","key_scope":"service","key_version":1}}]}'::jsonb
    and (public.account_v2_export(
      '51000000-0000-4000-8000-000000000001'
    )->'daily_sun_aliases'->0) ?& array['bound_at', 'updated_at']
    and not (
      public.account_v2_export('51000000-0000-4000-8000-000000000001')::text
      ~ 'idempotency_key|mutation_id|request_fingerprint|token_hash|label|positions|sun_sign|birth|@'
    ),
  'portable export must include opaque alias history but no recovery/provider/plaintext data'
);

-- Pull pagination must not skip the second page when one account exceeds 100
-- committed payload-free changes.
select public.account_v2_bootstrap(
  '51000000-0000-4000-8000-000000000003',
  '52000000-0000-4000-8000-000000000003',
  'web',
  repeat('c', 64),
  pg_temp.envelope('c')
);

insert into private.account_sync_changes (
  user_id, entity_type, entity_id, operation, revision, mutation_id
)
select
  '51000000-0000-4000-8000-000000000003',
  'consent',
  null,
  'grant',
  sequence_number,
  gen_random_uuid()
from generate_series(1, 150) as generated(sequence_number);

insert into account_v2_results values (
  'page_one',
  public.account_v2_pull(
    '51000000-0000-4000-8000-000000000003',
    '52000000-0000-4000-8000-000000000003',
    0,
    100
  )
);

insert into account_v2_results values (
  'page_two',
  public.account_v2_pull(
    '51000000-0000-4000-8000-000000000003',
    '52000000-0000-4000-8000-000000000003',
    (select (value->>'next_cursor')::bigint from account_v2_results where key = 'page_one'),
    100
  )
);

select pg_temp.assert_true(
  (select jsonb_array_length(value->'changes') = 100 and (value->>'has_more')::boolean
   from account_v2_results where key = 'page_one')
    and (select jsonb_array_length(value->'changes') = 50 and not (value->>'has_more')::boolean
         from account_v2_results where key = 'page_two')
    and (select (value->>'next_cursor')::bigint from account_v2_results where key = 'page_two')
      > (select (value->>'next_cursor')::bigint from account_v2_results where key = 'page_one'),
  'cursor pagination must return 100 then 50 committed changes without skipping'
);

-- A stable total-device bound keeps the exact portable export representable.
insert into private.account_sync_devices (user_id, device_id, platform)
select
  '51000000-0000-4000-8000-000000000003',
  gen_random_uuid(),
  'unknown'
from generate_series(1, 99);

select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '51000000-0000-4000-8000-000000000003',
    '52000000-0000-4000-8000-000000000003',
    'web',
    repeat('c', 64),
    pg_temp.envelope('c')
  )->>'outcome' = 'ready'
    and public.account_v2_bootstrap(
      '51000000-0000-4000-8000-000000000003',
      '52000000-0000-4000-8000-000000000099',
      'ios',
      repeat('c', 64),
      pg_temp.envelope('c')
    ) = '{"outcome":"device_limit_reached"}'::jsonb
    and jsonb_array_length(
      public.account_v2_export(
        '51000000-0000-4000-8000-000000000003'
      )->'devices'
    ) = 100,
  'bootstrap must keep existing devices idempotent and reject device 101'
);

-- Seed every legacy account-owned table that must be empty even if the later
-- Auth admin deletion fails.
reset role;

insert into public.charts (id, user_id, payload) values (
  '54000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  '{"label":"terminal legacy payload","birthDate":"1990-01-01"}'::jsonb
);

insert into account_v2_results values (
  'legacy_invite',
  public.create_compatibility_invite(
    '51000000-0000-4000-8000-000000000001',
    'Delete me',
    'aries',
    pg_temp.positions_wire(),
    true,
    false,
    repeat('9', 64)
  )
);

insert into public.profiles (user_id, digest_opt_in)
values ('51000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set digest_opt_in = true;

insert into public.daily_chart_preferences (
  user_id,
  chart_id,
  recipient_hash,
  confirmation_token_hash,
  timezone
) values (
  '51000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  repeat('f', 64),
  repeat('b', 64),
  'UTC'
);

insert into public.daily_chart_confirmation_send_claims (user_id, claim_token)
values (
  '51000000-0000-4000-8000-000000000001',
  '55000000-0000-4000-8000-000000000010'
);

insert into public.daily_sun_preferences (
  recipient_hash, sign, confirmed_by_attempt_id
) values
  (repeat('d', 64), 'aries', '55000000-0000-4000-8000-000000000001'),
  (repeat('e', 64), 'taurus', '55000000-0000-4000-8000-000000000002');

insert into public.daily_sun_confirmation_requests (
  recipient_hash,
  requested_sign,
  confirmation_token_hash,
  request_kind,
  expires_at
) values (
  repeat('d', 64),
  'gemini',
  repeat('a', 64),
  'sign_change',
  clock_timestamp() + interval '24 hours'
);

insert into public.daily_sun_confirmation_rate_limits (
  recipient_hash, next_allowed_at
) values (repeat('d', 64), clock_timestamp() + interval '15 minutes');

set role service_role;

insert into account_v2_results values (
  'prepared',
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b'),
    pg_temp.provider_entries(repeat('d', 64), 'd'),
    true
  )
);

reset role;

select pg_temp.assert_true(
  (select value @> '{"outcome":"prepared","request_id":"53000000-0000-4000-8000-000000000008","daily_sun_revoked":false,"daily_sun_reconciliation_required":true}'::jsonb
   from account_v2_results where key = 'prepared')
    and not exists (select 1 from public.profiles where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.charts where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.chart_deletions where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.daily_chart_preferences where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.daily_chart_confirmation_send_claims where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.compatibility_invites where owner_user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.daily_sun_preferences where recipient_hash = repeat('d', 64))
    and not exists (select 1 from public.daily_sun_confirmation_requests where recipient_hash = repeat('d', 64))
    and not exists (select 1 from public.daily_sun_confirmation_rate_limits where recipient_hash = repeat('d', 64))
    and exists (select 1 from public.daily_sun_preferences where recipient_hash = repeat('e', 64))
    and not exists (select 1 from private.account_consents where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from private.account_consent_events where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from private.account_sync_devices where user_id = '51000000-0000-4000-8000-000000000001')
    and not exists (select 1 from private.account_sync_mutations where user_id = '51000000-0000-4000-8000-000000000001')
    and exists (
      select 1
      from private.account_deletion_provider_cleanup
      where request_id = '53000000-0000-4000-8000-000000000008'
        and recipient_hash = repeat('d', 64)
        and state = 'pending'
        and octet_length(payload_ciphertext) between 17 and 528
        and octet_length(payload_nonce) = 12
        and octet_length(payload_wrapped_key) = 68
    )
    and exists (select 1 from auth.users where id = '51000000-0000-4000-8000-000000000001'),
  'prepare must erase account data and stage opaque provider work before Auth deletion'
);

set role service_role;

select pg_temp.assert_true(
  pg_temp.terminal_recreation_blocked(
    '51000000-0000-4000-8000-000000000001'
  ),
  'terminal database guards must prevent owner-bound account recreation'
);

select pg_temp.assert_true(
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b'),
    pg_temp.provider_entries(repeat('d', 64), 'd'),
    true
  ) = (select value from account_v2_results where key = 'prepared')
    and public.account_v2_prepare_deletion(
      '51000000-0000-4000-8000-000000000001',
      '53000000-0000-4000-8000-000000000008',
      pg_temp.request_hmac('c'),
      pg_temp.provider_entries(repeat('d', 64), 'd'),
      true
    ) = '{"outcome":"mutation_conflict"}'::jsonb
    and public.account_v2_prepare_deletion(
      '51000000-0000-4000-8000-000000000001',
      '53000000-0000-4000-8000-000000000009',
      pg_temp.request_hmac('d'),
      pg_temp.provider_entries(repeat('e', 64), 'e')
        || pg_temp.provider_entries(repeat('d', 64), 'd'),
      true
    ) @> '{"outcome":"already_prepared","request_id":"53000000-0000-4000-8000-000000000009","daily_sun_reconciliation_required":true}'::jsonb,
  'deletion replay must fingerprint-match and allow recovery rotation'
);

insert into account_v2_results values (
  'third_rotation',
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000010',
    pg_temp.request_hmac('f'),
    pg_temp.provider_entries(repeat('e', 64), 'e')
      || pg_temp.provider_entries(repeat('d', 64), 'd'),
    true
  )
);
insert into account_v2_results values (
  'fourth_rotation',
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000011',
    pg_temp.request_hmac('1', 'v2'),
    pg_temp.provider_entries(repeat('e', 64), 'e'),
    true
  )
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"already_prepared","request_id":"53000000-0000-4000-8000-000000000010"}'::jsonb
   from account_v2_results where key = 'third_rotation')
    and (select value = '{"outcome":"receipt_limit_reached"}'::jsonb
         from account_v2_results where key = 'fourth_rotation')
    and (
      select count(*) = 3
      from private.account_deletion_receipts
      where user_id = '51000000-0000-4000-8000-000000000001'
        and expires_at > clock_timestamp()
    ),
  format(
    'the account lock must cap active recovery rotation at three receipts (third %s, fourth %s, count %s)',
    (select value from account_v2_results where key = 'third_rotation'),
    (select value from account_v2_results where key = 'fourth_rotation'),
    (select count(*) from private.account_deletion_receipts
     where user_id = '51000000-0000-4000-8000-000000000001')
  )
);

reset role;
select pg_temp.assert_true(
  not exists (
    select 1 from public.daily_sun_preferences
    where recipient_hash = repeat('e', 64)
  ),
  'recovery rotation must reassert best-effort email cleanup without blocking'
);
set role service_role;

insert into account_v2_results values (
  'terminal_cleanup',
  public.account_v2_terminal_cleanup(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b'),
    pg_temp.provider_entries(repeat('d', 64), 'd'),
    true
  )
);
insert into account_v2_results values (
  'provider_job_list',
  public.account_v2_list_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b')
  )
);

select pg_temp.assert_true(
  (select value = '{"outcome":"ready","user_id":"51000000-0000-4000-8000-000000000001"}'::jsonb
   from account_v2_results where key = 'terminal_cleanup')
    and (select value @> '{"outcome":"ready","has_more":false}'::jsonb
         and jsonb_array_length(value->'entries') = 1
         and (value->'entries'->0->>'claim_id')::uuid is not null
         from account_v2_results where key = 'provider_job_list'),
  'terminal cleanup must reassert erasure and expose one opaque provider job'
);

insert into account_v2_results values (
  'provider_failure',
  public.account_v2_record_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b'),
    repeat('d', 64),
    (select (value->'entries'->0->>'claim_id')::uuid
     from account_v2_results where key = 'provider_job_list'),
    false
  )
);

update private.account_deletion_provider_cleanup
set cleanup_claimed_at = created_at,
    cleanup_claim_expires_at = created_at + interval '1 millisecond'
where request_id = '53000000-0000-4000-8000-000000000008'
  and recipient_hash = repeat('d', 64);

insert into account_v2_results values (
  'provider_job_retry',
  public.account_v2_list_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b')
  )
);
insert into account_v2_results values (
  'provider_success',
  public.account_v2_record_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b'),
    repeat('d', 64),
    (select (value->'entries'->0->>'claim_id')::uuid
     from account_v2_results where key = 'provider_job_retry'),
    true
  )
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"recorded","state":"pending","daily_sun_revoked":false,"daily_sun_reconciliation_required":true}'::jsonb
   from account_v2_results where key = 'provider_failure')
    and (select value @> '{"outcome":"recorded","state":"completed","daily_sun_revoked":true,"daily_sun_reconciliation_required":false}'::jsonb
         from account_v2_results where key = 'provider_success'),
  'provider failure must stay retryable and success must refresh durable receipt truth'
);

select pg_temp.assert_true(
  public.account_v2_deletion_status(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b')
  ) @> '{"outcome":"ready","state":"prepared","user_id":"51000000-0000-4000-8000-000000000001","daily_sun_revoked":true,"daily_sun_reconciliation_required":false}'::jsonb
    and public.account_v2_deletion_status(
      '53000000-0000-4000-8000-000000000009',
      pg_temp.request_hmac('d')
  ) @> '{"outcome":"ready","state":"prepared","daily_sun_revoked":false,"daily_sun_reconciliation_required":true}'::jsonb
    and public.account_v2_deletion_status(
      '53000000-0000-4000-8000-000000000008',
      pg_temp.request_hmac('c')
    ) = '{"outcome":"recovery_mismatch"}'::jsonb,
  'a deletion receipt must require its server-HMAC recovery verifier'
);

-- Account deletion is also available to a legacy-only user. Missing Daily
-- Sun binding is reported for reconciliation but cannot block core erasure.
reset role;
select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-4000-8000-000000000002',
  false
);
-- Seed the v1-only deletion fixture as the table owner; authenticated
-- inserts into public.charts are paused.
reset role;
insert into public.charts (id, user_id, payload) values (
  '54000000-0000-4000-8000-000000000020',
  '51000000-0000-4000-8000-000000000002',
  '{"birthDate":"1988-08-08"}'::jsonb
);
set role service_role;

insert into account_v2_results values (
  'legacy_prepared',
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000002',
    '53000000-0000-4000-8000-000000000022',
    pg_temp.request_hmac('e'),
    '[]'::jsonb,
    false
  )
);

reset role;
select pg_temp.assert_true(
  (select value @> '{"outcome":"prepared","daily_sun_reconciliation_required":true}'::jsonb
   from account_v2_results where key = 'legacy_prepared')
    and not exists (
      select 1 from public.charts
      where user_id = '51000000-0000-4000-8000-000000000002'
    )
    and exists (
      select 1 from private.account_states
      where user_id = '51000000-0000-4000-8000-000000000002'
        and status = 'deleting'
    ),
  format(
    'v1-only deletion must lazily create terminal state and erase core data without an email secret (result %s, chart count %s, state %s)',
    (select value from account_v2_results where key = 'legacy_prepared'),
    (select count(*) from public.charts where user_id = '51000000-0000-4000-8000-000000000002'),
    (select status from private.account_states where user_id = '51000000-0000-4000-8000-000000000002')
  )
);

-- A historical opaque alias is bound to the consent generation observed while
-- it was current. Recycled-address authority and an in-flight provider add
-- must survive deletion of the older account generation.
insert into public.daily_sun_preferences (
  recipient_hash, sign, confirmed_by_attempt_id
) values (
  repeat('a', 64),
  'aries',
  '55000000-0000-4000-8000-000000000031'
);

set role service_role;
select public.account_v2_bootstrap(
  '51000000-0000-4000-8000-000000000004',
  '52000000-0000-4000-8000-000000000004',
  'web',
  repeat('a', 64),
  pg_temp.envelope('a')
);
select public.revoke_daily_email_preference(repeat('a', 64), 'sun_sign', null);
select public.account_v2_bootstrap(
  '51000000-0000-4000-8000-000000000004',
  '52000000-0000-4000-8000-000000000004',
  'web',
  repeat('b', 64),
  pg_temp.envelope('b')
);

insert into public.daily_sun_preferences (
  recipient_hash, sign, confirmed_by_attempt_id
) values
  (
    repeat('a', 64),
    'taurus',
    '55000000-0000-4000-8000-000000000032'
  ),
  (
    repeat('b', 64),
    'gemini',
    '55000000-0000-4000-8000-000000000033'
  );

insert into account_v2_results values (
  'provider_lease_before_deletion',
  public.account_v2_begin_daily_sun_provider_mutation(
    repeat('b', 64),
    '55000000-0000-4000-8000-000000000033',
    '55000000-0000-4000-8000-000000000034'
  )
);

insert into account_v2_results values (
  'recycled_prepare',
  public.account_v2_prepare_deletion(
    '51000000-0000-4000-8000-000000000004',
    '53000000-0000-4000-8000-000000000044',
    pg_temp.request_hmac('7'),
    pg_temp.provider_entries(repeat('b', 64), 'b')
      || pg_temp.provider_entries(repeat('a', 64), 'a'),
    true
  )
);

select pg_temp.assert_true(
  (select value @> '{"outcome":"prepared"}'::jsonb
   from account_v2_results where key = 'recycled_prepare')
    and exists (
      select 1 from public.daily_sun_preferences
      where recipient_hash = repeat('a', 64)
        and confirmed_by_attempt_id = '55000000-0000-4000-8000-000000000032'
    )
    and exists (
      select 1 from private.account_deletion_provider_cleanup
      where request_id = '53000000-0000-4000-8000-000000000044'
        and recipient_hash = repeat('a', 64)
        and authority_attempt_id = '55000000-0000-4000-8000-000000000031'
        and state = 'superseded'
    )
    and (select value = '{"outcome":"ready"}'::jsonb
         from account_v2_results where key = 'provider_lease_before_deletion'),
  'historical aliases must not revoke a later generation while an in-flight current provider add is durably fenced'
);

insert into account_v2_results values (
  'provider_list_during_add',
  public.account_v2_list_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000044',
    pg_temp.request_hmac('7')
  )
);

insert into account_v2_results values (
  'provider_lease_finish',
  public.account_v2_finish_daily_sun_provider_mutation(
    repeat('b', 64),
    '55000000-0000-4000-8000-000000000033',
    '55000000-0000-4000-8000-000000000034'
  )
);

-- Starting a fresh DOI is not committed consent. It may remain available to
-- its recipient, but it must not let an unauthenticated requester suppress
-- removal of the deleted owner's already-revoked provider subscription.
insert into public.daily_sun_confirmation_requests (
  recipient_hash,
  requested_sign,
  confirmation_token_hash,
  request_kind,
  expires_at
) values (
  repeat('b', 64),
  'cancer',
  repeat('7', 64),
  'subscribe',
  clock_timestamp() + interval '24 hours'
);
insert into public.daily_sun_confirmation_rate_limits (
  recipient_hash,
  next_allowed_at
) values (
  repeat('b', 64),
  clock_timestamp() + interval '15 minutes'
);

insert into account_v2_results values (
  'provider_job_after_add',
  public.account_v2_list_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000044',
    pg_temp.request_hmac('7')
  )
);

select pg_temp.assert_true(
  (select jsonb_array_length(value->'entries') = 0 and value->>'has_more' = 'true'
   from account_v2_results where key = 'provider_list_during_add')
    and (select value = '{"outcome":"released"}'::jsonb
         from account_v2_results where key = 'provider_lease_finish')
    and (select jsonb_array_length(value->'entries') = 1
         and (value->'entries'->0->>'claim_id')::uuid is not null
         from account_v2_results where key = 'provider_job_after_add')
    and exists (
      select 1 from public.daily_sun_confirmation_requests
      where recipient_hash = repeat('b', 64)
    )
    and exists (
      select 1 from public.daily_sun_confirmation_rate_limits
      where recipient_hash = repeat('b', 64)
    ),
  'provider cleanup must wait for the add lease but ignore non-authoritative opt-in state'
);

insert into public.daily_sun_preferences (
  recipient_hash, sign, confirmed_by_attempt_id
) values (
  repeat('b', 64),
  'cancer',
  '55000000-0000-4000-8000-000000000035'
);

insert into account_v2_results values (
  'provider_add_blocked_by_cleanup',
  public.account_v2_begin_daily_sun_provider_mutation(
    repeat('b', 64),
    '55000000-0000-4000-8000-000000000035',
    '55000000-0000-4000-8000-000000000036'
  )
);
insert into account_v2_results values (
  'provider_cleanup_superseded',
  public.account_v2_record_deletion_provider_cleanup(
    '53000000-0000-4000-8000-000000000044',
    pg_temp.request_hmac('7'),
    repeat('b', 64),
    (select (value->'entries'->0->>'claim_id')::uuid
     from account_v2_results where key = 'provider_job_after_add'),
    true
  )
);
insert into account_v2_results values (
  'provider_add_after_cleanup',
  public.account_v2_begin_daily_sun_provider_mutation(
    repeat('b', 64),
    '55000000-0000-4000-8000-000000000035',
    '55000000-0000-4000-8000-000000000036'
  )
);

select pg_temp.assert_true(
  (select value = '{"outcome":"busy"}'::jsonb
   from account_v2_results where key = 'provider_add_blocked_by_cleanup')
    and (select value @> '{"outcome":"recorded","state":"superseded","daily_sun_revoked":false,"daily_sun_reconciliation_required":false}'::jsonb
         from account_v2_results where key = 'provider_cleanup_superseded')
    and (select value = '{"outcome":"ready"}'::jsonb
         from account_v2_results where key = 'provider_add_after_cleanup')
    and exists (
      select 1 from public.daily_sun_preferences
      where recipient_hash = repeat('b', 64)
        and confirmed_by_attempt_id = '55000000-0000-4000-8000-000000000035'
    ),
  'cleanup claims must fence a later add until provider removal is acknowledged and superseded'
);

select public.account_v2_finish_daily_sun_provider_mutation(
  repeat('b', 64),
  '55000000-0000-4000-8000-000000000035',
  '55000000-0000-4000-8000-000000000036'
);

insert into private.account_deletion_receipts (
  request_id,
  user_id,
  recovery_verifier,
  prepared_at,
  daily_sun_revoked,
  daily_sun_reconciliation_required,
  expires_at
) values (
  '53000000-0000-4000-8000-000000000055',
  '51000000-0000-4000-8000-000000000055',
  'v1:' || repeat('8', 64),
  clock_timestamp() - interval '8 days',
  false,
  true,
  clock_timestamp() - interval '1 day'
);
insert into private.account_daily_sun_provider_mutation_leases (
  recipient_hash,
  authority_attempt_id,
  lease_id,
  started_at,
  expires_at
) values (
  repeat('c', 64),
  '55000000-0000-4000-8000-000000000035',
  '55000000-0000-4000-8000-000000000036',
  clock_timestamp() - interval '9 minutes',
  clock_timestamp() - interval '4 minutes'
);

insert into account_v2_results values (
  'bounded_receipt_cleanup',
  to_jsonb(public.account_v2_cleanup_deletion_receipts(10))
);

select pg_temp.assert_true(
  (select value = '1'::jsonb
   from account_v2_results where key = 'bounded_receipt_cleanup')
    and not exists (
      select 1 from private.account_deletion_receipts
      where request_id = '53000000-0000-4000-8000-000000000055'
    )
    and not exists (
      select 1 from private.account_daily_sun_provider_mutation_leases
      where recipient_hash = repeat('c', 64)
    ),
  'the bounded maintenance RPC must prune expired receipts and orphaned provider leases'
);

reset role;
delete from auth.users
where id = '51000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  not exists (
    select 1 from private.account_states
    where user_id = '51000000-0000-4000-8000-000000000001'
  )
    and not exists (
      select 1 from private.account_consent_events
      where user_id = '51000000-0000-4000-8000-000000000001'
    )
    and not exists (
      select 1 from private.account_sync_devices
      where user_id = '51000000-0000-4000-8000-000000000001'
    ),
  'hard Auth deletion must cascade the remaining terminal lifecycle records'
);

set role service_role;
select pg_temp.assert_true(
  public.account_v2_deletion_status(
    '53000000-0000-4000-8000-000000000008',
    pg_temp.request_hmac('b')
  ) @> '{"outcome":"ready","state":"prepared","user_id":"51000000-0000-4000-8000-000000000001","daily_sun_revoked":true,"daily_sun_reconciliation_required":false}'::jsonb
    and public.account_v2_finish_deletion(
      '53000000-0000-4000-8000-000000000008',
      pg_temp.request_hmac('b')
    ) @> '{"outcome":"completed","user_id":"51000000-0000-4000-8000-000000000001","daily_sun_revoked":true,"daily_sun_reconciliation_required":false}'::jsonb
    and public.account_v2_finish_deletion(
      '53000000-0000-4000-8000-000000000008',
      pg_temp.request_hmac('b')
    ) @> '{"outcome":"completed","user_id":"51000000-0000-4000-8000-000000000001","daily_sun_revoked":true,"daily_sun_reconciliation_required":false}'::jsonb
    and public.account_v2_deletion_status(
      '53000000-0000-4000-8000-000000000008',
      pg_temp.request_hmac('b')
    ) @> '{"outcome":"ready","state":"completed"}'::jsonb,
  'the HMAC-protected receipt must survive Auth deletion and finish idempotently'
);

reset role;
