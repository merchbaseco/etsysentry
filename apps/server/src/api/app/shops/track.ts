import { enqueueShopSyncJob } from '../../../jobs/sync-keyword-jobs';
import { z } from 'zod';
import {
    getTrackedShop,
    trackShop
} from '../../../services/shops/tracked-shops-service';
import { setTrackedShopSyncStateByTrackedShopId } from '../../../services/shops/set-tracked-shop-sync-state';
import { appProcedure } from '../../trpc';

export const shopsTrackProcedure = appProcedure
    .input(
        z.object({
            shop: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        const response = await trackShop({
            shopInput: input.shop,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            clerkUserId: ctx.user.sub
        });

        const queuedJobId = await enqueueShopSyncJob({
            accountId: ctx.accountId,
            clerkUserId: ctx.user.sub,
            trackedShopId: response.item.id
        });

        if (queuedJobId) {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: ctx.accountId,
                syncState: 'queued',
                trackedShopId: response.item.id
            });
        }

        const latest = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: response.item.id
        });

        return {
            created: response.created,
            item: latest ?? response.item
        };
    });
