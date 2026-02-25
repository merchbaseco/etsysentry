import { enqueueListingSyncJob } from '../../jobs/sync-keyword-jobs';
import { findTrackedListingSyncTargets } from './find-tracked-listing-sync-targets';
import { isTrackedListingSyncEnqueueEligible } from './is-tracked-listing-sync-enqueue-eligible';
import { setTrackedListingsSyncStateByListingIds } from './set-tracked-listing-sync-state';

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
    const queuedTrackedListingIds: string[] = [];

    for (const target of syncTargets) {
        if (!isTrackedListingSyncEnqueueEligible(target)) {
            continue;
        }

        const jobId = await enqueueListingSyncJob({
            clerkUserId: target.trackerClerkUserId,
            etsyListingId: target.etsyListingId,
            accountId: params.accountId
        });

        if (jobId) {
            enqueuedCount += 1;
            queuedTrackedListingIds.push(target.trackedListingId);
        }
    }

    await setTrackedListingsSyncStateByListingIds({
        accountId: params.accountId,
        syncState: 'queued',
        trackedListingIds: queuedTrackedListingIds
    });

    const totalCount = syncTargets.length;
    const skippedCount = totalCount - enqueuedCount;

    return {
        enqueuedCount,
        skippedCount,
        totalCount
    };
};
