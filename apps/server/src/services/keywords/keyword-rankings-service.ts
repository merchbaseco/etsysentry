import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { productKeywordRanks, trackedKeywords } from '../../db/schema';
import {
    EtsyFindAllListingsActiveBridgeError,
    findAllListingsActive
} from '../etsy/bridges/find-all-listings-active';
import { getEtsyOAuthAccessToken } from '../etsy/oauth-service';

export type ProductKeywordRankRecord = {
    etsyListingId: string;
    observedAt: string;
    rank: number;
    trackedKeywordId: string;
};

export type DailyProductRanksForKeyword = {
    keyword: string;
    normalizedKeyword: string;
    observedAt: string | null;
    trackedKeywordId: string;
    items: ProductKeywordRankRecord[];
};

export type KeywordRankForProduct = {
    bestRank: number;
    currentRank: number;
    daysSeen: number;
    firstObservedAt: string;
    keyword: string;
    latestObservedAt: string;
    normalizedKeyword: string;
    trackedKeywordId: string;
};

const parseListingIdentifier = (rawInput: string): string | null => {
    const trimmed = rawInput.trim();

    if (/^\d+$/.test(trimmed)) {
        return trimmed;
    }

    try {
        const url = new URL(trimmed);

        if (!url.hostname.toLowerCase().includes('etsy.com')) {
            return null;
        }

        const match = url.pathname.match(/\/listing\/(\d+)(?:\/|$)/i);

        if (match?.[1]) {
            return match[1];
        }

        const listingIdFromQuery = url.searchParams.get('listing_id');

        if (listingIdFromQuery && /^\d+$/.test(listingIdFromQuery)) {
            return listingIdFromQuery;
        }

        return null;
    } catch {
        return null;
    }
};

const toRecord = (
    row: typeof productKeywordRanks.$inferSelect
): ProductKeywordRankRecord => {
    return {
        etsyListingId: row.etsyListingId,
        observedAt: row.observedAt.toISOString(),
        rank: row.rank,
        trackedKeywordId: row.trackedKeywordId
    };
};

const mapBridgeErrorToTrpcError = (
    error: EtsyFindAllListingsActiveBridgeError
): TRPCError => {
    if (error.statusCode === 404) {
        return new TRPCError({
            code: 'NOT_FOUND',
            message: 'Etsy search endpoint did not return results.'
        });
    }

    if (error.statusCode === 400) {
        return new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
        });
    }

    if (error.statusCode === 401 || error.statusCode === 403) {
        const genericStatusMessage = `Etsy findAllListingsActive failed with HTTP ${error.statusCode}.`;

        return new TRPCError({
            code: 'FORBIDDEN',
            message:
                error.message === genericStatusMessage
                    ? 'Etsy access token is invalid or missing required scope.'
                    : error.message
        });
    }

    return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
    });
};

const getTrackedKeyword = async (params: {
    tenantId: string;
    trackedKeywordId: string;
}) => {
    const [keyword] = await db
        .select()
        .from(trackedKeywords)
        .where(
            and(
                eq(trackedKeywords.id, params.trackedKeywordId),
                eq(trackedKeywords.tenantId, params.tenantId)
            )
        )
        .limit(1);

    if (!keyword) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked keyword was not found for this tenant.'
        });
    }

    return keyword;
};

const fetchKeywordRanksFromEtsy = async (params: {
    clerkUserId: string;
    keyword: string;
    tenantId: string;
}) => {
    const oauthToken = await getEtsyOAuthAccessToken({
        clerkUserId: params.clerkUserId,
        tenantId: params.tenantId
    });

    try {
        return await findAllListingsActive({
            accessToken: oauthToken.accessToken,
            keywords: params.keyword,
            limit: 25,
            offset: 0,
            sortOn: 'score'
        });
    } catch (error) {
        if (error instanceof EtsyFindAllListingsActiveBridgeError) {
            throw mapBridgeErrorToTrpcError(error);
        }

        throw error;
    }
};

export const syncRanksForKeyword = async (params: {
    clerkUserId: string;
    tenantId: string;
    trackedKeywordId: string;
}): Promise<DailyProductRanksForKeyword> => {
    const trackedKeyword = await getTrackedKeyword({
        tenantId: params.tenantId,
        trackedKeywordId: params.trackedKeywordId
    });

    const now = new Date();

    try {
        const response = await fetchKeywordRanksFromEtsy({
            clerkUserId: params.clerkUserId,
            keyword: trackedKeyword.keyword,
            tenantId: params.tenantId
        });

        const insertValues = response.results.map((item, index) => ({
            etsyListingId: item.listingId,
            observedAt: now,
            rank: index + 1,
            tenantId: params.tenantId,
            trackedKeywordId: trackedKeyword.id
        }));

        if (insertValues.length > 0) {
            await db.insert(productKeywordRanks).values(insertValues);
        }

        await db
            .update(trackedKeywords)
            .set({
                lastRefreshError: null,
                lastRefreshedAt: now,
                trackingState: 'active',
                updatedAt: now
            })
            .where(
                and(
                    eq(trackedKeywords.id, trackedKeyword.id),
                    eq(trackedKeywords.tenantId, params.tenantId)
                )
            );

        return {
            keyword: trackedKeyword.keyword,
            normalizedKeyword: trackedKeyword.normalizedKeyword,
            observedAt: now.toISOString(),
            trackedKeywordId: trackedKeyword.id,
            items: insertValues.map((item) => ({
                etsyListingId: item.etsyListingId,
                observedAt: now.toISOString(),
                rank: item.rank,
                trackedKeywordId: item.trackedKeywordId
            }))
        };
    } catch (error) {
        const failureMessage =
            error instanceof TRPCError ? error.message : 'Unexpected daily product rank sync error.';

        await db
            .update(trackedKeywords)
            .set({
                lastRefreshError: failureMessage,
                lastRefreshedAt: now,
                trackingState: 'error',
                updatedAt: now
            })
            .where(
                and(
                    eq(trackedKeywords.id, trackedKeyword.id),
                    eq(trackedKeywords.tenantId, params.tenantId)
                )
            );

        throw error;
    }
};

export const getDailyProductRanksForKeyword = async (params: {
    tenantId: string;
    trackedKeywordId: string;
}): Promise<DailyProductRanksForKeyword> => {
    const trackedKeyword = await getTrackedKeyword({
        tenantId: params.tenantId,
        trackedKeywordId: params.trackedKeywordId
    });

    const [latest] = await db
        .select({
            observedAt: productKeywordRanks.observedAt
        })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.tenantId, params.tenantId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId)
            )
        )
        .orderBy(desc(productKeywordRanks.observedAt))
        .limit(1);

    if (!latest) {
        return {
            keyword: trackedKeyword.keyword,
            normalizedKeyword: trackedKeyword.normalizedKeyword,
            observedAt: null,
            trackedKeywordId: trackedKeyword.id,
            items: []
        };
    }

    const rows = await db
        .select()
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.tenantId, params.tenantId),
                eq(productKeywordRanks.trackedKeywordId, params.trackedKeywordId),
                eq(productKeywordRanks.observedAt, latest.observedAt)
            )
        )
        .orderBy(asc(productKeywordRanks.rank));

    return {
        keyword: trackedKeyword.keyword,
        normalizedKeyword: trackedKeyword.normalizedKeyword,
        observedAt: latest.observedAt.toISOString(),
        trackedKeywordId: trackedKeyword.id,
        items: rows.map(toRecord)
    };
};

export const getKeywordRanksForProduct = async (params: {
    listingInput: string;
    tenantId: string;
}): Promise<{
    etsyListingId: string;
    items: KeywordRankForProduct[];
}> => {
    const etsyListingId = parseListingIdentifier(params.listingInput);

    if (!etsyListingId) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Listing must be an Etsy listing URL or numeric listing id.'
        });
    }

    const rows = await db
        .select({
            keyword: trackedKeywords.keyword,
            normalizedKeyword: trackedKeywords.normalizedKeyword,
            observedAt: productKeywordRanks.observedAt,
            rank: productKeywordRanks.rank,
            trackedKeywordId: productKeywordRanks.trackedKeywordId
        })
        .from(productKeywordRanks)
        .innerJoin(
            trackedKeywords,
            and(
                eq(trackedKeywords.id, productKeywordRanks.trackedKeywordId),
                eq(trackedKeywords.tenantId, productKeywordRanks.tenantId)
            )
        )
        .where(
            and(
                eq(productKeywordRanks.tenantId, params.tenantId),
                eq(productKeywordRanks.etsyListingId, etsyListingId)
            )
        )
        .orderBy(desc(productKeywordRanks.observedAt), asc(productKeywordRanks.rank));

    const grouped = new Map<
        string,
        {
            bestRank: number;
            currentRank: number;
            firstObservedAt: Date;
            keyword: string;
            latestObservedAt: Date;
            normalizedKeyword: string;
            seenDays: Set<string>;
            trackedKeywordId: string;
        }
    >();

    for (const row of rows) {
        const current = grouped.get(row.trackedKeywordId);
        const observedDayKey = row.observedAt.toISOString().slice(0, 10);

        if (!current) {
            grouped.set(row.trackedKeywordId, {
                bestRank: row.rank,
                currentRank: row.rank,
                firstObservedAt: row.observedAt,
                keyword: row.keyword,
                latestObservedAt: row.observedAt,
                normalizedKeyword: row.normalizedKeyword,
                seenDays: new Set([observedDayKey]),
                trackedKeywordId: row.trackedKeywordId
            });
            continue;
        }

        current.bestRank = Math.min(current.bestRank, row.rank);
        current.firstObservedAt =
            row.observedAt < current.firstObservedAt ? row.observedAt : current.firstObservedAt;
        current.seenDays.add(observedDayKey);
    }

    return {
        etsyListingId,
        items: [...grouped.values()]
            .map((item) => ({
                bestRank: item.bestRank,
                currentRank: item.currentRank,
                daysSeen: item.seenDays.size,
                firstObservedAt: item.firstObservedAt.toISOString(),
                keyword: item.keyword,
                latestObservedAt: item.latestObservedAt.toISOString(),
                normalizedKeyword: item.normalizedKeyword,
                trackedKeywordId: item.trackedKeywordId
            }))
            .sort((a, b) => b.latestObservedAt.localeCompare(a.latestObservedAt))
    };
};
