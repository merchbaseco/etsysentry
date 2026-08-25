import type { listingMetricSnapshots, trackedListings } from '../db/schema';
import type { SeededRandom } from './random';
import { isWeekend, MS_PER_DAY, MS_PER_HOUR, shiftMs, toUtcDayLabel } from './time';
import type { SeedListing } from './types';

/**
 * One metric snapshot per listing per day. This is the table the listing
 * history drawer charts, and `deriveListingHistorySales` reads sales out of it
 * indirectly: units sold show up as a falling quantity, and a renewal shows up
 * as the ending timestamp jumping a listing cycle forward. Both shapes are
 * produced here so the estimated-sales column is not a flat zero.
 */

const PRICE_DIVISOR = 100;
const RENEWAL_WINDOW_SECONDS = 60 * 60 * 24 * 120;
const RENEWAL_FLOOR = 8;
const SPIKE_DAY_CHANCE = 0.05;
const SPIKE_MULTIPLIER = 2.6;
const SECONDS_PER_MS = 1000;

interface ListingMetricState {
    endingTimestamp: number;
    favorerCount: number;
    priceAmount: number;
    quantity: number;
    views: number;
}

export interface ListingSnapshotsBuild {
    /** Latest observed metrics per listing, keyed by tracked listing id. */
    latestByListingId: Map<string, ListingMetricState>;
    rows: (typeof listingMetricSnapshots.$inferInsert)[];
}

export const buildListingSnapshots = (params: {
    accountId: string;
    days: Date[];
    listings: SeedListing[];
    now: Date;
    random: SeededRandom;
}): ListingSnapshotsBuild => {
    const rows: (typeof listingMetricSnapshots.$inferInsert)[] = [];
    const latestByListingId = new Map<string, ListingMetricState>();

    for (const [index, listing] of params.listings.entries()) {
        const state = seedInitialState({
            listing,
            now: params.now,
            random: params.random,
        });
        // A stable per-listing observation hour, so the day's rows are not all
        // stacked at midnight and the "observed at" column varies like a real
        // crawl.
        const observationHour = 3 + (index % 14);

        for (const [dayIndex, day] of params.days.entries()) {
            advanceDay({
                day,
                dayIndex,
                dayCount: params.days.length,
                listing,
                random: params.random,
                state,
            });

            rows.push({
                accountId: params.accountId,
                endingTimestamp: state.endingTimestamp,
                favorerCount: state.favorerCount,
                listingId: listing.listingId,
                observedAt: shiftMs(day, observationHour * MS_PER_HOUR),
                observedDate: toUtcDayLabel(day),
                priceAmount: state.priceAmount,
                priceCurrencyCode: listing.currencyCode,
                priceDivisor: PRICE_DIVISOR,
                quantity: state.quantity,
                views: state.views,
            });
        }

        latestByListingId.set(listing.listingId, { ...state });
    }

    return { latestByListingId, rows };
};

/**
 * Copies the newest snapshot onto the tracked listing row. The listings table
 * and the history chart read different tables; if they disagree the dashboard
 * looks broken rather than seeded.
 */
export const applyLatestMetricsToListings = (params: {
    latestByListingId: Map<string, ListingMetricState>;
    rows: (typeof trackedListings.$inferInsert)[];
}): void => {
    for (const row of params.rows) {
        const latest = params.latestByListingId.get(String(row.listingId));

        if (!latest) {
            continue;
        }

        row.endingTimestamp = latest.endingTimestamp;
        row.numFavorers = latest.favorerCount;
        row.priceAmount = latest.priceAmount;
        row.quantity = latest.quantity;
        row.views = latest.views;
    }
};

const seedInitialState = (params: {
    listing: SeedListing;
    now: Date;
    random: SeededRandom;
}): ListingMetricState => {
    const { random } = params;

    return {
        endingTimestamp: Math.floor(
            (params.now.getTime() + random.int(12, 105) * MS_PER_DAY) / SECONDS_PER_MS
        ),
        favorerCount: random.int(4, 380),
        priceAmount: random.int(1200, 8900),
        quantity: random.int(60, 480),
        views: random.int(180, 9000),
    };
};

const advanceDay = (params: {
    day: Date;
    dayCount: number;
    dayIndex: number;
    listing: SeedListing;
    random: SeededRandom;
    state: ListingMetricState;
}): void => {
    const { random, state } = params;
    // Weekends run hot, and the window trends gently upward, so the charts have
    // a shape instead of noise around a constant.
    const weekendBoost = isWeekend(params.day) ? 1.45 : 1;
    const trend = 0.8 + (0.45 * params.dayIndex) / Math.max(1, params.dayCount - 1);
    const spike = random.chance(SPIKE_DAY_CHANCE) ? SPIKE_MULTIPLIER : 1;
    const unitsSold = random.poisson(params.listing.demand * weekendBoost * trend * spike);

    if (state.quantity - unitsSold < RENEWAL_FLOOR || random.chance(0.02)) {
        state.quantity += random.int(90, 320);
        state.endingTimestamp += RENEWAL_WINDOW_SECONDS;
    } else {
        state.quantity -= unitsSold;
    }

    state.views += unitsSold * random.int(6, 22) + random.poisson(params.listing.demand * 11);
    state.favorerCount += random.poisson(params.listing.demand * 0.55);

    if (random.chance(0.03)) {
        state.priceAmount = Math.max(500, state.priceAmount + random.int(-400, 600));
    }
};
