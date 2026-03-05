import { TRPCError } from '@trpc/server';
import { loadUsdRatesMap } from '../currency/load-usd-rates-cache';
import { listNormalizedTagsByListingIds } from '../listings/sync-listing-tags';
import {
    getLatestObservedAtForKeyword,
    listBestKeywordRanksByListingIds,
    listKeywordRankHistoryRowsByObservedAtAndListingIds,
    listKeywordRankTrendRowsByListingIds,
    listLatestRankedListingsForCapture,
    listObservedAtRowsForKeywordDayWindow,
} from './keyword-activity-queries';
import {
    toBestRankByListingId,
    toHistoryByListingId,
    toKeywordActivityListingRecord,
} from './keyword-activity-record-mapper';
import type { KeywordActivityResult } from './keyword-activity-types';
import { toKeywordRankChanges } from './keyword-rank-changes';
import { getTrackedKeyword } from './tracked-keywords-service';

const DEFAULT_HISTORY_WINDOW_DAYS = 30;
const TREND_CHANGE_WINDOW_DAYS = 30;

const toHistoryWindowDays = (days: number | undefined): number => {
    return typeof days === 'number' ? days : DEFAULT_HISTORY_WINDOW_DAYS;
};

export const getKeywordActivity = async (params: {
    accountId: string;
    days?: number;
    trackedKeywordId: string;
}): Promise<KeywordActivityResult> => {
    const trackedKeyword = await getTrackedKeyword({
        accountId: params.accountId,
        trackedKeywordId: params.trackedKeywordId,
    });

    if (!trackedKeyword) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked keyword was not found for this account.',
        });
    }

    const historyWindowDays = toHistoryWindowDays(params.days);
    const latestObservedAt = await getLatestObservedAtForKeyword({
        accountId: params.accountId,
        trackedKeywordId: params.trackedKeywordId,
    });

    if (!latestObservedAt) {
        return {
            capturedAt: null,
            historyWindowDays,
            items: [],
            keyword: {
                id: trackedKeyword.id,
                keyword: trackedKeyword.keyword,
                lastRefreshedAt: trackedKeyword.lastRefreshedAt,
                nextSyncAt: trackedKeyword.nextSyncAt,
                normalizedKeyword: trackedKeyword.normalizedKeyword,
                syncState: trackedKeyword.syncState,
                trackingState: trackedKeyword.trackingState,
            },
            previousCapturedAt: null,
        };
    }

    const observedRows = await listObservedAtRowsForKeywordDayWindow({
        accountId: params.accountId,
        historyWindowDays,
        latestObservedAt,
        trackedKeywordId: params.trackedKeywordId,
    });
    const previousObservedAt = observedRows[1]?.observedAt;

    const latestRows = await listLatestRankedListingsForCapture({
        accountId: params.accountId,
        latestObservedAt,
        trackedKeywordId: params.trackedKeywordId,
    });
    const latestListingIds = latestRows.map((row) => row.listingId);
    const observedAtValues = observedRows.map((row) => row.observedAt);

    const [rankHistoryRows, trendRows, bestRankRows, tagsByListingId, ratesByCurrencyCode] =
        await Promise.all([
            listKeywordRankHistoryRowsByObservedAtAndListingIds({
                accountId: params.accountId,
                latestListingIds,
                observedAtValues,
                trackedKeywordId: params.trackedKeywordId,
            }),
            listKeywordRankTrendRowsByListingIds({
                accountId: params.accountId,
                latestListingIds,
                latestObservedAt,
                trackedKeywordId: params.trackedKeywordId,
                trendWindowDays: TREND_CHANGE_WINDOW_DAYS,
            }),
            listBestKeywordRanksByListingIds({
                accountId: params.accountId,
                latestListingIds,
                trackedKeywordId: params.trackedKeywordId,
            }),
            listNormalizedTagsByListingIds({
                listingIds: latestRows.map((row) => row.id),
            }),
            loadUsdRatesMap(),
        ]);

    const historyByListingId = toHistoryByListingId(rankHistoryRows);
    const trendHistoryByListingId = toHistoryByListingId(trendRows);
    const bestRankByListingId = toBestRankByListingId(bestRankRows);

    return {
        capturedAt: latestObservedAt.toISOString(),
        historyWindowDays,
        items: latestRows.map((row) => {
            return {
                currentRank: row.rank,
                history: historyByListingId.get(row.listingId) ?? [],
                listing: toKeywordActivityListingRecord({
                    ratesByCurrencyCode,
                    row,
                    tags: tagsByListingId[row.id] ?? [],
                }),
                rankChanges: toKeywordRankChanges({
                    bestRank: bestRankByListingId.get(row.listingId) ?? null,
                    currentRank: row.rank,
                    latestObservedAt: latestObservedAt.toISOString(),
                    trendHistory: trendHistoryByListingId.get(row.listingId) ?? [],
                }),
            };
        }),
        keyword: {
            id: trackedKeyword.id,
            keyword: trackedKeyword.keyword,
            lastRefreshedAt: trackedKeyword.lastRefreshedAt,
            nextSyncAt: trackedKeyword.nextSyncAt,
            normalizedKeyword: trackedKeyword.normalizedKeyword,
            syncState: trackedKeyword.syncState,
            trackingState: trackedKeyword.trackingState,
        },
        previousCapturedAt: previousObservedAt ? previousObservedAt.toISOString() : null,
    };
};
