import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { productKeywordRanks, trackedKeywords, trackedListings } from '../../db/schema';
import {
    EtsyFindAllListingsActiveBridgeError,
    findAllListingsActive,
    type FindAllListingsActiveBridgeResponse
} from '../etsy/bridges/find-all-listings-active';
import { getEtsyOAuthAccessToken } from '../etsy/oauth-service';
import { recordEtsyApiCallBestEffort } from '../etsy/record-etsy-api-call';
import { createEventLog, createEventLogs } from '../logs/create-event-log';
import { emitEvent } from '../realtime/emit-event';

const DAILY_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const keywordSyncInvalidationQueries = ['app.keywords.list', 'app.listings.list'] as const;

export const computeNextKeywordSyncAt = (now: Date): Date => {
    return new Date(now.getTime() + DAILY_SYNC_INTERVAL_MS);
};

export type ProductKeywordRankRecord = {
    etsyListingId: string;
    listingId: string;
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

export type SyncRanksForKeywordResult = DailyProductRanksForKeyword & {
    newlyDiscoveredEtsyListingIds: string[];
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

type RankedListingResult = FindAllListingsActiveBridgeResponse['results'][number];

export const buildTrackedListingDiscoveryValues = (params: {
    clerkUserId: string;
    now: Date;
    rankedListing: RankedListingResult;
    accountId: string;
}) => {
    return {
        etsyListingId: params.rankedListing.listingId,
        etsyState: 'active' as const,
        shopId: params.rankedListing.shopId,
        accountId: params.accountId,
        thumbnailUrl: params.rankedListing.thumbnailUrl,
        title: params.rankedListing.title,
        trackerClerkUserId: params.clerkUserId,
        trackingState: 'active' as const,
        updatedAt: params.now,
        url: params.rankedListing.url
    };
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
        listingId: row.listingId,
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
    accountId: string;
    trackedKeywordId: string;
}) => {
    const [keyword] = await db
        .select()
        .from(trackedKeywords)
        .where(
            and(
                eq(trackedKeywords.id, params.trackedKeywordId),
                eq(trackedKeywords.accountId, params.accountId)
            )
        )
        .limit(1);

    if (!keyword) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked keyword was not found for this account.'
        });
    }

    return keyword;
};

const fetchKeywordRanksFromEtsy = async (params: {
    clerkUserId: string;
    keyword: string;
    accountId: string;
}) => {
    const oauthToken = await getEtsyOAuthAccessToken({
        accountId: params.accountId
    });

    try {
        await recordEtsyApiCallBestEffort({
            clerkUserId: params.clerkUserId,
            endpoint: 'findAllListingsActive',
            accountId: params.accountId
        });

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
    monitorRunId?: string;
    requestId?: string;
    accountId: string;
    trackedKeywordId: string;
}): Promise<SyncRanksForKeywordResult> => {
    const trackedKeyword = await getTrackedKeyword({
        accountId: params.accountId,
        trackedKeywordId: params.trackedKeywordId
    });

    const now = new Date();
    const nextSyncAt = computeNextKeywordSyncAt(now);

    try {
        const response = await fetchKeywordRanksFromEtsy({
            clerkUserId: params.clerkUserId,
            keyword: trackedKeyword.keyword,
            accountId: params.accountId
        });

        const insertValues = await db.transaction(async (tx) => {
            const listingIdByEtsyListingId = new Map<string, string>();
            const uniqueRankedListingsById = new Map<string, RankedListingResult>();
            const newlyDiscoveredEtsyListingIds: string[] = [];

            for (const item of response.results) {
                if (uniqueRankedListingsById.has(item.listingId)) {
                    continue;
                }

                uniqueRankedListingsById.set(item.listingId, item);
            }

            const uniqueRankedListings = [...uniqueRankedListingsById.values()];

            if (uniqueRankedListings.length > 0) {
                const discoveryValues = uniqueRankedListings.map((rankedListing) =>
                    buildTrackedListingDiscoveryValues({
                        clerkUserId: params.clerkUserId,
                        now,
                        rankedListing,
                        accountId: params.accountId
                    })
                );

                const insertedListings = await tx
                    .insert(trackedListings)
                    .values(discoveryValues)
                    // Keyword sync only discovers listings. Existing tracked listings are untouched.
                    .onConflictDoNothing({
                        target: [trackedListings.accountId, trackedListings.etsyListingId]
                    })
                    .returning({
                        etsyListingId: trackedListings.etsyListingId
                    });

                for (const inserted of insertedListings) {
                    newlyDiscoveredEtsyListingIds.push(inserted.etsyListingId);
                }

                const trackedListingRows = await tx
                    .select({
                        etsyListingId: trackedListings.etsyListingId,
                        listingId: trackedListings.listingId
                    })
                    .from(trackedListings)
                    .where(
                        and(
                            eq(trackedListings.accountId, params.accountId),
                            inArray(
                                trackedListings.etsyListingId,
                                uniqueRankedListings.map((rankedListing) => rankedListing.listingId)
                            )
                        )
                    );

                for (const row of trackedListingRows) {
                    listingIdByEtsyListingId.set(row.etsyListingId, row.listingId);
                }
            }

            for (const item of uniqueRankedListings) {
                const listingId = listingIdByEtsyListingId.get(item.listingId);

                if (!listingId) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Ranked listing was not available in tracked listings.'
                    });
                }
            }

            const values = response.results.map((item, index) => {
                const listingId = listingIdByEtsyListingId.get(item.listingId);

                if (!listingId) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Ranked listing was not available in tracked listings.'
                    });
                }

                return {
                    etsyListingId: item.listingId,
                    listingId,
                    observedAt: now,
                    rank: index + 1,
                    accountId: params.accountId,
                    trackedKeywordId: trackedKeyword.id
                };
            });

            if (values.length > 0) {
                await tx.insert(productKeywordRanks).values(values);
            }

            const discoveredListings = newlyDiscoveredEtsyListingIds.map((etsyListingId) => {
                const rankedListing = uniqueRankedListingsById.get(etsyListingId);

                return {
                    etsyListingId,
                    primitiveId: listingIdByEtsyListingId.get(etsyListingId) ?? null,
                    shopId: rankedListing?.shopId ?? null,
                    title: rankedListing?.title ?? null
                };
            });

            return {
                discoveredListings,
                newlyDiscoveredEtsyListingIds,
                values
            };
        });

        await db
            .update(trackedKeywords)
            .set({
                lastRefreshError: null,
                lastRefreshedAt: now,
                nextSyncAt,
                trackingState: 'active',
                updatedAt: now
            })
            .where(
                and(
                    eq(trackedKeywords.id, trackedKeyword.id),
                    eq(trackedKeywords.accountId, params.accountId)
                )
            );

        emitEvent({
            queries: [...keywordSyncInvalidationQueries],
            accountId: params.accountId
        });

        await createEventLogs([
            ...insertValues.discoveredListings.map((listing) => ({
                action: 'listing.discovered',
                category: 'listing',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    keyword: trackedKeyword.keyword,
                    title: listing.title
                },
                keyword: trackedKeyword.keyword,
                level: 'info' as const,
                listingId: listing.etsyListingId,
                message:
                    `Discovered listing ${listing.etsyListingId} from keyword ` +
                    `"${trackedKeyword.keyword}".`,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: listing.primitiveId,
                primitiveType: 'listing' as const,
                requestId: params.requestId ?? null,
                shopId: listing.shopId,
                status: 'success' as const,
                accountId: params.accountId
            })),
            {
                action: 'keyword.synced',
                category: 'keyword',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    capturedCount: insertValues.values.length,
                    discoveredCount: insertValues.newlyDiscoveredEtsyListingIds.length
                },
                keyword: trackedKeyword.keyword,
                level: 'info',
                message:
                    `Synced keyword "${trackedKeyword.keyword}" with ` +
                    `${insertValues.values.length} captured listings.`,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: trackedKeyword.id,
                primitiveType: 'keyword',
                requestId: params.requestId ?? null,
                status: 'success',
                accountId: params.accountId
            }
        ]);

        return {
            keyword: trackedKeyword.keyword,
            normalizedKeyword: trackedKeyword.normalizedKeyword,
            newlyDiscoveredEtsyListingIds: insertValues.newlyDiscoveredEtsyListingIds,
            observedAt: now.toISOString(),
            trackedKeywordId: trackedKeyword.id,
            items: insertValues.values.map((item) => ({
                etsyListingId: item.etsyListingId,
                listingId: item.listingId,
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
                nextSyncAt,
                trackingState: 'active',
                updatedAt: now
            })
            .where(
                and(
                    eq(trackedKeywords.id, trackedKeyword.id),
                    eq(trackedKeywords.accountId, params.accountId)
                )
            );

        emitEvent({
            queries: [...keywordSyncInvalidationQueries],
            accountId: params.accountId
        });

        try {
            await createEventLog({
                action: 'keyword.sync_failed',
                category: 'keyword',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    error: failureMessage
                },
                keyword: trackedKeyword.keyword,
                level: 'error',
                message: `Keyword sync failed for "${trackedKeyword.keyword}": ${failureMessage}`,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: trackedKeyword.id,
                primitiveType: 'keyword',
                requestId: params.requestId ?? null,
                status: 'failed',
                accountId: params.accountId
            });
        } catch {
            // Preserve the original sync failure.
        }

        throw error;
    }
};

export const getDailyProductRanksForKeyword = async (params: {
    accountId: string;
    trackedKeywordId: string;
}): Promise<DailyProductRanksForKeyword> => {
    const trackedKeyword = await getTrackedKeyword({
        accountId: params.accountId,
        trackedKeywordId: params.trackedKeywordId
    });

    const [latest] = await db
        .select({
            observedAt: productKeywordRanks.observedAt
        })
        .from(productKeywordRanks)
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
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
                eq(productKeywordRanks.accountId, params.accountId),
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
    accountId: string;
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
                eq(trackedKeywords.accountId, productKeywordRanks.accountId)
            )
        )
        .where(
            and(
                eq(productKeywordRanks.accountId, params.accountId),
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
