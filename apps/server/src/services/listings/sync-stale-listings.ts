import type { PgBoss } from 'pg-boss';
import { enqueueSyncListingJob } from './enqueue-sync-listing-job';
import { findStaleListings } from './find-stale-listings';
import { setTrackedListingsSyncStateByListingIds } from './set-tracked-listing-sync-state';

export const syncStaleListings = async (params: {
    boss: Pick<PgBoss, 'send'>;
}): Promise<number> => {
    const staleListings = await findStaleListings();
    let queuedCount = 0;
    const queuedListingIdsByAccountId = new Map<string, string[]>();

    for (const staleListing of staleListings) {
        const jobId = await enqueueSyncListingJob({
            boss: params.boss,
            payload: {
                clerkUserId: staleListing.clerkUserId,
                etsyListingId: staleListing.etsyListingId,
                accountId: staleListing.accountId,
            },
        });

        if (jobId) {
            queuedCount += 1;
            const accountListingIds = queuedListingIdsByAccountId.get(staleListing.accountId) ?? [];
            accountListingIds.push(staleListing.trackedListingId);
            queuedListingIdsByAccountId.set(staleListing.accountId, accountListingIds);
        }
    }

    for (const [accountId, trackedListingIds] of queuedListingIdsByAccountId.entries()) {
        await setTrackedListingsSyncStateByListingIds({
            accountId,
            trackedListingIds,
            syncState: 'queued',
        });
    }

    return queuedCount;
};
