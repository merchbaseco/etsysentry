import type { PgBoss } from 'pg-boss';
import {
    SYNC_LISTING_JOB_NAME,
    type SyncListingJobInput
} from '../../jobs/sync-listing-shared';

export const enqueueSyncListingJob = async (params: {
    boss: Pick<PgBoss, 'send'>;
    payload: SyncListingJobInput;
}): Promise<string | null> => {
    return params.boss.send(SYNC_LISTING_JOB_NAME, params.payload, {
        retryLimit: 0,
        singletonKey: `${params.payload.accountId}:${params.payload.etsyListingId}`
    });
};
