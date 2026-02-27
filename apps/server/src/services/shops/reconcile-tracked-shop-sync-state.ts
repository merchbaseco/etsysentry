import { inArray } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '../../db';
import { trackedShops } from '../../db/schema';
import { SYNC_SHOP_JOB_NAME, type SyncShopJobInput } from '../../jobs/sync-shop-shared';
import { setTrackedShopsSyncStateByTrackedShopIds } from './set-tracked-shop-sync-state';

const liveSyncShopJobStates = ['active', 'created', 'retry'] as const;

type SyncShopJobState = (typeof liveSyncShopJobStates)[number] | string;

const groupTrackedShopIdsByAccountId = (
    rows: Array<{
        accountId: string;
        trackedShopId: string;
    }>
): Map<string, string[]> => {
    const trackedShopIdsByAccountId = new Map<string, string[]>();

    for (const row of rows) {
        const accountTrackedShopIds = trackedShopIdsByAccountId.get(row.accountId) ?? [];
        accountTrackedShopIds.push(row.trackedShopId);
        trackedShopIdsByAccountId.set(row.accountId, accountTrackedShopIds);
    }

    return trackedShopIdsByAccountId;
};

export const isLiveSyncShopJobState = (state: SyncShopJobState): boolean => {
    return liveSyncShopJobStates.includes(state as (typeof liveSyncShopJobStates)[number]);
};

const hasLiveSyncShopJob = (jobs: Array<{ state: SyncShopJobState }>): boolean => {
    return jobs.some((job) => isLiveSyncShopJobState(job.state));
};

export interface ReconcileTrackedShopSyncStateResult {
    checkedCount: number;
    fixedCount: number;
    liveCount: number;
    summary: string;
}

export const reconcileTrackedShopSyncState = async (params: {
    boss: Pick<PgBoss, 'findJobs'>;
}): Promise<ReconcileTrackedShopSyncStateResult> => {
    const rows = await db
        .select({
            accountId: trackedShops.accountId,
            trackedShopId: trackedShops.trackedShopId,
        })
        .from(trackedShops)
        .where(inArray(trackedShops.syncState, ['queued', 'syncing']));

    const shopRowsWithLiveJobs: typeof rows = [];
    const staleShopRows: typeof rows = [];

    for (const row of rows) {
        const jobs = await params.boss.findJobs<SyncShopJobInput>(SYNC_SHOP_JOB_NAME, {
            data: {
                accountId: row.accountId,
                trackedShopId: row.trackedShopId,
            },
        });

        if (hasLiveSyncShopJob(jobs)) {
            shopRowsWithLiveJobs.push(row);
            continue;
        }

        staleShopRows.push(row);
    }

    let fixedCount = 0;
    const staleTrackedShopIdsByAccountId = groupTrackedShopIdsByAccountId(staleShopRows);

    for (const [accountId, trackedShopIds] of staleTrackedShopIdsByAccountId.entries()) {
        fixedCount += await setTrackedShopsSyncStateByTrackedShopIds({
            accountId,
            syncState: 'idle',
            trackedShopIds,
        });
    }

    const checkedCount = rows.length;
    const liveCount = shopRowsWithLiveJobs.length;
    const summary =
        `checked ${checkedCount} queued/syncing tracked shops; ` +
        `kept ${liveCount} with live jobs; reset ${fixedCount} to idle`;

    return {
        checkedCount,
        fixedCount,
        liveCount,
        summary,
    };
};
