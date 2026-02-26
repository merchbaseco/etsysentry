import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';
import { getDashboardJobCounts } from '../dashboard/get-dashboard-job-counts';
import { sendRealtimeEvent } from '../realtime/emit-event';

export type TrackedKeywordSyncState = (typeof trackedKeywords.$inferSelect)['syncState'];

export const isTrackedKeywordSyncInFlight = (syncState: TrackedKeywordSyncState): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const emitTrackedKeywordsSyncStatePush = (params: {
    accountId: string;
    keywordIds: string[];
    syncState: TrackedKeywordSyncState;
}): void => {
    sendRealtimeEvent({
        type: 'sync-state.push',
        entity: 'keyword',
        ids: Object.fromEntries(
            params.keywordIds.map((keywordId) => [keywordId, params.syncState] as const)
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

const buildSyncStateUpdate = (syncState: TrackedKeywordSyncState) => {
    return {
        syncState
    };
};

export const setTrackedKeywordSyncStateByKeywordId = async (params: {
    accountId: string;
    syncState: TrackedKeywordSyncState;
    trackedKeywordId: string;
}): Promise<boolean> => {
    const rows = await db
        .update(trackedKeywords)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedKeywords.accountId, params.accountId),
                eq(trackedKeywords.id, params.trackedKeywordId)
            )
        )
        .returning({
            id: trackedKeywords.id
        });

    if (rows.length === 0) {
        return false;
    }

    emitTrackedKeywordsSyncStatePush({
        accountId: params.accountId,
        keywordIds: rows.map((row) => row.id),
        syncState: params.syncState
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId
    });

    return true;
};

export const setTrackedKeywordsSyncStateByKeywordIds = async (params: {
    accountId: string;
    syncState: TrackedKeywordSyncState;
    trackedKeywordIds: string[];
}): Promise<number> => {
    const uniqueTrackedKeywordIds = Array.from(new Set(params.trackedKeywordIds));

    if (uniqueTrackedKeywordIds.length === 0) {
        return 0;
    }

    const rows = await db
        .update(trackedKeywords)
        .set(buildSyncStateUpdate(params.syncState))
        .where(
            and(
                eq(trackedKeywords.accountId, params.accountId),
                inArray(trackedKeywords.id, uniqueTrackedKeywordIds)
            )
        )
        .returning({
            id: trackedKeywords.id
        });

    if (rows.length === 0) {
        return 0;
    }

    emitTrackedKeywordsSyncStatePush({
        accountId: params.accountId,
        keywordIds: rows.map((row) => row.id),
        syncState: params.syncState
    });
    emitDashboardSummaryPushBestEffort({
        accountId: params.accountId
    });

    return rows.length;
};
