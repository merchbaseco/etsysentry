import type { PgBoss } from 'pg-boss';
import {
    SYNC_SHOP_JOB_NAME,
    type SyncShopJobInput
} from '../../jobs/sync-shop-shared';

export const enqueueSyncShopJob = async (params: {
    boss: Pick<PgBoss, 'send'>;
    payload: SyncShopJobInput;
}): Promise<string | null> => {
    return params.boss.send(SYNC_SHOP_JOB_NAME, params.payload, {
        retryLimit: 0
    });
};
