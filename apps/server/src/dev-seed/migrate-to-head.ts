import { sql } from 'drizzle-orm';
import type { db as database } from '../db';
import { runMigrations } from '../db/migrate';

/**
 * Brings a local database all the way to the current schema.
 *
 * `runMigrations()` deliberately stops at the central-access phase-one
 * migration and gates the phase-two cleanup behind a readiness check, because
 * on the live database that cleanup drops legacy identity tables and columns
 * and must not run until every account has been backfilled. A fresh local
 * database has no legacy world to protect, but it still starts out failing the
 * gate — there is no mapped account at all — which would leave the seed writing
 * into a schema that still carries `tracker_clerk_user_id NOT NULL`.
 *
 * So the seed satisfies the gate the way the cutover backfill does rather than
 * bypassing it: it writes its own account, that account's Clerk identity, and
 * the matching active access projection, and then asks for the cleanup. Those
 * three rows are the truthful phase-one shape of the account the seed is about
 * to fill, not a stub built to fool the check.
 */

const CLEANUP_TAG = '0021_known_sandman';
const CLERK_ISSUER = 'https://dev-seed.clerk.local';
const TERMINAL_ACCESS = 'granted';

type Database = typeof database;

export const migrateLocalDatabaseToHead = async (
    db: Database,
    account: { accountId: string; merchbaseUserId: string }
): Promise<void> => {
    await runMigrations();

    if (!(await hasLegacyIdentityTable(db))) {
        return;
    }

    await backfillPhaseOneAccount(db, account);
    await runMigrations({ throughTag: CLEANUP_TAG });
};

const hasLegacyIdentityTable = async (db: Database): Promise<boolean> => {
    const rows = await db.execute<{ present: boolean }>(
        sql`select to_regclass('public.clerk_identities') is not null as present`
    );

    return Boolean(rows[0]?.present);
};

/**
 * The phase-one shape of one mapped account: the account row, the Clerk
 * identity that owned it, and the active projection that replaces the identity.
 * Written with raw SQL because these legacy tables are already gone from
 * `schema.ts` — by the time the seed writes data they are gone from the
 * database too.
 */
const backfillPhaseOneAccount = async (
    db: Database,
    account: { accountId: string; merchbaseUserId: string }
): Promise<void> => {
    const subject = `user_${account.merchbaseUserId}`;
    const sourceUpdatedAt = Date.now();

    await db.transaction(async (tx) => {
        await tx.execute(sql`
            insert into accounts (id, merchbase_user_id)
            values (${account.accountId}, ${account.merchbaseUserId})
            on conflict (id) do update set merchbase_user_id = excluded.merchbase_user_id
        `);
        await tx.execute(sql`
            insert into clerk_identities (account_id, clerk_issuer, clerk_subject)
            values (${account.accountId}, ${CLERK_ISSUER}, ${subject})
            on conflict (clerk_issuer, clerk_subject) do update
                set account_id = excluded.account_id
        `);
        await tx.execute(sql`
            insert into access_projection (
                issuer, subject, state, merchbase_user_id, access, source_updated_at
            )
            values (
                ${CLERK_ISSUER}, ${subject}, 'active', ${account.merchbaseUserId},
                ${TERMINAL_ACCESS}, ${sourceUpdatedAt}
            )
            on conflict (issuer, subject) do update
                set state = 'active',
                    merchbase_user_id = excluded.merchbase_user_id,
                    access = excluded.access,
                    source_updated_at = excluded.source_updated_at
        `);
    });
};
