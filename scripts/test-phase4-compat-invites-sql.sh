#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

phase4_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
phase4_repo_root="$(cd -- "${phase4_script_dir}/.." && pwd -P)"
phase4_database="zodiacs_phase4_test"
phase4_container_name="zodiacs-phase4-sql-$$-${RANDOM}-$(date -u +%s)"
phase4_container_id=""

cleanup_phase4_sql_container() {
  if [[ -n "${phase4_container_id}" ]]; then
    docker rm --force --volumes -- "${phase4_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_phase4_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 Phase 4 SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 Phase 4 SQL tests require a running Docker daemon." >&2
  exit 1
fi

phase4_container_id="$(docker run \
  --detach \
  --rm \
  --name "${phase4_container_name}" \
  --env POSTGRES_DB="${phase4_database}" \
  --env POSTGRES_PASSWORD="phase4-local-test-only" \
  postgres:17
)"

phase4_ready="false"
for phase4_attempt in {1..60}; do
  if docker exec "${phase4_container_id}" \
    psql \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${phase4_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    phase4_ready="true"
    break
  fi
  sleep 1
done

if [[ "${phase4_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${phase4_container_id}" >&2 || true
  exit 1
fi

run_phase4_sql_file() {
  local phase4_sql_file="$1"
  echo "SQL test: ${phase4_sql_file#"${phase4_repo_root}/"}"
  docker exec --interactive "${phase4_container_id}" \
    psql \
      --no-psqlrc \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${phase4_database}" \
    < "${phase4_sql_file}"
}

run_phase4_sql_file "${phase4_repo_root}/supabase/tests/bootstrap.sql"

phase4_migrations=("${phase4_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${phase4_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

for phase4_migration in "${phase4_migrations[@]}"; do
  run_phase4_sql_file "${phase4_migration}"
done

# The migration is intentionally replay-safe so a reviewed SQL Editor retry
# cannot create duplicate authority, ledgers, policies, or grants.
run_phase4_sql_file \
  "${phase4_repo_root}/supabase/migrations/20260724003109_phase4_compat_invites.sql"

run_phase4_sql_file \
  "${phase4_repo_root}/supabase/tests/phase4_compat_invites.sql"
run_phase4_sql_file \
  "${phase4_repo_root}/supabase/tests/phase4_compat_invites_concurrency.sql"
# Invite signups (INVITE_SIGNUP_ENABLED=1): hashes only, completion on a
# confirmed signup, consent for both sides; the migration is replay-safe too.
run_phase4_sql_file \
  "${phase4_repo_root}/supabase/migrations/20261109120000_compat_invite_signups.sql"
run_phase4_sql_file \
  "${phase4_repo_root}/supabase/tests/compat_invite_signups.sql"

echo "PostgreSQL 17 Phase 4 compatibility-invite SQL tests passed."
