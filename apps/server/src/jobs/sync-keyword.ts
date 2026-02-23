import { defineJob } from './job-router';
import {
    SYNC_KEYWORD_JOB_NAME,
    syncKeywordJobInputSchema
} from './sync-keyword-shared';
import { syncRanksForKeyword } from '../services/keywords/keyword-rankings-service';
import { enqueueSyncListingJob } from '../services/listings/enqueue-sync-listing-job';

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
            tenantId: job.data.tenantId,
            trackedKeywordId: job.data.trackedKeywordId
        });

        for (const etsyListingId of syncResult.newlyDiscoveredEtsyListingIds) {
            await enqueueSyncListingJob({
                boss: context.boss,
                payload: {
                    clerkUserId: job.data.clerkUserId,
                    etsyListingId,
                    tenantId: job.data.tenantId
                }
            });
        }

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
