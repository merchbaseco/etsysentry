import { defineJob } from './job-router';
import {
    SYNC_LISTING_JOB_NAME,
    syncListingJobInputSchema
} from './sync-listing-shared';
import { syncTrackedListingFromEtsy } from '../services/listings/tracked-listings-service';
import {
    createListingSyncFailedEventLog,
    createListingSyncedEventLog
} from '../services/listings/create-listing-sync-event-log';
import {
    setTrackedListingsSyncStateByEtsyListingIds
} from '../services/listings/set-tracked-listing-sync-state';

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
            const syncedListing = await syncTrackedListingFromEtsy({
                clerkUserId: job.data.clerkUserId,
                etsyListingId: job.data.etsyListingId,
                accountId: job.data.accountId,
                trackerClerkUserId: job.data.clerkUserId
            });

            await createListingSyncedEventLog({
                accountId: syncedListing.accountId,
                clerkUserId: job.data.clerkUserId,
                etsyListingId: syncedListing.etsyListingId,
                etsyState: syncedListing.etsyState,
                listingId: syncedListing.listingId,
                monitorRunId: job.id,
                shopId: syncedListing.shopId,
                title: syncedListing.title
            });

            log('Synced listing from Etsy.', {
                etsyListingId: job.data.etsyListingId
            });
        } catch (error) {
            const failureMessage =
                error instanceof Error ? error.message : 'Unexpected listing sync error.';

            try {
                await createListingSyncFailedEventLog({
                    accountId: job.data.accountId,
                    clerkUserId: job.data.clerkUserId,
                    errorMessage: failureMessage,
                    etsyListingId: job.data.etsyListingId,
                    monitorRunId: job.id
                });
            } catch {
                // Preserve the original sync failure.
            }

            throw error;
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
