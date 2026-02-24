import { enqueueListingSyncJob } from '../../jobs/sync-keyword-jobs';
import { findTrackedListingSyncTargets } from './find-tracked-listing-sync-targets';

export type ListingSyncSelection =
    | {
          mode: 'all';
      }
    | {
          mode: 'selected';
          trackedListingIds: string[];
      };

export type EnqueueTrackedListingSyncJobsResult = {
    enqueuedCount: number;
    skippedCount: number;
    totalCount: number;
};

export const enqueueTrackedListingSyncJobs = async (params: {
    selection: ListingSyncSelection;
    accountId: string;
}): Promise<EnqueueTrackedListingSyncJobsResult> => {
    const syncTargets = await findTrackedListingSyncTargets({
        accountId: params.accountId,
        trackedListingIds:
            params.selection.mode === 'selected' ? params.selection.trackedListingIds : undefined
    });

    let enqueuedCount = 0;

    for (const target of syncTargets) {
        const jobId = await enqueueListingSyncJob({
            clerkUserId: target.trackerClerkUserId,
            etsyListingId: target.etsyListingId,
            accountId: params.accountId
        });

        if (jobId) {
            enqueuedCount += 1;
        }
    }

    const totalCount = syncTargets.length;
    const skippedCount = totalCount - enqueuedCount;

    return {
        enqueuedCount,
        skippedCount,
        totalCount
    };
};
