import { and, asc, eq, lte, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import {
    SYNC_STALE_LISTINGS_BATCH_SIZE,
    syncListingJobInputSchema,
    type SyncListingJobInput
} from '../../jobs/sync-listing-shared';

const LISTING_STALE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const computeListingStaleBefore = (now: Date): Date => {
    return new Date(now.getTime() - LISTING_STALE_INTERVAL_MS);
};

export type StaleListingSyncTarget = SyncListingJobInput & {
    trackedListingId: string;
};

export const findStaleListings = async (params?: {
    now?: Date;
}): Promise<StaleListingSyncTarget[]> => {
    const now = params?.now ?? new Date();
    const staleBefore = computeListingStaleBefore(now);

    const rows = await db
        .select({
            trackedListingId: trackedListings.listingId,
            clerkUserId: trackedListings.trackerClerkUserId,
            etsyListingId: trackedListings.etsyListingId,
            accountId: trackedListings.accountId
        })
        .from(trackedListings)
        .where(
            and(
                or(eq(trackedListings.isDigital, true), ne(trackedListings.trackingState, 'paused')),
                eq(trackedListings.syncState, 'idle'),
                lte(trackedListings.lastRefreshedAt, staleBefore)
            )
        )
        .orderBy(asc(trackedListings.lastRefreshedAt))
        .limit(SYNC_STALE_LISTINGS_BATCH_SIZE);

    const items: StaleListingSyncTarget[] = [];

    for (const row of rows) {
        const parsedInput = syncListingJobInputSchema.safeParse(row);

        if (!parsedInput.success) {
            continue;
        }

        items.push({
            trackedListingId: row.trackedListingId,
            ...parsedInput.data
        });
    }

    return items;
};
