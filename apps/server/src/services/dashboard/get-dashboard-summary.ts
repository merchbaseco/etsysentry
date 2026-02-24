import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { etsyApiCallEvents, trackedListings } from '../../db/schema';

export type DashboardSummary = {
    etsyApiCallsPast24Hours: number;
    etsyApiCallsPastHour: number;
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

export const getDashboardSummary = async (params: {
    clerkUserId: string;
    accountId: string;
}): Promise<DashboardSummary> => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [etsyApiCallsPastHour, etsyApiCallsPast24Hours, totalTrackedListings] =
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
            })
        ]);

    return {
        etsyApiCallsPast24Hours,
        etsyApiCallsPastHour,
        totalTrackedListings
    };
};
