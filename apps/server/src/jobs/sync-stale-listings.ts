import { syncStaleListings } from '../services/listings/sync-stale-listings';
import { defineJob } from './job-router';
import {
    SYNC_STALE_LISTINGS_CRON,
    SYNC_STALE_LISTINGS_JOB_NAME,
    syncStaleListingsJobInputSchema,
} from './sync-listing-shared';

export const syncStaleListingsJob = defineJob(SYNC_STALE_LISTINGS_JOB_NAME, {
    persistSuccess: 'didWork',
})
    .input(syncStaleListingsJobInputSchema)
    .options({
        retryLimit: 0,
        singletonKey: SYNC_STALE_LISTINGS_JOB_NAME,
    })
    .cron({
        cron: SYNC_STALE_LISTINGS_CRON,
        payload: {},
    })
    .work(async (_job, _signal, log, context) => {
        const queuedCount = await syncStaleListings({
            boss: context.boss,
        });

        if (queuedCount > 0) {
            log('Queued stale listing sync jobs.', {
                queuedCount,
            });
        }

        return {
            didWork: queuedCount > 0,
            queuedCount,
        } as const;
    });
