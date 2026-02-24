import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';

export type TrackedListingSyncTarget = {
    trackedListingId: string;
    etsyListingId: string;
    trackerClerkUserId: string;
};

export const findTrackedListingSyncTargets = async (params: {
    trackedListingIds?: string[];
    tenantId: string;
}): Promise<TrackedListingSyncTarget[]> => {
    const uniqueTrackedListingIds = params.trackedListingIds
        ? Array.from(new Set(params.trackedListingIds))
        : null;

    if (uniqueTrackedListingIds && uniqueTrackedListingIds.length === 0) {
        return [];
    }

    const whereClause = uniqueTrackedListingIds
        ? and(
              eq(trackedListings.tenantId, params.tenantId),
              inArray(trackedListings.listingId, uniqueTrackedListingIds)
          )
        : eq(trackedListings.tenantId, params.tenantId);

    return db
        .select({
            trackedListingId: trackedListings.listingId,
            etsyListingId: trackedListings.etsyListingId,
            trackerClerkUserId: trackedListings.trackerClerkUserId
        })
        .from(trackedListings)
        .where(whereClause);
};
