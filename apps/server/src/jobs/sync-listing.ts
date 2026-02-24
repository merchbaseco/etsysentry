import { defineJob } from './job-router';
import {
    SYNC_LISTING_JOB_NAME,
    syncListingJobInputSchema
} from './sync-listing-shared';
import { syncTrackedListingFromEtsy } from '../services/listings/tracked-listings-service';
import { setTrackedListingsSyncStateByEtsyListingIds } from '../services/listings/set-tracked-listing-sync-state';

export const syncListingJob = defineJob(SYNC_LISTING_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by keyword discovery'
})
    .input(syncListingJobInputSchema)
    .work(async (job, signal, log) => {
        void signal;

        await setTrackedListingsSyncStateByEtsyListingIds({
            accountId: job.data.accountId,
            etsyListingIds: [job.data.etsyListingId],
            syncState: 'syncing'
        });

        try {
            await syncTrackedListingFromEtsy({
                clerkUserId: job.data.clerkUserId,
                etsyListingId: job.data.etsyListingId,
                accountId: job.data.accountId,
                trackerClerkUserId: job.data.clerkUserId
            });

            log('Synced listing from Etsy.', {
                etsyListingId: job.data.etsyListingId
            });
        } finally {
            await setTrackedListingsSyncStateByEtsyListingIds({
                accountId: job.data.accountId,
                etsyListingIds: [job.data.etsyListingId],
                syncState: 'idle'
            });
        }

        return {
            didWork: true,
            etsyListingId: job.data.etsyListingId
        } as const;
    });
