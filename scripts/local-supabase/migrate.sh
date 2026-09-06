#!/usr/bin/env bash
# Re-applies supabase/migrations/*.sql to the running local database (all migrations are idempotent).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "$PG_BIN/psql" -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "$f"
done
"$PG_BIN/psql" -q -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "notify pgrst, 'reload schema';"
