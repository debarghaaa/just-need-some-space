#!/usr/bin/env bash
# One-command recovery for the local development environment.
#
# The sandbox that hosts the preview periodically loses everything that is not a regular file in
# the workspace: node_modules, the .next build, system packages, background processes and the
# downloaded Auth / PostgREST binaries. Postgres also refuses to start when its empty runtime
# directories (pg_notify, pg_tblspc, ...) were dropped by the snapshot. This script puts all of
# that back, in order, and leaves the production server running on :3000.
#
# Usage: bash scripts/dev-recover.sh [--no-build] [--no-start]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/scripts/local-supabase/.run"
PGDATA="$RUN/pgdata"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
BUILD=1
START=1
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --no-start) START=0 ;;
  esac
done

log() { printf '\033[36m[recover]\033[0m %s\n' "$*"; }
cd "$ROOT"

# 1. Node dependencies
if [ ! -d node_modules/next ]; then
  log "installing npm dependencies"
  npm install --no-audit --no-fund >/tmp/npm-install.log 2>&1
fi

# 2. PostgreSQL binaries
if [ ! -x "$PG_BIN/pg_ctl" ]; then
  log "installing PostgreSQL 17"
  sudo apt-get update -qq >/dev/null
  sudo apt-get install -y -qq postgresql-17 postgresql-client-17 >/tmp/apt-pg.log 2>&1
  sudo service postgresql stop >/dev/null 2>&1 || true
fi

# 3. Stop any half-alive stack services (Postgres may be gone while Auth and PostgREST linger)
for pat in "$HOME/.local/supa/auth serve" "$HOME/.local/supa/postgrest" "scripts/local-supabase/gateway.mjs"; do
  pkill -f "$pat" 2>/dev/null || true
done
if [ -f "$PGDATA/postmaster.pid" ]; then
  "$PG_BIN/pg_ctl" -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
fi
rm -f "$RUN"/*.pid "$PGDATA/postmaster.pid"

# 4. Restore the empty directories Postgres needs (snapshots do not keep empty dirs)
if [ -f "$PGDATA/PG_VERSION" ]; then
  chmod 700 "$PGDATA"
  for d in pg_notify pg_tblspc pg_replslot pg_twophase pg_snapshots pg_commit_ts pg_dynshmem pg_serial \
           pg_stat pg_stat_tmp pg_logical/snapshots pg_logical/mappings pg_wal/archive_status pg_wal/summaries; do
    mkdir -p "$PGDATA/$d"
  done
fi

# 5. Database, Auth, PostgREST, gateway (downloads binaries if missing, applies migrations, writes .env.local)
log "starting the local Supabase-compatible stack"
if ! bash scripts/local-supabase/up.sh >/tmp/up.log 2>&1; then
  # A frozen sandbox can truncate the write-ahead log mid-write; Postgres then panics with
  # "could not locate a valid checkpoint record". pg_resetwal discards the torn tail (at most the
  # last few seconds of writes) and keeps the data files. Only done when that exact failure is seen.
  if grep -q "could not locate a valid checkpoint record" "$RUN/postgres.log" 2>/dev/null; then
    log "postgres WAL is torn after a hard stop, resetting it (data files are kept)"
    "$PG_BIN/pg_resetwal" -f -D "$PGDATA" >/dev/null
    bash scripts/local-supabase/up.sh >/tmp/up.log 2>&1
  else
    grep -v NOTICE /tmp/up.log | tail -5
    echo "stack failed to start; see /tmp/up.log and $RUN/postgres.log" >&2
    exit 1
  fi
fi
grep -v NOTICE /tmp/up.log | tail -1

# 6. Prove the stack really works end to end: an anonymous sign-up must succeed
ANON="$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)"
if curl -sf -X POST -H "apikey: $ANON" -H 'content-type: application/json' -d '{}' \
     --max-time 10 http://127.0.0.1:54321/auth/v1/signup | grep -q access_token; then
  log "backend check: anonymous sign-in OK"
else
  echo "backend check FAILED: anonymous sign-in did not return a session. See $RUN/auth.log and $RUN/postgres.log" >&2
  exit 1
fi

# 7. Production build
if [ "$BUILD" = 1 ]; then
  log "building"
  rm -rf .next
  NODE_OPTIONS=--max-old-space-size=1400 node node_modules/next/dist/bin/next build >/tmp/build.log 2>&1 || { tail -20 /tmp/build.log; exit 1; }
fi

# 8. Server
if [ "$START" = 1 ]; then
  if ss -ltn 2>/dev/null | grep -q ':3000 '; then
    log "something is already listening on :3000, leaving it alone"
  else
    log "starting next start on :3000"
    setsid nohup node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000 >/tmp/next.log 2>&1 </dev/null &
    for _ in $(seq 1 30); do
      curl -sf -o /dev/null --max-time 2 http://127.0.0.1:3000/api/health && break
      sleep 1
    done
  fi
  curl -s http://127.0.0.1:3000/api/health; echo
fi
log "done"
