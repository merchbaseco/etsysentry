import { evaluateAccountAccess } from '../services/access/job-access';
import { enqueueSyncListingJob } from '../services/listings/enqueue-sync-listing-job';
import { setTrackedListingsSyncStateByEtsyListingIds } from '../services/listings/set-tracked-listing-sync-state';
import { setTrackedShopSyncStateByTrackedShopId } from '../services/shops/set-tracked-shop-sync-state';
import { syncTrackedShop } from '../services/shops/sync-tracked-shop';
import { defineJob } from './job-router';
import { SYNC_SHOP_JOB_NAME, syncShopJobInputSchema } from './sync-shop-shared';

export const syncShopJob = defineJob(SYNC_SHOP_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by stale shop sync job',
})
    .input(syncShopJobInputSchema)
    .work(async (job, _signal, log, context) => {
        const access = await evaluateAccountAccess({
            accountId: job.data.accountId,
        });

        if (access.state !== 'allowed') {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: job.data.accountId,
                syncState: 'idle',
                trackedShopId: job.data.trackedShopId,
            });
            log('Skipped shop sync because Merchbase access is unavailable.', {
                accessState: access.state,
                trackedShopId: job.data.trackedShopId,
            });
            return {
                didWork: false,
                trackedShopId: job.data.trackedShopId,
            } as const;
        }

        await setTrackedShopSyncStateByTrackedShopId({
            accountId: job.data.accountId,
            syncState: 'syncing',
            trackedShopId: job.data.trackedShopId,
        });

        try {
            const syncResult = await syncTrackedShop({
                clerkUserId: job.data.clerkUserId,
                monitorRunId: job.id,
                accountId: job.data.accountId,
                trackedShopId: job.data.trackedShopId,
            });

            const enqueuedEtsyListingIds: string[] = [];

            for (const etsyListingId of syncResult.newlyDiscoveredEtsyListingIds) {
                const queuedJobId = await enqueueSyncListingJob({
                    boss: context.boss,
                    payload: {
                        clerkUserId: job.data.clerkUserId,
                        etsyListingId,
                        accountId: job.data.accountId,
                    },
                });

                if (queuedJobId) {
                    enqueuedEtsyListingIds.push(etsyListingId);
                }
            }

            await setTrackedListingsSyncStateByEtsyListingIds({
                accountId: job.data.accountId,
                etsyListingIds: enqueuedEtsyListingIds,
                syncState: 'queued',
            });

            log('Synced tracked shop.', {
                changedListingCount: syncResult.changedListingCount,
                discoveredListingsCount: syncResult.newlyDiscoveredEtsyListingIds.length,
                trackedShopId: job.data.trackedShopId,
            });

            return {
                didWork: true,
                changedListingCount: syncResult.changedListingCount,
                discoveredListingsCount: syncResult.newlyDiscoveredEtsyListingIds.length,
                trackedShopId: job.data.trackedShopId,
            } as const;
        } finally {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: job.data.accountId,
                syncState: 'idle',
                trackedShopId: job.data.trackedShopId,
            });
        }
    });
