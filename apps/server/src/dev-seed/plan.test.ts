import { describe, expect, test } from 'bun:test';
import { deriveListingHistorySales } from '../services/listings/derive-listing-history-sales';
import { deriveShopSalesPerDay } from '../services/shops/derive-shop-sales-per-day';
import { buildDevSeedPlan, countPlanRows, DEFAULT_SEED_OPTIONS } from './plan';
import { toUtcDayLabel } from './time';
import type { DevSeedOptions, DevSeedPlan } from './types';

/**
 * The coverage contract. The seed exists so a developer can open any EtsySentry
 * surface without hand-building data, and these assertions are that promise
 * rather than incidental shape checks: if one fails, some view boots empty.
 */

const NOW = new Date('2026-08-25T19:30:00.000Z');

const buildPlan = (overrides: Partial<DevSeedOptions> = {}): DevSeedPlan =>
    buildDevSeedPlan({ ...DEFAULT_SEED_OPTIONS, now: NOW, ...overrides });

describe('dev seed plan', () => {
    test('is reproducible for a seed and varied across seeds', () => {
        expect(buildPlan()).toEqual(buildPlan());
        expect(buildPlan({ seed: 'friday' })).not.toEqual(buildPlan());
    });

    test('fills every table the dashboard reads', () => {
        const plan = buildPlan();

        for (const [table, count] of Object.entries(plan.summary)) {
            expect(count, `${table} has no rows`).toBeGreaterThan(0);
        }
    });

    test('stays a small slice rather than a data dump', () => {
        expect(countPlanRows(buildPlan())).toBeLessThan(5000);
    });

    test('seeds a listings tab with mixed states, prices, and thumbnails', () => {
        const rows = buildPlan().trackedListings;

        expect(rows.length).toBe(DEFAULT_SEED_OPTIONS.listingCount);
        expect(new Set(rows.map((row) => row.trackingState))).toEqual(
            new Set(['active', 'paused', 'error'])
        );
        expect(new Set(rows.map((row) => row.syncState))).toEqual(
            new Set(['idle', 'queued', 'syncing'])
        );
        expect(new Set(rows.map((row) => row.etsyState)).size).toBeGreaterThan(2);
        expect(rows.some((row) => row.isDigital)).toBe(true);
        expect(rows.some((row) => row.lastRefreshError !== null)).toBe(true);
        expect(new Set(rows.map((row) => row.priceCurrencyCode)).size).toBeGreaterThan(1);
        expect(rows.every((row) => String(row.thumbnailUrl).startsWith('data:image/svg'))).toBe(
            true
        );
        // The table and the history chart read different tables; a listing with
        // no live metrics renders a row of dashes.
        expect(rows.every((row) => typeof row.quantity === 'number')).toBe(true);
        expect(rows.every((row) => typeof row.views === 'number')).toBe(true);
    });

    test('the dashboard job counters are non-zero', () => {
        const plan = buildPlan();
        const inFlight = [
            ...plan.trackedListings,
            ...plan.trackedKeywords,
            ...plan.trackedShops,
        ].filter((row) => row.syncState === 'syncing' || row.syncState === 'queued');

        expect(inFlight.length).toBeGreaterThan(1);
    });

    test('listing history covers the window and yields estimated sales', () => {
        const plan = buildPlan();
        const byListing = new Map<string, typeof plan.listingSnapshots>();

        for (const row of plan.listingSnapshots) {
            const key = String(row.listingId);
            byListing.set(key, [...(byListing.get(key) ?? []), row]);
        }

        expect(byListing.size).toBe(DEFAULT_SEED_OPTIONS.listingCount);

        let listingsWithSales = 0;

        for (const rows of byListing.values()) {
            expect(rows.length).toBe(DEFAULT_SEED_OPTIONS.dayCount);
            expect(rows.at(-1)?.observedDate).toBe(toUtcDayLabel(NOW));

            // Run the real derivation, not a lookalike: the estimated-sales
            // column is the point of the snapshot table.
            const sales = deriveListingHistorySales(
                rows.map((row) => ({
                    endingTimestamp: row.endingTimestamp ?? null,
                    quantity: row.quantity ?? null,
                }))
            );

            if ((sales.at(-1)?.estimatedSoldCount ?? 0) > 0) {
                listingsWithSales += 1;
            }
        }

        expect(listingsWithSales).toBeGreaterThan(DEFAULT_SEED_OPTIONS.listingCount / 2);
    });

    test('sales follow a head and a long tail rather than a flat line', () => {
        const plan = buildPlan();
        const soldByListing = new Map<string, number>();

        for (const listing of plan.listings) {
            const rows = plan.listingSnapshots.filter((row) => row.listingId === listing.listingId);
            const sales = deriveListingHistorySales(
                rows.map((row) => ({
                    endingTimestamp: row.endingTimestamp ?? null,
                    quantity: row.quantity ?? null,
                }))
            );
            soldByListing.set(listing.listingId, sales.at(-1)?.estimatedSoldCount ?? 0);
        }

        const ranked = [...soldByListing.values()].sort((left, right) => right - left);

        expect(ranked[0]).toBeGreaterThan((ranked.at(-1) ?? 0) + 5);
    });

    test('every keyword has a capture per day, newest today, with one instant per capture', () => {
        const plan = buildPlan();

        for (const keyword of plan.trackedKeywords) {
            const ranks = plan.keywordRanks.filter((row) => row.trackedKeywordId === keyword.id);
            const captures = new Set(ranks.map((row) => (row.observedAt as Date).toISOString()));

            expect(captures.size).toBe(DEFAULT_SEED_OPTIONS.dayCount);
            expect(toUtcDayLabel(new Date([...captures].sort().at(-1) ?? 0))).toBe(
                toUtcDayLabel(NOW)
            );

            // The activity query selects the newest capture by timestamp
            // equality, so a capture split across instants shows one listing.
            const newest = [...captures].sort().at(-1);
            const newestRows = ranks.filter(
                (row) => (row.observedAt as Date).toISOString() === newest
            );
            expect(newestRows.length).toBeGreaterThan(2);
        }
    });

    test('the window outruns the longest comparison the dashboard offers', () => {
        // Keyword activity compares against the rank 30 days back. A window of
        // exactly 30 days reaches only 29 days back, so every 30-day change
        // column would render zero.
        expect(DEFAULT_SEED_OPTIONS.dayCount).toBeGreaterThan(31);
    });

    test('keyword ranks move, so the change columns are not all zero', () => {
        const plan = buildPlan();
        const movement = new Set(plan.keywordRanks.map((row) => row.rank));

        expect(movement.size).toBeGreaterThan(10);
        expect(plan.keywordRanks.every((row) => row.rank >= 1 && row.rank <= 144)).toBe(true);
        // Ranks reference tracked listings by primary key; a dangling id would
        // fail the foreign key at write time.
        const listingIds = new Set(plan.trackedListings.map((row) => row.listingId));
        expect(plan.keywordRanks.every((row) => listingIds.has(row.listingId))).toBe(true);
    });

    test('shop overview has snapshots whose deltas derive a sales rate', () => {
        const plan = buildPlan();

        for (const shop of plan.trackedShops) {
            const snapshots = plan.shopSnapshots.filter(
                (row) => row.trackedShopId === shop.trackedShopId
            );

            expect(snapshots.length).toBe(DEFAULT_SEED_OPTIONS.dayCount);

            const derived = deriveShopSalesPerDay({
                snapshots: snapshots.map((row) => ({
                    observedAt: row.observedAt as Date,
                    soldDelta: row.soldDelta ?? null,
                })),
            });

            expect(derived.value).not.toBeNull();
            expect(derived.coverageDays).toBeGreaterThan(0);
        }

        expect(plan.shopListings.some((row) => row.isActive === false)).toBe(true);
        expect(plan.shopListings.some((row) => row.isActive === true)).toBe(true);
    });

    test('the log view has every level, status, and primitive it filters on', () => {
        const rows = buildPlan().eventLogs;

        expect(new Set(rows.map((row) => row.level))).toEqual(
            new Set(['info', 'warn', 'error', 'debug'])
        );
        expect(new Set(rows.map((row) => row.status))).toEqual(
            new Set(['success', 'failed', 'partial'])
        );
        expect(new Set(rows.map((row) => row.primitiveType)).size).toBeGreaterThan(3);
        expect(new Set(rows.map((row) => row.action)).size).toBeGreaterThan(3);
        // The Logs tab groups by monitor run; a null run id leaves it flat.
        expect(rows.every((row) => typeof row.monitorRunId === 'string')).toBe(true);
        expect(new Set(rows.map((row) => row.monitorRunId)).size).toBeGreaterThan(5);
        expect(rows.every((row) => (row.occurredAt as Date) <= NOW)).toBe(true);
    });

    test('api usage counters are non-zero for the past hour and the past day', () => {
        const rows = buildPlan().apiCallEvents;
        const pastHour = rows.filter(
            (row) => NOW.getTime() - (row.createdAt as Date).getTime() <= 60 * 60 * 1000
        );
        const pastDay = rows.filter(
            (row) => NOW.getTime() - (row.createdAt as Date).getTime() <= 24 * 60 * 60 * 1000
        );

        expect(pastHour.length).toBeGreaterThan(5);
        expect(pastDay.length).toBeGreaterThan(pastHour.length);
        expect(new Set(rows.map((row) => row.endpoint)).size).toBeGreaterThan(2);
    });

    test('honours a shorter window', () => {
        const plan = buildPlan({ dayCount: 7 });
        const days = new Set(plan.listingSnapshots.map((row) => row.observedDate));

        expect(days.size).toBe(7);
        expect([...days].sort().at(-1)).toBe(toUtcDayLabel(NOW));
    });

    test('maps the account to a merchbase user so a dev can sign in against it', () => {
        const plan = buildPlan({ merchbaseUserId: 'mbu_local_dev' });

        expect(plan.account.merchbaseUserId).toBe('mbu_local_dev');
        expect(plan.account.id).toBe(plan.accountId);
    });
});
