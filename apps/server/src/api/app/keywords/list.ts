import { z } from 'zod';
import { listTrackedKeywords } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsListProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return listTrackedKeywords({
            accountId: ctx.accountId,
            trackerClerkUserId: ctx.user.sub
        });
    });
