import { z } from 'zod';
import { listTrackedShops } from '../../../services/shops/tracked-shops-service';
import { publicProcedure } from '../../trpc';

export const publicShopsListProcedure = publicProcedure.input(z.object({})).query(({ ctx }) => {
    return listTrackedShops({
        accountId: ctx.accountId,
    });
});
