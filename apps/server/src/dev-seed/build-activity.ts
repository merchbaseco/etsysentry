import type { etsyApiCallEvents, eventLogs } from '../db/schema';
import { ETSY_ENDPOINTS } from './catalog';
import type { SeededRandom } from './random';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, shiftMs } from './time';
import type { SeedListing, SeedShop } from './types';

/**
 * The operational surfaces: the event log the Logs tab reads, and the Etsy API
 * call events the dashboard's usage panel counts. Both are written densest in
 * the last day, because both are read through recent-time windows — the usage
 * panel counts the past hour and the past 24 hours, and an even spread over a
 * month leaves both counters at nearly zero.
 */

const MONITOR_RUNS_PER_DAY = 3;
const RECENT_LOG_DAYS = 7;
const API_CALLS_PAST_HOUR = 24;
const API_CALLS_PAST_DAY = 260;
const API_CALLS_EARLIER = 140;
const HEX_RADIX = 16;
const ID_LENGTH = 12;

export interface ActivityBuild {
    apiCallRows: (typeof etsyApiCallEvents.$inferInsert)[];
    eventLogRows: (typeof eventLogs.$inferInsert)[];
}

export const buildActivity = (params: {
    accountId: string;
    days: Date[];
    keywords: { id: string; keyword: string }[];
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
    shops: SeedShop[];
}): ActivityBuild => ({
    apiCallRows: buildApiCallRows(params),
    eventLogRows: buildEventLogRows(params),
});

const buildEventLogRows = (params: {
    accountId: string;
    days: Date[];
    keywords: { id: string; keyword: string }[];
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
    shops: SeedShop[];
}): (typeof eventLogs.$inferInsert)[] => {
    const rows: (typeof eventLogs.$inferInsert)[] = [];
    // Only the recent tail is filled in: the Logs tab opens on the newest page
    // and pages backwards, so depth over the last week beats a thin smear over
    // the whole window.
    const recentDays = params.days.slice(-RECENT_LOG_DAYS);

    for (const day of recentDays) {
        for (let run = 0; run < MONITOR_RUNS_PER_DAY; run += 1) {
            rows.push(
                ...buildMonitorRun({
                    accountId: params.accountId,
                    day,
                    keywords: params.keywords,
                    listings: params.listings,
                    now: params.now,
                    random: params.random,
                    run,
                    shops: params.shops,
                })
            );
        }
    }

    return rows.filter((row) => (row.occurredAt as Date) <= params.now);
};

/**
 * One monitor run, the way the schedulers actually emit them: a batch of
 * listing syncs, a keyword capture, and a shop sync, all sharing a
 * `monitor_run_id` so the Logs tab's run grouping and run filter have something
 * real to group on.
 */
const buildMonitorRun = (params: {
    accountId: string;
    day: Date;
    keywords: { id: string; keyword: string }[];
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
    run: number;
    shops: SeedShop[];
}): (typeof eventLogs.$inferInsert)[] => {
    const { random } = params;
    const monitorRunId = `run_${toShortId(random)}`;
    const requestId = `req_${toShortId(random)}`;
    const startedAt = shiftMs(
        params.day,
        params.run * 8 * MS_PER_HOUR + random.int(0, 110) * MS_PER_MINUTE
    );
    const base = {
        accountId: params.accountId,
        monitorRunId,
        requestId,
    };
    const rows: (typeof eventLogs.$inferInsert)[] = [];
    let offsetMinutes = 0;
    const nextOccurredAt = (): Date => {
        offsetMinutes += random.int(1, 4);
        return shiftMs(startedAt, offsetMinutes * MS_PER_MINUTE);
    };

    for (const listing of random.shuffle(params.listings).slice(0, random.int(3, 7))) {
        // Roughly one sync in twelve fails, which is what puts a red row and a
        // non-empty error filter in the log.
        const failed = random.chance(0.08);

        rows.push({
            ...base,
            action: failed ? 'listing.sync_failed' : 'listing.synced',
            category: 'listing',
            detailsJson: failed
                ? { attempt: random.int(1, 3), statusCode: random.pick([429, 500, 503]) }
                : { changedFields: random.pick([['quantity'], ['views', 'numFavorers']]) },
            level: failed ? 'error' : 'info',
            listingId: listing.etsyListingId,
            message: failed
                ? `Listing ${listing.etsyListingId} sync failed: Etsy returned an error.`
                : `Synced listing ${listing.etsyListingId} (${listing.title}).`,
            occurredAt: nextOccurredAt(),
            primitiveId: listing.listingId,
            primitiveType: 'listing',
            shopId: listing.shop.etsyShopId,
            status: failed ? 'failed' : 'success',
        });
    }

    const keyword = random.pick(params.keywords);
    const capturedRanks = random.int(3, 6);

    rows.push({
        ...base,
        action: 'keyword.synced',
        category: 'keyword',
        detailsJson: { capturedRanks, pagesScanned: 3 },
        keyword: keyword.keyword,
        level: 'info',
        message: `Captured ${capturedRanks} ranks for "${keyword.keyword}" across 3 pages.`,
        occurredAt: nextOccurredAt(),
        primitiveId: keyword.id,
        primitiveType: 'keyword',
        status: 'success',
    });

    const shop = random.pick(params.shops);
    const discoveredCount = random.poisson(0.8);

    rows.push({
        ...base,
        action: 'shop.synced',
        category: 'shop',
        detailsJson: { discoveredCount, newListingCount: random.int(0, 3) },
        level: discoveredCount > 0 ? 'info' : 'debug',
        message: `Synced shop ${shop.shopName} (${shop.etsyShopId}).`,
        occurredAt: nextOccurredAt(),
        primitiveId: shop.trackedShopId,
        primitiveType: 'shop',
        shopId: shop.etsyShopId,
        status: 'success',
    });

    if (discoveredCount > 0) {
        const discovered = random.pick(params.listings);

        rows.push({
            ...base,
            action: 'listing.discovered',
            category: 'listing',
            detailsJson: { shopId: shop.etsyShopId, shopName: shop.shopName },
            level: 'info',
            listingId: discovered.etsyListingId,
            message:
                `Discovered listing ${discovered.etsyListingId} from shop ` +
                `${shop.shopName} (${shop.etsyShopId}).`,
            occurredAt: nextOccurredAt(),
            primitiveId: discovered.listingId,
            primitiveType: 'listing',
            shopId: shop.etsyShopId,
            status: 'success',
        });
    }

    // A rate-limit warning now and then, so the warn level and the partial
    // status are not empty filters.
    if (random.chance(0.25)) {
        rows.push({
            ...base,
            action: 'listing.bulk_sync_queued',
            category: 'listing',
            detailsJson: { queued: random.int(4, 18), skipped: random.int(0, 3) },
            level: 'warn',
            message: 'Bulk listing sync queued with throttling applied.',
            occurredAt: nextOccurredAt(),
            primitiveType: 'system',
            status: 'partial',
        });
    }

    return rows;
};

/**
 * API call events, weighted into the windows the usage panel reads: the past
 * hour, the rest of the past day, and a thinner tail before that.
 */
const buildApiCallRows = (params: {
    accountId: string;
    now: Date;
    random: SeededRandom;
}): (typeof etsyApiCallEvents.$inferInsert)[] => {
    const { random } = params;
    const rows: (typeof etsyApiCallEvents.$inferInsert)[] = [];

    const push = (offsetMs: number): void => {
        rows.push({
            accountId: params.accountId,
            createdAt: shiftMs(params.now, -offsetMs),
            endpoint: random.pick(ETSY_ENDPOINTS),
        });
    };

    for (let index = 0; index < API_CALLS_PAST_HOUR; index += 1) {
        push(random.int(0, 59) * MS_PER_MINUTE + random.int(0, 59) * 1000);
    }

    for (let index = 0; index < API_CALLS_PAST_DAY; index += 1) {
        push(random.int(61, 23 * 60 + 50) * MS_PER_MINUTE);
    }

    for (let index = 0; index < API_CALLS_EARLIER; index += 1) {
        push(MS_PER_DAY + random.int(1, 6 * 24 * 60) * MS_PER_MINUTE);
    }

    return rows;
};

const toShortId = (random: SeededRandom): string =>
    Array.from({ length: ID_LENGTH }, () => random.int(0, 15).toString(HEX_RADIX)).join('');
