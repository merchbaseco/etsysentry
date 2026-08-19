#!/usr/bin/env bash
# Idempotent Cloud Agent install for EtsySentry.
# Installs Bun (pinned), PostgreSQL 16, JS dependencies, and provisions the
# local development database. Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUN_VERSION=1.3.5
PG_VERSION=16
PGBIN="/usr/lib/postgresql/${PG_VERSION}/bin"
PGDATA="${HOME}/etsysentry-pgdata"
PGSOCK="${HOME}/pgsock"
PGPORT=5435
PGUSER=etsysentry
PGDATABASE=etsysentry
PGPW=etsysentry_local_dev_password

log() { printf '[install] %s\n' "$*"; }

# --- Bun (pinned) -----------------------------------------------------------
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null || true)" != "$BUN_VERSION" ]; then
    log "Installing Bun ${BUN_VERSION}"
    curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
sudo ln -sf "$BUN_INSTALL/bin/bunx" /usr/local/bin/bunx
log "Bun $(bun --version)"

# --- PostgreSQL 16 ----------------------------------------------------------
if [ ! -x "${PGBIN}/initdb" ]; then
    log "Installing PostgreSQL ${PG_VERSION}"
    sudo apt-get update -qq || true
    for attempt in 1 2 3 4 5; do
        if sudo apt-get install -y -qq --fix-missing postgresql postgresql-contrib; then
            break
        fi
        log "apt attempt ${attempt} failed; retrying"
        sudo apt-get install -y -qq -f || true
        sleep $((attempt * 4))
    done
fi
[ -x "${PGBIN}/initdb" ] || {
    log "PostgreSQL ${PG_VERSION} install failed"
    exit 1
}

# --- Cluster init -----------------------------------------------------------
if [ ! -s "${PGDATA}/PG_VERSION" ]; then
    log "Initializing PostgreSQL cluster at ${PGDATA}"
    mkdir -p "$PGDATA" "$PGSOCK"
    pwfile="$(mktemp)"
    printf '%s' "$PGPW" >"$pwfile"
    "${PGBIN}/initdb" -D "$PGDATA" -U "$PGUSER" \
        --auth=scram-sha-256 --pwfile="$pwfile" --encoding=UTF8
    rm -f "$pwfile"
    {
        echo "listen_addresses = '127.0.0.1'"
        echo "port = ${PGPORT}"
        echo "unix_socket_directories = '${PGSOCK}'"
    } >>"${PGDATA}/postgresql.conf"
fi
mkdir -p "$PGSOCK"

# --- Provision database + extensions ---------------------------------------
"${PGBIN}/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 ||
    "${PGBIN}/pg_ctl" -D "$PGDATA" -l "${HOME}/etsysentry-pg.log" -w -t 60 start
export PGPASSWORD="$PGPW"
"${PGBIN}/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}'" | grep -q 1 ||
    "${PGBIN}/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"
"${PGBIN}/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;'

# --- App env + JS dependencies ---------------------------------------------
[ -f .env ] || cp .env.example .env
log "Installing JS dependencies (bun install --frozen-lockfile)"
bun install --frozen-lockfile
log "Install complete"
