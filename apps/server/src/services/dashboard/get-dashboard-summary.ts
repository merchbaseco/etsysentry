import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
    etsyApiCallEvents,
    trackedKeywords,
    trackedListings,
    trackedShops
} from '../../db/schema';

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

const countApiCallsSince = async (params: {
    clerkUserId: string;
    accountId: string;
    threshold: Date;
}): Promise<number> => {
    const [row] = await db
        .select({
            value: sql<number>`count(*)::int`
        })
        .from(etsyApiCallEvents)
        .where(
            and(
                eq(etsyApiCallEvents.accountId, params.accountId),
                eq(etsyApiCallEvents.clerkUserId, params.clerkUserId),
                gte(etsyApiCallEvents.createdAt, params.threshold)
            )
        );

    return row?.value ?? 0;
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
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [
        etsyApiCallsPastHour,
        etsyApiCallsPast24Hours,
        totalTrackedListings,
        trackedListingSyncJobs,
        trackedKeywordSyncJobs,
        trackedShopSyncJobs
    ] =
        await Promise.all([
            countApiCallsSince({
                clerkUserId: params.clerkUserId,
                accountId: params.accountId,
                threshold: oneHourAgo
            }),
            countApiCallsSince({
                clerkUserId: params.clerkUserId,
                accountId: params.accountId,
                threshold: twentyFourHoursAgo
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
        etsyApiCallsPast24Hours,
        etsyApiCallsPastHour,
        inFlightJobs,
        queuedJobs,
        totalTrackedListings
    };
};
