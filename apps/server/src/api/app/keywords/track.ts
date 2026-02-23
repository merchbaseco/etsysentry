import { z } from 'zod';
import { enqueueKeywordSyncJob } from '../../../jobs/sync-keyword-jobs';
import { trackKeyword } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsTrackProcedure = appProcedure
    .input(
        z.object({
            keyword: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        const trackedKeyword = await trackKeyword({
            keywordInput: input.keyword,
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });

        await enqueueKeywordSyncJob({
            clerkUserId: trackedKeyword.item.trackerClerkUserId,
            tenantId: trackedKeyword.item.tenantId,
            trackedKeywordId: trackedKeyword.item.id
        });

        return trackedKeyword;
    });
