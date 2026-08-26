import type { AccessProjectionStore } from '@merchbaseco/access';
import {
    bootstrapDevAccessProjection,
    DEV_SIGN_IN_CLERK_SUBJECT,
    DEV_SIGN_IN_MERCHBASE_USER_ID,
    type DevAccessProjectionBootstrapResult,
} from '@merchbaseco/access/dev';
import { sql } from 'drizzle-orm';
import type { db as database } from '../db';
import { runMigrations } from '../db/migrate';
import { ETSYSENTRY_SERVICE } from '../services/access/etsysentry-access';

/**
 * Brings a local database all the way to the current schema, and grants the
 * shared Merchbase Dev Sign-In user access to it.
 *
 * Two things have to happen here that a fresh database cannot do on its own.
 *
 * First, the Access Projection. Authorization is verified against a
 * webhook-synced projection held in this database, and a local or cloud
 * database receives no Clerk webhooks — so every request would fail before any
 * seeded data could be seen. `bootstrapDevAccessProjection` writes the row the
 * webhook would have written, through the very same `AccessProjectionStore`
 * the webhook handler uses. This repository writes no projection SQL of its
 * own; the access package owns that shape, its refusals, and its timestamps.
 *
 * Second, the phase-two gate. `runMigrations()` deliberately stops at the
 * central-access phase-one migration and gates the phase-two cleanup behind a
 * readiness check, because on the live database that cleanup drops legacy
 * identity tables and columns and must not run until every account has been
 * backfilled. A fresh local database has no legacy world to protect, but it
 * still starts out failing the gate — there is no mapped account at all — which
 * would leave the seed writing into a schema that still carries
 * `tracker_clerk_user_id NOT NULL`. So the seed satisfies the gate the way the
 * cutover backfill does rather than bypassing it: it writes its own account and
 * that account's Clerk identity, and the bootstrapped projection completes the
 * trio the readiness query looks for. Those rows are the truthful phase-one
 * shape of the account the seed is about to fill, not a stub built to fool the
 * check.
 */

const CLEANUP_TAG = '0021_known_sandman';

type Database = typeof database;

export interface LocalDatabaseHeadParams {
    accountId: string;
    /** Credential-free DSN for the loopback target; proved by the access package. */
    databaseUrl: string;
    /** Byte-identical to the issuer `createClerkAuthenticator` is configured with. */
    issuer: string;
    store: AccessProjectionStore;
}

export const migrateLocalDatabaseToHead = async (
    db: Database,
    params: LocalDatabaseHeadParams
): Promise<DevAccessProjectionBootstrapResult> => {
    await runMigrations();

    const hasLegacyIdentities = await hasLegacyIdentityTable(db);

    if (hasLegacyIdentities) {
        await backfillPhaseOneAccount(db, params);
    }

    const access = await bootstrapDevAccessProjection({
        databaseUrl: params.databaseUrl,
        issuer: params.issuer,
        service: ETSYSENTRY_SERVICE,
        store: params.store,
    });

    if (hasLegacyIdentities) {
        await runMigrations({ throughTag: CLEANUP_TAG });
    }

    return access;
};

const hasLegacyIdentityTable = async (db: Database): Promise<boolean> => {
    const rows = await db.execute<{ present: boolean }>(
        sql`select to_regclass('public.clerk_identities') is not null as present`
    );

    return Boolean(rows[0]?.present);
};

/**
 * The phase-one shape of one mapped account: the account row and the Clerk
 * identity that owned it. The active projection that replaces that identity is
 * written by the access package's bootstrap, against this exact issuer and
 * subject, which is what makes the readiness join resolve. Written with raw SQL
 * because `clerk_identities` is already gone from `schema.ts` — by the time the
 * seed writes data it is gone from the database too.
 */
const backfillPhaseOneAccount = async (
    db: Database,
    params: LocalDatabaseHeadParams
): Promise<void> => {
    await db.transaction(async (tx) => {
        await tx.execute(sql`
            insert into accounts (id, merchbase_user_id)
            values (${params.accountId}, ${DEV_SIGN_IN_MERCHBASE_USER_ID})
            on conflict (id) do update set merchbase_user_id = excluded.merchbase_user_id
        `);
        await tx.execute(sql`
            insert into clerk_identities (account_id, clerk_issuer, clerk_subject)
            values (${params.accountId}, ${params.issuer}, ${DEV_SIGN_IN_CLERK_SUBJECT})
            on conflict (clerk_issuer, clerk_subject) do update
                set account_id = excluded.account_id
        `);
    });
};
