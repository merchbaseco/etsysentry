import { z } from 'zod';
import { syncRanksForKeyword } from '../../../services/keywords/keyword-rankings-service';
import { appProcedure } from '../../trpc';

export const keywordsSyncRanksForKeywordProcedure = appProcedure
    .input(
        z.object({
            trackedKeywordId: z.string().uuid()
        })
    )
    .mutation(async ({ ctx, input }) => {
        return syncRanksForKeyword({
            clerkUserId: ctx.user.sub,
            tenantId: ctx.tenantId,
            trackedKeywordId: input.trackedKeywordId
        });
    });
