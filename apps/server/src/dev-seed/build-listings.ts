import type { listingTags, tags, trackedListings } from '../db/schema';
import {
    CURRENCY_CODES,
    DIGITAL_OBJECTS,
    LISTING_OBJECTS,
    LISTING_QUALIFIERS,
    LISTING_SUBJECTS,
    TAG_VOCABULARY,
} from './catalog';
import type { SeededRandom } from './random';
import { buildThumbnailDataUri } from './thumbnail';
import { MS_PER_HOUR, MS_PER_MINUTE, shiftDays, shiftMs } from './time';
import type { SeedListing, SeedShop } from './types';

/**
 * The account's tracked listings and their tag vocabulary. The states are
 * deliberately mixed: the dashboard's status column, the sync-job counters, and
 * the error affordances are all empty on a listing set that is uniformly
 * healthy and idle.
 */

const ETSY_LISTING_ID_MIN = 1_100_000_000;
const ETSY_LISTING_ID_MAX = 1_899_999_999;
const PRICE_DIVISOR = 100;
const TAGS_PER_LISTING_MIN = 4;
const TAGS_PER_LISTING_MAX = 8;
const COMPETITOR_LISTINGS = 3;

export interface ListingsBuild {
    listings: SeedListing[];
    listingTagRows: (typeof listingTags.$inferInsert)[];
    rows: (typeof trackedListings.$inferInsert)[];
    tagRows: (typeof tags.$inferInsert)[];
}

export const buildListings = (params: {
    accountId: string;
    listingCount: number;
    now: Date;
    random: SeededRandom;
    shops: SeedShop[];
}): ListingsBuild => {
    const ownShop = params.shops.find((shop) => shop.isOwnShop) ?? params.shops[0];

    if (!ownShop) {
        throw new Error('Dev seed requires at least one shop.');
    }

    const tagRows = TAG_VOCABULARY.map((normalizedTag) => ({
        id: params.random.uuid(),
        normalizedTag,
    }));

    const listings: SeedListing[] = [];
    const rows: (typeof trackedListings.$inferInsert)[] = [];
    const listingTagRows: (typeof listingTags.$inferInsert)[] = [];
    const shopByIndex = assignShops({
        listingCount: params.listingCount,
        ownShop,
        shops: params.shops,
    });

    for (let index = 0; index < params.listingCount; index += 1) {
        const listing = buildListing({
            index,
            ownShop,
            random: params.random,
            shop: shopByIndex[index] ?? ownShop,
        });

        listings.push(listing);
        rows.push(
            buildListingRow({
                accountId: params.accountId,
                index,
                listing,
                now: params.now,
                random: params.random,
            })
        );
        listingTagRows.push(
            ...pickTags({ random: params.random, tagRows }).map((tagId) => ({
                listingId: listing.listingId,
                tagId,
            }))
        );
    }

    return { listingTagRows, listings, rows, tagRows };
};

/**
 * Most tracked listings are the operator's own, but every watched shop gets a
 * few as well. The shop activity tab lists only the listings the account
 * actually tracks for that shop, so a competitor with one tracked listing
 * renders an almost-empty tab. Competitors are assigned from the tail, which
 * keeps the operator's own best sellers at the head of the catalog and matches
 * how a competitor's items actually get tracked — a few at a time, none of them
 * your top line.
 */
const assignShops = (params: {
    listingCount: number;
    ownShop: SeedShop;
    shops: SeedShop[];
}): SeedShop[] => {
    const assignment = Array.from({ length: params.listingCount }, () => params.ownShop);
    const competitors = params.shops.filter((shop) => shop !== params.ownShop);
    let slot = params.listingCount - 1;

    for (const shop of competitors) {
        for (let taken = 0; taken < COMPETITOR_LISTINGS && slot > 0; taken += 1) {
            assignment[slot] = shop;
            slot -= 1;
        }
    }

    return assignment;
};

const buildListing = (params: {
    index: number;
    ownShop: SeedShop;
    random: SeededRandom;
    shop: SeedShop;
}): SeedListing => {
    const { random, shop } = params;
    const isDigital = params.index < DIGITAL_OBJECTS.length;
    const object = isDigital
        ? (DIGITAL_OBJECTS[params.index] ?? DIGITAL_OBJECTS[0])
        : random.pick(LISTING_OBJECTS);
    const title = `${random.pick(LISTING_QUALIFIERS)} ${random.pick(LISTING_SUBJECTS)} ${object}`;

    return {
        currencyCode: pickCurrencyCode(params.index),
        // A steep head and a long tail: rank 0 sells many times what rank 20
        // does, which is what makes the sparklines and top-seller ordering
        // meaningful.
        demand: 4 / (params.index + 1.6) + random.between(0, 0.35),
        etsyListingId: String(random.int(ETSY_LISTING_ID_MIN, ETSY_LISTING_ID_MAX)),
        isTrackedShopListing: shop !== params.ownShop,
        listingId: random.uuid(),
        shop,
        title,
    };
};

const buildListingRow = (params: {
    accountId: string;
    index: number;
    listing: SeedListing;
    now: Date;
    random: SeededRandom;
}): typeof trackedListings.$inferInsert => {
    const { listing, random } = params;
    const isDigital = DIGITAL_OBJECTS.some((object) => listing.title.endsWith(object));
    const trackingState = pickTrackingState(params.index);
    const syncState = pickSyncState(params.index);
    const lastRefreshedAt = shiftMs(params.now, -random.int(5, 600) * MS_PER_MINUTE);

    return {
        accountId: params.accountId,
        createdAt: shiftDays(params.now, -random.int(45, 240)),
        // Live metric columns are overwritten from the newest daily snapshot in
        // `build-listing-snapshots`, so the table and the history chart agree.
        endingTimestamp: null,
        etsyListingId: listing.etsyListingId,
        etsyState: pickEtsyState(params.index),
        isDigital,
        lastRefreshError:
            trackingState === 'error' ? 'Etsy getListing failed with HTTP 429.' : null,
        lastRefreshedAt,
        listingId: listing.listingId,
        numFavorers: null,
        priceCurrencyCode: listing.currencyCode,
        priceDivisor: PRICE_DIVISOR,
        quantity: null,
        shopId: listing.shop.etsyShopId,
        shopName: listing.shop.shopName,
        shouldAutoRenew: random.chance(0.7),
        syncState,
        thumbnailUrl: buildThumbnailDataUri({
            swatchIndex: params.index,
            title: listing.title,
        }),
        title: listing.title,
        trackingState,
        updatedAt: lastRefreshedAt,
        updatedTimestamp: Math.floor(shiftMs(lastRefreshedAt, -MS_PER_HOUR).getTime() / 1000),
        url: `https://www.etsy.com/listing/${listing.etsyListingId}/`,
        views: null,
    };
};

/** Indexes rather than chance, so every run shows each state exactly once. */
const pickTrackingState = (index: number): 'active' | 'paused' | 'error' => {
    if (index === 3) {
        return 'paused';
    }

    if (index === 7) {
        return 'error';
    }

    return 'active';
};

const pickSyncState = (index: number): 'idle' | 'queued' | 'syncing' => {
    if (index === 1) {
        return 'syncing';
    }

    if (index === 2 || index === 9) {
        return 'queued';
    }

    return 'idle';
};

const pickEtsyState = (index: number): 'active' | 'inactive' | 'sold_out' | 'expired' | 'draft' => {
    if (index === 5) {
        return 'sold_out';
    }

    if (index === 11) {
        return 'expired';
    }

    if (index === 13) {
        return 'draft';
    }

    return 'active';
};

/** A couple of non-USD listings, so the currency conversion path is exercised. */
const pickCurrencyCode = (index: number): string =>
    CURRENCY_CODES[index % 8 === 6 ? (index % 3) % CURRENCY_CODES.length : 0] ?? 'USD';

const pickTags = (params: { random: SeededRandom; tagRows: { id: string }[] }): string[] =>
    params.random
        .shuffle(params.tagRows)
        .slice(0, params.random.int(TAGS_PER_LISTING_MIN, TAGS_PER_LISTING_MAX))
        .map((tag) => tag.id);
