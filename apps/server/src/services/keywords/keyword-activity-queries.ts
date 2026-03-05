import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { productKeywordRanks, trackedListings } from '../../db/schema';
import type {
    KeywordActivityListingLookupRow,
    KeywordActivityRankHistoryRow,
} from './keyword-activity-types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LatestRankedListingRow = KeywordActivityListingLookupRow & {
    listingId: string;
    rank: number;
};

export const getLatestObservedAtForKeyword = async (params: {
    accountId: string;
    trackedKeywordId: string;
}): Promise<Date | null> => {
    const [row] = await db
        .select({ observedAt: productKeywordRanks.observedAt })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId)
            )
        )
        .orderBy(desc(productKeywordRanks.observedAt))
        .limit(1);

    return row?.observedAt ?? null;
};

export const listObservedAtRowsForKeywordDayWindow = async (params: {
    accountId: string;
    historyWindowDays: number;
    latestObservedAt: Date;
    trackedKeywordId: string;
}): Promise<Array<{ observedAt: Date }>> => {
    const historyWindowStart = new Date(
        params.latestObservedAt.getTime() - params.historyWindowDays * MS_PER_DAY
    );

    return await db
        .select({ observedAt: productKeywordRanks.observedAt })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                gte(productKeywordRanks.observedAt, historyWindowStart)
            )
        )
        .groupBy(productKeywordRanks.observedAt)
        .orderBy(desc(productKeywordRanks.observedAt));
};

export const listLatestRankedListingsForCapture = async (params: {
    accountId: string;
    latestObservedAt: Date;
    trackedKeywordId: string;
}): Promise<LatestRankedListingRow[]> => {
    return await db
        .select({
            accountId: trackedListings.accountId,
            endingTimestamp: trackedListings.endingTimestamp,
            etsyListingId: trackedListings.etsyListingId,
            etsyState: trackedListings.etsyState,
            id: trackedListings.listingId,
            isDigital: trackedListings.isDigital,
            lastRefreshError: trackedListings.lastRefreshError,
            lastRefreshedAt: trackedListings.lastRefreshedAt,
            listingId: productKeywordRanks.listingId,
            numFavorers: trackedListings.numFavorers,
            priceAmount: trackedListings.priceAmount,
            priceCurrencyCode: trackedListings.priceCurrencyCode,
            priceDivisor: trackedListings.priceDivisor,
            quantity: trackedListings.quantity,
            rank: productKeywordRanks.rank,
            shouldAutoRenew: trackedListings.shouldAutoRenew,
            shopId: trackedListings.shopId,
            shopName: trackedListings.shopName,
            syncState: trackedListings.syncState,
            thumbnailUrl: trackedListings.thumbnailUrl,
            title: trackedListings.title,
            trackerClerkUserId: trackedListings.trackerClerkUserId,
            trackingState: trackedListings.trackingState,
            updatedAt: trackedListings.updatedAt,
            updatedTimestamp: trackedListings.updatedTimestamp,
            url: trackedListings.url,
            views: trackedListings.views,
        })
        .from(productKeywordRanks)
        .innerJoin(
            trackedListings,
            and(
                eq(trackedListings.accountId, productKeywordRanks.accountId),
                eq(trackedListings.listingId, productKeywordRanks.listingId)
            )
        )
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                eq(productKeywordRanks.observedAt, params.latestObservedAt)
            )
        )
        .orderBy(asc(productKeywordRanks.rank));
};

export const listKeywordRankHistoryRowsByObservedAtAndListingIds = async (params: {
    accountId: string;
    latestListingIds: string[];
    observedAtValues: Date[];
    trackedKeywordId: string;
}): Promise<KeywordActivityRankHistoryRow[]> => {
    if (params.latestListingIds.length === 0 || params.observedAtValues.length === 0) {
        return [];
    }

    return await db
        .select({
            listingId: productKeywordRanks.listingId,
            observedAt: productKeywordRanks.observedAt,
            rank: productKeywordRanks.rank,
        })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                inArray(productKeywordRanks.observedAt, params.observedAtValues),
                inArray(productKeywordRanks.listingId, params.latestListingIds)
            )
        )
        .orderBy(asc(productKeywordRanks.observedAt), asc(productKeywordRanks.rank));
};

export const listKeywordRankTrendRowsByListingIds = async (params: {
    accountId: string;
    latestListingIds: string[];
    latestObservedAt: Date;
    trackedKeywordId: string;
    trendWindowDays: number;
}): Promise<KeywordActivityRankHistoryRow[]> => {
    if (params.latestListingIds.length === 0) {
        return [];
    }

    const trendWindowStart = new Date(
        params.latestObservedAt.getTime() - params.trendWindowDays * MS_PER_DAY
    );

    return await db
        .select({
            listingId: productKeywordRanks.listingId,
            observedAt: productKeywordRanks.observedAt,
            rank: productKeywordRanks.rank,
        })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                inArray(productKeywordRanks.listingId, params.latestListingIds),
                gte(productKeywordRanks.observedAt, trendWindowStart)
            )
        )
        .orderBy(asc(productKeywordRanks.observedAt), asc(productKeywordRanks.rank));
};

export const listBestKeywordRanksByListingIds = async (params: {
    accountId: string;
    latestListingIds: string[];
    trackedKeywordId: string;
}): Promise<Array<{ bestRank: number; listingId: string }>> => {
    if (params.latestListingIds.length === 0) {
        return [];
    }

    return await db
        .select({
            bestRank: sql<number>`min(${productKeywordRanks.rank})::int`,
            listingId: productKeywordRanks.listingId,
        })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                inArray(productKeywordRanks.listingId, params.latestListingIds)
            )
        )
        .groupBy(productKeywordRanks.listingId);
};
