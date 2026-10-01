#!/usr/bin/env bash
set -Eeuo pipefail

export LC_ALL=C

feeds_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
feeds_repo_root="$(cd -- "${feeds_script_dir}/.." && pwd -P)"
feeds_database="zodiacs_calendar_feeds_test"
feeds_container_name="zodiacs-calendar-feeds-sql-$$-${RANDOM}-$(date -u +%s)"
feeds_container_id=""

cleanup_feeds_sql_container() {
  if [[ -n "${feeds_container_id}" ]]; then
    docker rm --force --volumes -- "${feeds_container_id}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_feeds_sql_container EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL 17 calendar feed SQL tests require Docker." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "PostgreSQL 17 calendar feed SQL tests require a running Docker daemon." >&2
  exit 1
fi

feeds_container_id="$(docker run \
  --detach \
  --rm \
  --name "${feeds_container_name}" \
  --env POSTGRES_DB="${feeds_database}" \
  --env POSTGRES_PASSWORD="calendar-feeds-local-test-only" \
  postgres:17
)"

feeds_ready="false"
for feeds_attempt in {1..60}; do
  if docker exec "${feeds_container_id}" \
    psql \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --username postgres \
      --dbname "${feeds_database}" \
      --command 'select 1' \
      >/dev/null 2>&1
  then
    feeds_ready="true"
    break
  fi
  sleep 1
done

if [[ "${feeds_ready}" != "true" ]]; then
  echo "PostgreSQL 17 did not become ready within 60 seconds." >&2
  docker logs "${feeds_container_id}" >&2 || true
  exit 1
fi

run_feeds_sql_file() {
  local feeds_sql_file="$1"
  echo "SQL test: ${feeds_sql_file#"${feeds_repo_root}/"}"
  docker exec --interactive "${feeds_container_id}" \
    psql \
      --no-psqlrc \
      --set ON_ERROR_STOP=1 \
      --username postgres \
      --dbname "${feeds_database}" \
    < "${feeds_sql_file}"
}

run_feeds_sql_file "${feeds_repo_root}/supabase/tests/bootstrap.sql"

feeds_migrations=("${feeds_repo_root}"/supabase/migrations/*.sql)
if [[ ! -e "${feeds_migrations[0]}" ]]; then
  echo "No Supabase migrations found." >&2
  exit 1
fi

for feeds_migration in "${feeds_migrations[@]}"; do
  run_feeds_sql_file "${feeds_migration}"
done

# The migration is intentionally replay-safe so a reviewed SQL Editor retry
# cannot create a duplicate table, index, function, or grant.
run_feeds_sql_file \
  "${feeds_repo_root}/supabase/migrations/20260929180000_calendar_feeds.sql"

# Its own session, so the feed functions first run with the decoys in place.
run_feeds_sql_file \
  "${feeds_repo_root}/supabase/tests/calendar_feeds_search_path.sql"
run_feeds_sql_file \
  "${feeds_repo_root}/supabase/tests/calendar_feeds.sql"
run_feeds_sql_file \
  "${feeds_repo_root}/supabase/tests/calendar_feeds_concurrency.sql"

echo "PostgreSQL 17 calendar feed SQL tests passed."
