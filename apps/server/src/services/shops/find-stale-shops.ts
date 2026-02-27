import { and, asc, eq, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShops } from '../../db/schema';
import {
    SYNC_STALE_SHOPS_BATCH_SIZE,
    type SyncShopJobInput,
    syncShopJobInputSchema,
} from '../../jobs/sync-shop-shared';
import { findLatestClerkUserIdByAccountId } from '../auth/find-latest-clerk-user-id-by-account-id';

export const findStaleShops = async (params?: { now?: Date }): Promise<SyncShopJobInput[]> => {
    const now = params?.now ?? new Date();

    const rows = await db
        .select({
            accountId: trackedShops.accountId,
            trackedShopId: trackedShops.trackedShopId,
        })
        .from(trackedShops)
        .where(
            and(
                ne(trackedShops.trackingState, 'paused'),
                eq(trackedShops.syncState, 'idle'),
                lte(trackedShops.nextSyncAt, now)
            )
        )
        .orderBy(asc(trackedShops.nextSyncAt))
        .limit(SYNC_STALE_SHOPS_BATCH_SIZE);

    const clerkUserIdByAccount = new Map<string, string | null>();
    const items: SyncShopJobInput[] = [];

    for (const row of rows) {
        const cachedClerkUserId = clerkUserIdByAccount.get(row.accountId);
        const clerkUserId =
            cachedClerkUserId === undefined
                ? await findLatestClerkUserIdByAccountId({
                      accountId: row.accountId,
                  })
                : cachedClerkUserId;

        clerkUserIdByAccount.set(row.accountId, clerkUserId);

        if (!clerkUserId) {
            continue;
        }

        const parsedInput = syncShopJobInputSchema.safeParse({
            accountId: row.accountId,
            clerkUserId,
            trackedShopId: row.trackedShopId,
        });

        if (!parsedInput.success) {
            continue;
        }

        items.push(parsedInput.data);
    }

    return items;
};
