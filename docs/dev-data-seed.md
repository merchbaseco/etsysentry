# Synthetic Development Data

`bun run db:seed:dev` fills a **local** database with one small fabricated account, so every
EtsySentry surface renders something instead of an empty state. It is never run automatically on a
developer machine.

## Why It Refuses Almost Everywhere

Local development points at the **live** database: the schema's development arm resolves
`ETSYSENTRY_DATABASE_HOST` to the Mac mini over Tailscale (see [`deployment.md`](deployment.md)).
"Not production" is therefore not a safe test for a script that writes fabricated listings and
sales.

The seed accepts only a loopback database host — `127.0.0.1`, `::1`, or `localhost` — and refuses
everything else with a loud error before it opens a connection. `NODE_ENV=production` is refused
too. **There is no override flag.** The refusal names the host, port, and database it rejected, and
never a credential.

To seed, point the run at a PostgreSQL on your machine:

```bash
ETSYSENTRY_DATABASE_HOST=127.0.0.1 ETSYSENTRY_DATABASE_PORT=5435 bun run db:seed:dev
```

The guard runs before anything that reads the parsed environment or opens a connection, which is why
`apps/server/src/dev-seed/seed-dev-data.ts` reaches the rest of the seed through a dynamic import.

## What One Run Produces

Roughly 2,700 rows in well under a second:

| What | Shape |
| --- | --- |
| Account | One account mapped to a `merchbase_user_id`, so a signed-in dashboard resolves to it. |
| Listings | 24 tracked listings with a 30-tag vocabulary, mixed tracking/sync/Etsy states, one refresh error, non-USD prices, digital listings, and inline SVG thumbnails. |
| Listing history | One `listing_metric_snapshots` row per listing per day. Quantity falls as units sell and jumps on renewal, so `deriveListingHistorySales` reports estimated sales both ways. |
| Keywords | 6 tracked keywords, each with a daily rank capture across 3 pages of results. |
| Rank history | Bounded random walks per ranked listing, so the 1d/7d/30d change columns and the trend sparkline show real movement in both directions. |
| Shops | 4 tracked shops — the account's own plus watched competitors — with daily snapshots whose sold/favorite/review deltas derive the per-day rates, and a listing roster mixing tracked and discovery-only listings. |
| Event log | Monitor runs over the last week, each sharing a `monitor_run_id`, covering every level, status, and primitive the Logs tab filters on. |
| API usage | Etsy call events weighted into the past hour and the past 24 hours, which is what the dashboard's usage panel counts. |
| Currency | A USD rates row, so the conversion panel is populated. |

The window is 35 days ending **today**, in UTC. Days are recomputed from the run's clock, so the
dataset always describes the current week. 35 rather than 30 because keyword activity compares
against the rank 30 days back, and a 30-day window reaches only 29 days back — every 30-day change
column would read zero.

## Flags

| Flag | Effect |
| --- | --- |
| `--seed=<string>` | Picks the dataset. The same seed always produces the same account. |
| `--days=<n>` | Length of the history window. Default 35. |
| `--listings=<n>` | Size of the catalog. Default 24. |
| `--keywords=<n>` | Number of tracked keywords. Default 6. |
| `--account-id=<id>` | Account to seed. Default `acct_dev_seed`. |
| `--merchbase-user-id=<mbu_…>` | Merchbase user the seeded account maps to. Pass your own to sign in to the dashboard against this data. |

## Re-running Replaces, It Does Not Stack

Every account-scoped table is cleared and refilled inside one transaction, so a re-run refreshes the
week rather than duplicating it, and a failed run leaves the previous dataset intact. Row counts are
identical after any number of runs.

The global `tags` vocabulary is deliberately **not** cleared — it is shared across accounts, and
deleting it would cascade into another account's listing tags. The seed adopts whatever tag ids
already exist instead of forcing its own.

## Migrations

The seed brings the schema to head itself, so a fresh database needs no separate migrate step.

That takes two passes. `runMigrations()` deliberately stops at the central-access phase-one
migration and gates the phase-two cleanup behind a readiness check, because on the live database
that cleanup drops legacy identity tables and columns. A fresh local database starts out failing
that gate — it has no mapped account at all — which would leave the seed writing into a schema that
still carries `tracker_clerk_user_id NOT NULL`. So `dev-seed/migrate-to-head.ts` satisfies the gate
the way the cutover backfill does: it writes the seed account, that account's Clerk identity, and
the matching active projection, then asks for the cleanup. Those rows are the truthful phase-one
shape of the account the seed is about to fill, not a stub built to pass a check. See
[`centralized-access-cutover.md`](centralized-access-cutover.md).

## Cloud Sessions

Cursor Cloud Agents get the data for free: `.cursor/start.sh` provisions the isolated local cluster,
overrides `ETSYSENTRY_DATABASE_HOST` to `127.0.0.1` for the session, and then seeds on every boot.
Seeding is per boot rather than baked into the environment snapshot because the dataset is anchored
to the current date, and a week-old snapshot would show a week-old week. A failed seed logs and is
skipped; it never blocks the session.

## The Coverage Contract

`apps/server/src/dev-seed/plan.test.ts` asserts what the seed **promises**, not incidental shape:
that every seeded table has rows, that the newest day is today, that listing history yields
estimated sales through the real `deriveListingHistorySales`, that shop deltas derive a per-day rate
through the real `deriveShopSalesPerDay`, that each keyword capture shares one exact `observed_at`
(the activity query selects the newest capture by timestamp equality, so a split capture would show
a single listing), and that the log view's levels, statuses, and primitives are all represented. If
one of those fails, some dashboard surface boots empty.

`local-database-guard.test.ts` covers the refusal, including the live Tailscale host and the
production Compose host by name.
