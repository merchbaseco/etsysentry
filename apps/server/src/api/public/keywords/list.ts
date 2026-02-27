import { z } from 'zod';
import { listTrackedKeywords } from '../../../services/keywords/tracked-keywords-service';
import { publicProcedure } from '../../trpc';

export const publicKeywordsListProcedure = publicProcedure.input(z.object({})).query(({ ctx }) => {
    return listTrackedKeywords({
        accountId: ctx.accountId,
    });
});
