import type { PgBoss } from 'pg-boss';
import { enqueueSyncKeywordJob } from './enqueue-sync-keyword-job';
import { findStaleKeywords } from './find-stale-keywords';
import { setTrackedKeywordsSyncStateByKeywordIds } from './set-tracked-keyword-sync-state';

export const syncStaleKeywords = async (params: {
    boss: Pick<PgBoss, 'send'>;
}): Promise<number> => {
    const staleKeywords = await findStaleKeywords();
    let queuedCount = 0;
    const queuedKeywordIdsByAccountId = new Map<string, string[]>();

    for (const staleKeyword of staleKeywords) {
        const jobId = await enqueueSyncKeywordJob({
            boss: params.boss,
            payload: staleKeyword
        });

        if (jobId) {
            queuedCount += 1;
            const accountKeywordIds = queuedKeywordIdsByAccountId.get(staleKeyword.accountId) ?? [];
            accountKeywordIds.push(staleKeyword.trackedKeywordId);
            queuedKeywordIdsByAccountId.set(staleKeyword.accountId, accountKeywordIds);
        }
    }

    for (const [accountId, trackedKeywordIds] of queuedKeywordIdsByAccountId.entries()) {
        await setTrackedKeywordsSyncStateByKeywordIds({
            accountId,
            trackedKeywordIds,
            syncState: 'queued'
        });
    }

    return queuedCount;
};
