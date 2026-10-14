#!/usr/bin/env bash
# EtsySentry per-session services, the repo-owned part of the fleet cloud agent
# contract: the loopback PostgreSQL cluster and its synthetic seed. It returns
# once the database is ready; the development servers are launched separately
# (Cursor's `dev` terminal, or `bun run dev` in a Claude session).
# Idempotent and safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# The schema's development arm points at the Mac mini over Tailscale, which is
# how local development reaches the live database. A cloud VM has no Tailscale,
# so it runs its own cluster and overrides this ONE public value for the
# session (env.sh carries the same export for every session shell). Nothing
# sensitive is overridden: the password still resolves from the Development
# vault, and the local cluster is provisioned with it.
export ETSYSENTRY_DATABASE_HOST=127.0.0.1

# Claude cloud containers run as root without sudo, and PostgreSQL's server
# binaries refuse root; Cursor runs as a sudo-capable user. pg_ctlcluster drops
# to the cluster owner itself, and psql reaches the superuser over the local
# socket as the postgres account.
if [ "$(id -u)" -eq 0 ]; then
    privileged=()
    as_postgres=(runuser -u postgres --)
else
    privileged=(sudo)
    as_postgres=(sudo -u postgres)
fi

PG_CLUSTER="$(ls -d /etc/postgresql/*/main 2>/dev/null | head -1 || true)"
PG_VERSION="$(basename "$(dirname "${PG_CLUSTER:-/16/main}")")"

if ! "${privileged[@]}" pg_ctlcluster "$PG_VERSION" main status >/dev/null 2>&1; then
    "${privileged[@]}" pg_ctlcluster "$PG_VERSION" main start
elif ! pg_isready -h 127.0.0.1 -p 5435 >/dev/null 2>&1; then
    # A cluster started before install.sh moved it to 5435 still listens on
    # its old port until it restarts.
    "${privileged[@]}" pg_ctlcluster "$PG_VERSION" main restart
fi

for _ in $(seq 1 30); do
    if pg_isready -h 127.0.0.1 -p 5435 >/dev/null 2>&1; then
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

"${as_postgres[@]}" psql -p 5435 -v ON_ERROR_STOP=1 \
    -v db_user="$DB_USER" -v db_name="$DB_NAME" -v db_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE USER %I WITH PASSWORD %L', :'db_user', :'db_password')
    WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'db_user')\gexec
SELECT format('ALTER USER %I WITH PASSWORD %L', :'db_user', :'db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')\gexec
SQL

"${as_postgres[@]}" psql -p 5435 -d "$DB_NAME" -v ON_ERROR_STOP=1 -v db_user="$DB_USER" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'db_user')\gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'db_user')\gexec
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL

unset DB_PASSWORD

echo "[start] PostgreSQL ready on 127.0.0.1:5435 (database: ${DB_NAME})."

# Synthetic development data, so a cloud session opens the dashboard on a
# catalog, a month of listing and rank history, and an event log instead of
# empty states. Seeded per boot rather than baked into the environment snapshot
# because the dataset is anchored to the current date, and a week-old snapshot
# would show a week-old week. The seed applies pending migrations itself and
# grants the shared Dev Sign-In user access to the result, and it only ever
# reaches this local cluster: it refuses any database host that is not loopback,
# which is why the override above is set before it runs.
#
# Its output is the session's starting receipt — which database was filled,
# which signed-in user owns it, how many rows, through which day — so it is
# printed rather than discarded. The seed prints identifiers only; it never
# prints a credential or a sign-in ticket. Best-effort: a session must still
# boot if seeding fails.
if ! bun run db:seed:dev; then
    echo "[start] Skipping synthetic dev data (seed failed; see the refusal above)." >&2
fi
