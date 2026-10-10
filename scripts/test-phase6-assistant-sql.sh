#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

phase6_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
phase6_repo_root="$(cd -- "${phase6_script_dir}/.." && pwd -P)"
phase6_database="zodiacs_phase6_test"
phase6_legacy_database="zodiacs_phase6_legacy_test"
phase6_container_name="zodiacs-phase6-sql-$$-${RANDOM}-$(date -u +%s)"
phase6_container_id=""

cleanup_phase6_sql_container() {
  if [[ -n "${phase6_container_id}" ]]; then
    docker rm --force --volumes -- "${phase6_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_phase6_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 Phase 6 SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 Phase 6 SQL tests require a running Docker daemon." >&2
  exit 1
fi

phase6_container_id="$(docker run \
  --detach \
  --rm \
  --name "${phase6_container_name}" \
  --env POSTGRES_DB="${phase6_database}" \
  --env POSTGRES_PASSWORD="phase6-local-test-only" \
  postgres:17
)"

phase6_ready="false"
for phase6_attempt in {1..60}; do
  if docker exec "${phase6_container_id}" \
    psql \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${phase6_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    phase6_ready="true"
    break
  fi
  sleep 1
done

if [[ "${phase6_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${phase6_container_id}" >&2 || true
  exit 1
fi

run_phase6_sql_file() {
  local phase6_sql_file="$1"
  local phase6_target_database="${2:-${phase6_database}}"
  echo "SQL test [${phase6_target_database}]: ${phase6_sql_file#"${phase6_repo_root}/"}"
  docker exec --interactive "${phase6_container_id}" \
    psql \
      --no-psqlrc \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${phase6_target_database}" \
    < "${phase6_sql_file}"
}

run_phase6_migrations() {
  local phase6_target_database="$1"
  local phase6_migration
  for phase6_migration in "${phase6_migrations[@]}"; do
    run_phase6_sql_file "${phase6_migration}" "${phase6_target_database}"
  done
}

run_phase6_sql_file "${phase6_repo_root}/supabase/tests/bootstrap.sql"

phase6_migrations=("${phase6_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${phase6_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

run_phase6_migrations "${phase6_database}"

# The migration is replay-safe: a reviewed SQL Editor retry cannot create
# duplicate tables, grants, or definer functions.
run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260727050000_phase6_assistant_quota.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260727050000_phase6_assistant_quota.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260813102035_guide_atomic_quota_reservation.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260813102035_guide_atomic_quota_reservation.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260814062255_guide_quota_legacy_shape_repair.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260814062255_guide_quota_legacy_shape_repair.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/phase6_assistant_quota.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota_concurrency.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/zodiacs_mcp_quota.sql"

# The hosted MCP's anonymous daily usage counters, beside its quota. A reviewed
# SQL Editor replay of the migration must be harmless before the test runs.
run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20261008074758_zodiacs_mcp_usage_counts.sql"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/zodiacs_mcp_usage.sql"

# Exercise the exact early-production table shape in a second database. The
# same migration sequence must rename its legacy columns without replacing
# rows or constraints, survive reviewed SQL Editor replays, restore both
# rollback RPCs, and retain Guide's distributed locking behavior.
docker exec "${phase6_container_id}" \
  createdb \
    --username postgres \
    --owner postgres \
    "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/bootstrap.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota_legacy_shape_fixture.sql" \
  "${phase6_legacy_database}"

run_phase6_migrations "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260727050000_phase6_assistant_quota.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260727050000_phase6_assistant_quota.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260813102035_guide_atomic_quota_reservation.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260813102035_guide_atomic_quota_reservation.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260814062255_guide_quota_legacy_shape_repair.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/migrations/20260814062255_guide_quota_legacy_shape_repair.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota_legacy_shape.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/phase6_assistant_quota.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota.sql" \
  "${phase6_legacy_database}"

run_phase6_sql_file \
  "${phase6_repo_root}/supabase/tests/guide_quota_concurrency.sql" \
  "${phase6_legacy_database}"

echo "PostgreSQL 17 Phase 6 assistant-quota SQL tests passed."
