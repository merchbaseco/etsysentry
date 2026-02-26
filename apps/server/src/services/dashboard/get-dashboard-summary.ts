import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import { getEtsyApiUsage, type EtsyApiUsageStats } from '../etsy/get-etsy-api-usage';

export type DashboardSummary = {
    etsyApiCallsPast24Hours: number;
    etsyApiCallsPastHour: number;
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

export const getDashboardSummary = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<DashboardSummary> => {
    const [apiUsage, totalTrackedListings] = await Promise.all([
        getEtsyApiUsage({
            accountId: params.accountId
        }),
        countTrackedListings({
            clerkUserId: params.clerkUserId,
            accountId: params.accountId
        })
    ]);

    return {
        ...toDashboardApiUsageCounts(apiUsage.stats),
        totalTrackedListings
    };
};
