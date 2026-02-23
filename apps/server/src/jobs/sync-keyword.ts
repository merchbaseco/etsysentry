import { defineJob } from './job-router';
import {
    SYNC_KEYWORD_JOB_NAME,
    syncKeywordJobInputSchema
} from './sync-keyword-shared';
import { syncRanksForKeyword } from '../services/keywords/keyword-rankings-service';

export const syncKeywordJob = defineJob(SYNC_KEYWORD_JOB_NAME, {
    persistSuccess: 'didWork',
    startupSummary: 'triggered by stale keyword sync job'
})
    .input(syncKeywordJobInputSchema)
    .work(async (job, signal, log) => {
        void signal;

        await syncRanksForKeyword({
            clerkUserId: job.data.clerkUserId,
            tenantId: job.data.tenantId,
            trackedKeywordId: job.data.trackedKeywordId
        });

        log('Synced keyword ranks.', {
            trackedKeywordId: job.data.trackedKeywordId
        });

        return {
            didWork: true,
            trackedKeywordId: job.data.trackedKeywordId
        } as const;
    });
