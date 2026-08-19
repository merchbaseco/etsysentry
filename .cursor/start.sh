#!/usr/bin/env bash
# Per-boot reconciliation for EtsySentry: ensure PostgreSQL is running and the
# development database exists. Idempotent; returns once the DB is ready.
set -euo pipefail

PG_VERSION=16
PGBIN="/usr/lib/postgresql/${PG_VERSION}/bin"
PGDATA="${HOME}/etsysentry-pgdata"
PGSOCK="${HOME}/pgsock"
PGPORT=5435
PGUSER=etsysentry
PGDATABASE=etsysentry

mkdir -p "$PGSOCK"

if ! "${PGBIN}/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "${PGBIN}/pg_ctl" -D "$PGDATA" -l "${HOME}/etsysentry-pg.log" -w -t 60 start
fi

export PGPASSWORD=etsysentry_local_dev_password
"${PGBIN}/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}'" | grep -q 1 ||
    "${PGBIN}/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"

echo "[start] PostgreSQL ready on 127.0.0.1:${PGPORT} (database ${PGDATABASE})"
