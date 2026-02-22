import { z } from 'zod';
import { getDailyProductRanksForKeyword } from '../../../services/keywords/keyword-rankings-service';
import { appProcedure } from '../../trpc';

export const keywordsGetDailyProductRanksForKeywordProcedure = appProcedure
    .input(
        z.object({
            trackedKeywordId: z.string().uuid()
        })
    )
    .query(async ({ ctx, input }) => {
        return getDailyProductRanksForKeyword({
            tenantId: ctx.tenantId,
            trackedKeywordId: input.trackedKeywordId
        });
    });
