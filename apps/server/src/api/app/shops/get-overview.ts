import { z } from 'zod';
import { loadShopActivityOverview } from '../../../services/shops/load-shop-activity-overview';
import { appProcedure } from '../../trpc';

const getShopOverviewInputSchema = z.object({
    etsyShopId: z.string().trim().min(1),
});

export const shopsGetOverviewProcedure = appProcedure
    .input(getShopOverviewInputSchema)
    .query(({ ctx, input }) => {
        return loadShopActivityOverview({
            accountId: ctx.accountId,
            etsyShopId: input.etsyShopId,
        });
    });
