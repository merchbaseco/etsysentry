import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots } from '../../db/schema';

export interface UpsertListingMetricSnapshotInput {
    accountId: string;
    favorerCount: number | null;
    listingId: string;
    observedAt: Date;
    priceAmount: number | null;
    priceCurrencyCode: string | null;
    priceDivisor: number | null;
    quantity: number | null;
    views: number | null;
}

type ListingMetricSnapshotInsert = Pick<
    UpsertListingMetricSnapshotInput,
    | 'accountId'
    | 'listingId'
    | 'observedAt'
    | 'views'
    | 'favorerCount'
    | 'quantity'
    | 'priceAmount'
    | 'priceDivisor'
    | 'priceCurrencyCode'
> & {
    observedDate: string;
    createdAt: Date;
    updatedAt: Date;
};

export const toUtcObservedDate = (observedAt: Date): string => {
    return observedAt.toISOString().slice(0, 10);
};

export const toListingMetricSnapshotInsert = (
    params: UpsertListingMetricSnapshotInput
): ListingMetricSnapshotInsert => {
    return {
        accountId: params.accountId,
        listingId: params.listingId,
        observedDate: toUtcObservedDate(params.observedAt),
        observedAt: params.observedAt,
        views: params.views,
        favorerCount: params.favorerCount,
        quantity: params.quantity,
        priceAmount: params.priceAmount,
        priceDivisor: params.priceDivisor,
        priceCurrencyCode: params.priceCurrencyCode,
        createdAt: params.observedAt,
        updatedAt: params.observedAt,
    };
};

export const upsertListingMetricSnapshot = async (
    params: UpsertListingMetricSnapshotInput
): Promise<void> => {
    const insertValues = toListingMetricSnapshotInsert(params);

    await db
        .insert(listingMetricSnapshots)
        .values(insertValues)
        .onConflictDoUpdate({
            target: [
                listingMetricSnapshots.accountId,
                listingMetricSnapshots.listingId,
                listingMetricSnapshots.observedDate,
            ],
            set: {
                observedAt: sql`GREATEST(
                    ${listingMetricSnapshots.observedAt},
                    excluded.observed_at
                )`,
                views: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.views
                    ELSE ${listingMetricSnapshots.views}
                END`,
                favorerCount: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.favorer_count
                    ELSE ${listingMetricSnapshots.favorerCount}
                END`,
                quantity: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.quantity
                    ELSE ${listingMetricSnapshots.quantity}
                END`,
                priceAmount: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.price_amount
                    ELSE ${listingMetricSnapshots.priceAmount}
                END`,
                priceDivisor: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.price_divisor
                    ELSE ${listingMetricSnapshots.priceDivisor}
                END`,
                priceCurrencyCode: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.price_currency_code
                    ELSE ${listingMetricSnapshots.priceCurrencyCode}
                END`,
                updatedAt: sql`CASE
                    WHEN excluded.observed_at >= ${listingMetricSnapshots.observedAt}
                        THEN excluded.updated_at
                    ELSE ${listingMetricSnapshots.updatedAt}
                END`,
            },
        });
};
