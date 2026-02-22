import { z } from 'zod';
import { trackKeyword } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsTrackProcedure = appProcedure
    .input(
        z.object({
            keyword: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        return trackKeyword({
            keywordInput: input.keyword,
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });
    });
