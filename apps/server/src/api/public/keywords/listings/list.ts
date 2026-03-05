import { z } from 'zod';
import { getDailyProductRanksForKeyword } from '../../../../services/keywords/keyword-rankings-service';
import { publicProcedure } from '../../../trpc';

export const publicKeywordsListingsListProcedure = publicProcedure
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
