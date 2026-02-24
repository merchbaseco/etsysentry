import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShopListings } from '../../db/schema';
import { emitEvent } from '../realtime/emit-event';

export const setTrackedShopListingActivityByEtsyListingId = async (params: {
    accountId: string;
    etsyListingId: string;
    isActive: boolean;
}): Promise<number> => {
    const now = new Date();

    const rows = await db
        .update(trackedShopListings)
        .set({
            isActive: params.isActive,
            lastChangedAt: sql`CASE
                WHEN ${trackedShopListings.isActive} = ${params.isActive}
                    THEN ${trackedShopListings.lastChangedAt}
                ELSE ${now}
            END`,
            updatedAt: now
        })
        .where(
            and(
                eq(trackedShopListings.accountId, params.accountId),
                eq(trackedShopListings.etsyListingId, params.etsyListingId)
            )
        )
        .returning({
            id: trackedShopListings.id
        });

    if (rows.length > 0) {
        emitEvent({
            queries: ['app.shops.list'],
            accountId: params.accountId
        });
    }

    return rows.length;
};
