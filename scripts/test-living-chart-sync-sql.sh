#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

living_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
living_repo_root="$(cd -- "${living_script_dir}/.." && pwd -P)"
living_database="zodiacs_living_chart_sync_test"
living_container_name="zodiacs-living-chart-sync-sql-$$-${RANDOM}-$(date -u +%s)"
living_container_id=""
living_sync_migration="${living_repo_root}/supabase/migrations/20260818112526_living_chart_sync.sql"
living_sync_rls_initplan_migration="${living_repo_root}/supabase/migrations/20260819111145_living_chart_rls_initplan.sql"

cleanup_living_sql_container() {
  if [[ -n "${living_container_id}" ]]; then
    docker rm --force --volumes -- "${living_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_living_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

# PL/pgSQL FOUND changes after every SQL statement. The missing-row cap path
# must preserve the row lookup before SELECT count(*) runs, or both limits are
# silently bypassed. Keep this guard ahead of Docker so it runs everywhere.
living_cap_guard_required=(
  "moment_exists boolean;"
  "moment_exists := found;"
  "if not moment_exists and active_count >= 250 then"
  "elsif not moment_exists and total_count >= 1000 then"
)
for living_cap_pattern in "${living_cap_guard_required[@]}"; do
  if ! grep --fixed-strings --quiet -- "${living_cap_pattern}" "${living_sync_migration}"; then
    echo "Living Chart SQL cap guard missing: ${living_cap_pattern}" >&2
    exit 1
  fi
done

living_cap_guard_forbidden=(
  "if not found and active_count >= 250 then"
  "elsif not found and total_count >= 1000 then"
)
for living_cap_pattern in "${living_cap_guard_forbidden[@]}"; do
  if grep --fixed-strings --quiet -- "${living_cap_pattern}" "${living_sync_migration}"; then
    echo "Living Chart SQL cap guard uses volatile FOUND: ${living_cap_pattern}" >&2
    exit 1
  fi
done
echo "Living Chart SQL static cap guard passed."

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 Living Chart sync SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 Living Chart sync SQL tests require a running Docker daemon." >&2
  exit 1
fi

living_container_id="$(docker run \
  --detach \
  --rm \
  --name "${living_container_name}" \
  --env POSTGRES_DB="${living_database}" \
  --env POSTGRES_PASSWORD="living-chart-local-test-only" \
  postgres:17
)"

living_ready="false"
# The initialization server accepts local sockets, then stops. Only the final
# server listens on TCP; wait for it before handing migrations to psql.
for living_attempt in {1..60}; do
  if docker exec --env PGPASSWORD="living-chart-local-test-only" "${living_container_id}" \
    psql \
      --host 127.0.0.1 \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${living_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    living_ready="true"
    break
  fi
  sleep 1
done

if [[ "${living_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${living_container_id}" >&2 || true
  exit 1
fi

run_living_sql_file() {
  local living_sql_file="$1"
  echo "SQL test: ${living_sql_file#"${living_repo_root}/"}"
  docker exec --interactive "${living_container_id}" \
    psql \
      --no-psqlrc \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${living_database}" \
    < "${living_sql_file}"
}

run_living_sql_file "${living_repo_root}/supabase/tests/bootstrap.sql"

living_migrations=("${living_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${living_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

for living_migration in "${living_migrations[@]}"; do
  run_living_sql_file "${living_migration}"
done

# Seed superseded executable overloads, then prove the reviewed SQL Editor
# retry removes them while preserving the final contract.
run_living_sql_file \
  "${living_repo_root}/supabase/tests/living_chart_sync_upgrade_seed.sql"
run_living_sql_file \
  "${living_repo_root}/supabase/migrations/20260818112526_living_chart_sync.sql"
run_living_sql_file \
  "${living_sync_rls_initplan_migration}"
# The retention migration gates the Living Chart wrappers; restore it after the
# retry above so the tests below run against the production definitions.
run_living_sql_file \
  "${living_repo_root}/supabase/migrations/20261113090000_account_sync_v2_retention.sql"

run_living_sql_file \
  "${living_repo_root}/supabase/tests/living_chart_sync.sql"
run_living_sql_file \
  "${living_repo_root}/supabase/tests/living_chart_sync_concurrency.sql"

echo "PostgreSQL 17 Living Chart sync migration, privacy, and concurrency tests passed."
