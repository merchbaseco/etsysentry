import type { PgBoss } from 'pg-boss';
import { enqueueSyncShopJob } from './enqueue-sync-shop-job';
import { findStaleShops } from './find-stale-shops';
import {
    queueTrackedShopSyncIfIdleByTrackedShopId,
    setTrackedShopSyncStateByTrackedShopId,
} from './set-tracked-shop-sync-state';

export const syncStaleShops = async (params: { boss: Pick<PgBoss, 'send'> }): Promise<number> => {
    const staleShops = await findStaleShops();
    let queuedCount = 0;

    for (const staleShop of staleShops) {
        const claimed = await queueTrackedShopSyncIfIdleByTrackedShopId({
            accountId: staleShop.accountId,
            trackedShopId: staleShop.trackedShopId,
        });

        if (!claimed) {
            continue;
        }

        try {
            const jobId = await enqueueSyncShopJob({
                boss: params.boss,
                payload: staleShop,
            });

            if (jobId) {
                queuedCount += 1;
                continue;
            }
        } catch (error) {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: staleShop.accountId,
                syncState: 'idle',
                trackedShopId: staleShop.trackedShopId,
            });
            throw error;
        }

        await setTrackedShopSyncStateByTrackedShopId({
            accountId: staleShop.accountId,
            syncState: 'idle',
            trackedShopId: staleShop.trackedShopId,
        });
    }

    return queuedCount;
};
