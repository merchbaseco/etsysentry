import { z } from 'zod';
import { loadShopActivityOverview } from '../../../services/shops/load-shop-activity-overview';
import { publicProcedure } from '../../trpc';

const publicShopsGetOverviewInputSchema = z.object({
    etsyShopId: z.string().trim().min(1),
});

export const publicShopsGetOverviewProcedure = publicProcedure
    .input(publicShopsGetOverviewInputSchema)
    .query(({ ctx, input }) => {
        return loadShopActivityOverview({
            accountId: ctx.accountId,
            etsyShopId: input.etsyShopId,
        });
    });
