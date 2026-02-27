import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { enqueueShopSyncJob } from '../../../jobs/sync-keyword-jobs';
import { findLatestClerkUserIdByAccountId } from '../../../services/auth/find-latest-clerk-user-id-by-account-id';
import { setTrackedShopSyncStateByTrackedShopId } from '../../../services/shops/set-tracked-shop-sync-state';
import { getTrackedShop, trackShop } from '../../../services/shops/tracked-shops-service';
import { publicProcedure } from '../../trpc';

export const publicShopsTrackProcedure = publicProcedure
    .input(
        z.object({
            shop: z.string().min(1),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const clerkUserId = await findLatestClerkUserIdByAccountId({
            accountId: ctx.accountId,
        });

        if (!clerkUserId) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No Clerk identity is linked to this account.',
            });
        }

        const response = await trackShop({
            shopInput: input.shop,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            clerkUserId,
        });

        const queuedJobId = await enqueueShopSyncJob({
            accountId: ctx.accountId,
            clerkUserId,
            trackedShopId: response.item.id,
        });

        if (queuedJobId) {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: ctx.accountId,
                syncState: 'queued',
                trackedShopId: response.item.id,
            });
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
