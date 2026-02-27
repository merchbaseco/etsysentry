import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';

export interface TrackedListingSyncTarget {
    etsyListingId: string;
    syncState: (typeof trackedListings.$inferSelect)['syncState'];
    trackedListingId: string;
    trackerClerkUserId: string;
    trackingState: (typeof trackedListings.$inferSelect)['trackingState'];
}

export const findTrackedListingSyncTargets = (params: {
    trackedListingIds?: string[];
    accountId: string;
}): Promise<TrackedListingSyncTarget[]> => {
    const uniqueTrackedListingIds = params.trackedListingIds
        ? Array.from(new Set(params.trackedListingIds))
        : null;

    if (uniqueTrackedListingIds && uniqueTrackedListingIds.length === 0) {
        return Promise.resolve([]);
    }

    const whereClause = uniqueTrackedListingIds
        ? and(
              eq(trackedListings.accountId, params.accountId),
              inArray(trackedListings.listingId, uniqueTrackedListingIds)
          )
        : eq(trackedListings.accountId, params.accountId);

    return db
        .select({
            trackedListingId: trackedListings.listingId,
            etsyListingId: trackedListings.etsyListingId,
            syncState: trackedListings.syncState,
            trackingState: trackedListings.trackingState,
            trackerClerkUserId: trackedListings.trackerClerkUserId,
        })
        .from(trackedListings)
        .where(whereClause);
};
