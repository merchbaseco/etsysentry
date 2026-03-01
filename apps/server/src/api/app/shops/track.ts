import { z } from 'zod';
import { enqueueShopSyncJob } from '../../../jobs/run-server-jobs';
import {
    queueTrackedShopSyncIfIdleByTrackedShopId,
    setTrackedShopSyncStateByTrackedShopId,
} from '../../../services/shops/set-tracked-shop-sync-state';
import { getTrackedShop, trackShop } from '../../../services/shops/tracked-shops-service';
import { appProcedure } from '../../trpc';

export const shopsTrackProcedure = appProcedure
    .input(
        z.object({
            shop: z.string().min(1),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const response = await trackShop({
            shopInput: input.shop,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            clerkUserId: ctx.user.sub,
        });

        const claimed = await queueTrackedShopSyncIfIdleByTrackedShopId({
            accountId: ctx.accountId,
            trackedShopId: response.item.id,
        });

        if (claimed) {
            try {
                const queuedJobId = await enqueueShopSyncJob({
                    accountId: ctx.accountId,
                    clerkUserId: ctx.user.sub,
                    trackedShopId: response.item.id,
                });

                if (!queuedJobId) {
                    await setTrackedShopSyncStateByTrackedShopId({
                        accountId: ctx.accountId,
                        syncState: 'idle',
                        trackedShopId: response.item.id,
                    });
                }
            } catch (error) {
                await setTrackedShopSyncStateByTrackedShopId({
                    accountId: ctx.accountId,
                    syncState: 'idle',
                    trackedShopId: response.item.id,
                });
                throw error;
            }
        }

        const latest = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: response.item.id,
        });

        return {
            created: response.created,
            item: latest ?? response.item,
        };
    });
