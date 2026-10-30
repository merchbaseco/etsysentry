# Centralized Merchbase Access Cutover

<!-- Read when changing authentication, account mapping, API credentials, or jobs. -->

This documents EtsySentry's Cloudflare Access runtime and the historical product-local Clerk data
cleanup. The source now verifies Cloudflare Access assertions through `@merchbaseco/access`, while
production stays on the previous Clerk release until the parent coordinates the complete data,
Cloudflare, and deployment cutover. Do not deploy this source against the current production
configuration. This repository contains no production identity maps, credentials, backup details,
or account identifiers.

## Runtime contract

The fixed Merchbase service is `etsysentry`. The server uses the private package for Cloudflare
Access assertions, suite API-key aliases, and the shared OAuth credential path. EtsySentry supplies:

- a product-local Access Projection store keyed by `(issuer, subject)`;
- the exact `merchbaseUserId` to existing local `accounts.id` resolver;
- an exact canonical `mbu_ID` lookup and resolver to the existing local account UUID;
- a product-only internal snapshot receiver with an independent audience/client check; and
- immediate WebSocket disconnects when a projection changes or its verified authorization expires.

The exact raw `Host` selects one of three audiences: interactive UI, shared public API, or the
EtsySentry internal snapshot receiver. Unknown hosts fail closed. Missing projections load from the
authority only through its service credential. Snapshot events are idempotent and monotonic by
source timestamp; removals become tombstones. The canonical grant plus person and multiple API-key
aliases coexist in the existing `(issuer, subject)` projection table. The retained local account
UUID, Etsy OAuth connection, listings, keywords, shops, snapshots, event logs, jobs, and metering
rows remain account-keyed and are not deleted or recreated.

Tracker ownership, job payloads, event logs, and Etsy API metering use `accountId` only. The
historical phase-two cleanup drops redundant Clerk-subject columns after proving every affected row
has an owning account and every non-system legacy value belongs to an identity on that same
account. Existing values are never reinterpreted as Merchbase User IDs.

Customer API-key issuance remains in the central authority. EtsySentry has no local issuance,
verification, UI, or key table. The CLI keeps `MERCHBASE_API_KEY` and the shared Keychain
convention; public clients decode only the strict `mbk_v1.<canonical-base64url-json>` transport
envelope and send its client ID/secret as Cloudflare Access service headers. Opaque OAuth tokens use
the separate bearer `accessToken` option and are never parsed locally.

Production image builds install the private access package with the `github_packages_token`
BuildKit secret. Compose sources that secret from `MERCHBASE_GITHUB_NPM_TOKEN` — the shared suite
credential, an `@internal` schema item that resolves only behind
`ETSYSENTRY_RESOLVE_INSTALL_TOKENS`. It resolves from the `Development` vault in every venue,
including CI: Actions' `github.token` gets a 403 from GitHub Packages for this package and is not
used. The package token is never an image build argument or Dockerfile environment variable.

The server verifies `Cf-Access-Jwt-Assertion` against the audience selected from exact `Host`.
Interactive persons map to session context, API-audience people map to OAuth context, and machine
assertions resolve only through local API-key aliases. API-host people cannot call app/admin routes.
All customer requests reject `x-merchbase-user-id`; caller-supplied identity headers never grant
access.

## Migration tooling

The tools are read-only unless `backfill` is explicitly invoked with all operator approvals:

```text
bun run --cwd apps/server access:audit [--mapping /private/path/mapping.json]
bun run --cwd apps/server access:plan --mapping /private/path/mapping.json --out /private/path/plan.json
bun run --cwd apps/server access:backfill \
  --mapping /private/path/mapping.json \
  --plan /private/path/plan.json \
  --backup-fingerprint <sha256> \
  --approved-by <operator-record>
```

The mapping file is supplied privately by the operator after checking Clerk and the approved local
account. Every retained or retired identity contains its own exact `issuer` and `subject`; there is
no shared or inferred issuer. The mapping also contains exactly one local `accountId`, the stable
`merchbaseUserId`, the retained projection's central source timestamp/access state, and expected
global and target counts for identities, the duplicate normalized-email group, active legacy keys,
Etsy OAuth connections, accounts, redundant ownership references, and system metering events. The
planner hashes the exact issuer/subject set and mapping; it never prints raw identifiers or emails
and never chooses a winner. Duplicate exact issuer/subject pairs are rejected.

The private mapping has this shape; replace every example value from approved operator evidence:

```json
{
    "accountId": "approved-local-account-id",
    "merchbaseUserId": "mbu_approved",
    "retained": {
        "issuer": "https://retained-clerk.example",
        "subject": "user_retained",
        "sourceUpdatedAt": 1,
        "access": "granted",
        "accessValidUntil": null
    },
    "retiredIdentities": [
        {
            "issuer": "https://retired-clerk.example",
            "subject": "user_retired"
        }
    ],
    "expected": {
        "global": {
            "accountCount": 1,
            "activeLegacyApiKeyCount": 1,
            "clerkIdentityCount": 2,
            "duplicateNormalizedEmailGroupCount": 1,
            "etsyOAuthConnectionCount": 1
        },
        "target": {
            "accountIdentityCount": 2,
            "activeLegacyApiKeyCount": 1,
            "etsyOAuthConnectionCount": 1,
            "legacyOwnershipReferenceCount": 0,
            "systemEtsyApiCallEventCount": 0
        }
    }
}
```

`access:audit` reads global counts plus, when given a mapping, the exact target identity-set,
legacy-key, OAuth, product-row, and legacy ownership-reference counts. It fails if an affected row
has no owning account or a non-system legacy value does not match an identity on that account.
`access:plan` fails if any expected fact differs. The backfill runs serializable, rechecks the plan
inside the transaction, sets the existing account's stable mapping only when it is null or already
equal, seeds the retained active projection, seeds terminal tombstones for retired identities, and
asserts product-row counts are unchanged. A duplicate mapping, changed identity set, changed
key/OAuth count, changed plan, or unique-account conflict aborts the transaction.

The generated migrations are intentionally staged:

1. `0020_early_agent_zero.sql` adds the projection tables and nullable account mapping while the
   legacy auth tables remain available for the assertion/backfill transaction.
2. The operator runs `access:backfill` against that phase-one schema.
3. `0021_known_sandman.sql` drops `api_keys`, `clerk_identities`, and the redundant Clerk-subject
   columns/indexes from trackers and Etsy API metering after acceptance of the backfill. It does not
   delete or recreate product, provider, event, job, or metering rows.

Do not run a migration command that applies phase two before the backfill. Do not run the backfill
against an unplanned database. A failed backfill transaction is rolled back; it does not delete
queued jobs or product data.

## Exact production cutover

1. Freeze identity changes. Pause account/identity administration long enough to capture the Clerk
   exact issuer and subject pair for every identity involved. Record the central metadata source
   timestamp, access state, and stable user ID in the private operator mapping. Do not use
   normalized email to select a retained identity or infer one identity's issuer from another.
2. Run `access:audit` read-only. Confirm the known Phase 0 shape with private evidence: one real
   account, the exact duplicate normalized-email group, the explicit Clerk issuer/subject pairs,
   one active legacy EtsySentry key, and one Etsy OAuth connection. Confirm all product/metering
   row counts.
3. Obtain explicit approval for the mapping, plan digest, and target account. Record who approved
   it and why; do not put those private identifiers into source or shared logs.
4. Stop the EtsySentry server, pg-boss workers, CLI automation, and any scheduled external caller.
   Verify no migration/backfill process is still connected except the controlled operator session.
5. Create a verified database backup. Restore it into an isolated scratch database and run the
   audit plus plan assertions there. Record a backup SHA-256 fingerprint and restore success.
6. Run `bun run --cwd apps/server db:migrate:phase1`. This uses the generated migration journal
   through `0020_early_agent_zero.sql` and keeps the real migration journal consistent. Ordinary
   `db:migrate` and server startup also stop at phase one until phase two is already recorded;
   use the explicit phase-two command only after backfill acceptance.
7. Run `access:backfill` with the private mapping, matching plan, backup fingerprint, and explicit
   approval. Confirm the transaction output contains only safe counts/fingerprints and the status
   is `backfilled`.
8. Before deploying the new source, have the parent verify the canonical Merchbase grant and its
   Cloudflare person and API-key aliases in the production projection data. Configure the exact UI,
   public API, and EtsySentry internal audiences, plus the authority and product service clients,
   through the separately managed Cloudflare/secret-store workflow. This repository does not create
   credentials or change remote policy.
9. Apply phase-two cleanup with `bun run --cwd apps/server db:migrate:phase2`; use this guarded runner rather
   than applying the SQL file directly. Verify the legacy local API-key and Clerk-identity tables are absent
   and the redundant tracker/metering identity columns are absent. Confirm all
   product/provider/metering tables and row counts remain.
10. Deploy only after the parent confirms that the Cloudflare host policies, service credentials,
    projection aliases, production-required environment values, and app source are all ready. Run
    smoke checks for a UI session, a public API machine key, the shared OAuth credential path, the
    Etsy OAuth connection, the internal snapshot receiver, and `/ws`. Confirm no credential value
    is printed.
11. Run one controlled background-job check for each keyword, listing, and shop worker. Confirm
    access is evaluated once at job start, an allowed run preserves the normal sync lifecycle, and
    a denied/unavailable run returns to queue-safe state without deleting provider or product data.
12. Confirm snapshot callbacks apply idempotently and immediately close affected sockets. Keep the
    verified backup until post-cutover acceptance is complete; then remove temporary backup copies
    according to the approved retention policy.

## Rollback

Before phase two, a failed backfill rolls back at the transaction boundary and the old runtime can
be restarted against the phase-one database only after the operator verifies the transaction did
not commit. After phase two or any production runtime change, rollback is a coordinated restore of
the verified pre-cutover backup plus the previous application/runtime release; there is no
compatibility alias or dual-auth window. Stop services before restore, verify restored row counts and
the Etsy OAuth connection, and rerun the read-only audit before accepting traffic.

## Facts still owned by the orchestrator

The implementation cannot safely infer the production legacy identity set and account mapping,
retained stable Merchbase user ID, central projection source timestamp, operator admin user ID,
Cloudflare audiences/service clients, backup fingerprint, or exact production row counts. The
orchestrator must resolve and approve those facts privately before any cutover.
