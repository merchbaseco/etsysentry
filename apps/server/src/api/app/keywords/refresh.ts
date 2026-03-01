import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { enqueueKeywordSyncJob } from '../../../jobs/run-server-jobs';
import {
    isTrackedKeywordSyncInFlight,
    setTrackedKeywordSyncStateByKeywordId,
} from '../../../services/keywords/set-tracked-keyword-sync-state';
import { getTrackedKeyword } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsRefreshProcedure = appProcedure
    .input(
        z.object({
            trackedKeywordId: z.string().uuid(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const current = await getTrackedKeyword({
            accountId: ctx.accountId,
            trackedKeywordId: input.trackedKeywordId,
        });

        if (!current) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked keyword was not found for this account.',
            });
        }

        if (isTrackedKeywordSyncInFlight(current.syncState)) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Tracked keyword sync is already queued or in progress.',
            });
        }

        const jobId = await enqueueKeywordSyncJob({
            accountId: ctx.accountId,
            clerkUserId: ctx.user.sub,
            trackedKeywordId: input.trackedKeywordId,
        });

        if (!jobId) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Unable to queue tracked keyword sync job.',
            });
        }

        await setTrackedKeywordSyncStateByKeywordId({
            accountId: ctx.accountId,
            syncState: 'queued',
            trackedKeywordId: input.trackedKeywordId,
        });

        const updated = await getTrackedKeyword({
            accountId: ctx.accountId,
            trackedKeywordId: input.trackedKeywordId,
        });

        if (!updated) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Tracked keyword was not found for this account.',
            });
        }

        return updated;
    });
