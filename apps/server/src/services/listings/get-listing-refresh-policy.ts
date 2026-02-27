import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots, trackedListings } from '../../db/schema';
import {
    LISTING_REFRESH_POLICY_LABEL_BY_TIER,
    resolveListingRefreshCadenceTierFromSnapshots,
} from './listing-refresh-cadence';

const listingRefreshPolicyBuckets = [
    {
        id: 'daily_signal',
        bucket: 'Active (favorites or purchases in last 5 days)',
        cadence: '1d',
        policy: LISTING_REFRESH_POLICY_LABEL_BY_TIER['1d'],
    },
    {
        id: 'cooldown_3d',
        bucket: 'Cooling (no activity in 5 days)',
        cadence: '3d',
        policy: LISTING_REFRESH_POLICY_LABEL_BY_TIER['3d'],
    },
    {
        id: 'cooldown_7d',
        bucket: 'Quiet (no activity in 14 days)',
        cadence: '7d',
        policy: LISTING_REFRESH_POLICY_LABEL_BY_TIER['7d'],
    },
] as const;
const MOMENTUM_SNAPSHOT_HISTORY_LIMIT = 8;

export interface ListingRefreshPolicyBucket {
    bucket: string;
    bucketId: (typeof listingRefreshPolicyBuckets)[number]['id'];
    cadence: (typeof listingRefreshPolicyBuckets)[number]['cadence'];
    count: number;
    policy: string;
}

export interface ListingRefreshPolicySummary {
    autoEnqueueCount: number;
    buckets: ListingRefreshPolicyBucket[];
    queuedCount: number;
}

export const getListingRefreshPolicySummary = async (params: {
    accountId: string;
    now?: Date;
}): Promise<ListingRefreshPolicySummary> => {
    const now = params.now ?? new Date();

    const [queuedRow] = await db
        .select({
            queuedCount: sql<number>`
                count(*) filter (where ${trackedListings.syncState} = 'queued')::int
            `,
        })
        .from(trackedListings)
        .where(eq(trackedListings.accountId, params.accountId));

    const autoEligibleRows = await db
        .select({
            listingId: trackedListings.listingId,
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                ne(trackedListings.trackingState, 'fatal'),
                or(eq(trackedListings.isDigital, true), ne(trackedListings.trackingState, 'paused'))
            )
        );

    if (autoEligibleRows.length === 0) {
        return {
            autoEnqueueCount: 0,
            buckets: listingRefreshPolicyBuckets.map((bucket) => ({
                bucket: bucket.bucket,
                bucketId: bucket.id,
                cadence: bucket.cadence,
                count: 0,
                policy: bucket.policy,
            })),
            queuedCount: queuedRow?.queuedCount ?? 0,
        };
    }

    const autoEligibleListingIds = autoEligibleRows.map((row) => row.listingId);

    const snapshotRows = await db
        .select({
            favorerCount: listingMetricSnapshots.favorerCount,
            listingId: listingMetricSnapshots.listingId,
            observedAt: listingMetricSnapshots.observedAt,
            quantity: listingMetricSnapshots.quantity,
            views: listingMetricSnapshots.views,
        })
        .from(listingMetricSnapshots)
        .where(inArray(listingMetricSnapshots.listingId, autoEligibleListingIds))
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
            views: snapshotRow.views,
        });
        recentSnapshotsByListingId.set(snapshotRow.listingId, currentRows);
    }

    const mutableBucketCountsById: Record<
        (typeof listingRefreshPolicyBuckets)[number]['id'],
        number
    > = {
        daily_signal: 0,
        cooldown_3d: 0,
        cooldown_7d: 0,
    };

    for (const row of autoEligibleRows) {
        const recentSnapshots = recentSnapshotsByListingId.get(row.listingId) ?? [];
        const cadenceTier = resolveListingRefreshCadenceTierFromSnapshots({
            now,
            snapshots: recentSnapshots,
        });

        if (cadenceTier === '1d') {
            mutableBucketCountsById.daily_signal += 1;
            continue;
        }

        if (cadenceTier === '3d') {
            mutableBucketCountsById.cooldown_3d += 1;
            continue;
        }

        mutableBucketCountsById.cooldown_7d += 1;
    }

    return {
        autoEnqueueCount: autoEligibleRows.length,
        buckets: listingRefreshPolicyBuckets.map((bucket) => ({
            bucket: bucket.bucket,
            bucketId: bucket.id,
            cadence: bucket.cadence,
            count: mutableBucketCountsById[bucket.id],
            policy: bucket.policy,
        })),
        queuedCount: queuedRow?.queuedCount ?? 0,
    };
};
