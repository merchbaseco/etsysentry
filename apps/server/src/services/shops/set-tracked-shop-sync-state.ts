import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShops } from '../../db/schema';
import { emitEvent } from '../realtime/emit-event';

export type TrackedShopSyncState = (typeof trackedShops.$inferSelect)['syncState'];

export const isTrackedShopSyncInFlight = (syncState: TrackedShopSyncState): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const emitTrackedShopsInvalidation = (params: {
    accountId: string;
}): void => {
    emitEvent({
        queries: ['app.shops.list'],
        accountId: params.accountId
    });
};

const buildSyncStateUpdate = (syncState: TrackedShopSyncState) => {
    return {
        syncState
    };
};

export const setTrackedShopSyncStateByTrackedShopId = async (params: {
    accountId: string;
    syncState: TrackedShopSyncState;
    trackedShopId: string;
}): Promise<boolean> => {
    const rows = await db
        .update(trackedShops)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.trackedShopId, params.trackedShopId)
            )
        )
        .returning({
            trackedShopId: trackedShops.trackedShopId
        });

    if (rows.length === 0) {
        return false;
    }

    emitTrackedShopsInvalidation({
        accountId: params.accountId
    });

    return true;
};

export const setTrackedShopsSyncStateByTrackedShopIds = async (params: {
    accountId: string;
    syncState: TrackedShopSyncState;
    trackedShopIds: string[];
}): Promise<number> => {
    const uniqueTrackedShopIds = Array.from(new Set(params.trackedShopIds));

    if (uniqueTrackedShopIds.length === 0) {
        return 0;
    }

    const rows = await db
        .update(trackedShops)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                inArray(trackedShops.trackedShopId, uniqueTrackedShopIds)
            )
        )
        .returning({
            trackedShopId: trackedShops.trackedShopId
        });

    if (rows.length === 0) {
        return 0;
    }

    emitTrackedShopsInvalidation({
        accountId: params.accountId
    });

    return rows.length;
};
