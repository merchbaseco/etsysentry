import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TERMINAL_PROJECTION_TIMESTAMP } from '@merchbaseco/access';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env';
import {
    assertPhaseTwoReadiness,
    type PhaseTwoReadiness,
} from './central-access-migration-readiness';

interface MigrationJournalEntry {
    breakpoints: boolean;
    idx: number;
    tag: string;
    version: string;
    when: number;
}

interface MigrationJournal {
    dialect: string;
    entries: MigrationJournalEntry[];
    version: string;
}

const CENTRAL_ACCESS_CLEANUP_TAG = '0021_known_sandman';
const CENTRAL_ACCESS_PHASE_ONE_TAG = '0020_early_agent_zero';

const isMissingMigrationTableError = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01';

const readMigrationHash = async (tag: string): Promise<string> => {
    const migration = await readFile(path.resolve('./drizzle', `${tag}.sql`));
    return createHash('sha256').update(migration).digest('hex');
};

const hasAppliedMigration = async (
    migrationClient: ReturnType<typeof postgres>,
    migrationHash: string
): Promise<boolean> => {
    try {
        const rows = await migrationClient<{ hash: string }[]>`
            SELECT hash
            FROM "drizzle"."__drizzle_migrations"
            WHERE hash = ${migrationHash}
            LIMIT 1
        `;

        return rows.length > 0;
    } catch (error) {
        if (isMissingMigrationTableError(error)) {
            return false;
        }

        throw error;
    }
};

const assertPhaseTwoReady = async (migrationClient: ReturnType<typeof postgres>): Promise<void> => {
    if (
        !(await hasAppliedMigration(
            migrationClient,
            await readMigrationHash(CENTRAL_ACCESS_PHASE_ONE_TAG)
        ))
    ) {
        throw new Error('Central access phase two requires the phase-one migration to be applied.');
    }

    try {
        const [readiness] = await migrationClient<PhaseTwoReadiness[]>`
            SELECT
                (
                    SELECT count(*)::int
                    FROM accounts
                    WHERE merchbase_user_id IS NOT NULL
                ) AS "mappedAccountCount",
                (
                    SELECT count(*)::int
                    FROM accounts
                    WHERE merchbase_user_id IS NULL
                ) AS "unmappedAccountCount",
                (
                    SELECT count(*)::int
                    FROM accounts AS account
                    WHERE (
                        SELECT count(*)
                        FROM clerk_identities AS legacy_identity
                        INNER JOIN access_projection AS projection
                            ON projection.issuer = legacy_identity.clerk_issuer
                            AND projection.subject = legacy_identity.clerk_subject
                        WHERE legacy_identity.account_id = account.id
                          AND projection.state = 'active'
                          AND projection.merchbase_user_id = account.merchbase_user_id
                    ) <> 1
                ) AS "accountWithInvalidActiveProjectionCount",
                (
                    SELECT count(*)::int
                    FROM clerk_identities AS legacy_identity
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM access_projection AS projection
                        WHERE projection.issuer = legacy_identity.clerk_issuer
                          AND projection.subject = legacy_identity.clerk_subject
                    )
                ) AS "unprojectedIdentityCount",
                (
                    SELECT count(*)::int
                    FROM clerk_identities AS legacy_identity
                    INNER JOIN accounts AS account
                        ON account.id = legacy_identity.account_id
                    INNER JOIN access_projection AS projection
                        ON projection.issuer = legacy_identity.clerk_issuer
                        AND projection.subject = legacy_identity.clerk_subject
                    WHERE NOT (
                        (
                            projection.state = 'active'
                            AND projection.merchbase_user_id = account.merchbase_user_id
                            AND projection.access IS NOT NULL
                        )
                        OR (
                            projection.state = 'tombstone'
                            AND projection.merchbase_user_id IS NULL
                            AND projection.access IS NULL
                            AND projection.access_valid_until IS NULL
                            AND projection.source_updated_at =
                                ${TERMINAL_PROJECTION_TIMESTAMP}
                        )
                    )
                ) AS "invalidLegacyProjectionCount",
                (
                    SELECT count(*)::int
                    FROM (
                        SELECT account_id FROM tracked_keywords
                        UNION ALL
                        SELECT account_id FROM tracked_listings
                        UNION ALL
                        SELECT account_id FROM etsy_api_call_events
                    ) AS ownership_reference
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM accounts
                        WHERE accounts.id = ownership_reference.account_id
                    )
                ) AS "orphanOwnershipReferenceCount",
                (
                    SELECT count(*)::int
                    FROM (
                        SELECT account_id, tracker_clerk_user_id AS subject
                        FROM tracked_keywords
                        UNION ALL
                        SELECT account_id, tracker_clerk_user_id AS subject
                        FROM tracked_listings
                        UNION ALL
                        SELECT account_id, clerk_user_id AS subject
                        FROM etsy_api_call_events
                        WHERE clerk_user_id <> 'system'
                    ) AS legacy_reference
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM clerk_identities AS legacy_identity
                        WHERE legacy_identity.account_id = legacy_reference.account_id
                          AND legacy_identity.clerk_subject = legacy_reference.subject
                    )
                ) AS "unmatchedIdentityReferenceCount"
        `;

        if (!readiness) {
            throw new Error('Central access phase-two readiness query returned no result.');
        }

        assertPhaseTwoReadiness(readiness);
    } catch (error) {
        if (isMissingMigrationTableError(error)) {
            throw new Error('Central access phase two requires the phase-one schema.');
        }

        throw error;
    }
};

const createMigrationFolderThrough = async (throughTag: string): Promise<string> => {
    const sourceFolder = path.resolve('./drizzle');
    const journalPath = path.join(sourceFolder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as MigrationJournal;
    const throughIndex = journal.entries.findIndex((entry) => entry.tag === throughTag);

    if (throughIndex < 0) {
        throw new Error(`Migration tag not found: ${throughTag}`);
    }

    const temporaryFolder = await mkdtemp(path.join(os.tmpdir(), 'etsysentry-migrations-'));
    const temporaryMetaFolder = path.join(temporaryFolder, 'meta');
    const entries = journal.entries.slice(0, throughIndex + 1);

    try {
        await mkdir(temporaryMetaFolder, { recursive: true });
        await writeFile(
            path.join(temporaryMetaFolder, '_journal.json'),
            `${JSON.stringify({ ...journal, entries }, null, 2)}\n`,
            'utf8'
        );
        await Promise.all(
            entries.map((entry) =>
                copyFile(
                    path.join(sourceFolder, `${entry.tag}.sql`),
                    path.join(temporaryFolder, `${entry.tag}.sql`)
                )
            )
        );
    } catch (error) {
        await rm(temporaryFolder, { force: true, recursive: true });
        throw error;
    }

    return temporaryFolder;
};

export const runMigrations = async (options?: { throughTag?: string }): Promise<void> => {
    const migrationClient = postgres({
        database: env.databaseName,
        host: env.databaseHost,
        max: 1,
        password: env.databasePassword,
        port: env.databasePort,
        user: env.databaseUser,
    });

    let migrationFolder: string | undefined;

    try {
        const migrationDb = drizzle(migrationClient);
        if (options?.throughTag) {
            const cleanupApplied = await hasAppliedMigration(
                migrationClient,
                await readMigrationHash(CENTRAL_ACCESS_CLEANUP_TAG)
            );

            if (options.throughTag === CENTRAL_ACCESS_CLEANUP_TAG && !cleanupApplied) {
                await assertPhaseTwoReady(migrationClient);
            }

            migrationFolder = await createMigrationFolderThrough(options.throughTag);
        } else {
            const cleanupApplied = await hasAppliedMigration(
                migrationClient,
                await readMigrationHash(CENTRAL_ACCESS_CLEANUP_TAG)
            );

            migrationFolder = cleanupApplied
                ? undefined
                : await createMigrationFolderThrough(CENTRAL_ACCESS_PHASE_ONE_TAG);
        }

        await migrate(migrationDb, {
            migrationsFolder: migrationFolder ?? './drizzle',
            migrationsSchema: 'drizzle',
            migrationsTable: '__drizzle_migrations',
        });
    } finally {
        if (migrationFolder) {
            await rm(migrationFolder, { force: true, recursive: true });
        }

        await migrationClient.end();
    }
};
