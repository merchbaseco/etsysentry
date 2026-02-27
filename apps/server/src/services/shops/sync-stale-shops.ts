import type { PgBoss } from 'pg-boss';
import { enqueueSyncShopJob } from './enqueue-sync-shop-job';
import { findStaleShops } from './find-stale-shops';

export const syncStaleShops = async (params: { boss: Pick<PgBoss, 'send'> }): Promise<number> => {
    const staleShops = await findStaleShops();
    let queuedCount = 0;

    for (const staleShop of staleShops) {
        const jobId = await enqueueSyncShopJob({
            boss: params.boss,
            payload: staleShop,
        });

        if (jobId) {
            queuedCount += 1;
        }
    }

    return queuedCount;
};
