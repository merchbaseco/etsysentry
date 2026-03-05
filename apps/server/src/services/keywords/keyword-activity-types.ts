import type { trackedListings } from '../../db/schema';
import type { TrackedListingWithUsd } from '../currency/decorate-tracked-listings-with-usd';

export interface KeywordActivityRankPoint {
    observedAt: string;
    rank: number;
}

export interface KeywordActivityRankChanges {
    bestRank: number | null;
    change1d: number;
    change7d: number;
    change30d: number;
}

export type KeywordActivityListingRecord = TrackedListingWithUsd;

export interface KeywordActivityRankHistoryRow {
    listingId: string;
    observedAt: Date;
    rank: number;
}

export interface KeywordActivityListingLookupRow {
    accountId: string;
    endingTimestamp: number | null;
    etsyListingId: string;
    etsyState: (typeof trackedListings.$inferSelect)['etsyState'];
    id: string;
    isDigital: boolean;
    lastRefreshError: string | null;
    lastRefreshedAt: Date;
    numFavorers: number | null;
    priceAmount: number | null;
    priceCurrencyCode: string | null;
    priceDivisor: number | null;
    quantity: number | null;
    shopId: string | null;
    shopName: string | null;
    shouldAutoRenew: boolean | null;
    syncState: (typeof trackedListings.$inferSelect)['syncState'];
    thumbnailUrl: string | null;
    title: string;
    trackerClerkUserId: string;
    trackingState: (typeof trackedListings.$inferSelect)['trackingState'];
    updatedAt: Date;
    updatedTimestamp: number | null;
    url: string | null;
    views: number | null;
}

export interface KeywordActivityItem {
    currentRank: number;
    history: KeywordActivityRankPoint[];
    listing: KeywordActivityListingRecord;
    rankChanges: KeywordActivityRankChanges;
}

export interface KeywordActivityResult {
    capturedAt: string | null;
    historyWindowDays: number;
    items: KeywordActivityItem[];
    keyword: {
        id: string;
        keyword: string;
        lastRefreshedAt: string;
        nextSyncAt: string;
        normalizedKeyword: string;
        syncState: 'idle' | 'queued' | 'syncing';
        trackingState: 'active' | 'paused' | 'error';
    };
    previousCapturedAt: string | null;
}
