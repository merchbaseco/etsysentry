import { z } from 'zod';
import { listTrackedShops } from '../../../services/shops/tracked-shops-service';
import { appProcedure } from '../../trpc';

export const shopsListProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return listTrackedShops({
            accountId: ctx.accountId
        });
    });
