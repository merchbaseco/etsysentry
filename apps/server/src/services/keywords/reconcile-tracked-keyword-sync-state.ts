import type { PgBoss } from 'pg-boss';
import { inArray } from 'drizzle-orm';
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

export type ReconcileTrackedKeywordSyncStateResult = {
    checkedCount: number;
    fixedCount: number;
    liveCount: number;
    summary: string;
};

export const reconcileTrackedKeywordSyncState = async (params: {
    boss: Pick<PgBoss, 'findJobs'>;
}): Promise<ReconcileTrackedKeywordSyncStateResult> => {
    const rows = await db
        .select({
            accountId: trackedKeywords.accountId,
            trackedKeywordId: trackedKeywords.id
        })
        .from(trackedKeywords)
        .where(inArray(trackedKeywords.syncState, ['queued', 'syncing']));

    const keywordRowsWithLiveJobs: typeof rows = [];
    const staleKeywordRows: typeof rows = [];

    for (const row of rows) {
        const jobs = await params.boss.findJobs<SyncKeywordJobInput>(SYNC_KEYWORD_JOB_NAME, {
            data: {
                accountId: row.accountId,
                trackedKeywordId: row.trackedKeywordId
            }
        });

        if (hasLiveSyncKeywordJob(jobs)) {
            keywordRowsWithLiveJobs.push(row);
            continue;
        }

        staleKeywordRows.push(row);
    }

    let fixedCount = 0;
    const staleKeywordIdsByAccountId = groupKeywordIdsByAccountId(staleKeywordRows);

    for (const [accountId, trackedKeywordIds] of staleKeywordIdsByAccountId.entries()) {
        fixedCount += await setTrackedKeywordsSyncStateByKeywordIds({
            accountId,
            syncState: 'idle',
            trackedKeywordIds
        });
    }

    const checkedCount = rows.length;
    const liveCount = keywordRowsWithLiveJobs.length;
    const summary =
        `checked ${checkedCount} queued/syncing tracked keywords; ` +
        `kept ${liveCount} with live jobs; reset ${fixedCount} to idle`;

    return {
        checkedCount,
        fixedCount,
        liveCount,
        summary
    };
};
