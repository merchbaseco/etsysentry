import { TRPCError } from '@trpc/server';
import { enqueueShopSyncJob } from '../../../jobs/sync-keyword-jobs';
import { z } from 'zod';
import {
    getTrackedShop
} from '../../../services/shops/tracked-shops-service';
import {
    isTrackedShopSyncInFlight,
    setTrackedShopSyncStateByTrackedShopId
} from '../../../services/shops/set-tracked-shop-sync-state';
import { appProcedure } from '../../trpc';

export const shopsRefreshProcedure = appProcedure
    .input(
        z.object({
            trackedShopId: z.string().uuid()
        })
    )
    .mutation(async ({ ctx, input }) => {
        const current = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: input.trackedShopId
        });

        if (!current) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked shop was not found for this account.'
            });
        }

        if (isTrackedShopSyncInFlight(current.syncState)) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Tracked shop sync is already queued or in progress.'
            });
        }

        const jobId = await enqueueShopSyncJob({
            accountId: ctx.accountId,
            clerkUserId: ctx.user.sub,
            trackedShopId: input.trackedShopId
        });

        if (!jobId) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Unable to queue tracked shop sync job.'
            });
        }

        await setTrackedShopSyncStateByTrackedShopId({
            accountId: ctx.accountId,
            syncState: 'queued',
            trackedShopId: input.trackedShopId
        });

        const updated = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: input.trackedShopId
        });

        if (!updated) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked shop was not found for this account.'
            });
        }

        return updated;
    });
