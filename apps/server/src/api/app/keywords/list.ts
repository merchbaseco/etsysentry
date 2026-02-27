import { z } from 'zod';
import { listTrackedKeywords } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsListProcedure = appProcedure.input(z.object({})).query(({ ctx }) => {
    return listTrackedKeywords({
        accountId: ctx.accountId,
    });
});
