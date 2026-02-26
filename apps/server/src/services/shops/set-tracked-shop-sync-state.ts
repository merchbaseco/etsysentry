import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShops } from '../../db/schema';
import { getDashboardJobCounts } from '../dashboard/get-dashboard-job-counts';
import { sendRealtimeEvent } from '../realtime/emit-event';

export type TrackedShopSyncState = (typeof trackedShops.$inferSelect)['syncState'];

export const isTrackedShopSyncInFlight = (syncState: TrackedShopSyncState): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const emitTrackedShopsSyncStatePush = (params: {
    accountId: string;
    trackedShopIds: string[];
    syncState: TrackedShopSyncState;
}): void => {
    sendRealtimeEvent({
        type: 'sync-state.push',
        entity: 'shop',
        ids: Object.fromEntries(
            params.trackedShopIds.map((trackedShopId) => [trackedShopId, params.syncState] as const)
        ),
        accountId: params.accountId
    });
};

const emitDashboardSummaryPushBestEffort = (params: {
    accountId: string;
}): void => {
    void getDashboardJobCounts({
        accountId: params.accountId
    })
        .then((jobCounts) => {
            sendRealtimeEvent({
                type: 'dashboard-summary.push',
                accountId: params.accountId,
                jobCounts
            });
        })
        .catch(() => {
            // Dashboard summary polling still refreshes every 60 seconds.
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

    emitTrackedShopsSyncStatePush({
        accountId: params.accountId,
        trackedShopIds: rows.map((row) => row.trackedShopId),
        syncState: params.syncState
    });
    emitDashboardSummaryPushBestEffort({
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

    emitTrackedShopsSyncStatePush({
        accountId: params.accountId,
        trackedShopIds: rows.map((row) => row.trackedShopId),
        syncState: params.syncState
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId
    });

    return rows.length;
};
