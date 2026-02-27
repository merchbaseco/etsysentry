import { and, asc, desc, eq, inArray, lte, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots, trackedListings } from '../../db/schema';
import {
    SYNC_STALE_LISTINGS_BATCH_SIZE,
    type SyncListingJobInput,
    syncListingJobInputSchema,
} from '../../jobs/sync-listing-shared';
import {
    computeListingRefreshStaleBefore,
    resolveListingRefreshCadenceTierFromSnapshots
} from './listing-refresh-cadence';

export const computeListingStaleBefore = (now: Date): Date => {
    return computeListingRefreshStaleBefore({
        cadenceTier: '1d',
        now
    });
};

export type StaleListingSyncTarget = SyncListingJobInput & {
    trackedListingId: string;
};

const STALE_LISTING_CANDIDATE_POOL_MULTIPLIER = 5;
const MOMENTUM_SNAPSHOT_HISTORY_LIMIT = 8;

export const findStaleListings = async (params?: {
    now?: Date;
}): Promise<StaleListingSyncTarget[]> => {
    const now = params?.now ?? new Date();
    const staleBeforeDaily = computeListingRefreshStaleBefore({
        cadenceTier: '1d',
        now
    });

    const candidateRows = await db
        .select({
            trackedListingId: trackedListings.listingId,
            clerkUserId: trackedListings.trackerClerkUserId,
            etsyListingId: trackedListings.etsyListingId,
            accountId: trackedListings.accountId,
            lastRefreshedAt: trackedListings.lastRefreshedAt
        })
        .from(trackedListings)
        .where(
            and(
                ne(trackedListings.trackingState, 'fatal'),
                or(
                    eq(trackedListings.isDigital, true),
                    ne(trackedListings.trackingState, 'paused')
                ),
                eq(trackedListings.syncState, 'idle'),
                lte(trackedListings.lastRefreshedAt, staleBeforeDaily)
            )
        )
        .orderBy(asc(trackedListings.lastRefreshedAt))
        .limit(SYNC_STALE_LISTINGS_BATCH_SIZE * STALE_LISTING_CANDIDATE_POOL_MULTIPLIER);

    if (candidateRows.length === 0) {
        return [];
    }

    const snapshotRows = await db
        .select({
            listingId: listingMetricSnapshots.listingId,
            observedAt: listingMetricSnapshots.observedAt,
            views: listingMetricSnapshots.views,
            favorerCount: listingMetricSnapshots.favorerCount,
            quantity: listingMetricSnapshots.quantity
        })
        .from(listingMetricSnapshots)
        .where(
            inArray(
                listingMetricSnapshots.listingId,
                candidateRows.map((row) => row.trackedListingId)
            )
        )
        .orderBy(asc(listingMetricSnapshots.listingId), desc(listingMetricSnapshots.observedAt));

    const recentSnapshotsByListingId = new Map<
        string,
        Array<{
            observedAt: Date;
            favorerCount: number | null;
            quantity: number | null;
            views: number | null;
        }>
    >();

    for (const snapshotRow of snapshotRows) {
        const currentRows = recentSnapshotsByListingId.get(snapshotRow.listingId) ?? [];

        if (currentRows.length >= MOMENTUM_SNAPSHOT_HISTORY_LIMIT) {
            continue;
        }

        currentRows.push({
            observedAt: snapshotRow.observedAt,
            favorerCount: snapshotRow.favorerCount,
            quantity: snapshotRow.quantity,
            views: snapshotRow.views
        });
        recentSnapshotsByListingId.set(snapshotRow.listingId, currentRows);
    }

    const items: StaleListingSyncTarget[] = [];

    for (const row of candidateRows) {
        const recentSnapshots = recentSnapshotsByListingId.get(row.trackedListingId) ?? [];
        const cadenceTier = resolveListingRefreshCadenceTierFromSnapshots({
            now,
            snapshots: recentSnapshots
        });
        const staleBeforeForTier = computeListingRefreshStaleBefore({
            cadenceTier,
            now
        });

        if (row.lastRefreshedAt > staleBeforeForTier) {
            continue;
        }

        const parsedInput = syncListingJobInputSchema.safeParse(row);

        if (!parsedInput.success) {
            continue;
        }

        items.push({
            trackedListingId: row.trackedListingId,
            ...parsedInput.data,
        });

        if (items.length >= SYNC_STALE_LISTINGS_BATCH_SIZE) {
            break;
        }
    }

    return items;
};
