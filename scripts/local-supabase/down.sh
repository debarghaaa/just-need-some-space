#!/usr/bin/env bash
# Stops the local Supabase-compatible stack started by up.sh. Data is kept in .run/pgdata.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="$ROOT/scripts/local-supabase/.run"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
for name in gateway postgrest auth; do
  if [ -f "$RUN/$name.pid" ]; then
    pid="$(cat "$RUN/$name.pid")"
    kill "$pid" 2>/dev/null && echo "stopped $name ($pid)"
    rm -f "$RUN/$name.pid"
  fi
done
if [ -d "$RUN/pgdata" ] && "$PG_BIN/pg_ctl" -D "$RUN/pgdata" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$RUN/pgdata" -m fast -w stop >/dev/null && echo "stopped postgres"
fi
