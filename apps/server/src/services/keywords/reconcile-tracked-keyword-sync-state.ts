import { inArray } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';
import { SYNC_KEYWORD_JOB_NAME, type SyncKeywordJobInput } from '../../jobs/sync-keyword-shared';
import { setTrackedKeywordsSyncStateByKeywordIds } from './set-tracked-keyword-sync-state';

const liveSyncKeywordJobStates = ['active', 'created', 'retry'] as const;

type SyncKeywordJobState = (typeof liveSyncKeywordJobStates)[number] | string;

const groupKeywordIdsByAccountId = (
    rows: Array<{
        accountId: string;
        trackedKeywordId: string;
    }>
): Map<string, string[]> => {
    const keywordIdsByAccountId = new Map<string, string[]>();

    for (const row of rows) {
        const accountKeywordIds = keywordIdsByAccountId.get(row.accountId) ?? [];
        accountKeywordIds.push(row.trackedKeywordId);
        keywordIdsByAccountId.set(row.accountId, accountKeywordIds);
    }

    return keywordIdsByAccountId;
};

export const isLiveSyncKeywordJobState = (state: SyncKeywordJobState): boolean => {
    return liveSyncKeywordJobStates.includes(state as (typeof liveSyncKeywordJobStates)[number]);
};

const hasLiveSyncKeywordJob = (jobs: Array<{ state: SyncKeywordJobState }>): boolean => {
    return jobs.some((job) => isLiveSyncKeywordJobState(job.state));
};

export interface ReconcileTrackedKeywordSyncStateResult {
    checkedCount: number;
    fixedCount: number;
    liveCount: number;
    summary: string;
}

export const reconcileTrackedKeywordSyncState = async (params: {
    boss: Pick<PgBoss, 'findJobs'>;
}): Promise<ReconcileTrackedKeywordSyncStateResult> => {
    const rows = await db
        .select({
            accountId: trackedKeywords.accountId,
            trackedKeywordId: trackedKeywords.id,
            syncState: trackedKeywords.syncState,
        })
        .from(trackedKeywords)
        .where(inArray(trackedKeywords.syncState, ['queued', 'syncing']));

    const syncingKeywordRowsWithLiveJobs: typeof rows = [];
    const queuedKeywordRowsWithLiveJobs: typeof rows = [];
    const staleKeywordRows: typeof rows = [];

    for (const row of rows) {
        const jobs = await params.boss.findJobs<SyncKeywordJobInput>(SYNC_KEYWORD_JOB_NAME, {
            data: {
                accountId: row.accountId,
                trackedKeywordId: row.trackedKeywordId,
            },
        });

        if (hasLiveSyncKeywordJob(jobs)) {
            if (row.syncState === 'syncing') {
                syncingKeywordRowsWithLiveJobs.push(row);
            } else {
                queuedKeywordRowsWithLiveJobs.push(row);
            }
            continue;
        }

        staleKeywordRows.push(row);
    }

    let queuedCount = 0;
    const syncingKeywordIdsByAccountId = groupKeywordIdsByAccountId(syncingKeywordRowsWithLiveJobs);

    for (const [accountId, trackedKeywordIds] of syncingKeywordIdsByAccountId.entries()) {
        queuedCount += await setTrackedKeywordsSyncStateByKeywordIds({
            accountId,
            syncState: 'queued',
            trackedKeywordIds,
        });
    }

    let resetCount = 0;
    const staleKeywordIdsByAccountId = groupKeywordIdsByAccountId(staleKeywordRows);

    for (const [accountId, trackedKeywordIds] of staleKeywordIdsByAccountId.entries()) {
        resetCount += await setTrackedKeywordsSyncStateByKeywordIds({
            accountId,
            syncState: 'idle',
            trackedKeywordIds,
        });
    }

    const fixedCount = queuedCount + resetCount;
    const checkedCount = rows.length;
    const liveCount = syncingKeywordRowsWithLiveJobs.length + queuedKeywordRowsWithLiveJobs.length;
    const summary =
        `checked ${checkedCount} queued/syncing tracked keywords; ` +
        `kept ${queuedKeywordRowsWithLiveJobs.length} queued with live jobs; ` +
        `moved ${queuedCount} syncing to queued; reset ${resetCount} to idle`;

    return {
        checkedCount,
        fixedCount,
        liveCount,
        summary,
    };
};
