import { createHash } from 'node:crypto';
import type { AccessProjectionStore } from '@merchbaseco/access';
import {
    assertDevCloudflareAccessTarget,
    createDevCloudflareAccess,
    DEV_CLOUDFLARE_ISSUER,
    DEV_SIGN_IN_MERCHBASE_USER_ID,
} from '@merchbaseco/access/dev';
import { eq, sql } from 'drizzle-orm';
import type { db as database } from '../db';
import { runMigrations } from '../db/migrate';
import { accounts } from '../db/schema';
import { ETSYSENTRY_SERVICE } from '../services/access/etsysentry-access';

const CLEANUP_TAG = '0021_known_sandman';
const LOCAL_LEGACY_ISSUER = 'https://etsysentry-local-cutover.invalid';
const LOCAL_LEGACY_SUBJECT = 'etsysentry-dev-seed';

type Database = typeof database;

export interface LocalDatabaseHeadParams {
    accountId: string;
    /** Credential-free DSN for the loopback target; proved by the access package. */
    databaseUrl: string;
    projections: AccessProjectionStore;
}

export interface LocalDatabaseHeadResult {
    issuer: string;
    merchbaseUserId: string;
    subject: string;
}

/**
 * Migrates a guarded local database to the current schema and seeds its one
 * fixed development principal through the same projection store as production.
 * The old cleanup migration remains readiness-gated; a fresh local database
 * gets only a temporary migration identity that is discarded with its legacy
 * columns by that existing migration.
 */
export const migrateLocalDatabaseToHead = async (
    db: Database,
    params: LocalDatabaseHeadParams
): Promise<LocalDatabaseHeadResult> => {
    const runtimeEnv = { ...process.env };
    assertDevCloudflareAccessTarget({ databaseUrl: params.databaseUrl, env: runtimeEnv });

    await runMigrations();

    const hasLegacyIdentities = await hasLegacyIdentityTable(db);
    if (hasLegacyIdentities) {
        await prepareLegacyCleanup(db, params);
        await runMigrations({ throughTag: CLEANUP_TAG });
    }

    await createDevCloudflareAccess({
        databaseUrl: params.databaseUrl,
        env: runtimeEnv,
        projections: params.projections,
        resolveServicePrincipal: async ({ merchbaseUserId }) => ({ merchbaseUserId }),
        service: ETSYSENTRY_SERVICE,
    });

    return {
        issuer: DEV_CLOUDFLARE_ISSUER,
        merchbaseUserId: DEV_SIGN_IN_MERCHBASE_USER_ID,
        subject: 'person:development',
    };
};

const prepareLegacyCleanup = async (
    db: Database,
    params: LocalDatabaseHeadParams
): Promise<void> => {
    const [counts] = await db.execute<{
        accountCount: number;
        apiKeyCount: number;
        identityCount: number;
    }>(sql`
        SELECT
            (SELECT count(*)::int FROM accounts) AS "accountCount",
            (SELECT count(*)::int FROM clerk_identities) AS "identityCount",
            (SELECT count(*)::int FROM api_keys) AS "apiKeyCount"
    `);
    if (!counts) {
        throw new Error('Could not inspect the local legacy access data.');
    }
    if (counts.accountCount > 1 || counts.identityCount > 1 || counts.apiKeyCount > 0) {
        throw new Error(
            'The local database still has legacy access data. Complete its explicit access cutover before running the dev seed.'
        );
    }

    const [existingAccount] = await db
        .select({ merchbaseUserId: accounts.merchbaseUserId })
        .from(accounts)
        .where(eq(accounts.id, params.accountId))
        .limit(1);
    if (existingAccount && existingAccount.merchbaseUserId !== DEV_SIGN_IN_MERCHBASE_USER_ID) {
        throw new Error('The existing local seed account belongs to a different Merchbase user.');
    }

    const [anotherAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.merchbaseUserId, DEV_SIGN_IN_MERCHBASE_USER_ID))
        .limit(1);
    if (anotherAccount && anotherAccount.id !== params.accountId) {
        throw new Error('The development Merchbase user already belongs to another local account.');
    }

    if (!existingAccount) {
        await db.insert(accounts).values({
            id: params.accountId,
            merchbaseUserId: DEV_SIGN_IN_MERCHBASE_USER_ID,
        });
    }

    const legacyRows = await db.execute<{ issuer: string; subject: string }>(sql`
        SELECT clerk_issuer AS issuer, clerk_subject AS subject
        FROM clerk_identities
        WHERE account_id = ${params.accountId}
        ORDER BY clerk_issuer, clerk_subject
        LIMIT 2
    `);
    let identity = legacyRows[0];
    if (!identity) {
        if (counts.identityCount !== 0) {
            throw new Error('The local development account has no matching legacy identity.');
        }
        identity = { issuer: LOCAL_LEGACY_ISSUER, subject: LOCAL_LEGACY_SUBJECT };
        await db.execute(sql`
            INSERT INTO clerk_identities (account_id, clerk_issuer, clerk_subject)
            VALUES (${params.accountId}, ${identity.issuer}, ${identity.subject})
        `);
    }
    if (legacyRows.length > 1) {
        throw new Error('The local development account has multiple legacy identities.');
    }

    const eventId = `etsysentry-local-${createHash('sha256')
        .update(`${identity.issuer}\0${identity.subject}`)
        .digest('hex')
        .slice(0, 32)}`;
    await params.projections.apply({
        eventId,
        projection: {
            access: 'granted',
            accessValidUntil: null,
            issuer: identity.issuer,
            merchbaseUserId: DEV_SIGN_IN_MERCHBASE_USER_ID,
            sourceUpdatedAt: Date.now(),
            subject: identity.subject,
        },
        type: 'upsert',
    });
};

const hasLegacyIdentityTable = async (db: Database): Promise<boolean> => {
    const rows = await db.execute<{ present: boolean }>(
        sql`select to_regclass('public.clerk_identities') is not null as present`
    );

    return Boolean(rows[0]?.present);
};
