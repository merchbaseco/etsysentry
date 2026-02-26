import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
    trackedKeywords,
    trackedListings,
    trackedShops
} from '../../db/schema';
import { getEtsyApiUsage, type EtsyApiUsageStats } from '../etsy/get-etsy-api-usage';

type SyncJobCounts = {
    inFlightJobs: number;
    queuedJobs: number;
};

export type DashboardSummary = {
    etsyApiCallsPast24Hours: number;
    etsyApiCallsPastHour: number;
    inFlightJobs: number;
    queuedJobs: number;
    totalTrackedListings: number;
};

export type DashboardApiUsageCounts = Pick<
    DashboardSummary,
    'etsyApiCallsPast24Hours' | 'etsyApiCallsPastHour'
>;

export const toDashboardApiUsageCounts = (
    stats: Pick<EtsyApiUsageStats, 'callsPast24Hours' | 'callsPastHour'>
): DashboardApiUsageCounts => {
    return {
        etsyApiCallsPast24Hours: stats.callsPast24Hours,
        etsyApiCallsPastHour: stats.callsPastHour
    };
};

const countTrackedListings = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<number> => {
    const [row] = await db
        .select({
            value: sql<number>`count(*)::int`
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.trackerClerkUserId, params.clerkUserId)
            )
        );

    return row?.value ?? 0;
};

const countTrackedListingSyncJobs = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`count(*) filter (where ${trackedListings.syncState} = 'syncing')::int`,
            queuedJobs: sql<number>`count(*) filter (where ${trackedListings.syncState} = 'queued')::int`
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.trackerClerkUserId, params.clerkUserId)
            )
        );

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0
    };
};

const countTrackedKeywordSyncJobs = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`count(*) filter (where ${trackedKeywords.syncState} = 'syncing')::int`,
            queuedJobs: sql<number>`count(*) filter (where ${trackedKeywords.syncState} = 'queued')::int`
        })
        .from(trackedKeywords)
        .where(
            and(
                eq(trackedKeywords.accountId, params.accountId),
                eq(trackedKeywords.trackerClerkUserId, params.clerkUserId)
            )
        );

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0
    };
};

const countTrackedShopSyncJobs = async (params: {
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`count(*) filter (where ${trackedShops.syncState} = 'syncing')::int`,
            queuedJobs: sql<number>`count(*) filter (where ${trackedShops.syncState} = 'queued')::int`
        })
        .from(trackedShops)
        .where(eq(trackedShops.accountId, params.accountId));

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0
    };
};

export const sumSyncJobCounts = (counts: SyncJobCounts[]): SyncJobCounts => {
    return counts.reduce<SyncJobCounts>(
        (total, current) => {
            return {
                inFlightJobs: total.inFlightJobs + current.inFlightJobs,
                queuedJobs: total.queuedJobs + current.queuedJobs
            };
        },
        {
            inFlightJobs: 0,
            queuedJobs: 0
        }
    );
};

export const getDashboardSummary = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<DashboardSummary> => {
    const [apiUsage, totalTrackedListings, trackedListingSyncJobs, trackedKeywordSyncJobs, trackedShopSyncJobs] =
        await Promise.all([
            getEtsyApiUsage({
                accountId: params.accountId
            }),
            countTrackedListings({
                clerkUserId: params.clerkUserId,
                accountId: params.accountId
            }),
            countTrackedListingSyncJobs({
                clerkUserId: params.clerkUserId,
                accountId: params.accountId
            }),
            countTrackedKeywordSyncJobs({
                clerkUserId: params.clerkUserId,
                accountId: params.accountId
            }),
            countTrackedShopSyncJobs({
                accountId: params.accountId
            })
        ]);

    const { inFlightJobs, queuedJobs } = sumSyncJobCounts([
        trackedListingSyncJobs,
        trackedKeywordSyncJobs,
        trackedShopSyncJobs
    ]);

    return {
        ...toDashboardApiUsageCounts(apiUsage.stats),
        inFlightJobs,
        queuedJobs,
        totalTrackedListings
    };
};
