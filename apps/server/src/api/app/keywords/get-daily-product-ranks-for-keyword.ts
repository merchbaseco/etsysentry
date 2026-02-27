import { z } from 'zod';
import { getDailyProductRanksForKeyword } from '../../../services/keywords/keyword-rankings-service';
import { appProcedure } from '../../trpc';

export const keywordsGetDailyProductRanksForKeywordProcedure = appProcedure
    .input(
        z.object({
            trackedKeywordId: z.string().uuid(),
        })
    )
    .query(({ ctx, input }) => {
        return getDailyProductRanksForKeyword({
            accountId: ctx.accountId,
            trackedKeywordId: input.trackedKeywordId,
        });
    });
