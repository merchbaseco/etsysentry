import { defineJob } from './job-router';
import {
    SYNC_KEYWORD_JOB_NAME,
    syncKeywordJobInputSchema
} from './sync-keyword-shared';
import { syncRanksForKeyword } from '../services/keywords/keyword-rankings-service';
import { enqueueSyncListingJob } from '../services/listings/enqueue-sync-listing-job';
import { setTrackedListingsSyncStateByEtsyListingIds } from '../services/listings/set-tracked-listing-sync-state';

export const syncKeywordJob = defineJob(SYNC_KEYWORD_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by stale keyword sync job'
})
    .input(syncKeywordJobInputSchema)
    .work(async (job, signal, log, context) => {
        void signal;

        const syncResult = await syncRanksForKeyword({
            clerkUserId: job.data.clerkUserId,
            monitorRunId: job.id,
            accountId: job.data.accountId,
            trackedKeywordId: job.data.trackedKeywordId
        });

        const enqueuedEtsyListingIds: string[] = [];

        for (const etsyListingId of syncResult.newlyDiscoveredEtsyListingIds) {
            const queuedJobId = await enqueueSyncListingJob({
                boss: context.boss,
                payload: {
                    clerkUserId: job.data.clerkUserId,
                    etsyListingId,
                    accountId: job.data.accountId
                }
            });

            if (queuedJobId) {
                enqueuedEtsyListingIds.push(etsyListingId);
            }
        }

        await setTrackedListingsSyncStateByEtsyListingIds({
            accountId: job.data.accountId,
            etsyListingIds: enqueuedEtsyListingIds,
            syncState: 'queued'
        });

        log('Synced keyword ranks.', {
            discoveredListingsCount: syncResult.newlyDiscoveredEtsyListingIds.length,
            trackedKeywordId: job.data.trackedKeywordId
        });

        return {
            didWork: true,
            discoveredListingsCount: syncResult.newlyDiscoveredEtsyListingIds.length,
            trackedKeywordId: job.data.trackedKeywordId
        } as const;
    });
