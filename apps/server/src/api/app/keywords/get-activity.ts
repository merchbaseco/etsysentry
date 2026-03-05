import { z } from 'zod';
import { getKeywordActivity } from '../../../services/keywords/get-keyword-activity';
import { appProcedure } from '../../trpc';

export const keywordsGetActivityProcedure = appProcedure
    .input(
        z.object({
            days: z.number().int().min(1).max(30).optional(),
            trackedKeywordId: z.string().uuid(),
        })
    )
    .query(({ ctx, input }) => {
        return getKeywordActivity({
            accountId: ctx.accountId,
            days: input.days,
            trackedKeywordId: input.trackedKeywordId,
        });
    });
