import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';

type TrackedListingTrackingState = (typeof trackedListings.$inferSelect)['trackingState'];

export type FailedTrackedListingTrackingState = Extract<
    TrackedListingTrackingState,
    'error' | 'fatal'
>;

export interface TrackedListingSyncFailureRecord {
    accountId: string;
    etsyListingId: string;
    listingId: string;
    shopId: string | null;
    trackingState: FailedTrackedListingTrackingState;
}

export const computeNextTrackedListingFailureState = (
    currentTrackingState: TrackedListingTrackingState
): FailedTrackedListingTrackingState => {
    if (currentTrackingState === 'error' || currentTrackingState === 'fatal') {
        return 'fatal';
    }

    return 'error';
};

const updateTrackedListingForSyncFailure = async (params: {
    currentTrackingState: TrackedListingTrackingState;
    failureMessage: string;
    listingId: string;
    now: Date;
}): Promise<TrackedListingSyncFailureRecord | null> => {
    const nextTrackingState = computeNextTrackedListingFailureState(params.currentTrackingState);
    const [updated] = await db
        .update(trackedListings)
        .set({
            lastRefreshError: params.failureMessage,
            lastRefreshedAt: params.now,
            syncState: 'idle',
            trackingState: nextTrackingState,
            updatedAt: params.now,
        })
        .where(eq(trackedListings.listingId, params.listingId))
        .returning({
            accountId: trackedListings.accountId,
            etsyListingId: trackedListings.etsyListingId,
            listingId: trackedListings.listingId,
            shopId: trackedListings.shopId,
            trackingState: trackedListings.trackingState,
        });

    return updated
        ? {
              ...updated,
              trackingState: updated.trackingState as FailedTrackedListingTrackingState,
          }
        : null;
};

export const markTrackedListingSyncFailureByListingId = async (params: {
    accountId: string;
    failureMessage: string;
    now?: Date;
    trackedListingId: string;
}): Promise<TrackedListingSyncFailureRecord | null> => {
    const [current] = await db
        .select({
            trackingState: trackedListings.trackingState,
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.listingId, params.trackedListingId)
            )
        )
        .limit(1);

    if (!current) {
        return null;
    }

    return updateTrackedListingForSyncFailure({
        currentTrackingState: current.trackingState,
        failureMessage: params.failureMessage,
        listingId: params.trackedListingId,
        now: params.now ?? new Date(),
    });
};

export const markTrackedListingSyncFailureByEtsyListingId = async (params: {
    accountId: string;
    etsyListingId: string;
    failureMessage: string;
    now?: Date;
}): Promise<TrackedListingSyncFailureRecord | null> => {
    const [current] = await db
        .select({
            listingId: trackedListings.listingId,
            trackingState: trackedListings.trackingState,
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.etsyListingId, params.etsyListingId)
            )
        )
        .limit(1);

    if (!current) {
        return null;
    }

    return updateTrackedListingForSyncFailure({
        currentTrackingState: current.trackingState,
        failureMessage: params.failureMessage,
        listingId: current.listingId,
        now: params.now ?? new Date(),
    });
};
