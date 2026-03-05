import { listTrackedShops } from '../../../services/shops/tracked-shops-service';
import { publicProcedure } from '../../trpc';
import { filterPublicShopItems, publicShopsListInputSchema } from '../list-filters';

export const publicShopsListProcedure = publicProcedure
    .input(publicShopsListInputSchema)
    .query(async ({ ctx, input }) => {
        const response = await listTrackedShops({
            accountId: ctx.accountId,
        });

        return {
            items: filterPublicShopItems(response.items, input),
        };
    });
