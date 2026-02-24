# EtsySentry Database Queries

Use this guide when you need to inspect database data for debugging, validation,
or incident triage.

## Guardrails

- Default to `SELECT`-only queries.
- Any write action (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, migrations) requires explicit
  user approval in the current conversation.
- Keep queries bounded (`LIMIT`, tight `WHERE` clauses, explicit time windows).
- Avoid exposing secrets or full credential values in responses.

## Connection Setup

Run from repo root:

```bash
set -a
source .env
set +a

export DATABASE_PORT=5435
export PGPASSWORD="$DATABASE_PASSWORD"
export PGOPTIONS='-c default_transaction_read_only=on'
```

Test the connection:

```bash
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c 'SELECT 1;'
```

## Query Patterns

### One-shot query

```bash
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c \
  "SELECT COUNT(*) FROM tracked_listings;"
```

### Interactive `psql`

```bash
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME"
```

Inside `psql`:

```sql
\dt
\d tracked_listings
\d etsy_oauth_connections
\q
```

### Common debugging queries

```bash
# Most recently tracked listings
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c \
  "SELECT etsy_listing_id, account_id, tracker_clerk_user_id, updated_at FROM tracked_listings ORDER BY updated_at DESC LIMIT 50;"

# Etsy OAuth connections by account
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c \
  "SELECT account_id, expires_at, updated_at FROM etsy_oauth_connections ORDER BY updated_at DESC LIMIT 50;"

# USD conversion rates cache status
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c \
  "SELECT base_currency, provider, fetched_at, next_refresh_at, last_refresh_error, updated_at FROM currency_rates ORDER BY updated_at DESC LIMIT 10;"
```

### Container-local query (when logged into deployment host)

```bash
docker exec etsysentry-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -c '\dt'
```

## Write Operations (Approval Required)

If and only if the user explicitly approves a write:

```bash
unset PGOPTIONS
# run the approved write command
export PGOPTIONS='-c default_transaction_read_only=on'
```

Always report exactly what changed and why.

## Schema Reference

- Primary schema source: `apps/server/src/db/schema.ts`
- Migration history: `apps/server/drizzle/`

## One-Time Migration Prep (Approved)

For the `product_keyword_ranks.listing_id` NOT NULL + FK rollout, historical rank rows may not have
`listing_id` populated yet. If data loss for keyword rank history is acceptable, clear the table
before running server migrations in production:

```bash
unset PGOPTIONS
psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -c \
  'TRUNCATE TABLE product_keyword_ranks;'
export PGOPTIONS='-c default_transaction_read_only=on'
```
