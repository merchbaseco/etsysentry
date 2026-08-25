import type { trackedShopListings, trackedShopSnapshots, trackedShops } from '../db/schema';
import { SHOP_NAMES } from './catalog';
import type { SeededRandom } from './random';
import { isWeekend, MS_PER_HOUR, MS_PER_MINUTE, shiftDays, shiftMs } from './time';
import type { SeedListing, SeedShop } from './types';

/**
 * Shop monitoring: the tracked shops themselves, one daily snapshot each, and
 * the per-shop listing roster that shop discovery would have built up. The
 * snapshot deltas are what `deriveShopSalesPerDay` and
 * `deriveShopFavoritesPerDay` average, so they have to be positive on most days
 * for the overview's derived rates to be anything but null.
 */

const ETSY_SHOP_ID_MIN = 12_000_000;
const ETSY_SHOP_ID_MAX = 58_999_999;
const SHOP_LISTING_ROSTER_MIN = 9;
const SHOP_LISTING_ROSTER_MAX = 18;
const ETSY_LISTING_ID_MIN = 1_100_000_000;
const ETSY_LISTING_ID_MAX = 1_899_999_999;

export interface ShopActivityBuild {
    listingRows: (typeof trackedShopListings.$inferInsert)[];
    rows: (typeof trackedShops.$inferInsert)[];
    snapshotRows: (typeof trackedShopSnapshots.$inferInsert)[];
}

/**
 * Shop identities are minted before listings so a listing can name the shop it
 * belongs to, and the shop's roster can point back at real tracked listings.
 */
export const buildShopIdentities = (random: SeededRandom): SeedShop[] =>
    SHOP_NAMES.map((shopName, index) => ({
        etsyShopId: String(random.int(ETSY_SHOP_ID_MIN, ETSY_SHOP_ID_MAX)),
        isOwnShop: index === 0,
        shopName,
        shopUrl: `https://www.etsy.com/shop/${shopName}`,
        trackedShopId: random.uuid(),
    }));

export const buildShopActivity = (params: {
    accountId: string;
    days: Date[];
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
    shops: SeedShop[];
}): ShopActivityBuild => {
    const rows: (typeof trackedShops.$inferInsert)[] = [];
    const snapshotRows: (typeof trackedShopSnapshots.$inferInsert)[] = [];
    const listingRows: (typeof trackedShopListings.$inferInsert)[] = [];

    for (const [index, shop] of params.shops.entries()) {
        const roster = buildRoster({
            listings: params.listings,
            random: params.random,
            shop,
        });

        snapshotRows.push(
            ...buildShopSnapshots({
                accountId: params.accountId,
                days: params.days,
                random: params.random,
                rosterSize: roster.length,
                shop,
            })
        );
        listingRows.push(
            ...buildShopListingRows({
                accountId: params.accountId,
                now: params.now,
                random: params.random,
                roster,
                shop,
            })
        );
        rows.push(
            buildShopRow({
                accountId: params.accountId,
                index,
                now: params.now,
                random: params.random,
                shop,
            })
        );
    }

    return { listingRows, rows, snapshotRows };
};

const buildShopRow = (params: {
    accountId: string;
    index: number;
    now: Date;
    random: SeededRandom;
    shop: SeedShop;
}): typeof trackedShops.$inferInsert => {
    const { random, shop } = params;
    const lastRefreshedAt = shiftMs(params.now, -random.int(20, 900) * MS_PER_MINUTE);
    const trackingState = params.index === 3 ? 'paused' : 'active';

    return {
        accountId: params.accountId,
        createdAt: shiftDays(params.now, -random.int(40, 180)),
        etsyShopId: shop.etsyShopId,
        lastRefreshError: null,
        lastRefreshedAt,
        lastSyncedListingUpdatedTimestamp: Math.floor(lastRefreshedAt.getTime() / 1000),
        nextSyncAt: shiftMs(params.now, random.int(30, 480) * MS_PER_MINUTE),
        shopName: shop.shopName,
        shopUrl: shop.shopUrl,
        // One shop is mid-sync on every run, so the dashboard's in-flight
        // counter and the shop table's sync badge are never both empty.
        syncState: params.index === 1 ? 'syncing' : 'idle',
        trackedShopId: shop.trackedShopId,
        trackingState,
        updatedAt: lastRefreshedAt,
    };
};

interface ShopMetricState {
    favoritesTotal: number;
    reviewTotal: number;
    soldTotal: number;
}

const buildShopSnapshots = (params: {
    accountId: string;
    days: Date[];
    random: SeededRandom;
    rosterSize: number;
    shop: SeedShop;
}): (typeof trackedShopSnapshots.$inferInsert)[] => {
    const { random, shop } = params;
    const state: ShopMetricState = {
        favoritesTotal: random.int(400, 9000),
        reviewTotal: random.int(60, 2400),
        soldTotal: random.int(900, 24_000),
    };
    const scale = shop.isOwnShop ? 1.6 : random.between(0.5, 1.2);
    let activeListingCount = params.rosterSize + random.int(20, 140);

    return params.days.map((day) => {
        const weekendBoost = isWeekend(day) ? 1.5 : 1;
        const soldDelta = random.poisson(9 * scale * weekendBoost);
        const favoritesDelta = random.poisson(6 * scale * weekendBoost);
        const reviewDelta = random.poisson(1.1 * scale);
        const newListingCount = random.poisson(0.7 * scale);

        state.soldTotal += soldDelta;
        state.favoritesTotal += favoritesDelta;
        state.reviewTotal += reviewDelta;
        activeListingCount += newListingCount - random.poisson(0.4);

        return {
            accountId: params.accountId,
            activeListingCount: Math.max(1, activeListingCount),
            etsyShopId: shop.etsyShopId,
            favoritesDelta,
            favoritesTotal: state.favoritesTotal,
            newListingCount,
            observedAt: shiftMs(day, 5 * MS_PER_HOUR),
            reviewDelta,
            reviewTotal: state.reviewTotal,
            soldDelta,
            soldTotal: state.soldTotal,
            trackedShopId: shop.trackedShopId,
        };
    });
};

interface RosterEntry {
    etsyListingId: string;
    isTracked: boolean;
}

/**
 * The roster mixes listings the account also tracks with listings only ever
 * seen through shop discovery, which is what the shop activity tab shows.
 */
const buildRoster = (params: {
    listings: SeedListing[];
    random: SeededRandom;
    shop: SeedShop;
}): RosterEntry[] => {
    const tracked = params.listings
        .filter((listing) => listing.shop.etsyShopId === params.shop.etsyShopId)
        .map((listing) => ({ etsyListingId: listing.etsyListingId, isTracked: true }));
    const discoveredCount = Math.max(
        0,
        params.random.int(SHOP_LISTING_ROSTER_MIN, SHOP_LISTING_ROSTER_MAX) - tracked.length
    );
    const discovered = Array.from({ length: discoveredCount }, () => ({
        etsyListingId: String(params.random.int(ETSY_LISTING_ID_MIN, ETSY_LISTING_ID_MAX)),
        isTracked: false,
    }));

    return [...tracked, ...discovered];
};

const buildShopListingRows = (params: {
    accountId: string;
    now: Date;
    random: SeededRandom;
    roster: RosterEntry[];
    shop: SeedShop;
}): (typeof trackedShopListings.$inferInsert)[] =>
    params.roster.map((entry, index) => {
        const { random } = params;
        const firstSeenAt = shiftDays(params.now, -random.int(2, 120));
        const lastChangedAt = shiftMs(params.now, -random.int(30, 6000) * MS_PER_MINUTE);

        return {
            accountId: params.accountId,
            createdAt: firstSeenAt,
            etsyListingId: entry.etsyListingId,
            etsyShopId: params.shop.etsyShopId,
            firstSeenAt,
            // A retired listing or two per shop, so the "no longer active"
            // affordance has something to show.
            isActive: index % 9 !== 8,
            lastChangedAt,
            lastSeenAt: shiftMs(params.now, -random.int(10, 400) * MS_PER_MINUTE),
            listingUpdatedTimestamp: Math.floor(lastChangedAt.getTime() / 1000),
            trackedShopId: params.shop.trackedShopId,
            updatedAt: lastChangedAt,
        };
    });
