#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

account_v2_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
account_v2_repo_root="$(cd -- "${account_v2_script_dir}/.." && pwd -P)"
account_v2_database="zodiacs_account_v2_test"
account_v2_container_name="zodiacs-account-v2-sql-$$-${RANDOM}-$(date -u +%s)"
account_v2_container_id=""

cleanup_account_v2_sql_container() {
  if [[ -n "${account_v2_container_id}" ]]; then
    docker rm --force --volumes -- "${account_v2_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_account_v2_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 account sync v2 SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 account sync v2 SQL tests require a running Docker daemon." >&2
  exit 1
fi

account_v2_container_id="$(docker run \
  --detach \
  --rm \
  --name "${account_v2_container_name}" \
  --env POSTGRES_DB="${account_v2_database}" \
  --env POSTGRES_PASSWORD="account-v2-local-test-only" \
  postgres:17
)"

account_v2_ready="false"
for account_v2_attempt in {1..60}; do
  if docker exec "${account_v2_container_id}" \
    psql \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${account_v2_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    account_v2_ready="true"
    break
  fi
  sleep 1
done

if [[ "${account_v2_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${account_v2_container_id}" >&2 || true
  exit 1
fi

run_account_v2_sql_file() {
  local account_v2_sql_file="$1"
  echo "SQL test: ${account_v2_sql_file#"${account_v2_repo_root}/"}"
  docker exec --interactive "${account_v2_container_id}" \
    psql \
      --no-psqlrc \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${account_v2_database}" \
    < "${account_v2_sql_file}"
}

run_account_v2_sql_file "${account_v2_repo_root}/supabase/tests/bootstrap.sql"

account_v2_migrations=("${account_v2_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${account_v2_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

for account_v2_migration in "${account_v2_migrations[@]}"; do
  run_account_v2_sql_file "${account_v2_migration}"
done

# The new migration must be replay-safe for a reviewed SQL Editor retry.
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/migrations/20260811153303_account_sync_v2_foundation.sql"

# The write-block migration must be replay-safe for a reviewed SQL retry.
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/migrations/20261111140000_charts_writes_paused.sql"

# The launch migration must be replay-safe for a reviewed SQL retry.
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/migrations/20261111170000_account_sync_v2_chart_emails.sql"
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/migrations/20261111180000_weekly_digest_dispatch_recheck.sql"

run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/tests/charts_writes_paused.sql"
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/tests/account_sync_v2.sql"
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/tests/account_sync_v2_concurrency.sql"
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/tests/account_sync_v2_chart_emails.sql"
run_account_v2_sql_file \
  "${account_v2_repo_root}/supabase/tests/weekly_digest_dispatch_recheck.sql"

echo "PostgreSQL 17 account sync v2 SQL tests passed."
