import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots, trackedListings } from '../../db/schema';

const DEFAULT_HISTORY_DAYS = 30;

export interface ListingMetricHistoryPrice {
    amount: number;
    currencyCode: string;
    divisor: number;
    value: number;
}

export interface ListingMetricHistoryItem {
    favorerCount: number | null;
    observedAt: string;
    observedDate: string;
    price: ListingMetricHistoryPrice | null;
    quantity: number | null;
    views: number | null;
}

export interface ListingMetricHistory {
    days: number;
    etsyListingId: string;
    items: ListingMetricHistoryItem[];
    listingId: string;
    title: string;
}

export const normalizeHistoryDays = (days: number | undefined): number => {
    if (!(days && Number.isFinite(days)) || days < 1) {
        return DEFAULT_HISTORY_DAYS;
    }

    return Math.floor(days);
};

export const toEarliestObservedDate = (params: { now: Date; days: number }): string => {
    const normalized = normalizeHistoryDays(params.days);
    const boundary = new Date(params.now);
    boundary.setUTCHours(0, 0, 0, 0);
    boundary.setUTCDate(boundary.getUTCDate() - (normalized - 1));

    return boundary.toISOString().slice(0, 10);
};

const toHistoryItem = (
    row: typeof listingMetricSnapshots.$inferSelect
): ListingMetricHistoryItem => {
    let price: ListingMetricHistoryPrice | null = null;

    if (
        row.priceAmount !== null &&
        row.priceDivisor !== null &&
        row.priceCurrencyCode !== null &&
        row.priceDivisor > 0
    ) {
        price = {
            amount: row.priceAmount,
            divisor: row.priceDivisor,
            currencyCode: row.priceCurrencyCode,
            value: row.priceAmount / row.priceDivisor,
        };
    }

    return {
        observedDate: row.observedDate,
        observedAt: row.observedAt.toISOString(),
        views: row.views,
        favorerCount: row.favorerCount,
        quantity: row.quantity,
        price,
    };
};

export const getListingMetricHistory = async (params: {
    accountId: string;
    trackedListingId: string;
    days?: number;
}): Promise<ListingMetricHistory> => {
    const days = normalizeHistoryDays(params.days);
    const earliestObservedDate = toEarliestObservedDate({
        now: new Date(),
        days,
    });

    const [listing] = await db
        .select({
            listingId: trackedListings.listingId,
            etsyListingId: trackedListings.etsyListingId,
            title: trackedListings.title,
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.listingId, params.trackedListingId)
            )
        )
        .limit(1);

    if (!listing) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked listing was not found for this account.',
        });
    }

    const rows = await db
        .select()
        .from(listingMetricSnapshots)
        .where(
            and(
                eq(listingMetricSnapshots.accountId, params.accountId),
                eq(listingMetricSnapshots.listingId, params.trackedListingId),
                gte(listingMetricSnapshots.observedDate, earliestObservedDate)
            )
        )
        .orderBy(desc(listingMetricSnapshots.observedDate));

    return {
        listingId: listing.listingId,
        etsyListingId: listing.etsyListingId,
        title: listing.title,
        days,
        items: rows.map(toHistoryItem),
    };
};
