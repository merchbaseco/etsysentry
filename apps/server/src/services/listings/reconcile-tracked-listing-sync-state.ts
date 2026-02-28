import { inArray } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import { SYNC_LISTING_JOB_NAME, type SyncListingJobInput } from '../../jobs/sync-listing-shared';
import { setTrackedListingsSyncStateByListingIds } from './set-tracked-listing-sync-state';

const liveSyncListingJobStates = ['active', 'created', 'retry'] as const;

type SyncListingJobState = (typeof liveSyncListingJobStates)[number] | string;

const groupListingIdsByAccountId = (
    rows: Array<{
        accountId: string;
        listingId: string;
    }>
): Map<string, string[]> => {
    const listingIdsByAccountId = new Map<string, string[]>();

    for (const row of rows) {
        const accountListingIds = listingIdsByAccountId.get(row.accountId) ?? [];
        accountListingIds.push(row.listingId);
        listingIdsByAccountId.set(row.accountId, accountListingIds);
    }

    return listingIdsByAccountId;
};

export const isLiveSyncListingJobState = (state: SyncListingJobState): boolean => {
    return liveSyncListingJobStates.includes(state as (typeof liveSyncListingJobStates)[number]);
};

const hasLiveSyncListingJob = (jobs: Array<{ state: SyncListingJobState }>): boolean => {
    return jobs.some((job) => isLiveSyncListingJobState(job.state));
};

export interface ReconcileTrackedListingSyncStateResult {
    checkedCount: number;
    fixedCount: number;
    liveCount: number;
    summary: string;
}

export const reconcileTrackedListingSyncState = async (params: {
    boss: Pick<PgBoss, 'findJobs'>;
}): Promise<ReconcileTrackedListingSyncStateResult> => {
    const rows = await db
        .select({
            accountId: trackedListings.accountId,
            etsyListingId: trackedListings.etsyListingId,
            listingId: trackedListings.listingId,
            syncState: trackedListings.syncState,
        })
        .from(trackedListings)
        .where(inArray(trackedListings.syncState, ['queued', 'syncing']));

    const syncingListingRowsWithLiveJobs: typeof rows = [];
    const queuedListingRowsWithLiveJobs: typeof rows = [];
    const staleListingRows: typeof rows = [];

    for (const row of rows) {
        const jobs = await params.boss.findJobs<SyncListingJobInput>(SYNC_LISTING_JOB_NAME, {
            data: {
                accountId: row.accountId,
                etsyListingId: row.etsyListingId,
            },
        });

        if (hasLiveSyncListingJob(jobs)) {
            if (row.syncState === 'syncing') {
                syncingListingRowsWithLiveJobs.push(row);
            } else {
                queuedListingRowsWithLiveJobs.push(row);
            }
            continue;
        }

        staleListingRows.push(row);
    }

    let queuedCount = 0;
    const syncingListingIdsByAccountId = groupListingIdsByAccountId(syncingListingRowsWithLiveJobs);

    for (const [accountId, trackedListingIds] of syncingListingIdsByAccountId.entries()) {
        queuedCount += await setTrackedListingsSyncStateByListingIds({
            accountId,
            syncState: 'queued',
            trackedListingIds,
        });
    }

    let resetCount = 0;
    const staleListingIdsByAccountId = groupListingIdsByAccountId(staleListingRows);

    for (const [accountId, trackedListingIds] of staleListingIdsByAccountId.entries()) {
        resetCount += await setTrackedListingsSyncStateByListingIds({
            accountId,
            syncState: 'idle',
            trackedListingIds,
        });
    }

    const fixedCount = queuedCount + resetCount;
    const checkedCount = rows.length;
    const liveCount = syncingListingRowsWithLiveJobs.length + queuedListingRowsWithLiveJobs.length;
    const summary =
        `checked ${checkedCount} queued/syncing tracked listings; ` +
        `kept ${queuedListingRowsWithLiveJobs.length} queued with live jobs; ` +
        `moved ${queuedCount} syncing to queued; reset ${resetCount} to idle`;

    return {
        checkedCount,
        fixedCount,
        liveCount,
        summary,
    };
};
