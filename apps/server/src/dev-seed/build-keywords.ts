import type { productKeywordRanks, trackedKeywords } from '../db/schema';
import { KEYWORD_VOCABULARY } from './catalog';
import type { SeededRandom } from './random';
import { MS_PER_HOUR, MS_PER_MINUTE, shiftDays, shiftMs } from './time';
import type { SeedListing } from './types';

/**
 * Keyword monitoring: the tracked keywords and their daily rank captures.
 *
 * Every row in one capture shares the exact same `observed_at`. That is not
 * cosmetic — the keyword activity query finds the newest capture with
 * `max(observed_at)` and then selects rows by equality, so ranks written a few
 * milliseconds apart would split one capture into several and the activity tab
 * would show a single listing per day.
 */

const CAPTURE_HOUR = 6;
const CAPTURE_MINUTE = 13;
const MAX_RANK = 144;
const RANKED_LISTINGS_MIN = 3;
const RANKED_LISTINGS_MAX = 6;

export interface KeywordsBuild {
    rankRows: (typeof productKeywordRanks.$inferInsert)[];
    rows: (typeof trackedKeywords.$inferInsert)[];
}

export const buildKeywords = (params: {
    accountId: string;
    days: Date[];
    keywordCount: number;
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
}): KeywordsBuild => {
    const rows: (typeof trackedKeywords.$inferInsert)[] = [];
    const rankRows: (typeof productKeywordRanks.$inferInsert)[] = [];
    const keywords = KEYWORD_VOCABULARY.slice(0, params.keywordCount);

    for (const [index, keyword] of keywords.entries()) {
        const trackedKeywordId = params.random.uuid();

        rows.push(
            buildKeywordRow({
                accountId: params.accountId,
                index,
                keyword,
                now: params.now,
                random: params.random,
                trackedKeywordId,
            })
        );
        rankRows.push(
            ...buildRankCaptures({
                accountId: params.accountId,
                days: params.days,
                listings: params.listings,
                random: params.random,
                trackedKeywordId,
            })
        );
    }

    return { rankRows, rows };
};

const buildKeywordRow = (params: {
    accountId: string;
    index: number;
    keyword: string;
    now: Date;
    random: SeededRandom;
    trackedKeywordId: string;
}): typeof trackedKeywords.$inferInsert => {
    const { random } = params;
    const lastRefreshedAt = shiftMs(params.now, -random.int(15, 720) * MS_PER_MINUTE);
    const trackingState = params.index === 4 ? 'paused' : 'active';

    return {
        accountId: params.accountId,
        createdAt: shiftDays(params.now, -random.int(30, 200)),
        id: params.trackedKeywordId,
        keyword: params.keyword,
        lastRefreshError: null,
        lastRefreshedAt,
        nextSyncAt: shiftMs(params.now, random.int(20, 600) * MS_PER_MINUTE),
        normalizedKeyword: params.keyword.toLowerCase(),
        syncState: params.index === 2 ? 'queued' : 'idle',
        trackingState,
        updatedAt: lastRefreshedAt,
    };
};

interface RankedListing {
    listing: SeedListing;
    rank: number;
}

const buildRankCaptures = (params: {
    accountId: string;
    days: Date[];
    listings: SeedListing[];
    random: SeededRandom;
    trackedKeywordId: string;
}): (typeof productKeywordRanks.$inferInsert)[] => {
    const { random } = params;
    // A keyword ranks a stable handful of listings; which ones is fixed for the
    // whole window so the trend lines follow the same listings day to day.
    const ranked: RankedListing[] = random
        .shuffle(params.listings)
        .slice(0, random.int(RANKED_LISTINGS_MIN, RANKED_LISTINGS_MAX))
        .map((listing, index) => ({
            listing,
            rank: Math.min(MAX_RANK, index * random.int(4, 22) + random.int(1, 14)),
        }));

    const rows: (typeof productKeywordRanks.$inferInsert)[] = [];

    for (const day of params.days) {
        const observedAt = shiftMs(
            day,
            CAPTURE_HOUR * MS_PER_HOUR + CAPTURE_MINUTE * MS_PER_MINUTE
        );

        for (const entry of ranked) {
            // A bounded random walk: ranks move a little most days and jump
            // occasionally, which is what makes the 1d/7d/30d change columns
            // and the sparkline read as movement rather than noise.
            const drift = random.chance(0.12) ? random.int(-18, 18) : random.int(-3, 3);
            entry.rank = Math.min(MAX_RANK, Math.max(1, entry.rank + drift));

            rows.push({
                accountId: params.accountId,
                createdAt: observedAt,
                etsyListingId: entry.listing.etsyListingId,
                listingId: entry.listing.listingId,
                observedAt,
                rank: entry.rank,
                trackedKeywordId: params.trackedKeywordId,
            });
        }
    }

    return rows;
};
