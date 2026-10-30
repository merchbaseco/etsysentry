import { DEV_ACCESS_AUTHORITY_ORIGIN } from '@merchbaseco/access/dev';
import { closeDbConnection, db } from '../db';
import { createAccessProjectionStore } from '../services/access/access-projection-store';
import type { SeedDatabaseTarget } from './local-database-guard';
import { describeTarget, toDatabaseUrl } from './local-database-guard';
import { migrateLocalDatabaseToHead } from './migrate-to-head';
import { buildDevSeedPlan, countPlanRows } from './plan';
import type { DevSeedOptions } from './types';
import { writeDevSeedPlan } from './write-plan';

/**
 * The seed's actual work, kept apart from the entry script so the entry can run
 * the loopback guard before anything that reaches the database or the parsed
 * environment is even imported.
 */

export interface SeedRunSummary {
    accessIssuer: string;
    accessSubject: string;
    accountId: string;
    dayCount: number;
    durationMs: number;
    merchbaseUserId: string;
    rows: Record<string, number>;
    seed: string;
    target: string;
    through: string;
    totalRows: number;
}

export const runSeed = async (params: {
    options: DevSeedOptions;
    target: SeedDatabaseTarget;
}): Promise<SeedRunSummary> => {
    const { options } = params;
    const startedAt = Date.now();

    try {
        // A fresh cloud VM has an empty database, so the seed brings the schema
        // up itself rather than requiring a separate migrate step before it —
        // and grants the shared Dev Sign-In user access to the result, because
        // nothing else in a cloud session ever writes an Access Projection.
        const access = await migrateLocalDatabaseToHead(db, {
            accountId: options.accountId,
            databaseUrl: toDatabaseUrl(params.target),
            projections: createAccessProjectionStore(db, DEV_ACCESS_AUTHORITY_ORIGIN),
        });

        // Ownership comes from the projection that was actually stored, not
        // from a second copy of the same constant, so the seeded account and
        // the signed-in user cannot drift apart.
        const plan = buildDevSeedPlan({ ...options, merchbaseUserId: access.merchbaseUserId });
        await writeDevSeedPlan(db, plan);

        return {
            accountId: plan.accountId,
            accessIssuer: access.issuer,
            accessSubject: access.subject,
            dayCount: options.dayCount,
            durationMs: Date.now() - startedAt,
            merchbaseUserId: access.merchbaseUserId,
            rows: plan.summary,
            seed: options.seed,
            target: describeTarget(params.target),
            through: options.now.toISOString().slice(0, 10),
            totalRows: countPlanRows(plan),
        };
    } finally {
        await closeDbConnection();
    }
};
