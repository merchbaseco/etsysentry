import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import { getDashboardJobCounts } from '../dashboard/get-dashboard-job-counts';
import { sendRealtimeEvent } from '../realtime/emit-event';

export type TrackedListingSyncState = (typeof trackedListings.$inferSelect)['syncState'];

export const isTrackedListingSyncInFlight = (syncState: TrackedListingSyncState): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const emitTrackedListingsSyncStatePush = (params: {
    accountId: string;
    listingIds: string[];
    syncState: TrackedListingSyncState;
}): void => {
    sendRealtimeEvent({
        type: 'sync-state.push',
        entity: 'listing',
        ids: Object.fromEntries(
            params.listingIds.map((listingId) => [listingId, params.syncState] as const)
        ),
        accountId: params.accountId,
    });
};

const emitDashboardSummaryPushBestEffort = (params: { accountId: string }): void => {
    getDashboardJobCounts({
        accountId: params.accountId,
    })
        .then((jobCounts) => {
            sendRealtimeEvent({
                type: 'dashboard-summary.push',
                accountId: params.accountId,
                jobCounts,
            });
        })
        .catch(() => {
            // Dashboard summary polling still refreshes every 60 seconds.
        });
};

const buildSyncStateUpdate = (syncState: TrackedListingSyncState) => {
    return {
        syncState,
    };
};

export const setTrackedListingSyncStateByListingId = async (params: {
    accountId: string;
    syncState: TrackedListingSyncState;
    trackedListingId: string;
}): Promise<boolean> => {
    const rows = await db
        .update(trackedListings)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.listingId, params.trackedListingId)
            )
        )
        .returning({
            listingId: trackedListings.listingId,
        });

    if (rows.length === 0) {
        return false;
    }

    emitTrackedListingsSyncStatePush({
        accountId: params.accountId,
        listingIds: rows.map((row) => row.listingId),
        syncState: params.syncState,
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId,
    });

    return true;
};

export const setTrackedListingsSyncStateByListingIds = async (params: {
    accountId: string;
    syncState: TrackedListingSyncState;
    trackedListingIds: string[];
}): Promise<number> => {
    const uniqueTrackedListingIds = Array.from(new Set(params.trackedListingIds));

    if (uniqueTrackedListingIds.length === 0) {
        return 0;
    }

    const rows = await db
        .update(trackedListings)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                inArray(trackedListings.listingId, uniqueTrackedListingIds)
            )
        )
        .returning({
            listingId: trackedListings.listingId,
        });

    if (rows.length === 0) {
        return 0;
    }

    emitTrackedListingsSyncStatePush({
        accountId: params.accountId,
        listingIds: rows.map((row) => row.listingId),
        syncState: params.syncState,
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId,
    });

    return rows.length;
};

export const setTrackedListingsSyncStateByEtsyListingIds = async (params: {
    accountId: string;
    etsyListingIds: string[];
    syncState: TrackedListingSyncState;
}): Promise<number> => {
    const uniqueEtsyListingIds = Array.from(new Set(params.etsyListingIds));

    if (uniqueEtsyListingIds.length === 0) {
        return 0;
    }

    const rows = await db
        .update(trackedListings)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                inArray(trackedListings.etsyListingId, uniqueEtsyListingIds)
            )
        )
        .returning({
            listingId: trackedListings.listingId,
        });

    if (rows.length === 0) {
        return 0;
    }

    emitTrackedListingsSyncStatePush({
        accountId: params.accountId,
        listingIds: rows.map((row) => row.listingId),
        syncState: params.syncState,
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId,
    });

    return rows.length;
};
