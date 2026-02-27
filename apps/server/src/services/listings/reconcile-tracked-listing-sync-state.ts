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
        })
        .from(trackedListings)
        .where(inArray(trackedListings.syncState, ['queued', 'syncing']));

    const listingRowsWithLiveJobs: typeof rows = [];
    const staleListingRows: typeof rows = [];

    for (const row of rows) {
        const jobs = await params.boss.findJobs<SyncListingJobInput>(SYNC_LISTING_JOB_NAME, {
            data: {
                accountId: row.accountId,
                etsyListingId: row.etsyListingId,
            },
        });

        if (hasLiveSyncListingJob(jobs)) {
            listingRowsWithLiveJobs.push(row);
            continue;
        }

        staleListingRows.push(row);
    }

    let fixedCount = 0;
    const staleListingIdsByAccountId = groupListingIdsByAccountId(staleListingRows);

    for (const [accountId, trackedListingIds] of staleListingIdsByAccountId.entries()) {
        fixedCount += await setTrackedListingsSyncStateByListingIds({
            accountId,
            syncState: 'idle',
            trackedListingIds,
        });
    }

    const checkedCount = rows.length;
    const liveCount = listingRowsWithLiveJobs.length;
    const summary =
        `checked ${checkedCount} queued/syncing tracked listings; ` +
        `kept ${liveCount} with live jobs; reset ${fixedCount} to idle`;

    return {
        checkedCount,
        fixedCount,
        liveCount,
        summary,
    };
};
