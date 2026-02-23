import { defineJob } from './job-router';
import {
    SYNC_STALE_KEYWORDS_CRON,
    SYNC_STALE_KEYWORDS_JOB_NAME,
    syncStaleKeywordsJobInputSchema
} from './sync-keyword-shared';
import { syncStaleKeywords } from '../services/keywords/sync-stale-keywords';

export const syncStaleKeywordsJob = defineJob(SYNC_STALE_KEYWORDS_JOB_NAME, {
    persistSuccess: 'didWork'
})
    .input(syncStaleKeywordsJobInputSchema)
    .options({
        retryLimit: 0,
        singletonKey: SYNC_STALE_KEYWORDS_JOB_NAME
    })
    .cron({
        cron: SYNC_STALE_KEYWORDS_CRON,
        payload: {}
    })
    .work(async (job, signal, log, context) => {
        void job;
        void signal;

        const queuedCount = await syncStaleKeywords({
            boss: context.boss
        });

        if (queuedCount > 0) {
            log('Queued stale keyword sync jobs.', {
                queuedCount
            });
        }

        return {
            didWork: queuedCount > 0,
            queuedCount
        } as const;
    });
