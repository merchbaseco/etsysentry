import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';
import { emitEvent } from '../realtime/emit-event';

export type TrackedKeywordSyncState = (typeof trackedKeywords.$inferSelect)['syncState'];

export const isTrackedKeywordSyncInFlight = (syncState: TrackedKeywordSyncState): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const emitTrackedKeywordsInvalidation = (params: {
    accountId: string;
}): void => {
    emitEvent({
        queries: ['app.keywords.list'],
        accountId: params.accountId
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

    emitTrackedKeywordsInvalidation({
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

    emitTrackedKeywordsInvalidation({
        accountId: params.accountId
    });

    return rows.length;
};
