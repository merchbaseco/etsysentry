import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShopSnapshots, trackedShops } from '../../db/schema';
import { createEventLog } from '../logs/create-event-log';
import { resolveShopFromInput } from './resolve-shop-input';
import { type TrackedShopRecord, toTrackedShopRecord } from './types';

const getLatestSnapshotByTrackedShopId = async (params: {
    accountId: string;
    trackedShopIds: string[];
}): Promise<Map<string, typeof trackedShopSnapshots.$inferSelect>> => {
    if (params.trackedShopIds.length === 0) {
        return new Map();
    }

    const rows = await db
        .select()
        .from(trackedShopSnapshots)
        .where(
            and(
                eq(trackedShopSnapshots.accountId, params.accountId),
                inArray(trackedShopSnapshots.trackedShopId, params.trackedShopIds)
            )
        )
        .orderBy(desc(trackedShopSnapshots.observedAt));

    const latestByTrackedShopId = new Map<string, typeof trackedShopSnapshots.$inferSelect>();

    for (const row of rows) {
        if (!latestByTrackedShopId.has(row.trackedShopId)) {
            latestByTrackedShopId.set(row.trackedShopId, row);
        }
    }

    return latestByTrackedShopId;
};

export const listTrackedShops = async (params: {
    accountId: string;
}): Promise<{ items: TrackedShopRecord[] }> => {
    const shopRows = await db
        .select()
        .from(trackedShops)
        .where(eq(trackedShops.accountId, params.accountId))
        .orderBy(desc(trackedShops.updatedAt));

    const latestSnapshotsByTrackedShopId = await getLatestSnapshotByTrackedShopId({
        accountId: params.accountId,
        trackedShopIds: shopRows.map((row) => row.trackedShopId),
    });

    return {
        items: shopRows.map((row) =>
            toTrackedShopRecord({
                row,
                latestSnapshot: latestSnapshotsByTrackedShopId.get(row.trackedShopId) ?? null,
            })
        ),
    };
};

export const getTrackedShop = async (params: {
    accountId: string;
    trackedShopId: string;
}): Promise<TrackedShopRecord | null> => {
    const [shopRow] = await db
        .select()
        .from(trackedShops)
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.trackedShopId, params.trackedShopId)
            )
        )
        .limit(1);

    if (!shopRow) {
        return null;
    }

    const [latestSnapshot] = await db
        .select()
        .from(trackedShopSnapshots)
        .where(
            and(
                eq(trackedShopSnapshots.accountId, params.accountId),
                eq(trackedShopSnapshots.trackedShopId, params.trackedShopId)
            )
        )
        .orderBy(desc(trackedShopSnapshots.observedAt))
        .limit(1);

    return toTrackedShopRecord({
        row: shopRow,
        latestSnapshot: latestSnapshot ?? null,
    });
};

export const trackShop = async (params: {
    shopInput: string;
    requestId?: string;
    accountId: string;
    clerkUserId: string;
}): Promise<{
    created: boolean;
    item: TrackedShopRecord;
}> => {
    const resolvedShop = await resolveShopFromInput({
        shopInput: params.shopInput,
        clerkUserId: params.clerkUserId,
        accountId: params.accountId,
    });

    const [existing] = await db
        .select({
            trackedShopId: trackedShops.trackedShopId,
        })
        .from(trackedShops)
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.etsyShopId, resolvedShop.shopId)
            )
        )
        .limit(1);

    const now = new Date();
    const insertValues = {
        accountId: params.accountId,
        etsyShopId: resolvedShop.shopId,
        shopName: resolvedShop.shopName,
        shopUrl: resolvedShop.url,
        trackingState: 'active' as const,
        syncState: 'idle' as const,
        lastRefreshedAt: now,
        nextSyncAt: now,
        lastRefreshError: null,
        updatedAt: now,
    };

    const [row] = await db
        .insert(trackedShops)
        .values(insertValues)
        .onConflictDoUpdate({
            set: {
                shopName: insertValues.shopName,
                shopUrl: insertValues.shopUrl,
                trackingState: insertValues.trackingState,
                nextSyncAt: insertValues.nextSyncAt,
                lastRefreshError: null,
                updatedAt: insertValues.updatedAt,
            },
            target: [trackedShops.accountId, trackedShops.etsyShopId],
        })
        .returning();

    const item = toTrackedShopRecord({
        row,
        latestSnapshot: null,
    });
    const created = !existing;

    await createEventLog({
        action: created ? 'shop.tracked' : 'shop.updated',
        category: 'shop',
        clerkUserId: params.clerkUserId,
        detailsJson: {
            activeListingCount: resolvedShop.activeListingCount,
            favoritesTotal: resolvedShop.numFavorers,
            reviewTotal: resolvedShop.reviewCount,
            soldTotal: resolvedShop.soldCount,
        },
        level: 'info',
        message: created
            ? `Started tracking shop ${item.shopName} (${item.etsyShopId}).`
            : `Updated tracked shop ${item.shopName} (${item.etsyShopId}).`,
        primitiveId: item.id,
        primitiveType: 'shop',
        requestId: params.requestId ?? null,
        shopId: item.etsyShopId,
        status: 'success',
        accountId: item.accountId,
    });

    return {
        created,
        item,
    };
};
