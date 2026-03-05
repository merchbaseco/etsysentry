import { z } from 'zod';
import { loadShopActivityOverview } from '../../../../services/shops/load-shop-activity-overview';
import { publicProcedure } from '../../../trpc';

const publicShopsOverviewGetInputSchema = z.object({
    etsyShopId: z.string().trim().min(1),
});

export const publicShopsOverviewGetProcedure = publicProcedure
    .input(publicShopsOverviewGetInputSchema)
    .query(({ ctx, input }) => {
        return loadShopActivityOverview({
            accountId: ctx.accountId,
            etsyShopId: input.etsyShopId,
        });
    });
