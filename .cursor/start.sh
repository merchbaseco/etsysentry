#!/usr/bin/env bash
# Per-boot startup for EtsySentry Cursor cloud agents.
# Starts the local PostgreSQL cluster, ensures the role/database/extensions
# exist using the credential the schema resolves, then launches the development
# servers under varlock. Idempotent and safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# The schema's development arm points at the Mac mini over Tailscale, which is
# how local development reaches the live database. A Cursor cloud VM has no
# Tailscale, so it runs its own cluster and overrides this ONE public value for
# the session. Nothing sensitive is overridden: the password still resolves from
# the Development vault, and the local cluster is provisioned with it.
export ETSYSENTRY_DATABASE_HOST=127.0.0.1

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

PG_CLUSTER="$(ls -d /etc/postgresql/*/main 2>/dev/null | head -1 || true)"
PG_VERSION="$(basename "$(dirname "${PG_CLUSTER:-/16/main}")")"

if ! $SUDO pg_ctlcluster "$PG_VERSION" main status >/dev/null 2>&1; then
    $SUDO pg_ctlcluster "$PG_VERSION" main start
fi

for _ in $(seq 1 30); do
    if pg_isready -h localhost -p 5435 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# The database password is a schema item, so the local cluster is provisioned
# with the same value the server will resolve — one owner, no drift. The value
# moves through a pipe into psql and is never printed.
DB_USER="$(bunx varlock printenv ETSYSENTRY_DATABASE_USER)"
DB_NAME="$(bunx varlock printenv ETSYSENTRY_DATABASE_NAME)"
DB_PASSWORD="$(bunx varlock printenv ETSYSENTRY_DATABASE_PASSWORD)"

$SUDO -u postgres psql -p 5435 -v ON_ERROR_STOP=1 \
    -v db_user="$DB_USER" -v db_name="$DB_NAME" -v db_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE USER %I WITH PASSWORD %L', :'db_user', :'db_password')
    WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'db_user')\gexec
SELECT format('ALTER USER %I WITH PASSWORD %L', :'db_user', :'db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')\gexec
SQL

$SUDO -u postgres psql -p 5435 -d "$DB_NAME" -v ON_ERROR_STOP=1 -v db_user="$DB_USER" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'db_user')\gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'db_user')\gexec
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL

unset DB_PASSWORD

echo "[start] PostgreSQL ready on 127.0.0.1:5435 (database: ${DB_NAME})."
echo "[start] Launching development servers (server:8080, website:3100)..."

exec bunx varlock run -- sh -c '
bun --cwd apps/server --watch src/index.ts &
server_pid=$!
bun run --cwd apps/website dev --strictPort --port 3100 &
website_pid=$!
trap "kill $server_pid $website_pid 2>/dev/null" INT TERM EXIT
wait $server_pid $website_pid
'
