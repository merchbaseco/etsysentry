import { and, asc, eq, isNotNull, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { accounts, trackedShops } from '../../db/schema';
import {
    SYNC_STALE_SHOPS_BATCH_SIZE,
    type SyncShopJobInput,
    syncShopJobInputSchema,
} from '../../jobs/sync-shop-shared';

export const findStaleShops = async (params?: { now?: Date }): Promise<SyncShopJobInput[]> => {
    const now = params?.now ?? new Date();

    const rows = await db
        .select({
            accountId: trackedShops.accountId,
            clerkUserId: accounts.merchbaseUserId,
            trackedShopId: trackedShops.trackedShopId,
        })
        .from(trackedShops)
        .innerJoin(accounts, eq(accounts.id, trackedShops.accountId))
        .where(
            and(
                isNotNull(accounts.merchbaseUserId),
                ne(trackedShops.trackingState, 'paused'),
                eq(trackedShops.syncState, 'idle'),
                lte(trackedShops.nextSyncAt, now)
            )
        )
        .orderBy(asc(trackedShops.nextSyncAt))
        .limit(SYNC_STALE_SHOPS_BATCH_SIZE);

    const items: SyncShopJobInput[] = [];

    for (const row of rows) {
        const parsedInput = syncShopJobInputSchema.safeParse({
            accountId: row.accountId,
            clerkUserId: row.clerkUserId,
            trackedShopId: row.trackedShopId,
        });

        if (!parsedInput.success) {
            continue;
        }

        items.push(parsedInput.data);
    }

    return items;
};
