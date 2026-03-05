import { convertPriceToUsd } from '../currency/convert-price-to-usd';
import type {
    KeywordActivityListingLookupRow,
    KeywordActivityListingRecord,
    KeywordActivityRankHistoryRow,
    KeywordActivityRankPoint,
} from './keyword-activity-types';

export const toBestRankByListingId = (
    rows: Array<{ bestRank: number; listingId: string }>
): Map<string, number> => {
    return new Map(rows.map((row) => [row.listingId, row.bestRank]));
};

export const toHistoryByListingId = (
    rows: KeywordActivityRankHistoryRow[]
): Map<string, KeywordActivityRankPoint[]> => {
    const historyByListingId = new Map<string, KeywordActivityRankPoint[]>();

    for (const row of rows) {
        const existing = historyByListingId.get(row.listingId) ?? [];
        historyByListingId.set(row.listingId, [
            ...existing,
            { observedAt: row.observedAt.toISOString(), rank: row.rank },
        ]);
    }

    return historyByListingId;
};

const toListingPrice = (
    row: KeywordActivityListingLookupRow
): KeywordActivityListingRecord['price'] | null => {
    if (
        row.priceAmount === null ||
        row.priceCurrencyCode === null ||
        row.priceDivisor === null ||
        row.priceDivisor <= 0
    ) {
        return null;
    }

    return {
        amount: row.priceAmount,
        currencyCode: row.priceCurrencyCode,
        divisor: row.priceDivisor,
        value: row.priceAmount / row.priceDivisor,
    };
};

export const toKeywordActivityListingRecord = (params: {
    ratesByCurrencyCode: Record<string, number> | null;
    row: KeywordActivityListingLookupRow;
    tags: string[];
}): KeywordActivityListingRecord => {
    const row = params.row;
    const price = toListingPrice(row);
    const priceUsdValue = price
        ? convertPriceToUsd({
              currencyCode: price.currencyCode,
              ratesByCurrencyCode: params.ratesByCurrencyCode,
              value: price.value,
          })
        : null;

    return {
        accountId: row.accountId,
        endingTimestamp: row.endingTimestamp,
        etsyListingId: row.etsyListingId,
        etsyState: row.etsyState,
        id: row.id,
        isDigital: row.isDigital,
        lastRefreshError: row.lastRefreshError,
        lastRefreshedAt: row.lastRefreshedAt.toISOString(),
        numFavorers: row.numFavorers,
        price,
        priceUsdValue,
        quantity: row.quantity,
        shouldAutoRenew: row.shouldAutoRenew,
        shopId: row.shopId,
        shopName: row.shopName,
        tags: params.tags,
        syncState: row.syncState,
        thumbnailUrl: row.thumbnailUrl,
        title: row.title,
        trackerClerkUserId: row.trackerClerkUserId,
        trackingState: row.trackingState,
        updatedAt: row.updatedAt.toISOString(),
        updatedTimestamp: row.updatedTimestamp,
        url: row.url,
        views: row.views,
    };
};
