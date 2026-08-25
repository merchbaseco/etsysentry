import { buildActivity } from './build-activity';
import { buildKeywords } from './build-keywords';
import { applyLatestMetricsToListings, buildListingSnapshots } from './build-listing-snapshots';
import { buildListings } from './build-listings';
import { buildShopActivity, buildShopIdentities } from './build-shops';
import { CURRENCY_RATES } from './catalog';
import { createSeededRandom } from './random';
import { buildDayWindow, MS_PER_HOUR, shiftDays, shiftMs } from './time';
import type { DevSeedOptions, DevSeedPlan } from './types';

/**
 * Builds the whole synthetic dataset in memory. The plan is a pure function of
 * the options — seed string and `now` included — which is what makes a run
 * reproducible while still always describing the current week.
 */

/**
 * 35 days, not 30. The keyword activity view compares today's rank against the
 * rank 30 days earlier, and a 30-day window's oldest capture is only 29 days
 * back — so the 30-day change column would read a flat zero for every listing.
 * The extra week gives every comparison the dashboard offers a real baseline.
 */
export const DEFAULT_SEED_OPTIONS = {
    accountId: 'acct_dev_seed',
    dayCount: 35,
    keywordCount: 6,
    listingCount: 24,
    merchbaseUserId: 'mbu_dev_seed',
    seed: 'etsysentry-dev',
} as const;

export const buildDevSeedPlan = (options: DevSeedOptions): DevSeedPlan => {
    const random = createSeededRandom(options.seed);
    const days = buildDayWindow({ dayCount: options.dayCount, now: options.now });

    const shops = buildShopIdentities(random);
    const catalog = buildListings({
        accountId: options.accountId,
        listingCount: options.listingCount,
        now: options.now,
        random,
        shops,
    });

    const snapshots = buildListingSnapshots({
        accountId: options.accountId,
        days,
        listings: catalog.listings,
        now: options.now,
        random,
    });
    applyLatestMetricsToListings({
        latestByListingId: snapshots.latestByListingId,
        rows: catalog.rows,
    });

    const keywords = buildKeywords({
        accountId: options.accountId,
        days,
        keywordCount: options.keywordCount,
        listings: catalog.listings,
        now: options.now,
        random,
    });

    const shopActivity = buildShopActivity({
        accountId: options.accountId,
        days,
        listings: catalog.listings,
        now: options.now,
        random,
        shops,
    });

    const activity = buildActivity({
        accountId: options.accountId,
        days,
        keywords: keywords.rows.map((row) => ({
            id: String(row.id),
            keyword: String(row.keyword),
        })),
        listings: catalog.listings,
        now: options.now,
        random,
        shops,
    });

    const plan: Omit<DevSeedPlan, 'summary'> = {
        account: {
            createdAt: shiftDays(options.now, -180),
            id: options.accountId,
            merchbaseUserId: options.merchbaseUserId,
            updatedAt: options.now,
        },
        accountId: options.accountId,
        apiCallEvents: activity.apiCallRows,
        currencyRate: {
            baseCurrency: 'USD',
            fetchedAt: shiftMs(options.now, -3 * MS_PER_HOUR),
            lastRefreshError: null,
            nextRefreshAt: shiftMs(options.now, 9 * MS_PER_HOUR),
            provider: 'dev-seed',
            ratesJson: JSON.stringify(CURRENCY_RATES),
            updatedAt: shiftMs(options.now, -3 * MS_PER_HOUR),
        },
        eventLogs: activity.eventLogRows,
        keywordRanks: keywords.rankRows,
        listingSnapshots: snapshots.rows,
        listingTags: catalog.listingTagRows,
        listings: catalog.listings,
        shopListings: shopActivity.listingRows,
        shopSnapshots: shopActivity.snapshotRows,
        tags: catalog.tagRows,
        trackedKeywords: keywords.rows,
        trackedListings: catalog.rows,
        trackedShops: shopActivity.rows,
    };

    return { ...plan, summary: summarize(plan) };
};

const summarize = (plan: Omit<DevSeedPlan, 'summary'>): Record<string, number> => ({
    currency_rates: 1,
    etsy_api_call_events: plan.apiCallEvents.length,
    event_logs: plan.eventLogs.length,
    listing_metric_snapshots: plan.listingSnapshots.length,
    listing_tags: plan.listingTags.length,
    product_keyword_ranks: plan.keywordRanks.length,
    tags: plan.tags.length,
    tracked_keywords: plan.trackedKeywords.length,
    tracked_listings: plan.trackedListings.length,
    tracked_shop_listings: plan.shopListings.length,
    tracked_shop_snapshots: plan.shopSnapshots.length,
    tracked_shops: plan.trackedShops.length,
});

export const countPlanRows = (plan: DevSeedPlan): number =>
    Object.values(plan.summary).reduce((total, count) => total + count, 0);
