import { defineJob } from './job-router';
import {
    SYNC_LISTING_JOB_NAME,
    syncListingJobInputSchema
} from './sync-listing-shared';
import { syncTrackedListingFromEtsy } from '../services/listings/tracked-listings-service';

export const syncListingJob = defineJob(SYNC_LISTING_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by keyword discovery'
})
    .input(syncListingJobInputSchema)
    .work(async (job, signal, log) => {
        void signal;

        await syncTrackedListingFromEtsy({
            clerkUserId: job.data.clerkUserId,
            etsyListingId: job.data.etsyListingId,
            tenantId: job.data.tenantId,
            trackerClerkUserId: job.data.clerkUserId
        });

        log('Synced listing from Etsy.', {
            etsyListingId: job.data.etsyListingId
        });

        return {
            didWork: true,
            etsyListingId: job.data.etsyListingId
        } as const;
    });
