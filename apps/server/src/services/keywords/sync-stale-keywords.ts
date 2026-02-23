import type { PgBoss } from 'pg-boss';
import { enqueueSyncKeywordJob } from './enqueue-sync-keyword-job';
import { findStaleKeywords } from './find-stale-keywords';

export const syncStaleKeywords = async (params: {
    boss: Pick<PgBoss, 'send'>;
}): Promise<number> => {
    const staleKeywords = await findStaleKeywords();
    let queuedCount = 0;

    for (const staleKeyword of staleKeywords) {
        const jobId = await enqueueSyncKeywordJob({
            boss: params.boss,
            payload: staleKeyword
        });

        if (jobId) {
            queuedCount += 1;
        }
    }

    return queuedCount;
};
