#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

saved_pages_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
saved_pages_repo_root="$(cd -- "${saved_pages_script_dir}/.." && pwd -P)"
saved_pages_database="zodiacs_saved_pages_test"
saved_pages_container_name="zodiacs-saved-pages-sql-$$-${RANDOM}-$(date -u +%s)"
saved_pages_container_id=""

cleanup_saved_pages_sql_container() {
  if [[ -n "${saved_pages_container_id}" ]]; then
    docker rm --force --volumes -- "${saved_pages_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_saved_pages_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 saved pages SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 saved pages SQL tests require a running Docker daemon." >&2
  exit 1
fi

saved_pages_container_id="$(docker run \
  --detach \
  --rm \
  --name "${saved_pages_container_name}" \
  --env POSTGRES_DB="${saved_pages_database}" \
  --env POSTGRES_PASSWORD="saved-pages-local-test-only" \
  postgres:17
)"

saved_pages_ready="false"
for saved_pages_attempt in {1..60}; do
  # The image's initialization server accepts Unix sockets before stopping.
  # Only its final server listens on TCP; wait for that same endpoint below.
  if docker exec --env PGPASSWORD=saved-pages-local-test-only "${saved_pages_container_id}" \
    psql \
      --no-psqlrc \
      --no-password \
      --host 127.0.0.1 \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${saved_pages_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    saved_pages_ready="true"
    break
  fi
  sleep 1
done

if [[ "${saved_pages_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${saved_pages_container_id}" >&2 || true
  exit 1
fi

run_saved_pages_sql_file() {
  local saved_pages_sql_file="$1"
  echo "SQL test [${saved_pages_database}]: ${saved_pages_sql_file#"${saved_pages_repo_root}/"}"
  docker exec --interactive --env PGPASSWORD=saved-pages-local-test-only "${saved_pages_container_id}" \
    psql \
      --no-psqlrc \
      --no-password \
      --host 127.0.0.1 \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${saved_pages_database}" \
    < "${saved_pages_sql_file}"
}

run_saved_pages_sql_file "${saved_pages_repo_root}/supabase/tests/bootstrap.sql"

saved_pages_migrations=("${saved_pages_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${saved_pages_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

for saved_pages_migration in "${saved_pages_migrations[@]}"; do
  run_saved_pages_sql_file "${saved_pages_migration}"
done

# The migration is replay-safe: a reviewed SQL Editor retry cannot create
# duplicate tables, grants, policies or triggers.
run_saved_pages_sql_file \
  "${saved_pages_repo_root}/supabase/migrations/20261015090000_saved_pages.sql"

run_saved_pages_sql_file "${saved_pages_repo_root}/supabase/tests/saved_pages.sql"

echo "PostgreSQL 17 saved pages SQL tests passed."
