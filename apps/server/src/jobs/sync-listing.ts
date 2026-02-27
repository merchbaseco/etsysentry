import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { trackedListings } from '../db/schema';
import {
    createListingSyncedEventLog,
    createListingSyncFailedEventLog,
} from '../services/listings/create-listing-sync-event-log';
import { markTrackedListingSyncFailureByEtsyListingId } from '../services/listings/set-tracked-listing-sync-failure-state';
import { setTrackedListingsSyncStateByEtsyListingIds } from '../services/listings/set-tracked-listing-sync-state';
import { syncTrackedListingFromEtsy } from '../services/listings/tracked-listings-service';
import { defineJob } from './job-router';
import { SYNC_LISTING_JOB_NAME, syncListingJobInputSchema } from './sync-listing-shared';

export const syncListingJob = defineJob(SYNC_LISTING_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by keyword discovery',
})
    .input(syncListingJobInputSchema)
    .work(async (job, _signal, log) => {
        const [current] = await db
            .select({
                trackingState: trackedListings.trackingState,
            })
            .from(trackedListings)
            .where(
                and(
                    eq(trackedListings.accountId, job.data.accountId),
                    eq(trackedListings.etsyListingId, job.data.etsyListingId)
                )
            )
            .limit(1);

        if (current?.trackingState === 'fatal') {
            log('Skipped sync for fatal tracked listing.', {
                etsyListingId: job.data.etsyListingId,
            });

            return {
                didWork: false,
                etsyListingId: job.data.etsyListingId,
            } as const;
        }

        await setTrackedListingsSyncStateByEtsyListingIds({
            accountId: job.data.accountId,
            etsyListingIds: [job.data.etsyListingId],
            syncState: 'syncing',
        });

        try {
            const syncedListing = await syncTrackedListingFromEtsy({
                clerkUserId: job.data.clerkUserId,
                etsyListingId: job.data.etsyListingId,
                accountId: job.data.accountId,
                trackerClerkUserId: job.data.clerkUserId,
            });

            await createListingSyncedEventLog({
                accountId: syncedListing.accountId,
                clerkUserId: job.data.clerkUserId,
                etsyListingId: syncedListing.etsyListingId,
                etsyState: syncedListing.etsyState,
                listingId: syncedListing.listingId,
                monitorRunId: job.id,
                shopId: syncedListing.shopId,
                title: syncedListing.title,
            });

            log('Synced listing from Etsy.', {
                etsyListingId: job.data.etsyListingId,
            });
        } catch (error) {
            const failureMessage =
                error instanceof Error ? error.message : 'Unexpected listing sync error.';
            const failedListing = await markTrackedListingSyncFailureByEtsyListingId({
                accountId: job.data.accountId,
                etsyListingId: job.data.etsyListingId,
                failureMessage,
            });

            try {
                await createListingSyncFailedEventLog({
                    accountId: job.data.accountId,
                    clerkUserId: job.data.clerkUserId,
                    errorMessage: failureMessage,
                    etsyListingId: job.data.etsyListingId,
                    listingId: failedListing?.listingId ?? null,
                    monitorRunId: job.id,
                    shopId: failedListing?.shopId ?? null,
                });
            } catch {
                // Preserve the original sync failure.
            }

            throw error;
        } finally {
            await setTrackedListingsSyncStateByEtsyListingIds({
                accountId: job.data.accountId,
                etsyListingIds: [job.data.etsyListingId],
                syncState: 'idle',
            });
        }

        return {
            didWork: true,
            etsyListingId: job.data.etsyListingId,
        } as const;
    });
