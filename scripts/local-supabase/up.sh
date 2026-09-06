#!/usr/bin/env bash
# Boots a local Supabase-compatible stack for development WITHOUT Docker:
#   PostgreSQL 17  (port 54322)  the database, with the same roles Supabase uses
#   GoTrue         (port 54324)  Supabase Auth, the exact binary Supabase ships
#   PostgREST      (port 54323)  the REST layer Supabase uses
#   gateway        (port 54321)  maps /auth/v1 and /rest/v1 onto the two services so
#                                 supabase-js talks to it exactly like a hosted project
# Then it writes .env.local with the resulting URL and keys.
#
# Production does not use any of this: point NEXT_PUBLIC_SUPABASE_URL at a real project instead.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="$ROOT/scripts/local-supabase/.run"
BIN="${SUPA_BIN:-$HOME/.local/supa}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
PGDATA="$RUN/pgdata"
PG_PORT=54322
REST_PORT=54323
AUTH_PORT=54324
GATEWAY_PORT=54321
SITE_URL="${SITE_URL:-http://localhost:3000}"
POSTGREST_VERSION="v16.2"
GOTRUE_VERSION="v2.196.0"

mkdir -p "$RUN" "$BIN"
cd "$ROOT"

log() { printf '\033[36m[stack]\033[0m %s\n' "$*"; }

# ----------------------------------------------------------------- binaries
if [ ! -x "$BIN/postgrest" ]; then
  log "downloading PostgREST $POSTGREST_VERSION"
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" | tar -xJ -C "$BIN"
fi
if [ ! -x "$BIN/auth" ]; then
  log "downloading Supabase Auth (GoTrue) $GOTRUE_VERSION"
  curl -fsSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-amd64.tar.xz" | tar -xJ -C "$BIN"
fi
if [ ! -x "$PG_BIN/pg_ctl" ]; then
  echo "PostgreSQL 17 not found at $PG_BIN. Install postgresql-17 or set PG_BIN." >&2
  exit 1
fi

# ----------------------------------------------------------------- secrets (generated once, never committed)
if [ ! -f "$RUN/jwt_secret" ]; then
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > "$RUN/jwt_secret"
  node -e "process.stdout.write(require('crypto').randomBytes(12).toString('hex'))" > "$RUN/db_password"
fi
JWT_SECRET="$(cat "$RUN/jwt_secret")"
DB_PASSWORD="$(cat "$RUN/db_password")"
ANON_KEY="$(node scripts/local-supabase/mkjwt.mjs "$JWT_SECRET" anon)"
SERVICE_KEY="$(node scripts/local-supabase/mkjwt.mjs "$JWT_SECRET" service_role)"

# ----------------------------------------------------------------- postgres
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "initialising database cluster"
  "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >"$RUN/initdb.log" 2>&1
  {
    echo "port = $PG_PORT"
    echo "listen_addresses = '127.0.0.1'"
    echo "unix_socket_directories = '$RUN'"
    echo "wal_level = logical"
    echo "max_connections = 60"
    echo "log_min_messages = warning"
  } >> "$PGDATA/postgresql.conf"
fi
if ! "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  # A restored/copied data directory can lose its 0700 mode and keep a stale pid file; postgres refuses both.
  chmod 700 "$PGDATA"
  if [ -f "$PGDATA/postmaster.pid" ] && ! kill -0 "$(head -1 "$PGDATA/postmaster.pid")" 2>/dev/null; then rm -f "$PGDATA/postmaster.pid"; fi
  log "starting postgres on :$PG_PORT"
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$RUN/postgres.log" -w start >/dev/null
fi
PSQL=("$PG_BIN/psql" -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres)

log "ensuring roles and grants"
"${PSQL[@]}" <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin superuser login; end if;
end \$\$;
alter role authenticator password '$DB_PASSWORD';
alter role supabase_auth_admin password '$DB_PASSWORD';
alter role supabase_auth_admin set search_path = auth;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
-- Mirrors hosted Supabase's default grants: usage for all API roles, table/sequence/function
-- privileges for signed-in players (RLS still decides row access) and the service role. The anon
-- role gets schema usage only; migrations/0003 tightens the remaining privileges the same way in
-- both environments.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all functions in schema public to authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
SQL

# ----------------------------------------------------------------- auth schema (GoTrue's own migrations)
export GOTRUE_DB_DRIVER=postgres
export GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:$DB_PASSWORD@127.0.0.1:$PG_PORT/postgres?sslmode=disable"
export DATABASE_URL="$GOTRUE_DB_DATABASE_URL"
export GOTRUE_DB_NAMESPACE=auth
export GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations"
export GOTRUE_SITE_URL="$SITE_URL"
export GOTRUE_URI_ALLOW_LIST="$SITE_URL/**,https://*.e2b.app/**,http://localhost:*/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET"
export GOTRUE_JWT_EXP=3600
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_JWT_ADMIN_ROLES=service_role,supabase_admin
export GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_ISSUER="http://127.0.0.1:$GATEWAY_PORT/auth/v1"
export GOTRUE_API_HOST=127.0.0.1
export PORT=$AUTH_PORT
export API_EXTERNAL_URL="http://127.0.0.1:$GATEWAY_PORT/auth/v1"
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true
export GOTRUE_MAILER_AUTOCONFIRM=true     # no SMTP locally: accounts are confirmed on sign-up
export GOTRUE_SMS_AUTOCONFIRM=true
export GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true   # guest entry (section 45 / "no login required"): enable "Allow anonymous sign-ins" in hosted Supabase Auth settings too
export GOTRUE_PASSWORD_MIN_LENGTH=8
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
export GOTRUE_LOG_LEVEL=warn
export GOTRUE_OPERATOR_TOKEN="$SERVICE_KEY"

log "applying auth migrations"
( cd "$BIN" && "$BIN/auth" migrate >"$RUN/auth-migrate.log" 2>&1 ) || { cat "$RUN/auth-migrate.log"; exit 1; }
"${PSQL[@]}" -c "grant usage on schema auth to anon, authenticated, service_role;" \
             -c "grant execute on all functions in schema auth to anon, authenticated, service_role;" \
             -c "grant select on auth.users to service_role;"

# ----------------------------------------------------------------- app schema
log "applying app migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done
"${PSQL[@]}" -c "notify pgrst, 'reload schema';" >/dev/null

# ----------------------------------------------------------------- services
stop_pidfile() {
  if [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; then
    kill "$(cat "$1")" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$(cat "$1")" 2>/dev/null || break; sleep 0.1; done
    kill -9 "$(cat "$1")" 2>/dev/null || true
  fi
  rm -f "$1"
}
stop_pidfile "$RUN/auth.pid"; stop_pidfile "$RUN/postgrest.pid"; stop_pidfile "$RUN/gateway.pid"
# belt and braces: nothing else may hold the service ports
pkill -9 -f "^$BIN/auth serve" 2>/dev/null || true
pkill -9 -f "^$BIN/postgrest" 2>/dev/null || true
pkill -9 -f "^node scripts/local-supabase/gateway.mjs" 2>/dev/null || true

log "starting auth on :$AUTH_PORT"
( cd "$BIN" && setsid nohup "$BIN/auth" serve >"$RUN/auth.log" 2>&1 </dev/null & echo $! > "$RUN/auth.pid" )

log "starting postgrest on :$REST_PORT"
PGRST_DB_URI="postgres://authenticator:$DB_PASSWORD@127.0.0.1:$PG_PORT/postgres" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=warn PGRST_DB_POOL=10 \
setsid nohup "$BIN/postgrest" >"$RUN/postgrest.log" 2>&1 </dev/null & echo $! > "$RUN/postgrest.pid"

log "starting gateway on :$GATEWAY_PORT"
GATEWAY_PORT=$GATEWAY_PORT AUTH_PORT=$AUTH_PORT REST_PORT=$REST_PORT \
setsid nohup node scripts/local-supabase/gateway.mjs >"$RUN/gateway.log" 2>&1 </dev/null & echo $! > "$RUN/gateway.pid"

# ----------------------------------------------------------------- env file
cat > "$ROOT/.env.local" <<ENV
# Generated by scripts/local-supabase/up.sh for LOCAL development. Do not deploy these values.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
NEXT_PUBLIC_BACKEND_MODE=local
UNIVERSE_SEED=just-need-some-space
ENV

for i in $(seq 1 40); do
  if curl -fs -m 3 "http://127.0.0.1:$GATEWAY_PORT/auth/v1/health" >/dev/null 2>&1 && curl -fs -m 3 -H "apikey: $ANON_KEY" "http://127.0.0.1:$GATEWAY_PORT/rest/v1/" >/dev/null 2>&1; then
    log "ready: http://127.0.0.1:$GATEWAY_PORT (auth + rest). .env.local written."
    exit 0
  fi
  sleep 0.25
done
echo "services did not come up; see $RUN/*.log" >&2
exit 1
