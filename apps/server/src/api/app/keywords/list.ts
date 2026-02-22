import { z } from 'zod';
import { listTrackedKeywords } from '../../../services/keywords/tracked-keywords-service';
import { appProcedure } from '../../trpc';

export const keywordsListProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return listTrackedKeywords({
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });
    });
