import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { enqueueShopSyncJob } from '../../../jobs/run-server-jobs';
import {
    isTrackedShopSyncInFlight,
    queueTrackedShopSyncIfIdleByTrackedShopId,
    setTrackedShopSyncStateByTrackedShopId,
} from '../../../services/shops/set-tracked-shop-sync-state';
import { getTrackedShop } from '../../../services/shops/tracked-shops-service';
import { appProcedure } from '../../trpc';

export const shopsRefreshProcedure = appProcedure
    .input(
        z.object({
            trackedShopId: z.string().uuid(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const current = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: input.trackedShopId,
        });

        if (!current) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked shop was not found for this account.',
            });
        }

        if (isTrackedShopSyncInFlight(current.syncState)) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Tracked shop sync is already queued or in progress.',
            });
        }

        const claimed = await queueTrackedShopSyncIfIdleByTrackedShopId({
            accountId: ctx.accountId,
            trackedShopId: input.trackedShopId,
        });

        if (!claimed) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Tracked shop sync is already queued or in progress.',
            });
        }

        let jobId: string | null;

        try {
            jobId = await enqueueShopSyncJob({
                accountId: ctx.accountId,
                clerkUserId: ctx.user.sub,
                trackedShopId: input.trackedShopId,
            });
        } catch (error) {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: ctx.accountId,
                syncState: 'idle',
                trackedShopId: input.trackedShopId,
            });
            throw error;
        }

        if (!jobId) {
            await setTrackedShopSyncStateByTrackedShopId({
                accountId: ctx.accountId,
                syncState: 'idle',
                trackedShopId: input.trackedShopId,
            });

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Unable to queue tracked shop sync job.',
            });
        }

        const updated = await getTrackedShop({
            accountId: ctx.accountId,
            trackedShopId: input.trackedShopId,
        });

        if (!updated) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked shop was not found for this account.',
            });
        }

        return updated;
    });
