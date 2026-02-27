import { syncStaleShops } from '../services/shops/sync-stale-shops';
import { defineJob } from './job-router';
import {
    SYNC_STALE_SHOPS_CRON,
    SYNC_STALE_SHOPS_JOB_NAME,
    syncStaleShopsJobInputSchema,
} from './sync-shop-shared';

export const syncStaleShopsJob = defineJob(SYNC_STALE_SHOPS_JOB_NAME, {
    persistSuccess: 'didWork',
})
    .input(syncStaleShopsJobInputSchema)
    .options({
        retryLimit: 0,
        singletonKey: SYNC_STALE_SHOPS_JOB_NAME,
    })
    .cron({
        cron: SYNC_STALE_SHOPS_CRON,
        payload: {},
    })
    .work(async (_job, _signal, log, context) => {
        const queuedCount = await syncStaleShops({
            boss: context.boss,
        });

        if (queuedCount > 0) {
            log('Queued stale shop sync jobs.', {
                queuedCount,
            });
        }

        return {
            didWork: queuedCount > 0,
            queuedCount,
        } as const;
    });
