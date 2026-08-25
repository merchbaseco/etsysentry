import { closeDbConnection, db } from '../db';
import type { SeedDatabaseTarget } from './local-database-guard';
import { describeTarget } from './local-database-guard';
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
        // up itself rather than requiring a separate migrate step before it.
        await migrateLocalDatabaseToHead(db, {
            accountId: options.accountId,
            merchbaseUserId: options.merchbaseUserId,
        });

        const plan = buildDevSeedPlan(options);
        await writeDevSeedPlan(db, plan);

        return {
            accountId: plan.accountId,
            dayCount: options.dayCount,
            durationMs: Date.now() - startedAt,
            merchbaseUserId: options.merchbaseUserId,
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
