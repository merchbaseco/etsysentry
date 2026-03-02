import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots, trackedListings } from '../../db/schema';
import { deriveListingHistorySales } from './derive-listing-history-sales';

const DEFAULT_HISTORY_DAYS = 30;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ListingMetricHistoryPrice {
    amount: number;
    currencyCode: string;
    divisor: number;
    value: number;
}

export interface ListingMetricHistoryItem {
    endingTimestamp: number | null;
    estimatedSoldCount: number;
    estimatedSoldDelta: number;
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
    fromObservedDate: string;
    items: ListingMetricHistoryItem[];
    listingId: string;
    title: string;
    toObservedDate: string;
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

const toUtcDayString = (value: Date): string => {
    return value.toISOString().slice(0, 10);
};

const parseIsoDate = (value: string): Date | null => {
    if (!ISO_DATE_REGEX.test(value)) {
        return null;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

const toHistoryWindowFromDays = (
    days: number
): {
    days: number;
    fromObservedDate: string;
    toObservedDate: string;
} => {
    const now = new Date();
    const toObservedDate = toUtcDayString(now);
    const fromObservedDate = toEarliestObservedDate({
        now,
        days,
    });

    return {
        days,
        fromObservedDate,
        toObservedDate,
    };
};

const toHistoryWindowFromDateRange = (params: {
    fromObservedDate: string;
    toObservedDate: string;
}): {
    days: number;
    fromObservedDate: string;
    toObservedDate: string;
} => {
    const fromDate = parseIsoDate(params.fromObservedDate);
    const toDate = parseIsoDate(params.toObservedDate);

    if (!(fromDate && toDate)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Range dates must use YYYY-MM-DD format.',
        });
    }

    if (fromDate > toDate) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Range start must be on or before range end.',
        });
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay) + 1;

    return {
        days,
        fromObservedDate: params.fromObservedDate,
        toObservedDate: params.toObservedDate,
    };
};

export const resolveHistoryWindow = (params: {
    days?: number;
    fromObservedDate?: string;
    toObservedDate?: string;
}): {
    days: number;
    fromObservedDate: string;
    toObservedDate: string;
} => {
    const { fromObservedDate, toObservedDate } = params;
    const hasFrom = typeof fromObservedDate === 'string';
    const hasTo = typeof toObservedDate === 'string';

    if (hasFrom || hasTo) {
        if (!(hasFrom && hasTo)) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Both range start and end are required when using date range input.',
            });
        }

        return toHistoryWindowFromDateRange({
            fromObservedDate,
            toObservedDate,
        });
    }

    return toHistoryWindowFromDays(normalizeHistoryDays(params.days));
};

const toHistoryItem = (params: {
    row: typeof listingMetricSnapshots.$inferSelect;
    estimatedSoldCount: number;
    estimatedSoldDelta: number;
}): ListingMetricHistoryItem => {
    const row = params.row;
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
        endingTimestamp: row.endingTimestamp,
        estimatedSoldCount: params.estimatedSoldCount,
        estimatedSoldDelta: params.estimatedSoldDelta,
        observedDate: row.observedDate,
        observedAt: row.observedAt.toISOString(),
        views: row.views,
        favorerCount: row.favorerCount,
        quantity: row.quantity,
        price,
    };
};

const toHistoryItems = (
    rows: (typeof listingMetricSnapshots.$inferSelect)[]
): ListingMetricHistoryItem[] => {
    const ascendingRows = [...rows].sort((left, right) =>
        left.observedDate.localeCompare(right.observedDate)
    );
    const salesMetrics = deriveListingHistorySales(
        ascendingRows.map((row) => ({
            endingTimestamp: row.endingTimestamp,
            quantity: row.quantity,
        }))
    );
    const ascendingItems = ascendingRows.map((row, index) =>
        toHistoryItem({
            row,
            estimatedSoldCount: salesMetrics[index]?.estimatedSoldCount ?? 0,
            estimatedSoldDelta: salesMetrics[index]?.estimatedSoldDelta ?? 0,
        })
    );

    return ascendingItems.reverse();
};

export const getListingMetricHistory = async (params: {
    accountId: string;
    trackedListingId: string;
    days?: number;
    fromObservedDate?: string;
    toObservedDate?: string;
}): Promise<ListingMetricHistory> => {
    const historyWindow = resolveHistoryWindow({
        days: params.days,
        fromObservedDate: params.fromObservedDate,
        toObservedDate: params.toObservedDate,
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
                gte(listingMetricSnapshots.observedDate, historyWindow.fromObservedDate),
                lte(listingMetricSnapshots.observedDate, historyWindow.toObservedDate)
            )
        )
        .orderBy(desc(listingMetricSnapshots.observedDate));

    return {
        listingId: listing.listingId,
        etsyListingId: listing.etsyListingId,
        title: listing.title,
        days: historyWindow.days,
        fromObservedDate: historyWindow.fromObservedDate,
        toObservedDate: historyWindow.toObservedDate,
        items: toHistoryItems(rows),
    };
};
